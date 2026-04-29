import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import type { PaperclipPluginManifestV1, PluginRecord } from "@paperclipai/shared";
import type { pluginRegistryService } from "./plugin-registry.js";

type PluginRegistry = ReturnType<typeof pluginRegistryService>;

export async function readPluginPackageJson(packagePath: string): Promise<Record<string, unknown> | null> {
  const pkgPath = path.join(packagePath, "package.json");
  if (!existsSync(pkgPath)) return null;
  return JSON.parse(await readFile(pkgPath, "utf8")) as Record<string, unknown>;
}

export function resolvePluginManifestPath(
  packagePath: string,
  pkgJson: Record<string, unknown>,
): string | null {
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

export function assertPluginManifest(
  input: unknown,
  packagePath: string,
): PaperclipPluginManifestV1 {
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
    throw new Error(
      `Invalid plugin manifest for package at ${packagePath}: missing numeric "apiVersion"`,
    );
  }

  return record as unknown as PaperclipPluginManifestV1;
}

export async function loadManifestFromPackage(
  packagePath: string,
): Promise<PaperclipPluginManifestV1> {
  const pkgJson = await readPluginPackageJson(packagePath);
  if (!pkgJson) {
    throw new Error(`Missing package.json at ${packagePath}`);
  }

  const manifestPath = resolvePluginManifestPath(packagePath, pkgJson);
  if (!manifestPath || !existsSync(manifestPath)) {
    throw new Error(`No plugin manifest found for package at ${packagePath}`);
  }

  const mod = (await import(pathToFileURL(manifestPath).href)) as Record<string, unknown>;
  return assertPluginManifest(mod.default ?? mod, packagePath);
}

export async function syncBundledPluginManifestIfNeeded(
  plugin: PluginRecord & { packagePath?: string | null },
  registry: PluginRegistry,
): Promise<PluginRecord> {
  if (!plugin.packagePath || plugin.packagePath.trim().length === 0) {
    return plugin;
  }

  const loadedManifest = await loadManifestFromPackage(plugin.packagePath);
  if (isDeepStrictEqual(plugin.manifestJson, loadedManifest)) {
    return plugin;
  }

  const updated = await registry.update(plugin.id, {
    version: loadedManifest.version,
    manifest: loadedManifest,
  });

  return updated ?? { ...plugin, version: loadedManifest.version, manifestJson: loadedManifest };
}
