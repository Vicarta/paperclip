#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const APPLY = process.argv.includes("--apply");

const trackTargets = {
  western_astrology_learning: 12,
  audience_applied_questions: 5,
  audience_trends: 3,
  trust_expert_method_boundaries: 3,
  commercial_unmet_demand: 2,
};

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
  if (!response.ok) throw new Error(`${method} ${pathname}: ${response.status} ${text.slice(0, 1200)}`);
  return text ? JSON.parse(text) : null;
}

function caseRow(value) {
  return value?.case ?? value;
}

function isLineageValidTopic(row, topicPipelineId) {
  const topic = row?.case;
  return topic?.pipelineId === topicPipelineId
    && topic?.fields?.selectedAction === "new_article"
    && typeof topic?.fields?.contentPortfolioTrack === "string"
    && row?.parentCase?.pipeline?.key === "astrogen-search-demand-opportunities"
    && row?.parentCase?.case?.id === topic?.parentCaseId;
}

async function main() {
  const requestedCaseKey = process.argv.find((arg) => arg.startsWith("--case-key="))?.slice("--case-key=".length);
  const caseKey = requestedCaseKey ?? `growth:topic-inventory-refill:${kyivIsoWeekKey()}`;
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${q(keyId)}::uuid, ${q(USER_ID)}, 'reconcile-topic-refill-capacity-lanes',
      ${q(createHash("sha256").update(token).digest("hex"))}, now() + interval '15 minutes');
  `);

  try {
    const pipelines = await request(token, "GET", `/companies/${COMPANY_ID}/pipelines`);
    const growth = pipelines.find((pipeline) => pipeline.key === "astrogen-growth-actions");
    const topic = pipelines.find((pipeline) => pipeline.key === "astrogen-topic-inventory");
    if (!growth || !topic) throw new Error("Required native growth/topic pipeline is missing");

    const [refillRows, readyRows, reservedRows] = await Promise.all([
      request(token, "GET", `/pipelines/${growth.id}/cases?caseKey=${encodeURIComponent(caseKey)}&terminal=false&limit=10&offset=0`),
      request(token, "GET", `/pipelines/${topic.id}/cases?stageKey=ready&terminal=false&limit=100&offset=0`),
      request(token, "GET", `/pipelines/${topic.id}/cases?stageKey=reserved&terminal=false&limit=100&offset=0`),
    ]);
    if (!Array.isArray(refillRows) || refillRows.length !== 1) {
      throw new Error(`Expected exactly one canonical refill case for ${caseKey}`);
    }
    if (!Array.isArray(readyRows) || !Array.isArray(reservedRows)) {
      throw new Error("Native topic inventory response must be an array");
    }

    const counts = Object.fromEntries(Object.keys(trackTargets).map((track) => [track, 0]));
    for (const row of [...readyRows, ...reservedRows]) {
      if (!isLineageValidTopic(row, topic.id)) continue;
      const track = row.case.fields.contentPortfolioTrack;
      if (track in counts) counts[track] += 1;
    }
    const nonTrendDeficits = Object.entries(trackTargets)
      .filter(([track, target]) => track !== "audience_trends" && counts[track] < target)
      .map(([track, target]) => ({ track, current: counts[track], target }));

    let detail = await request(token, "GET", `/cases/${refillRows[0].case.id}`);
    let refill = caseRow(detail);
    const currentStage = detail.stage?.key ?? null;
    const blockedByTrendCooldown = currentStage === "external_wait"
      && refill.fields?.ownerActionRequired === false
      && typeof refill.fields?.blockerClass === "string"
      && refill.fields.blockerClass.includes("audience_trends");

    if (!blockedByTrendCooldown) {
      console.log(JSON.stringify({
        ok: true,
        mode: "no-op",
        reason: "Refill is not an audience-trend external cooldown",
        caseKey,
        stage: currentStage,
        nonTrendDeficits,
      }, null, 2));
      return;
    }
    if (nonTrendDeficits.length === 0) {
      console.log(JSON.stringify({
        ok: true,
        mode: "no-op",
        reason: "No non-trend portfolio deficit requires a live continuation",
        caseKey,
        stage: currentStage,
        counts,
      }, null, 2));
      return;
    }
    if (!APPLY) {
      console.log(JSON.stringify({
        ok: true,
        mode: "dry-run",
        caseKey,
        caseId: refill.id,
        stage: currentStage,
        counts,
        nonTrendDeficits,
      }, null, 2));
      return;
    }

    const backup = await request(token, "POST", "/instance/database-backups", {});
    await request(token, "PATCH", `/cases/${refill.id}`, {
      expectedVersion: refill.version,
      fieldPatch: {
        executionStatus: "capacity_refill_requires_non_trend_lane",
        blockerClass: null,
        blockerOwner: null,
        blockerAction: null,
        nextReviewAt: null,
        ownerActionRequired: false,
        capacityPlanningReconciledAt: new Date().toISOString(),
        capacityPlanningDeficits: nonTrendDeficits,
      },
    });
    detail = await request(token, "GET", `/cases/${refill.id}`);
    refill = caseRow(detail);
    await request(token, "POST", `/cases/${refill.id}/transition`, {
      toStageKey: "executing",
      expectedVersion: refill.version,
      reason: "A trend cooldown cannot park separate non-trend portfolio deficits; resume the canonical refill for the next bounded source lane.",
    });
    detail = await request(token, "GET", `/cases/${refill.id}`);
    refill = caseRow(detail);
    if (detail.stage?.key !== "executing" || refill.fields?.blockerClass != null) {
      throw new Error("Refill did not become executable after capacity-lane reconciliation");
    }

    console.log(JSON.stringify({
      ok: true,
      mode: "reconciled",
      caseKey,
      caseId: refill.id,
      stage: detail.stage?.key,
      counts,
      nonTrendDeficits,
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
