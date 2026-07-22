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
const COMPANY_DIR = process.env.ASTROGEN_COMPANY_DIR
  ?? "/home/paperclip/companies/astrogen-clean";
const BACKUP_ROOT = process.env.ASTROGEN_BACKUP_DIR ?? "/home/paperclip/backups";
const VERIFY_ONLY = process.argv.includes("--verify");
const POLICIES = [
  {
    name: "search-demand-policy.yaml",
    version: "version: astrogen-search-demand-v8",
  },
  {
    name: "trend-topic-policy.yaml",
    version: "version: astrogen-trend-topic-v12",
  },
  {
    name: "western-astrology-curriculum.yaml",
    version: "version: astrogen-western-astrology-curriculum-v1",
  },
  {
    name: "zodiac-compatibility-cluster.yaml",
    version: "version: astrogen-zodiac-compatibility-cluster-v1",
  },
];

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function timestamp() {
  return new Date().toISOString().replaceAll(":", "").replaceAll(".", "-");
}

const backupDir = join(BACKUP_ROOT, `search-discovery-policies-${timestamp()}`);
const results = [];

for (const policy of POLICIES) {
  const source = resolve(SCRIPT_DIR, `../reference/${policy.name}`);
  const target = join(COMPANY_DIR, `reference/${policy.name}`);
  const desired = readFileSync(source, "utf8");
  if (!desired.includes(policy.version)) {
    throw new Error(`Unsupported ${policy.name} version`);
  }

  const before = existsSync(target) ? readFileSync(target, "utf8") : null;
  const changed = before !== desired;
  let backupPath = null;

  if (VERIFY_ONLY && changed) {
    throw new Error(`Live ${policy.name} is stale or missing`);
  }

  if (!VERIFY_ONLY && changed) {
    mkdirSync(dirname(target), { recursive: true, mode: 0o755 });
    if (before !== null) {
      mkdirSync(backupDir, { recursive: true, mode: 0o700 });
      backupPath = join(backupDir, policy.name);
      copyFileSync(target, backupPath);
    }
    const temporary = `${target}.tmp-${process.pid}`;
    copyFileSync(source, temporary);
    chmodSync(temporary, 0o644);
    renameSync(temporary, target);
  }

  const after = readFileSync(target, "utf8");
  if (after !== desired) throw new Error(`${policy.name} sync verification failed`);
  results.push({ name: policy.name, changed, target, backupPath, sha256: digest(after) });
}

console.log(JSON.stringify({
  mode: VERIFY_ONLY ? "verify" : "apply-and-verify",
  policies: results,
}, null, 2));
