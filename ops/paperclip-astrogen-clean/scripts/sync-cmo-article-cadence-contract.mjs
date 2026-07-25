#!/usr/bin/env node
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { agentDefs, assertUniqueAgentSlugs, instructionText } from "./bootstrap-astrogen-growth-os.mjs";

const COMPANY_DIR = process.env.ASTROGEN_COMPANY_DIR ?? "/home/paperclip/companies/astrogen-clean";
const BACKUP_ROOT = process.env.ASTROGEN_BACKUP_DIR ?? "/home/paperclip/backups";
const VERIFY_ONLY = process.argv.includes("--verify");

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function timestamp() {
  return new Date().toISOString().replaceAll(":", "").replaceAll(".", "-");
}

function main() {
  assertUniqueAgentSlugs();
  const cmo = agentDefs.find((agent) => agent.name === "Chief Marketing Officer");
  if (!cmo) throw new Error("Chief Marketing Officer definition is missing");

  const targetPath = path.join(COMPANY_DIR, "agents", cmo.slug, "AGENTS.md");
  if (!existsSync(targetPath)) throw new Error(`Live CMO contract is missing: ${targetPath}`);
  const before = readFileSync(targetPath, "utf8");
  const desired = instructionText(cmo);
  const backupPath = VERIFY_ONLY ? null : path.join(BACKUP_ROOT, `astrogen-cmo-contract-${timestamp()}.md`);

  if (!VERIFY_ONLY && before !== desired) {
    mkdirSync(BACKUP_ROOT, { recursive: true, mode: 0o700 });
    copyFileSync(targetPath, backupPath);
    writeFileSync(targetPath, desired, { encoding: "utf8", mode: 0o644 });
  }

  const after = readFileSync(targetPath, "utf8");
  if (after !== desired) throw new Error("Live CMO contract verification failed");
  console.log(JSON.stringify({
    mode: VERIFY_ONLY ? "verify" : "apply-and-verify",
    targetPath,
    backupPath,
    changed: before !== desired,
    beforeSha256: digest(before),
    afterSha256: digest(after),
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
