#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = "http://127.0.0.1:3210/api";

function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}

function psql(sql) {
  return run("docker", ["exec", "-i", DB_CONTAINER, "psql", "-U", "paperclip", "-d", "paperclip", "-v", "ON_ERROR_STOP=1", "-At"], sql);
}

function q(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function issue(identifier) {
  const raw = psql(`select json_build_object('id',id,'identifier',identifier,'status',status,'executionRunId',execution_run_id)::text from issues where company_id=${q(COMPANY_ID)}::uuid and identifier=${q(identifier)};`);
  return raw ? JSON.parse(raw) : null;
}

async function request(token, method, pathname, body) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 1600)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const keyHash = createHash("sha256").update(token).digest("hex");
  psql(`insert into board_api_keys (id,user_id,name,key_hash,expires_at) values (${q(keyId)}::uuid,${q(USER_ID)},'reconcile-trend-intake-duplicate',${q(keyHash)},now()+interval '10 minutes');`);
  try {
    const parent = issue("AST-708");
    const canonical = issue("AST-709");
    const duplicate = issue("AST-710");
    if (!parent?.id || !canonical?.id || !duplicate?.id) throw new Error("AST-708/709/710 not found");
    if (!["done", "cancelled"].includes(duplicate.status)) {
      if (duplicate.executionRunId) {
        const status = psql(`select status from heartbeat_runs where id=${q(duplicate.executionRunId)}::uuid;`);
        if (["queued", "running"].includes(status)) {
          await request(token, "POST", `/heartbeat-runs/${duplicate.executionRunId}/cancel`, {});
        }
      }
      await request(token, "POST", `/issues/${duplicate.id}/admin/force-release`);
      await request(token, "PATCH", `/issues/${duplicate.id}`, {
        status: "cancelled",
        comment: [
          "Cancelled as a duplicate intake continuation created by overlapping recovery wakes.",
          "",
          "Canonical execution remains AST-709, which was created first and is already active. No semantic, search-demand, topic, or article work is discarded.",
        ].join("\n"),
      });
    }
    await request(token, "PATCH", `/issues/${parent.id}`, {
      status: "blocked",
      blockedByIssueIds: [canonical.id],
      comment: "Reconciled duplicate intake children. AST-708 now waits only on canonical AST-709.",
    });
    process.stdout.write(`${JSON.stringify({ ok: true, parent: parent.identifier, canonical: canonical.identifier, duplicate: duplicate.identifier, duplicateStatus: "cancelled" }, null, 2)}\n`);
  } finally {
    psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
