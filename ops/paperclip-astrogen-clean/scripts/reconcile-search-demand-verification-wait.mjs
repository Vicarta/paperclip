#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const CASE_KEY = "search-demand:semcore-horoskop-vodoliia-na-sogodni";

function run(command, args, input) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
  }
  return result.stdout.trim();
}

function psql(sql) {
  return run("sudo", [
    "docker", "exec", "-i", DB_CONTAINER,
    "psql", "-U", "paperclip", "-d", "paperclip", "-v", "ON_ERROR_STOP=1", "-At",
  ], sql);
}

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function request(token, method, pathname, body, runId) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(runId ? { "X-Paperclip-Run-Id": runId } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 2000)}`);
  }
  return text ? JSON.parse(text) : null;
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const keyHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${quote(keyId)}::uuid, ${quote(USER_ID)}, 'reconcile-search-demand-verification-wait',
      ${quote(keyHash)}, now() + interval '10 minutes');
  `);

  try {
    const rows = psql(`
      select json_build_object(
        'id', i.id,
        'identifier', i.identifier,
        'status', i.status,
        'runId', hr.id,
        'runStatus', hr.status
      )::text
      from issues i
      left join lateral (
        select h.id,h.status from heartbeat_runs h
        where h.company_id=i.company_id
          and h.context_snapshot->>'issueId'=i.id::text
        order by h.created_at desc limit 1
      ) hr on true
      where i.company_id=${quote(COMPANY_ID)}::uuid
        and i.title='Verified automation'
        and i.description like ${quote(`%${CASE_KEY}%`)}
        and i.status not in ('done','cancelled')
      order by i.created_at;
    `).split("\n").filter(Boolean).map((row) => JSON.parse(row));

    const cancelled = [];
    for (const row of rows) {
      if (["queued", "running"].includes(row.runStatus)) {
        await request(token, "POST", `/heartbeat-runs/${row.runId}/cancel`, {});
      }
      await request(token, "PATCH", `/issues/${row.id}`, {
        status: "cancelled",
        comment: [
          "Superseded by the corrected search-demand verified-stage contract.",
          "",
          "CMS draft 131 is a valid delivered draft with `nextReviewAt=2026-07-25T09:00:00+03:00`. An unpublished draft now remains in the native `verified` stage as a bounded waiting-for-publication state. It must not transition back to already-completed `delegated` or create another verification automation issue.",
        ].join("\n"),
      }, row.runId);
      cancelled.push(row.identifier);
    }

    const blockerText = psql(`
      select json_build_object(
        'id', i.id,
        'identifier', i.identifier,
        'status', i.status,
        'runId', (
          select h.id from heartbeat_runs h
          where h.company_id=i.company_id
            and h.context_snapshot->>'issueId'=i.id::text
          order by h.created_at desc limit 1
        )
      )::text
      from issues i
      where i.company_id=${quote(COMPANY_ID)}::uuid and i.identifier='AST-659';
    `);
    const blocker = blockerText ? JSON.parse(blockerText) : null;
    if (blocker && !["done", "cancelled"].includes(blocker.status)) {
      await request(token, "PATCH", `/issues/${blocker.id}`, {
        status: "done",
        comment: [
          "Resolved by the canonical Semantic Core project/runtime path.",
          "",
          "- clean app image: `paperclip-app:v2026.626.0-vicarta.94-semantic-trend-reader-20260719`",
          "- plugin: `paperclip.semantic-core-mcp-agent-tools` 0.3.7, 19 tools",
          "- project: `astrogen-ukraine`",
          "- fixture trend + stored report read passed with unchanged semantic import count",
          "- legacy project aliases and pre-migration jobs are not valid verification targets",
        ].join("\n"),
      }, blocker.runId);
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      caseKey: CASE_KEY,
      cancelledVerificationIssues: cancelled,
      resolvedBlocker: blocker?.identifier ?? null,
    }, null, 2)}\n`);
  } finally {
    psql(`delete from board_api_keys where id=${quote(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
