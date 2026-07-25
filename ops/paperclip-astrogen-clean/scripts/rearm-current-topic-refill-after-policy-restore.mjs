#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const POLICY_PATH = process.env.ASTROGEN_TREND_POLICY_PATH
  ?? "/home/paperclip/companies/astrogen-clean/reference/trend-topic-policy.yaml";
const APPLY = process.argv.includes("--apply");

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

function kyivIsoWeekKey(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const date = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  const weekday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() + 3 - weekday);
  const isoYear = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstWeekday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() + 3 - firstWeekday);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / 604800000);
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

function assertLivePolicy() {
  const policy = readFileSync(POLICY_PATH, "utf8");
  if (!/^version:\s*astrogen-trend-topic-v14\s*$/m.test(policy)) {
    throw new Error("Refusing rearm: live trend policy is not astrogen-trend-topic-v14");
  }
  if (!/^\s*liveEnabled:\s*true\s*$/m.test(policy)) {
    throw new Error("Refusing rearm: live trend execution is not enabled in the company policy");
  }
  if (!/^\s*providerCacheModeForApprovedCandidateBatch:\s*read_write\s*$/m.test(policy)) {
    throw new Error("Refusing rearm: approved trend candidates do not have the bounded read_write cache mode");
  }
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

function caseRow(value) {
  return value?.case ?? value;
}

function currentCmoMonitor(caseId) {
  const raw = psql(`
    select json_build_object(
      'id', i.id,
      'identifier', i.identifier,
      'status', i.status,
      'nextCheckAt', i.monitor_next_check_at
    )::text
    from pipeline_case_issue_links link
    join issues i on i.id=link.issue_id
    join agents a on a.id=i.assignee_agent_id
    where link.company_id=${q(COMPANY_ID)}::uuid
      and link.case_id=${q(caseId)}::uuid
      and link.retired_at is null
      and link.role='automation'
      and i.status='in_progress'
      and i.monitor_next_check_at is not null
      and a.name='Chief Marketing Officer'
    order by i.monitor_next_check_at asc, i.updated_at desc
    limit 1;
  `);
  return raw ? JSON.parse(raw) : null;
}

async function main() {
  assertLivePolicy();
  const week = kyivIsoWeekKey();
  const caseKey = `growth:topic-inventory-refill:${week}`;
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${q(keyId)}::uuid, ${q(USER_ID)}, 'rearm-current-topic-refill-after-policy-restore',
      ${q(createHash("sha256").update(token).digest("hex"))}, now()+interval '15 minutes');
  `);

  try {
    const pipelines = await request(token, "GET", `/companies/${COMPANY_ID}/pipelines`);
    const growth = pipelines.find((pipeline) => pipeline.key === "astrogen-growth-actions");
    if (!growth) throw new Error("Growth pipeline is missing");
    const rows = await request(token, "GET", `/pipelines/${growth.id}/cases?caseKey=${encodeURIComponent(caseKey)}&terminal=false&limit=10&offset=0`);
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new Error(`Expected exactly one current refill case for ${caseKey}`);
    }
    let detail = await request(token, "GET", `/cases/${rows[0].case.id}`);
    let refill = caseRow(detail);
    const alreadyRearmed = detail.stage?.key === "executing"
      && refill.fields?.blockerClass == null
      && refill.fields?.executionStatus === "provider_policy_restored";

    if (!alreadyRearmed) {
      if (detail.stage?.key !== "external_wait" || refill.fields?.blockerClass !== "trend_semantic_execution_policy_locked") {
        throw new Error(`Refusing rearm from ${detail.stage?.key ?? "unknown"}/${String(refill.fields?.blockerClass ?? "none")}`);
      }
      if (!APPLY) {
        console.log(JSON.stringify({ mode: "dry-run", caseId: refill.id, caseKey, stage: detail.stage?.key }, null, 2));
        return;
      }

      const backup = await request(token, "POST", "/instance/database-backups", {});
      await request(token, "PATCH", `/cases/${refill.id}`, {
        expectedVersion: refill.version,
        fieldPatch: {
          blockerClass: null,
          blockerOwner: null,
          blockerAction: null,
          nextReviewAt: null,
          ownerActionRequired: false,
          executionStatus: "provider_policy_restored",
          policyRestoredAt: new Date().toISOString(),
          policyRestoreEvidence: "trend-topic-policy-v14:liveEnabled=true; approved candidate cache=read_write",
        },
      });
      detail = await request(token, "GET", `/cases/${refill.id}`);
      refill = caseRow(detail);
      await request(token, "POST", `/cases/${refill.id}/transition`, {
        toStageKey: "executing",
        expectedVersion: refill.version,
        reason: "The company-scoped trend policy is live again; resume the existing bounded refill continuation.",
      });
      detail = await request(token, "GET", `/cases/${refill.id}`);
      refill = caseRow(detail);
      if (detail.stage?.key !== "executing" || refill.fields?.blockerClass != null) {
        throw new Error("Refill rearm did not leave the existing case executable");
      }
      refill.backup = backup;
    }

    const monitor = currentCmoMonitor(refill.id);
    if (!monitor) throw new Error("Current refill has no in-progress CMO monitor to wake");
    if (APPLY) await request(token, "POST", `/issues/${monitor.id}/monitor/check-now`, {});

    console.log(JSON.stringify({
      ok: true,
      mode: APPLY ? (alreadyRearmed ? "already-rearmed-monitor-woken" : "rearmed-monitor-woken") : "dry-run",
      caseId: refill.id,
      caseKey,
      stage: detail.stage?.key,
      monitorIssue: monitor,
      policy: "astrogen-trend-topic-v14/liveEnabled=true/read_write",
    }, null, 2));
  } finally {
    psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
