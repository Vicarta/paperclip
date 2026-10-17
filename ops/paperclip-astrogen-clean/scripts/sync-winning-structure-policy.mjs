#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(SCRIPT_DIR, "../reference/winning-structure-policy.yaml");
const COMPANY_DIR = process.env.ASTROGEN_COMPANY_DIR
  ?? "/home/paperclip/companies/astrogen-clean";
const BACKUP_ROOT = process.env.ASTROGEN_BACKUP_DIR ?? "/home/paperclip/backups";
const TARGET = join(COMPANY_DIR, "reference/winning-structure-policy.yaml");
const VERIFY_ONLY = process.argv.includes("--verify");

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function timestamp() {
  return new Date().toISOString().replaceAll(":", "").replaceAll(".", "-");
}

const desired = readFileSync(SOURCE, "utf8");
if (!desired.includes("version: astrogen-winning-structure-phase32-33-v1")) {
  throw new Error("Unsupported Winning Structure policy version");
}

const before = existsSync(TARGET) ? readFileSync(TARGET, "utf8") : null;
const changed = before !== desired;
let backupPath = null;

if (VERIFY_ONLY && changed) {
  throw new Error("Live Winning Structure policy is stale or missing");
}

if (!VERIFY_ONLY && changed) {
  mkdirSync(dirname(TARGET), { recursive: true, mode: 0o755 });
  if (before !== null) {
    const backupDir = join(BACKUP_ROOT, `winning-structure-policy-${timestamp()}`);
    mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    backupPath = join(backupDir, "winning-structure-policy.yaml");
    copyFileSync(TARGET, backupPath);
  }
  const temporary = `${TARGET}.tmp-${process.pid}`;
  copyFileSync(SOURCE, temporary);
  chmodSync(temporary, 0o644);
  renameSync(temporary, TARGET);
}

const after = readFileSync(TARGET, "utf8");
if (after !== desired) throw new Error("Winning Structure policy sync verification failed");

console.log(JSON.stringify({
  mode: VERIFY_ONLY ? "verify" : "apply-and-verify",
  changed,
  source: SOURCE,
  target: TARGET,
  backupPath,
  sha256: digest(after),
}, null, 2));
