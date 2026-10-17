#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const CASE_ID = "45bbd736-b3c5-4f4a-995c-748b7e2aef28";
const STALE_RUN_IDS = [
  "5cf377a3-cf48-4d1b-a1f8-be1f49ac0534",
  "46fd829f-5c2c-4df7-8705-56c849dea516",
];
const NEXT_REVIEW_AT = "2026-07-20T07:00:00Z";

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
  if (!response.ok) throw new Error(`${method} ${pathname}: ${response.status} ${text.slice(0, 2000)}`);
  return text ? JSON.parse(text) : null;
}

async function detail(token) {
  const response = await request(token, "GET", `/cases/${CASE_ID}`);
  return response.case ? response : { case: response };
}

async function transition(token, toStageKey, reason) {
  const current = await detail(token);
  if (current.stage?.key === toStageKey) return current;
  await request(token, "POST", `/cases/${CASE_ID}/transition`, {
    toStageKey,
    expectedVersion: current.case.version,
    reason,
  });
  return detail(token);
}

async function cancelSupersededIssue(token, identifier) {
  const issueId = psql(`
    select id from issues
    where company_id=${q(COMPANY_ID)}::uuid and identifier=${q(identifier)};
  `);
  if (!issueId) return;
  await request(token, "PATCH", `/issues/${issueId}`, {
    status: "cancelled",
    blockedByIssueIds: [],
  });
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  psql(`
    insert into board_api_keys (id,user_id,name,key_hash,expires_at)
    values (${q(keyId)}::uuid,${q(USER_ID)},'rearm-growth-external-wait-after-contract-sync',
      ${q(createHash("sha256").update(token).digest("hex"))},now()+interval '15 minutes');
  `);

  try {
    for (const runId of STALE_RUN_IDS) {
      await request(token, "POST", `/heartbeat-runs/${runId}/cancel`);
    }
    await cancelSupersededIssue(token, "AST-761");
    await cancelSupersededIssue(token, "AST-762");

    let current = await detail(token);
    if (current.stage?.key !== "external_wait") {
      await transition(token, "executing", "Re-arm external-wait automation after typed cooldown contract sync.");
    }

    current = await detail(token);
    await request(token, "PATCH", `/cases/${CASE_ID}`, {
      fieldPatch: {
        executionStatus: "waiting_next_day_trend_research",
        blockerClass: "bounded_trend_cooldown",
        ownerActionRequired: false,
        nextReviewAt: NEXT_REVIEW_AT,
      },
      expectedVersion: current.case.version,
    });
    current = await transition(
      token,
      "external_wait",
      "Wait until the next permitted Kyiv-day trend run; stale blocker closure is not continuation evidence.",
    );

    process.stdout.write(`${JSON.stringify({
      ok: true,
      cancelledRunIds: STALE_RUN_IDS,
      caseId: CASE_ID,
      stage: current.stage?.key,
      version: current.case.version,
      nextReviewAt: current.case.fields?.nextReviewAt,
    }, null, 2)}\n`);
  } finally {
    psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
