#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";

const SEARCH_CASES = [
  {
    id: "6aff75be-1855-475c-89d4-0e7ee59361d6",
    reason: "owner_policy_ephemeral_daily_horoscope_paused",
  },
  {
    id: "8dd13077-5f25-4849-8280-5d4a808e0507",
    reason: "owner_policy_ephemeral_daily_horoscope_paused",
  },
];

const HISTORY_CASES = [
  {
    id: "5fe6c901-58b8-48f3-b72a-c4f7af23d2ed",
    reason: "owner_policy_ephemeral_daily_horoscope_paused",
  },
  {
    id: "23719864-fcdc-4922-9f23-64fdaa1c83df",
    reason: "owner_policy_ephemeral_daily_horoscope_paused",
  },
  {
    id: "df7b956d-7699-4b91-bb07-8aa888793fc6",
    reason: "owner_policy_calendar_date_topics_paused",
  },
];

const REVIEW_ISSUES = [
  { identifier: "AST-665", caseId: "6aff75be-1855-475c-89d4-0e7ee59361d6" },
  { identifier: "AST-587", caseId: "8dd13077-5f25-4849-8280-5d4a808e0507" },
];

const SUPERSEDED_ISSUES = ["AST-551"];

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

async function detail(token, caseId) {
  const response = await request(token, "GET", `/cases/${caseId}`);
  return response.case ? response : { case: response };
}

async function patchCase(token, caseId, fieldPatch) {
  const current = await detail(token, caseId);
  await request(token, "PATCH", `/cases/${caseId}`, {
    fieldPatch,
    expectedVersion: current.case.version,
  });
  return detail(token, caseId);
}

async function cancelSearchCase(token, target) {
  let current = await patchCase(token, target.id, {
    selectedAction: "no_action",
    actionReasonCode: target.reason,
    actionReasonSummary: "Owner policy excludes ephemeral daily horoscope and explicit calendar-date article demand.",
    noActionReason: target.reason,
    policyDecision: "no_action",
    workflowDisposition: "cancelled",
    ownerPolicyReconciledAt: new Date().toISOString(),
    ownerActionRequired: false,
  });
  if (current.stage?.key !== "cancelled" && current.stage?.kind !== "review") {
    await request(token, "POST", `/cases/${target.id}/transition`, {
      toStageKey: "cancelled",
      expectedVersion: current.case.version,
      reason: `Implementation rejected by owner policy: ${target.reason}.`,
    });
    current = await detail(token, target.id);
  }
  return { id: target.id, stage: current.stage?.key, version: current.case.version };
}

async function reactivateReviewIssue(token, target) {
  const issueId = psql(`
    select id from issues
    where company_id=${q(COMPANY_ID)}::uuid and identifier=${q(target.identifier)};
  `);
  if (!issueId) return { ...target, missing: true };
  const updated = await request(token, "PATCH", `/issues/${issueId}`, {
    status: "todo",
    blockedByIssueIds: [],
    comment: `Re-read native case ${target.caseId}. Current typed policyDecision=no_action requires the configured review rejection to cancelled. Do not create, recover, or replace article work.`,
  });
  return { ...target, status: updated.status };
}

async function cancelIssue(token, identifier) {
  const row = psql(`
    select concat_ws('|',id::text,coalesce(execution_run_id::text,''),status)
    from issues where company_id=${q(COMPANY_ID)}::uuid and identifier=${q(identifier)};
  `);
  if (!row) return { identifier, missing: true };
  const [issueId, runId, status] = row.split("|");
  if (runId) await request(token, "POST", `/heartbeat-runs/${runId}/cancel`);
  if (!["done", "cancelled"].includes(status)) {
    await request(token, "PATCH", `/issues/${issueId}`, {
      status: "cancelled",
      blockedByIssueIds: [],
    });
  }
  return { identifier, priorStatus: status, cancelled: !["done", "cancelled"].includes(status) };
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  psql(`
    insert into board_api_keys (id,user_id,name,key_hash,expires_at)
    values (${q(keyId)}::uuid,${q(USER_ID)},'reconcile-owner-paused-topic-lineages',
      ${q(createHash("sha256").update(token).digest("hex"))},now()+interval '15 minutes');
  `);

  try {
    const searchCases = [];
    for (const target of SEARCH_CASES) searchCases.push(await cancelSearchCase(token, target));

    const reviewIssues = [];
    for (const target of REVIEW_ISSUES) reviewIssues.push(await reactivateReviewIssue(token, target));

    const historyCases = [];
    for (const target of HISTORY_CASES) {
      const current = await patchCase(token, target.id, {
        policyDecision: "no_action",
        noActionReason: target.reason,
        evidenceStatus: "policy_excluded",
        ownerPolicyReconciledAt: new Date().toISOString(),
        preserveTerminalHistory: true,
      });
      historyCases.push({ id: target.id, stage: current.stage?.key, version: current.case.version });
    }

    const issues = [];
    for (const identifier of SUPERSEDED_ISSUES) issues.push(await cancelIssue(token, identifier));

    process.stdout.write(`${JSON.stringify({ ok: true, searchCases, reviewIssues, historyCases, issues }, null, 2)}\n`);
  } finally {
    psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
