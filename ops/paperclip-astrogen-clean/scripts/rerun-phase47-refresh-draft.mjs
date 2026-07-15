#!/usr/bin/env node

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const CASE_ID = "f58bf6a8-0d48-439f-9534-fe33020c7a16";

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

async function request(token, method, path) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${method} ${path} returned ${response.status}: ${text.slice(0, 1200)}`);
  return parsed;
}

const token = `pcp_board_${randomBytes(24).toString("hex")}`;
const keyId = randomUUID();
const keyHash = createHash("sha256").update(token).digest("hex");

psql(`
  insert into board_api_keys (id, user_id, name, key_hash, expires_at)
  values (${q(keyId)}::uuid, ${q(USER_ID)}, 'phase47-refresh-draft-rerun', ${q(keyHash)}, now() + interval '10 minutes');
`);

try {
  const detail = await request(token, "GET", `/cases/${CASE_ID}`);
  const pipelineCase = detail.case ?? detail;
  if (detail.stage?.key !== "draft") {
    throw new Error(`Expected refresh case to remain in draft, found ${detail.stage?.key ?? "unknown"}`);
  }
  if (pipelineCase.fields?.operation !== "refresh" || pipelineCase.fields?.cmsDraftId !== 123) {
    throw new Error("Refusing to rerun a case other than the Phase 47 CMS 123 refresh canary");
  }
  if (pipelineCase.fields?.preserveExistingMedia !== true || pipelineCase.fields?.imageDefectScoped !== false) {
    throw new Error("Refresh media-preservation guard is absent");
  }

  const result = await request(token, "POST", `/cases/${CASE_ID}/automation/current-stage/rerun`);
  console.log(JSON.stringify({
    ok: true,
    caseId: CASE_ID,
    stage: detail.stage.key,
    operation: pipelineCase.fields.operation,
    cmsDraftId: pipelineCase.fields.cmsDraftId,
    preserveExistingMedia: pipelineCase.fields.preserveExistingMedia,
    automationExecution: result.automationExecution?.status ?? null,
    automationIssueId: result.automationLedger?.executionIssueId ?? null,
  }, null, 2));
} finally {
  psql(`update board_api_keys set revoked_at=now(), last_used_at=now() where id=${q(keyId)}::uuid;`);
}
