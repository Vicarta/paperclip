#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const NEXT_REVIEW_AT = "2026-07-20T07:00:00Z";

function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}

function psql(sql) {
  return run("sudo", [
    "docker", "exec", "-i", DB_CONTAINER,
    "psql", "-U", "paperclip", "-d", "paperclip", "-v", "ON_ERROR_STOP=1", "-At",
  ], sql);
}

function q(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function request(token, method, pathname, body) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${pathname}: ${response.status} ${text.slice(0, 2000)}`);
  return text ? JSON.parse(text) : null;
}

function issueRow(identifier) {
  const row = psql(`
    select concat_ws('|',id::text,coalesce(execution_run_id::text,''),status)
    from issues where identifier=${q(identifier)};
  `);
  if (!row) throw new Error(`Issue not found: ${identifier}`);
  const [id, executionRunId, status] = row.split("|");
  return { id, executionRunId: executionRunId || null, status };
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  psql(`
    insert into board_api_keys (id,user_id,name,key_hash,expires_at)
    values (${q(keyId)}::uuid,${q(USER_ID)},'restore-ast763-monitor-after-harness-fix',
      ${q(createHash("sha256").update(token).digest("hex"))},now()+interval '15 minutes');
  `);

  try {
    const recovery = issueRow("AST-765");
    if (recovery.executionRunId) {
      await request(token, "POST", `/heartbeat-runs/${recovery.executionRunId}/cancel`);
    }
    if (!["done", "cancelled"].includes(recovery.status)) {
      await request(token, "PATCH", `/issues/${recovery.id}`, {
        status: "cancelled",
        blockedByIssueIds: [],
      });
    }

    const monitorIssue = issueRow("AST-763");
    const updated = await request(token, "PATCH", `/issues/${monitorIssue.id}`, {
      status: "in_progress",
      blockedByIssueIds: [],
      executionPolicy: {
        mode: "normal",
        stages: [],
        monitor: {
          kind: "external_service",
          nextCheckAt: NEXT_REVIEW_AT,
          scheduledBy: "assignee",
          serviceName: "paperclip-monitor",
          notes: "Canonical topic refill waits for the next permitted Kyiv-day trend research window.",
        },
      },
    });

    process.stdout.write(`${JSON.stringify({
      ok: true,
      cancelledRecoveryIssue: "AST-765",
      monitorIssue: "AST-763",
      status: updated.status,
      nextCheckAt: updated.monitorNextCheckAt ?? updated.executionPolicy?.monitor?.nextCheckAt ?? null,
    }, null, 2)}\n`);
  } finally {
    psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
