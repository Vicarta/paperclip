import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AdapterSkillContext,
  AdapterSkillEntry,
  AdapterSkillSnapshot,
} from "@paperclipai/adapter-utils";
import {
  readPaperclipRuntimeSkillEntries,
  resolvePaperclipDesiredSkillNames,
} from "@paperclipai/adapter-utils/server-utils";

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));

async function buildOpenRouterSkillSnapshot(config: Record<string, unknown>): Promise<AdapterSkillSnapshot> {
  const availableEntries = await readPaperclipRuntimeSkillEntries(config, __moduleDir);
  const availableByKey = new Map(availableEntries.map((entry) => [entry.key, entry]));
  const desiredSkills = resolvePaperclipDesiredSkillNames(config, availableEntries);
  const desiredSet = new Set(desiredSkills);
  const entries: AdapterSkillEntry[] = availableEntries.map((entry) => ({
    key: entry.key,
    runtimeName: entry.runtimeName,
    desired: desiredSet.has(entry.key),
    managed: true,
    state: desiredSet.has(entry.key) ? "configured" : "available",
    origin: entry.required ? "paperclip_required" : "company_managed",
    originLabel: entry.required ? "Required by Paperclip" : "Managed by Paperclip",
    readOnly: false,
    sourcePath: entry.source,
    targetPath: null,
    detail: desiredSet.has(entry.key)
      ? "Will be injected into the OpenRouter system prompt on the next run."
      : null,
    required: Boolean(entry.required),
    requiredReason: entry.requiredReason ?? null,
  }));
  const warnings: string[] = [
    "OpenRouter is stateless: skills are prompt-injected as markdown context, not installed as local runtime tools.",
  ];

  for (const desiredSkill of desiredSkills) {
    if (availableByKey.has(desiredSkill)) continue;
    warnings.push(`Desired skill "${desiredSkill}" is not available from the Paperclip skills directory.`);
    entries.push({
      key: desiredSkill,
      runtimeName: null,
      desired: true,
      managed: true,
      state: "missing",
      origin: "external_unknown",
      originLabel: "External or unavailable",
      readOnly: false,
      sourcePath: null,
      targetPath: null,
      detail: "Paperclip cannot find this skill in the local runtime skills directory.",
    });
  }

  entries.sort((left, right) => left.key.localeCompare(right.key));

  return {
    adapterType: "openrouter",
    supported: true,
    mode: "ephemeral",
    desiredSkills,
    entries,
    warnings,
  };
}

export async function listOpenRouterSkills(ctx: AdapterSkillContext): Promise<AdapterSkillSnapshot> {
  return buildOpenRouterSkillSnapshot(ctx.config);
}

export async function syncOpenRouterSkills(
  ctx: AdapterSkillContext,
  _desiredSkills: string[],
): Promise<AdapterSkillSnapshot> {
  return buildOpenRouterSkillSnapshot(ctx.config);
}

export async function loadOpenRouterPromptSkills(
  config: Record<string, unknown>,
): Promise<{ text: string; desiredSkills: string[]; missingSkills: string[] }> {
  const availableEntries = await readPaperclipRuntimeSkillEntries(config, __moduleDir);
  const desiredSkills = resolvePaperclipDesiredSkillNames(config, availableEntries);
  const availableByKey = new Map(availableEntries.map((entry) => [entry.key, entry]));
  const sections: string[] = [];
  const missingSkills: string[] = [];

  for (const skillKey of desiredSkills) {
    const entry = availableByKey.get(skillKey);
    if (!entry) {
      missingSkills.push(skillKey);
      continue;
    }
    const skillPath = path.join(entry.source, "SKILL.md");
    try {
      const markdown = await fs.readFile(skillPath, "utf8");
      sections.push(
        [
          `# Paperclip Skill: ${entry.runtimeName}`,
          `Source: ${skillPath}`,
          "",
          markdown.trim(),
        ].join("\n"),
      );
    } catch {
      missingSkills.push(skillKey);
    }
  }

  return {
    desiredSkills,
    missingSkills,
    text:
      sections.length > 0
        ? [
            "The following Paperclip skills are available as markdown operating context for this stateless OpenRouter run.",
            "They are not local tools; follow their procedures when applicable and use the Paperclip issue protocol for durable outputs.",
            "",
            sections.join("\n\n---\n\n"),
          ].join("\n")
        : "",
  };
}
