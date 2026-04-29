import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadManifestFromPackage,
  syncBundledPluginManifestIfNeeded,
} from "../services/bundled-plugin-manifest.js";

async function createPluginPackage(version: string, timeoutMs: number): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "paperclip-plugin-"));
  await mkdir(path.join(dir, "dist"), { recursive: true });
  await writeFile(
    path.join(dir, "package.json"),
    JSON.stringify(
      {
        name: "@paperclipai/plugin-bright-data-agent-tools",
        version,
        type: "module",
        paperclipPlugin: {
          manifest: "dist/manifest.js",
        },
      },
      null,
      2,
    ),
  );
  await writeFile(
    path.join(dir, "dist", "manifest.js"),
    [
      "export default {",
      '  schemaVersion: "1",',
      '  id: "paperclip.bright-data-agent-tools",',
      '  displayName: "Bright Data",',
      `  version: "${version}",`,
      "  apiVersion: 1,",
      '  runtime: { entry: "dist/worker.js" },',
      "  tools: [",
      "    {",
      '      name: "resolve-instagram-account-post-set",',
      '      displayName: "Resolve Instagram Account Post Set",',
      '      description: "Resolve canonical Instagram posts",',
      '      parametersSchema: { type: "object" },',
      `      executionTimeoutMs: ${timeoutMs}`,
      "    }",
      "  ]",
      "};",
    ].join("\n"),
  );
  return dir;
}

describe("bundled plugin manifest sync", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads bundled manifest from package path", async () => {
    const packagePath = await createPluginPackage("0.3.1", 180000);
    const manifest = await loadManifestFromPackage(packagePath);

    expect(manifest.id).toBe("paperclip.bright-data-agent-tools");
    expect(manifest.version).toBe("0.3.1");
    expect(manifest.tools?.[0]?.executionTimeoutMs).toBe(180000);
  });

  it("refreshes stored manifest_json when bundled manifest drifted", async () => {
    const packagePath = await createPluginPackage("0.3.1", 180000);
    const plugin = {
      id: "plugin-1",
      pluginKey: "paperclip.bright-data-agent-tools",
      packageName: "@paperclipai/plugin-bright-data-agent-tools",
      version: "0.3.0",
      apiVersion: 1,
      categories: [],
      manifestJson: {
        schemaVersion: "1",
        id: "paperclip.bright-data-agent-tools",
        displayName: "Bright Data",
        version: "0.3.0",
        apiVersion: 1,
        runtime: { entry: "dist/worker.js" },
        tools: [
          {
            name: "resolve-instagram-account-post-set",
            displayName: "Resolve Instagram Account Post Set",
            description: "Resolve canonical Instagram posts",
            parametersSchema: { type: "object" },
          },
        ],
      },
      status: "installed",
      installOrder: 1,
      packagePath,
      lastError: null,
      installedAt: new Date(),
      updatedAt: new Date(),
    } as any;

    const update = vi.fn(async (_id: string, data: { version?: string; manifest?: unknown }) => ({
      ...plugin,
      version: data.version ?? plugin.version,
      manifestJson: data.manifest ?? plugin.manifestJson,
    }));
    const registry = { update } as any;

    const result = await syncBundledPluginManifestIfNeeded(plugin, registry);

    expect(update).toHaveBeenCalledTimes(1);
    expect(result.version).toBe("0.3.1");
    expect(result.manifestJson.tools?.[0]?.executionTimeoutMs).toBe(180000);
  });
});
