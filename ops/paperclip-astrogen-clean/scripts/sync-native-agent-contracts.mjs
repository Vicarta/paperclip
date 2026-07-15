#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { agentDefs, instructionText } from "./bootstrap-astrogen-growth-os.mjs";

const COMPANY_DIR = process.env.ASTROGEN_COMPANY_DIR ?? "/home/paperclip/companies/astrogen-clean";
const BACKUP_ROOT = process.env.ASTROGEN_BACKUP_DIR ?? "/home/paperclip/backups";
const TARGETS = new Set([
  "CEO",
  "Chief Marketing Officer",
  "SEO Blog Content Strategist",
  "SEO Blog Content Plan Validator",
  "MKT Competitive Intelligence Analyst",
  "MKT Blog Brief Strategist",
  "SEO Blog Article Writer (Claude)",
  "SEO Blog Article Validator",
  "SEO Blog Humanizer",
]);

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function timestamp() {
  return new Date().toISOString().replaceAll(":", "").replaceAll(".", "-");
}

function main() {
  const backupDir = path.join(BACKUP_ROOT, `astrogen-agent-contracts-${timestamp()}`);
  mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const results = [];

  for (const agent of agentDefs.filter((candidate) => TARGETS.has(candidate.name))) {
    const targetDir = path.join(COMPANY_DIR, "agents", agent.slug);
    const targetPath = path.join(targetDir, "AGENTS.md");
    if (!existsSync(targetPath)) throw new Error(`Live agent contract is missing: ${targetPath}`);

    const before = readFileSync(targetPath, "utf8");
    const desired = instructionText(agent);
    const backupPath = path.join(backupDir, `${agent.slug}-AGENTS.md`);
    copyFileSync(targetPath, backupPath);
    writeFileSync(targetPath, desired, { encoding: "utf8", mode: 0o644 });
    const after = readFileSync(targetPath, "utf8");
    if (after !== desired) throw new Error(`Agent contract verification failed: ${agent.name}`);

    results.push({
      agent: agent.name,
      targetPath,
      backupPath,
      changed: before !== after,
      beforeSha256: digest(before),
      afterSha256: digest(after),
    });
  }

  console.log(JSON.stringify({ mode: "apply-and-verify", backupDir, agents: results }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
