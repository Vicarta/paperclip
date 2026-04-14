import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { eq } from "drizzle-orm";
import { createDb } from "../../packages/db/src/index.ts";
import { plugins } from "../../packages/db/src/schema/plugins.ts";

type Options = {
  apply: boolean;
  pluginKey: string | null;
  strict: boolean;
};

type PluginManifest = Record<string, unknown> & {
  id: string;
  version: string;
  apiVersion: number;
};

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    apply: false,
    pluginKey: null,
    strict: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") {
      opts.apply = true;
      continue;
    }
    if (arg === "--strict") {
      opts.strict = true;
      continue;
    }
    if (arg === "--plugin-key") {
      opts.pluginKey = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log(
        [
          "Usage: tsx server/scripts/refresh-bundled-plugin-manifests.ts [--apply] [--plugin-key <pluginKey>] [--strict]",
          "",
          "Dry-run by default. Requires DATABASE_URL for DB access.",
          "--apply        Persist refreshed manifest_json rows",
          "--plugin-key   Restrict refresh to one installed plugin",
          "--strict       Exit non-zero if a package path or manifest file is missing",
        ].join("\n"),
      );
      process.exit(0);
    }
  }

  return opts;
}

async function readPackageJson(packagePath: string): Promise<Record<string, unknown> | null> {
  const pkgPath = path.join(packagePath, "package.json");
  if (!existsSync(pkgPath)) return null;
  return JSON.parse(await readFile(pkgPath, "utf8")) as Record<string, unknown>;
}

function resolveManifestPath(packagePath: string, pkgJson: Record<string, unknown>): string | null {
  const paperclipPlugin = pkgJson.paperclipPlugin;
  if (
    paperclipPlugin &&
    typeof paperclipPlugin === "object" &&
    !Array.isArray(paperclipPlugin)
  ) {
    const manifestRelPath = (paperclipPlugin as Record<string, unknown>).manifest;
    if (typeof manifestRelPath === "string" && manifestRelPath.trim().length > 0) {
      return path.resolve(packagePath, manifestRelPath);
    }
  }

  const distManifest = path.join(packagePath, "dist", "manifest.js");
  if (existsSync(distManifest)) return distManifest;

  const rootManifest = path.join(packagePath, "manifest.js");
  if (existsSync(rootManifest)) return rootManifest;

  return null;
}

function assertPluginManifest(input: unknown, packagePath: string): PluginManifest {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error(`Invalid plugin manifest for package at ${packagePath}: expected object`);
  }

  const record = input as Record<string, unknown>;
  if (typeof record.id !== "string" || record.id.trim().length === 0) {
    throw new Error(`Invalid plugin manifest for package at ${packagePath}: missing string "id"`);
  }
  if (typeof record.version !== "string" || record.version.trim().length === 0) {
    throw new Error(`Invalid plugin manifest for package at ${packagePath}: missing string "version"`);
  }
  if (typeof record.apiVersion !== "number" || !Number.isFinite(record.apiVersion)) {
    throw new Error(`Invalid plugin manifest for package at ${packagePath}: missing numeric "apiVersion"`);
  }

  return record as PluginManifest;
}

async function loadManifestFromPackage(packagePath: string): Promise<PluginManifest> {
  const pkgJson = await readPackageJson(packagePath);
  if (!pkgJson) {
    throw new Error(`Missing package.json at ${packagePath}`);
  }

  const manifestPath = resolveManifestPath(packagePath, pkgJson);
  if (!manifestPath || !existsSync(manifestPath)) {
    throw new Error(`No plugin manifest found for package at ${packagePath}`);
  }

  const mod = await import(pathToFileURL(manifestPath).href) as Record<string, unknown>;
  return assertPluginManifest(mod.default ?? mod, packagePath);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const db = createDb(dbUrl);
  const installed = await db.select().from(plugins).where(eq(plugins.status, "installed"));
  const targets = installed.filter((plugin) => {
    if (opts.pluginKey && plugin.pluginKey !== opts.pluginKey) return false;
    return typeof plugin.packagePath === "string" && plugin.packagePath.trim().length > 0;
  });

  let checked = 0;
  let drifted = 0;
  let updated = 0;
  let skipped = 0;

  for (const plugin of targets) {
    checked += 1;
    const packagePath = plugin.packagePath!;
    if (!existsSync(packagePath)) {
      const message = `skip ${plugin.pluginKey}: package path missing (${packagePath})`;
      if (opts.strict) {
        throw new Error(message);
      }
      skipped += 1;
      console.warn(message);
      continue;
    }

    const loadedManifest = await loadManifestFromPackage(packagePath);
    const storedManifest = plugin.manifestJson as PluginManifest;
    if (isDeepStrictEqual(storedManifest, loadedManifest)) {
      console.log(`ok   ${plugin.pluginKey}: manifest_json already matches bundled manifest`);
      continue;
    }

    drifted += 1;
    console.log(`diff ${plugin.pluginKey}: manifest_json drift detected`);

    if (!opts.apply) continue;

    await db
      .update(plugins)
      .set({
        version: loadedManifest.version,
        apiVersion: loadedManifest.apiVersion,
        categories: Array.isArray(loadedManifest.categories) ? loadedManifest.categories as never : plugin.categories,
        manifestJson: loadedManifest,
        updatedAt: new Date(),
      })
      .where(eq(plugins.id, plugin.id));
    updated += 1;
    console.log(`applied ${plugin.pluginKey}: manifest_json refreshed from ${packagePath}`);
  }

  console.log(
    [
      `checked=${checked}`,
      `drifted=${drifted}`,
      `updated=${updated}`,
      `skipped=${skipped}`,
      `mode=${opts.apply ? "apply" : "dry-run"}`,
    ].join(" "),
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
