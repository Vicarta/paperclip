#!/usr/bin/env node
/**
 * Moves only the current canonical topic refill from a legacy non-owner
 * external wait into its native executing stage after the curriculum-first
 * contracts are live. The stage transition creates the normal CMO automation;
 * this script never creates issues, topics, articles, CMS records, or runs.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const APPLY = process.argv.includes("--apply");

function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
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

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${q(keyId)}::uuid, ${q(USER_ID)}, 'resume-current-refill-through-curriculum',
      ${q(createHash("sha256").update(token).digest("hex"))}, now() + interval '15 minutes');
  `);
  try {
    const pipelines = await request(token, "GET", `/companies/${COMPANY_ID}/pipelines`);
    const growth = pipelines.find((pipeline) => pipeline.key === "astrogen-growth-actions");
    if (!growth) throw new Error("Astrogen growth pipeline is missing");
    const caseKey = `growth:topic-inventory-refill:${kyivIsoWeekKey()}`;
    const rows = await request(token, "GET", `/pipelines/${growth.id}/cases?caseKey=${encodeURIComponent(caseKey)}&terminal=false&limit=10&offset=0`);
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error(`Expected one current canonical refill for ${caseKey}`);
    let detail = await request(token, "GET", `/cases/${rows[0].case.id}`);
    let refill = caseRow(detail);
    const stage = detail.stage?.key ?? null;
    const valid = refill.fields?.actionType === "topic_inventory_refill" && refill.fields?.ownerActionRequired !== true;
    if (!valid) throw new Error("Current refill is not a non-owner topic_inventory_refill case");
    if (stage === "executing") {
      console.log(JSON.stringify({ ok: true, mode: "no-op", reason: "already_executing", caseKey, caseId: refill.id }, null, 2));
      return;
    }
    if (stage !== "external_wait") throw new Error(`Refusing to resume refill from unexpected stage ${stage}`);
    if (!APPLY) {
      console.log(JSON.stringify({
        ok: true,
        mode: "dry-run",
        caseKey,
        caseId: refill.id,
        stage,
        executionStatus: refill.fields?.executionStatus ?? null,
        blockerClass: refill.fields?.blockerClass ?? null,
      }, null, 2));
      return;
    }

    const backup = await request(token, "POST", "/instance/database-backups", {});
    await request(token, "PATCH", `/cases/${refill.id}`, {
      expectedVersion: refill.version,
      fieldPatch: {
        executionStatus: "curriculum_refill_required",
        blockerClass: null,
        blockerOwner: null,
        blockerAction: null,
        ownerActionRequired: false,
        nextReviewAt: null,
        sourceLane: "western_astrology_curriculum",
        sourceLaneReason: "Portfolio deficit requires the first prerequisite-ready missing curriculum node; an empty semantic snapshot is not source exhaustion.",
        resumedAt: new Date().toISOString(),
      },
    });
    detail = await request(token, "GET", `/cases/${refill.id}`);
    refill = caseRow(detail);
    await request(token, "POST", `/cases/${refill.id}/transition`, {
      toStageKey: "executing",
      expectedVersion: refill.version,
      reason: "Resume the canonical refill through the approved western-astrology curriculum lane; no owner action or manual article dispatch is required.",
    });
    const transitionedDetail = await request(token, "GET", `/cases/${refill.id}`);
    if (transitionedDetail.stage?.key !== "executing") throw new Error("Refill did not enter executing");
    console.log(JSON.stringify({
      ok: true,
      mode: "resumed",
      caseKey,
      caseId: refill.id,
      stage: transitionedDetail.stage?.key,
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
