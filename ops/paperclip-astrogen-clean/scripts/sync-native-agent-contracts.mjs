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
import { agentDefs, assertUniqueAgentSlugs, instructionText } from "./bootstrap-astrogen-growth-os.mjs";

const COMPANY_DIR = process.env.ASTROGEN_COMPANY_DIR ?? "/home/paperclip/companies/astrogen-clean";
const BACKUP_ROOT = process.env.ASTROGEN_BACKUP_DIR ?? "/home/paperclip/backups";
const TARGETED_NAMES = new Set([
  "CEO",
  "Chief Marketing Officer",
  "Chief Technical Officer",
  "SEO Performance Analyst",
  "SEO Blog Content Strategist",
  "SEO Semantic Core Strategist",
  "SEO Semantic Core Validator",
  "SEO Blog Content Plan Validator",
  "MKT Competitive Intelligence Analyst",
  "MKT Blog Brief Strategist",
  "SEO Blog Article Writer (Claude)",
  "SEO Blog Article Validator",
  "SEO Blog Humanizer",
  "SEO CMS Technical Fixer",
]);
const APPLY_ALL = process.argv.includes("--all");
const VERIFY_ONLY = process.argv.includes("--verify");

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function timestamp() {
  return new Date().toISOString().replaceAll(":", "").replaceAll(".", "-");
}

function main() {
  assertUniqueAgentSlugs();
  const agents = APPLY_ALL ? agentDefs : agentDefs.filter((candidate) => TARGETED_NAMES.has(candidate.name));
  const backupDir = VERIFY_ONLY ? null : path.join(BACKUP_ROOT, `astrogen-agent-contracts-${timestamp()}`);
  if (backupDir) mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const results = [];

  for (const agent of agents) {
    const targetDir = path.join(COMPANY_DIR, "agents", agent.slug);
    const targetPath = path.join(targetDir, "AGENTS.md");
    if (!existsSync(targetPath)) throw new Error(`Live agent contract is missing: ${targetPath}`);

    const before = readFileSync(targetPath, "utf8");
    const desired = instructionText(agent);
    const backupPath = backupDir ? path.join(backupDir, `${agent.slug}-AGENTS.md`) : null;
    if (!VERIFY_ONLY) {
      copyFileSync(targetPath, backupPath);
      writeFileSync(targetPath, desired, { encoding: "utf8", mode: 0o644 });
    }
    const after = VERIFY_ONLY ? before : readFileSync(targetPath, "utf8");
    if (!VERIFY_ONLY && after !== desired) throw new Error(`Agent contract verification failed: ${agent.name}`);

    results.push({
      agent: agent.name,
      targetPath,
      backupPath,
      changed: before !== desired,
      beforeSha256: digest(before),
      afterSha256: digest(after),
    });
  }

  const stale = results.filter((item) => item.changed);
  if (VERIFY_ONLY && stale.length > 0) {
    throw new Error(`Live agent contracts are stale: ${stale.map((item) => item.agent).join(", ")}`);
  }
  console.log(JSON.stringify({
    mode: VERIFY_ONLY ? "verify" : "apply-and-verify",
    scope: APPLY_ALL ? "all-agents" : "targeted-agents",
    backupDir,
    agents: results,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
