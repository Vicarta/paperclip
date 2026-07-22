#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const APPLY = process.argv.includes("--apply");
const VERIFY = process.argv.includes("--verify");
const TRACK_TARGETS = {
  western_astrology_learning: 12,
  audience_applied_questions: 5,
  audience_trends: 3,
  trust_expert_method_boundaries: 3,
  commercial_unmet_demand: 2,
};
const COMPATIBILITY_FIELDS = {
  clusterLane: "compatibility_reference",
  allocationFamily: "zodiac_compatibility",
  contentPortfolioTrack: "audience_applied_questions",
  portfolioLane: "search_demand_core",
};

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

function q(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function jsonRows(sql) {
  return psql(sql).split("\n").map((value) => value.trim()).filter(Boolean).map(JSON.parse);
}

function kyivIsoWeek() {
  const calendarDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kiev",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [year, month, dayOfMonth] = calendarDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, dayOfMonth));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function compatibilityCases() {
  return jsonRows(`
    select json_build_object(
      'id', c.id,
      'caseKey', c.case_key,
      'pipelineKey', p.key,
      'stageKey', ps.key,
      'version', c.version,
      'fields', c.fields
    )::text
    from pipeline_cases c
    join pipelines p on p.id=c.pipeline_id
    join pipeline_stages ps on ps.id=c.stage_id
    where c.company_id=${q(COMPANY_ID)}::uuid
      and c.retired_at is null
      and p.key in ('astrogen-search-demand-opportunities','astrogen-topic-inventory','astrogen-article-production')
      and (
        c.fields->>'intentClusterKey' like 'zodiac-compatibility:%'
        or c.fields->>'clusterLane'='compatibility_reference'
      )
    order by p.key,c.created_at;
  `);
}

function trackCounts() {
  const counts = Object.fromEntries(Object.keys(TRACK_TARGETS).map((key) => [key, 0]));
  const rows = jsonRows(`
    select json_build_object(
      'track', c.fields->>'contentPortfolioTrack',
      'count', count(*)::int
    )::text
    from pipeline_cases c
    join pipelines p on p.id=c.pipeline_id
    join pipeline_stages ps on ps.id=c.stage_id
    where c.company_id=${q(COMPANY_ID)}::uuid
      and p.key='astrogen-topic-inventory'
      and c.retired_at is null
      and c.terminal_kind is null
      and ps.key in ('ready','reserved')
    group by c.fields->>'contentPortfolioTrack';
  `);
  for (const row of rows) {
    if (row.track in counts) counts[row.track] = Number(row.count);
  }
  return counts;
}

function currentRefill() {
  const caseKey = `growth:topic-inventory-refill:${kyivIsoWeek()}`;
  const rows = jsonRows(`
    select json_build_object(
      'id', c.id,
      'caseKey', c.case_key,
      'stageKey', ps.key,
      'version', c.version,
      'fields', c.fields
    )::text
    from pipeline_cases c
    join pipelines p on p.id=c.pipeline_id
    join pipeline_stages ps on ps.id=c.stage_id
    where c.company_id=${q(COMPANY_ID)}::uuid
      and p.key='astrogen-growth-actions'
      and c.case_key=${q(caseKey)}
      and c.retired_at is null
    order by c.updated_at desc
    limit 1;
  `);
  if (rows.length !== 1) throw new Error(`Canonical refill not found: ${caseKey}`);
  return rows[0];
}

function hasCompatibilityFields(pipelineCase) {
  return Object.entries(COMPATIBILITY_FIELDS).every(([key, value]) => pipelineCase.fields?.[key] === value);
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
  if (!response.ok) {
    throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 2000)}`);
  }
  return text ? JSON.parse(text) : null;
}

async function main() {
  if (process.argv.slice(2).some((argument) => !["--apply", "--verify"].includes(argument))) {
    throw new Error("Usage: repair-content-source-lane-coexistence.mjs [--apply] [--verify]");
  }
  const before = compatibilityCases();
  const beforeMissing = before.filter((pipelineCase) => !hasCompatibilityFields(pipelineCase));
  if (!APPLY) {
    console.log(JSON.stringify({
      mode: "dry-run",
      compatibilityCaseCount: before.length,
      missingCompatibilityFields: beforeMissing.map(({ id, caseKey, pipelineKey, stageKey }) => ({ id, caseKey, pipelineKey, stageKey })),
      trackCounts: trackCounts(),
      refill: currentRefill(),
    }, null, 2));
    return;
  }

  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  psql(`
    insert into board_api_keys (id,user_id,name,key_hash,expires_at)
    values (${q(keyId)}::uuid,${q(USER_ID)},'repair-content-source-lane-coexistence',
      ${q(createHash("sha256").update(token).digest("hex"))},now()+interval '20 minutes');
  `);

  try {
    const backup = await request(token, "POST", "/instance/database-backups", {});
    const patchedCases = [];
    for (const pipelineCase of beforeMissing) {
      const detail = await request(token, "GET", `/cases/${pipelineCase.id}`);
      const updated = await request(token, "PATCH", `/cases/${pipelineCase.id}`, {
        fieldPatch: COMPATIBILITY_FIELDS,
        expectedVersion: detail.case.version,
      });
      patchedCases.push({
        id: pipelineCase.id,
        caseKey: pipelineCase.caseKey,
        pipelineKey: pipelineCase.pipelineKey,
        version: updated.case?.version ?? updated.version ?? null,
      });
    }

    const counts = trackCounts();
    let refill = currentRefill();
    const semanticDeficits = Object.fromEntries(Object.entries(TRACK_TARGETS)
      .filter(([track, target]) => track !== "audience_trends" && counts[track] < target)
      .map(([track, target]) => [track, target - counts[track]]));
    const trendDeficit = Math.max(0, TRACK_TARGETS.audience_trends - counts.audience_trends);
    const refillDetail = await request(token, "GET", `/cases/${refill.id}`);
    await request(token, "PATCH", `/cases/${refill.id}`, {
      fieldPatch: {
        actionType: "topic_inventory_refill",
        executionStatus: "active_multi_source_refill",
        blockerClass: null,
        ownerActionRequired: false,
        nextReviewAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        contentPortfolioTrackTargets: TRACK_TARGETS,
        contentPortfolioTrackCounts: counts,
        sourceLanePolicyVersion: "content-source-coexistence-v1",
        sourceLaneContinuations: {
          semantic_core_and_curriculum: {
            status: Object.keys(semanticDeficits).length > 0 ? "refill_required" : "satisfied",
            deficits: semanticDeficits,
            maximumActiveContinuations: 1,
          },
          audience_trends: {
            status: trendDeficit > 0 ? "refill_required" : "satisfied",
            deficit: trendDeficit,
            maximumActiveContinuations: 1,
          },
        },
        allocationFamilyCaps: { zodiac_compatibility: 1 },
      },
      expectedVersion: refillDetail.case.version,
    });
    refill = currentRefill();
    if (["external_wait", "measured"].includes(refill.stageKey) && (trendDeficit > 0 || Object.keys(semanticDeficits).length > 0)) {
      const transitioned = await request(token, "POST", `/cases/${refill.id}/transition`, {
        toStageKey: "executing",
        expectedVersion: refill.version,
        reason: "Independent semantic/curriculum and audience-trend source lanes still have portfolio deficits.",
      });
      refill = { ...refill, stageKey: transitioned.stage?.key ?? "executing" };
    }

    const campaignRows = jsonRows(`
      select json_build_object('id',id,'identifier',identifier,'status',status)::text
      from issues
      where company_id=${q(COMPANY_ID)}::uuid and identifier='AST-1297'
      limit 1;
    `);
    let compatibilityCampaign = campaignRows[0] ?? null;
    if (compatibilityCampaign?.status === "blocked") {
      const issue = await request(token, "GET", `/issues/${compatibilityCampaign.id}`);
      const blockers = Array.isArray(issue.blockedBy) ? issue.blockedBy : [];
      const hasLiveBlocker = blockers.some((blocker) => !["done", "cancelled"].includes(blocker.status));
      if (!hasLiveBlocker) {
        compatibilityCampaign = await request(token, "PATCH", `/issues/${compatibilityCampaign.id}`, {
          resume: true,
          blockedByIssueIds: [],
          comment: "Системний контур оновлено: compatibility cases мають окрему allocationFamily з лімітом 1 денний слот, а trend і semantic/curriculum refill працюють незалежно. Продовжуйте контроль уже створених native opportunities; не створюйте прямі article tasks.",
        });
      }
    }

    const after = compatibilityCases();
    const afterMissing = after.filter((pipelineCase) => !hasCompatibilityFields(pipelineCase));
    if (afterMissing.length > 0) throw new Error(`Compatibility field migration incomplete: ${afterMissing.length}`);
    if (currentRefill().stageKey !== "executing") throw new Error("Canonical refill is not executing after coexistence repair");

    console.log(JSON.stringify({
      mode: "apply",
      backup: { backupFile: backup.backupFile ?? null, sizeBytes: backup.sizeBytes ?? null },
      patchedCases,
      compatibilityCaseCount: after.length,
      trackCounts: counts,
      sourceLaneDeficits: { semantic_core_and_curriculum: semanticDeficits, audience_trends: trendDeficit },
      refill: currentRefill(),
      compatibilityCampaign: compatibilityCampaign ? {
        identifier: compatibilityCampaign.identifier,
        status: compatibilityCampaign.status,
      } : null,
    }, null, 2));
  } finally {
    psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
  }

  if (VERIFY) {
    const missing = compatibilityCases().filter((pipelineCase) => !hasCompatibilityFields(pipelineCase));
    if (missing.length > 0) throw new Error(`Verification failed: ${missing.length} compatibility cases are incomplete`);
    console.log(JSON.stringify({ verified: true, refillStage: currentRefill().stageKey, trackCounts: trackCounts() }));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
