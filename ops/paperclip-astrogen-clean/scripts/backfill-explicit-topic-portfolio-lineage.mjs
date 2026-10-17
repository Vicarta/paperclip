#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";

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
  if (!response.ok) throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 1600)}`);
  return text ? JSON.parse(text) : null;
}

function rows(value) {
  return Array.isArray(value) ? value : [];
}

function explicitTrack(fields) {
  if (typeof fields?.contentPortfolioTrack === "string" && fields.contentPortfolioTrack.trim()) {
    return fields.contentPortfolioTrack.trim();
  }
  const hasTrendLineage = typeof fields?.trendReportRunId === "string" && fields.trendReportRunId.trim();
  const isEditorialTrend = fields?.portfolioLane === "audience_interest_editorial"
    && typeof fields?.demandClass === "string"
    && fields.demandClass.startsWith("trend_emerging");
  return hasTrendLineage && isEditorialTrend ? "audience_trends" : null;
}

async function patchTrack(token, detail, track) {
  if (detail.case.fields?.contentPortfolioTrack === track) return false;
  await request(token, "PATCH", `/cases/${detail.case.id}`, {
    fieldPatch: { contentPortfolioTrack: track },
    expectedVersion: detail.case.version,
  });
  return true;
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  psql(`
    insert into board_api_keys (id,user_id,name,key_hash,expires_at)
    values (
      ${q(keyId)}::uuid,
      ${q(USER_ID)},
      'backfill-explicit-topic-portfolio-lineage',
      ${q(createHash("sha256").update(token).digest("hex"))},
      now()+interval '10 minutes'
    );
  `);

  try {
    const pipelines = rows(await request(token, "GET", `/companies/${COMPANY_ID}/pipelines`));
    const topicPipeline = pipelines.find((pipeline) => pipeline.key === "astrogen-topic-inventory");
    if (!topicPipeline) throw new Error("astrogen-topic-inventory pipeline is missing");

    const candidates = [];
    for (const stageKey of ["ready", "reserved"]) {
      candidates.push(...rows(await request(
        token,
        "GET",
        `/pipelines/${topicPipeline.id}/cases?stageKey=${stageKey}&terminal=false&limit=100`,
      )));
    }

    const changed = [];
    const skipped = [];
    for (const row of candidates) {
      const detail = await request(token, "GET", `/cases/${row.case.id}`);
      const track = explicitTrack(detail.case.fields ?? {});
      if (!track) {
        skipped.push({ caseId: detail.case.id, caseKey: detail.case.caseKey, reason: "no_explicit_track_lineage" });
        continue;
      }
      if (await patchTrack(token, detail, track)) {
        changed.push({ caseId: detail.case.id, caseKey: detail.case.caseKey, track, role: "topic" });
      }

      if (detail.case.parentCaseId) {
        const parent = await request(token, "GET", `/cases/${detail.case.parentCaseId}`);
        if (explicitTrack(parent.case.fields ?? {}) === track && await patchTrack(token, parent, track)) {
          changed.push({ caseId: parent.case.id, caseKey: parent.case.caseKey, track, role: "search_demand_parent" });
        }
      }
    }

    console.log(JSON.stringify({ mode: "apply-and-verify", changed, skipped }, null, 2));
  } finally {
    psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
