#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const OBSOLETE_ISSUES = ["AST-675", "AST-676"];

function execute(command, args, input) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function psql(sql) {
  return execute(
    "sudo",
    ["docker", "exec", "-i", DB_CONTAINER, "psql", "-U", "paperclip", "-d", "paperclip", "-v", "ON_ERROR_STOP=1", "-At"],
    sql,
  );
}

async function request(token, method, path, body, runId) {
  const response = await fetch(`http://127.0.0.1:3210/api${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(runId ? { "X-Paperclip-Run-Id": runId } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${text.slice(0, 1600)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  psql(`
    insert into board_api_keys (id,user_id,name,key_hash,expires_at)
    values (
      ${quote(keyId)}::uuid,
      ${quote(USER_ID)},
      'reconcile-trend-ingest-ownership',
      ${quote(createHash("sha256").update(token).digest("hex"))},
      now()+interval '10 minutes'
    );
  `);

  const reconciled = [];
  try {
    for (const identifier of OBSOLETE_ISSUES) {
      const row = JSON.parse(psql(`
        select json_build_object(
          'id', i.id,
          'status', i.status,
          'parentId', i.parent_id,
          'runId', (
            select h.id from heartbeat_runs h
            where h.company_id=i.company_id
              and h.context_snapshot->>'issueId'=i.id::text
            order by h.created_at desc limit 1
          ),
          'runStatus', (
            select h.status from heartbeat_runs h
            where h.company_id=i.company_id
              and h.context_snapshot->>'issueId'=i.id::text
            order by h.created_at desc limit 1
          )
        )::text
        from issues i
        where i.company_id=${quote(COMPANY_ID)}::uuid
          and i.identifier=${quote(identifier)};
      `));

      if (["queued", "running"].includes(row.runStatus)) {
        await request(token, "POST", `/heartbeat-runs/${row.runId}/cancel`, {});
      }

      if (!["done", "cancelled"].includes(row.status)) {
        await request(token, "PATCH", `/issues/${row.id}`, {
          status: "cancelled",
          blockedByIssueIds: [],
          comment: [
            "Скасовано як помилкову escalation-гілку.",
            "",
            "Native search-demand ingest належить SEO Blog Content Strategist у AST-674. Цей агент уже має company-configured `pipelines:write`, обмежений потрібними native pipelines. Validator, CEO і CTO не повинні дублювати ingest або отримувати додаткові широкі права.",
          ].join("\n"),
        }, row.runId);
      }

      if (row.parentId) {
        const parent = await request(token, "GET", `/issues/${row.parentId}`);
        const remaining = (parent.blockedBy ?? [])
          .filter((blocker) => blocker.id !== row.id)
          .map((blocker) => blocker.id);
        if ((parent.blockedBy ?? []).some((blocker) => blocker.id === row.id)) {
          await request(token, "PATCH", `/issues/${row.parentId}`, {
            blockedByIssueIds: remaining,
          }, row.runId);
        }
      }

      reconciled.push({ identifier, cancelledRun: ["queued", "running"].includes(row.runStatus) });
    }

    process.stdout.write(`${JSON.stringify({ ok: true, reconciled }, null, 2)}\n`);
  } finally {
    psql(`delete from board_api_keys where id=${quote(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
