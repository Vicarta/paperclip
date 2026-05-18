import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listOpenRouterSkills, loadOpenRouterPromptSkills } from "./skills.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeSkill(name: string, body: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "paperclip-openrouter-skill-"));
  tempDirs.push(root);
  const skillDir = path.join(root, name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), body, "utf8");
  return skillDir;
}

describe("OpenRouter skills", () => {
  it("reports selected skills as prompt-injected ephemeral context", async () => {
    const source = makeSkill("seo-writing", "# SEO Writing\n\nUse the approved brief.");
    const config = {
      paperclipRuntimeSkills: [
        {
          key: "company/seo-writing",
          runtimeName: "seo-writing",
          source,
        },
      ],
      paperclipSkillSync: {
        desiredSkills: ["seo-writing"],
      },
    };

    const snapshot = await listOpenRouterSkills({
      agentId: "agent-1",
      companyId: "company-1",
      adapterType: "openrouter",
      config,
    });

    expect(snapshot.supported).toBe(true);
    expect(snapshot.mode).toBe("ephemeral");
    expect(snapshot.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "company/seo-writing",
          desired: true,
          state: "configured",
        }),
      ]),
    );
    expect(snapshot.warnings.join("\n")).toMatch(/prompt-injected/i);
  });

  it("loads selected skill markdown for the system prompt", async () => {
    const source = makeSkill("seo-writing", "# SEO Writing\n\nUse the approved brief.");
    const result = await loadOpenRouterPromptSkills({
      paperclipRuntimeSkills: [
        {
          key: "company/seo-writing",
          runtimeName: "seo-writing",
          source,
        },
      ],
      paperclipSkillSync: {
        desiredSkills: ["company/seo-writing"],
      },
    });

    expect(result.missingSkills).toEqual([]);
    expect(result.text).toContain("Paperclip Skill: seo-writing");
    expect(result.text).toContain("Use the approved brief.");
  });
});
