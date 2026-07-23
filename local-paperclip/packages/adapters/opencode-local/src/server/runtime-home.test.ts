import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  prepareOpenCodeRuntimeHome,
  resolveOpenCodeSkillsHome,
} from "./runtime-home.js";

describe("OpenCode runtime home", () => {
  const cleanup: string[] = [];

  afterEach(async () => {
    while (cleanup.length > 0) {
      const target = cleanup.pop();
      if (target) await fs.rm(target, { recursive: true, force: true });
    }
  });

  it("uses an explicitly configured writable HOME for skills and execution", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-opencode-home-"));
    cleanup.push(root);
    const home = path.join(root, "configured");
    const config = { env: { HOME: home } };

    const prepared = await prepareOpenCodeRuntimeHome(config, {
      PAPERCLIP_HOME: path.join(root, "paperclip"),
      PAPERCLIP_INSTANCE_ID: "test",
    });

    expect(prepared).toMatchObject({
      homeDir: home,
      skillsHome: path.join(home, ".claude", "skills"),
      usedFallback: false,
      rejectedHomes: [],
    });
    expect(resolveOpenCodeSkillsHome(config)).toBe(path.join(home, ".claude", "skills"));
  });

  it("falls back to the persistent instance runtime when the preferred HOME is not writable", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-opencode-fallback-"));
    cleanup.push(root);
    const invalidHome = path.join(root, "not-a-directory");
    await fs.writeFile(invalidHome, "occupied");
    const paperclipHome = path.join(root, "paperclip");

    const prepared = await prepareOpenCodeRuntimeHome(
      { env: { HOME: invalidHome } },
      {
        PAPERCLIP_HOME: paperclipHome,
        PAPERCLIP_INSTANCE_ID: "astrogen-clean",
      },
    );

    expect(prepared.homeDir).toBe(
      path.join(paperclipHome, "instances", "astrogen-clean", "runtime", "opencode-home"),
    );
    expect(prepared.skillsHome).toBe(path.join(prepared.homeDir, ".claude", "skills"));
    expect(prepared.usedFallback).toBe(true);
    expect(prepared.rejectedHomes).toHaveLength(1);
  });
});
