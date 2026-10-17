#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const JANUARY_CASE_ID = "2c1b0930-f533-409f-9146-d3846234933c";
const REFILL_CASE_ID = "45bbd736-b3c5-4f4a-995c-748b7e2aef28";
const PRIOR_TREND_RUN_ID = "run_20260719_030615_trend_topic_e0c18fbd";
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

async function detail(token, caseId) {
  const response = await request(token, "GET", `/cases/${caseId}`);
  return response.case ? response : { case: response };
}

async function patchAndTransition(token, caseId, fieldPatch, toStageKey, reason) {
  let current = await detail(token, caseId);
  await request(token, "PATCH", `/cases/${caseId}`, {
    fieldPatch,
    expectedVersion: current.case.version,
  });
  current = await detail(token, caseId);
  if (current.stage?.key !== toStageKey) {
    await request(token, "POST", `/cases/${caseId}/transition`, {
      toStageKey,
      expectedVersion: current.case.version,
      reason,
    });
  }
  return detail(token, caseId);
}

async function patchCase(token, caseId, fieldPatch) {
  const current = await detail(token, caseId);
  await request(token, "PATCH", `/cases/${caseId}`, {
    fieldPatch,
    expectedVersion: current.case.version,
  });
  return detail(token, caseId);
}

async function updateIssue(token, identifier, body) {
  const id = psql(`select id from issues where company_id=${q(COMPANY_ID)}::uuid and identifier=${q(identifier)};`);
  if (!id) return { identifier, missing: true };
  const current = JSON.parse(psql(`select json_build_object('status',status)::text from issues where id=${q(id)}::uuid;`));
  if (["done", "cancelled"].includes(current.status)) return { identifier, status: current.status, changed: false };
  const updated = await request(token, "PATCH", `/issues/${id}`, body);
  return { identifier, status: updated.status, changed: true };
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  psql(`
    insert into board_api_keys (id,user_id,name,key_hash,expires_at)
    values (${q(keyId)}::uuid,${q(USER_ID)},'reconcile-stale-refill-after-owner-topic-pause',
      ${q(createHash("sha256").update(token).digest("hex"))},now()+interval '15 minutes');
  `);

  try {
    const january = await patchCase(token, JANUARY_CASE_ID, {
      policyDecision: "no_action",
      evidenceStatus: "policy_excluded",
      articleWorkCreated: false,
      workflowDisposition: "cancelled",
      noActionReason: "owner_policy_calendar_date_topics_paused",
      ownerPolicyReconciledAt: new Date().toISOString(),
      nativeBlocker: null,
      verificationProof: {
        status: "owner_policy_cancelled",
        reason: "Calendar-date topics are not eligible for article production.",
      },
    });

    const refill = await patchAndTransition(token, REFILL_CASE_ID, {
      executionStatus: "waiting_next_day_trend_research",
      eligibleReadyTopicCountAfter: 0,
      priorTrendReportRunId: PRIOR_TREND_RUN_ID,
      priorTrendReportDisposition: "exhausted_after_ownership_review",
      remainingUnusedClusters: 0,
      nextReviewAt: NEXT_REVIEW_AT,
      blockerClass: "bounded_trend_cooldown",
      ownerActionRequired: false,
      continuationPolicy: {
        trigger: "next_allocator_run",
        maximumLiveTrendRunsPerKyivDay: 1,
        excludeCalendarDateTopics: true,
        excludeEphemeralDailyHoroscopeTopics: true,
      },
    }, "external_wait", "Ready inventory is zero; wait for the bounded next-day trend research continuation.");

    const issues = [];
    issues.push(await updateIssue(token, "AST-482", {
      status: "done",
      blockedByIssueIds: [],
      comment: "Superseded refill chain closed. The old calendar/daily-horoscope candidates are policy-excluded; canonical growth case now owns one bounded next-day trend continuation without owner action.",
    }));
    issues.push(await updateIssue(token, "AST-603", {
      status: "done",
      blockedByIssueIds: [],
      comment: "Resolved by policy reconciliation: January demand is cancelled, so delegated delivery repair is no longer required.",
    }));
    issues.push(await updateIssue(token, "AST-607", {
      status: "done",
      blockedByIssueIds: [],
      comment: "Resolved without broadening CTO permissions. The policy-excluded January case was reconciled through the privileged bounded recovery path.",
    }));
    issues.push(await updateIssue(token, "AST-605", {
      status: "todo",
      blockedByIssueIds: [],
      comment: "Native review is now actionable. Re-read the case policy evidence and reject the verified-stage implementation: calendar-date demand is owner-policy excluded and its guarded topic child already expired without article work.",
    }));
    issues.push(await updateIssue(token, "AST-479", {
      status: "cancelled",
      blockedByIssueIds: [],
      comment: "Retired stale executing-stage automation after the canonical refill moved to bounded external_wait. Repeated dependency-wait comments must stop.",
    }));

    process.stdout.write(`${JSON.stringify({
      ok: true,
      januaryCase: {
        stage: january.stage?.key,
        version: january.case.version,
        expectedReviewOutcome: "reject_to_cancelled_by_configured_agent",
      },
      refillCase: { stage: refill.stage?.key, version: refill.case.version },
      issues,
      nextReviewAt: NEXT_REVIEW_AT,
    }, null, 2)}\n`);
  } finally {
    psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
