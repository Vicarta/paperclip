#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const caseId = process.argv.find((arg) => arg.startsWith("--case-id="))?.slice("--case-id=".length) ?? null;

if (!caseId || !/^[0-9a-f-]{36}$/i.test(caseId)) {
  throw new Error("Usage: restore-current-external-wait-monitor.mjs --case-id=<uuid>");
}

function run(command, args, input) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input,
    maxBuffer: 16 * 1024 * 1024,
  });
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
  if (!response.ok) throw new Error(`${method} ${pathname}: ${response.status} ${text.slice(0, 1600)}`);
  return text ? JSON.parse(text) : null;
}

function currentExternalWaitAutomation() {
  const raw = psql(`
    select json_build_object('id', i.id, 'identifier', i.identifier, 'status', i.status)::text
    from pipeline_case_issue_links link
    join issues i on i.id=link.issue_id
    join agents a on a.id=i.assignee_agent_id
    where link.company_id=${q(COMPANY_ID)}::uuid
      and link.case_id=${q(caseId)}::uuid
      and link.retired_at is null
      and link.role='automation'
      and i.status='in_progress'
      and i.title='External Wait automation'
      and i.monitor_next_check_at is null
      and a.name='Chief Marketing Officer'
    order by i.updated_at desc
    limit 1;
  `);
  return raw ? JSON.parse(raw) : null;
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${q(keyId)}::uuid, ${q(USER_ID)}, 'restore-current-external-wait-monitor',
      ${q(createHash("sha256").update(token).digest("hex"))}, now()+interval '15 minutes');
  `);

  try {
    const detail = await request(token, "GET", `/cases/${caseId}`);
    const pipelineCase = detail.case ?? detail;
    const nextReviewAt = pipelineCase.fields?.nextReviewAt;
    if (detail.stage?.key !== "external_wait") throw new Error(`Case is not external_wait: ${detail.stage?.key ?? "unknown"}`);
    if (pipelineCase.fields?.ownerActionRequired !== false) throw new Error("Refusing owner-action external wait");
    if (typeof nextReviewAt !== "string" || !Number.isFinite(Date.parse(nextReviewAt)) || Date.parse(nextReviewAt) <= Date.now()) {
      throw new Error("Refusing external wait without a future typed nextReviewAt");
    }

    const automation = currentExternalWaitAutomation();
    if (!automation) throw new Error("No unscheduled in-progress CMO external-wait automation exists for this case");
    const backup = await request(token, "POST", "/instance/database-backups", {});
    const updated = await request(token, "PATCH", `/issues/${automation.id}`, {
      status: "in_progress",
      blockedByIssueIds: [],
      executionPolicy: {
        mode: "normal",
        commentRequired: true,
        stages: [],
        monitor: {
          kind: "external_service",
          nextCheckAt: nextReviewAt,
          scheduledBy: "assignee",
          serviceName: "paperclip-monitor",
          notes: `Case ${pipelineCase.caseKey} waits for typed ${String(pipelineCase.fields?.blockerClass ?? "external")} review at ${nextReviewAt}.`,
        },
      },
    });
    const monitorAt = updated.monitorNextCheckAt ?? updated.executionPolicy?.monitor?.nextCheckAt ?? null;
    if (monitorAt !== nextReviewAt) throw new Error("Monitor write verification failed");
    console.log(JSON.stringify({
      ok: true,
      caseId,
      caseKey: pipelineCase.caseKey,
      blockerClass: pipelineCase.fields?.blockerClass ?? null,
      nextReviewAt,
      automation,
      monitorAt,
      backup: backup.filename ?? backup.backupDir ?? null,
    }, null, 2));
  } finally {
    psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
