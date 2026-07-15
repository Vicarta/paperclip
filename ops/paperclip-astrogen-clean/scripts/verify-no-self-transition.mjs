#!/usr/bin/env node

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const CASE_ID = "f2d24183-891e-4767-b84d-6c5181b46030";

function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
  return result.stdout.trim();
}

function psql(sql) {
  return run("docker", [
    "exec", "-i", DB_CONTAINER, "psql", "-U", "paperclip", "-d", "paperclip",
    "-v", "ON_ERROR_STOP=1", "-At",
  ], sql);
}

function q(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function request(token, method, path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

const token = `pcp_board_${randomBytes(24).toString("hex")}`;
const keyId = randomUUID();
const keyHash = createHash("sha256").update(token).digest("hex");
psql(`
  insert into board_api_keys (id, user_id, name, key_hash, expires_at)
  values (${q(keyId)}::uuid, ${q(USER_ID)}, 'phase47-no-self-transition-verify', ${q(keyHash)}, now() + interval '5 minutes');
`);

try {
  const detail = await request(token, "GET", `/cases/${CASE_ID}`);
  if (detail.status !== 200 || detail.body?.stage?.key !== "draft") {
    throw new Error(`Expected active canary at draft, got HTTP ${detail.status} / ${detail.body?.stage?.key ?? "unknown"}`);
  }
  const result = await request(token, "POST", `/cases/${CASE_ID}/transition`, {
    toStageKey: "draft",
    expectedVersion: detail.body.case.version,
    reason: "Phase 47 invariant verification only; this must be rejected without mutation.",
  });
  if (result.status !== 422 || result.body?.code !== "self_transition_not_allowed") {
    throw new Error(`Expected 422 self_transition_not_allowed, got ${result.status}: ${JSON.stringify(result.body)}`);
  }
  console.log(JSON.stringify({ ok: true, rejectedStatus: result.status, code: result.body.code }, null, 2));
} finally {
  psql(`update board_api_keys set revoked_at=now() where id=${q(keyId)}::uuid;`);
}
