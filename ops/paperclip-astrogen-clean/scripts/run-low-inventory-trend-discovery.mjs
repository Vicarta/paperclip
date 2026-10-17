#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const ROUTINE_TITLE = "Monthly Astrogen trend discovery";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const CONTENT_PLAN_TARGET = 25;
const AUDIENCE_TREND_TARGET = 3;
const PORTFOLIO_TRACK_TARGETS = {
  western_astrology_learning: 12,
  audience_applied_questions: 5,
  audience_trends: AUDIENCE_TREND_TARGET,
  trust_expert_method_boundaries: 3,
  commercial_unmet_demand: 2,
};
const TREND_PROJECT_ID = "astrogen-audience-trends-ukraine";
const SEMANTIC_VALIDATION_PROJECT_ID = "astrogen-ukraine";
const PRIMARY_AUDIENCE_SEGMENTS = [
  "life_decisions",
  "relationships",
  "self_reflection",
  "family_and_parenting",
  "expert_selection",
];
const TOPIC_COMPLETION_STAGE_KEYS = ["ready", "reserved"];
const TOPIC_SELECTION_STAGE_KEYS = ["candidate", "evidence_ready", "waiting_evidence", "ready", "reserved"];

function option(name) {
  const prefix = `--${name}=`;
  const value = process.argv.slice(2).find((entry) => entry.startsWith(prefix));
  return value ? value.slice(prefix.length).trim() : null;
}

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
    "psql", "-U", "paperclip", "-d", "paperclip",
    "-v", "ON_ERROR_STOP=1", "-At",
  ], sql);
}

function q(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function topicSegmentCounts(stageKeys) {
  const counts = Object.fromEntries(PRIMARY_AUDIENCE_SEGMENTS.map((segment) => [segment, 0]));
  const stageSql = stageKeys.map((stageKey) => q(stageKey)).join(",");
  const rows = psql(`
    select c.fields->>'primaryAudienceSegmentId', count(*)::int
    from pipeline_cases c
    join pipelines p on p.id=c.pipeline_id
    join pipeline_stages ps on ps.id=c.stage_id
    where c.company_id=${q(COMPANY_ID)}::uuid
      and p.key='astrogen-topic-inventory'
      and c.retired_at is null
      and c.terminal_kind is null
      and ps.key in (${stageSql})
    group by 1;
  `).split("\n").map((value) => value.trim()).filter(Boolean);
  for (const row of rows) {
    const [segment, rawCount] = row.split("|");
    if (segment in counts) counts[segment] = Number(rawCount);
  }
  return counts;
}

function topicPortfolioTrackCounts(stageKeys) {
  const counts = Object.fromEntries(Object.keys(PORTFOLIO_TRACK_TARGETS).map((track) => [track, 0]));
  const stageSql = stageKeys.map((stageKey) => q(stageKey)).join(",");
  const rows = psql(`
    select c.fields->>'contentPortfolioTrack', count(*)::int
    from pipeline_cases c
    join pipelines p on p.id=c.pipeline_id
    join pipeline_stages ps on ps.id=c.stage_id
    where c.company_id=${q(COMPANY_ID)}::uuid
      and p.key='astrogen-topic-inventory'
      and c.retired_at is null
      and c.terminal_kind is null
      and ps.key in (${stageSql})
    group by 1;
  `).split("\n").map((value) => value.trim()).filter(Boolean);
  for (const row of rows) {
    const [track, rawCount] = row.split("|");
    if (track in counts) counts[track] = Number(rawCount);
  }
  return counts;
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
  const parsed = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 1200)}`);
  }
  return parsed;
}

function asArray(value, keys) {
  if (Array.isArray(value)) return value;
  for (const key of keys) {
    if (Array.isArray(value?.[key])) return value[key];
  }
  return [];
}

function kyivDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kiev",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function main() {
  const validationWave = Number(option("validation-wave") ?? "1");
  if (!Number.isInteger(validationWave) || validationWave < 1 || validationWave > 3) {
    throw new Error("--validation-wave must be an integer from 1 to 3");
  }
  const reuseTrendReportId = option("reuse-trend-report-id");
  const forceFreshTrendReport = option("force-fresh-trend-report") === "true";
  const portfolioCampaign = option("portfolio-campaign") === "true";
  const campaignId = option("campaign-id") ?? `astrogen-content-portfolio:${kyivDate()}`;
  const priorExhaustedTrendReportId = option("prior-exhausted-trend-report-id");
  if (forceFreshTrendReport && reuseTrendReportId) {
    throw new Error("--force-fresh-trend-report=true cannot be combined with --reuse-trend-report-id");
  }
  if (forceFreshTrendReport && !priorExhaustedTrendReportId && !portfolioCampaign) {
    throw new Error("--prior-exhausted-trend-report-id is required for a fresh report override");
  }
  const requestedTargetSegment = option("target-audience-segment");
  if (requestedTargetSegment && !PRIMARY_AUDIENCE_SEGMENTS.includes(requestedTargetSegment)) {
    throw new Error(`Unsupported --target-audience-segment: ${requestedTargetSegment}`);
  }
  const previousValidationIssueIdentifier = option("previous-validation-issue");
  const previousValidationIssueIdentifiers = (option("previous-validation-issues") ?? previousValidationIssueIdentifier ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const keyHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${q(keyId)}::uuid, ${q(USER_ID)}, 'low-inventory-trend-discovery',
      ${q(keyHash)}, now() + interval '10 minutes');
  `);

  try {
    const [routineResponse, pipelineResponse] = await Promise.all([
      request(token, "GET", `/companies/${COMPANY_ID}/routines`),
      request(token, "GET", `/companies/${COMPANY_ID}/pipelines`),
    ]);
    const routines = asArray(routineResponse, ["items", "routines"]);
    const pipelines = asArray(pipelineResponse, ["items", "pipelines"]);
    const routine = routines.find((candidate) => candidate.title === ROUTINE_TITLE);
    if (!routine) throw new Error(`Routine not found: ${ROUTINE_TITLE}`);
    if (routine.status !== "active") throw new Error(`Trend routine is not active: ${routine.status}`);
    const topicPipeline = pipelines.find((candidate) => candidate.key === "astrogen-topic-inventory");
    if (!topicPipeline) throw new Error("Native topic inventory pipeline is missing");

    const detail = await request(token, "GET", `/routines/${routine.id}`);
    const activeIssue = detail.activeIssue ?? null;
    if (activeIssue && !["done", "cancelled"].includes(activeIssue.status)) {
      process.stdout.write(`${JSON.stringify({
        outcome: "reused_active_run",
        routineId: routine.id,
        issueId: activeIssue.id,
        issueIdentifier: activeIssue.identifier,
        issueStatus: activeIssue.status,
      }, null, 2)}\n`);
      return;
    }

    const analysisDate = kyivDate();
    const segmentCounts = topicSegmentCounts(TOPIC_COMPLETION_STAGE_KEYS);
    const activeSegmentCounts = topicSegmentCounts(TOPIC_SELECTION_STAGE_KEYS);
    const portfolioTrackCounts = topicPortfolioTrackCounts(TOPIC_COMPLETION_STAGE_KEYS);
    const activePortfolioTrackCounts = topicPortfolioTrackCounts(TOPIC_SELECTION_STAGE_KEYS);
    const targetAudienceSegment = requestedTargetSegment ?? [...PRIMARY_AUDIENCE_SEGMENTS]
      .sort((left, right) => activeSegmentCounts[left] - activeSegmentCounts[right])[0];
    const eligiblePlanTopicCount = Object.values(portfolioTrackCounts).reduce((sum, count) => sum + count, 0);
    if (portfolioCampaign && portfolioTrackCounts.audience_trends >= AUDIENCE_TREND_TARGET) {
      process.stdout.write(`${JSON.stringify({
        outcome: "audience_trend_track_target_already_met",
        campaignId,
        eligiblePlanTopicCount,
        portfolioTrackCounts,
        segmentCounts,
      }, null, 2)}\n`);
      return;
    }
    const reportKey = forceFreshTrendReport
      ? `portfolio-fresh:${targetAudienceSegment}`
      : reuseTrendReportId ?? `latest-or-new:${targetAudienceSegment}`;
    const idempotencyKey = `astrogen-low-inventory-trend:${analysisDate}:${campaignId}:${reportKey}:wave-${validationWave}:synchronous-controls-v3`;
    const descriptionAppendix = [
      "## Current run controls",
      "",
      `- validationWave: ${validationWave} of 3`,
      `- portfolioCampaign: ${portfolioCampaign}`,
      `- campaignId: ${campaignId}`,
      `- contentPlanTarget: ${CONTENT_PLAN_TARGET}`,
      `- contentPortfolioTrack: audience_trends`,
      `- audienceTrendTarget: ${AUDIENCE_TREND_TARGET}`,
      `- contentPortfolioTrackTargets: ${JSON.stringify(PORTFOLIO_TRACK_TARGETS)}`,
      `- contentPortfolioTrackCounts: ${JSON.stringify(portfolioTrackCounts)}`,
      `- activeContentPortfolioTrackCounts: ${JSON.stringify(activePortfolioTrackCounts)}`,
      `- eligiblePlanTopicCount (ready + reserved): ${eligiblePlanTopicCount}`,
      `- primaryAudienceSegmentCounts: ${JSON.stringify(segmentCounts)}`,
      `- activePrimaryAudienceSegmentCounts (candidate + evidence_ready + waiting_evidence + ready + reserved): ${JSON.stringify(activeSegmentCounts)}`,
      `- targetAudienceSegment: ${targetAudienceSegment}`,
      `- reuseTrendReportId: ${reuseTrendReportId ?? "none; generate only if no reusable live report exists"}`,
      `- forceFreshTrendReport: ${forceFreshTrendReport}`,
      `- priorExhaustedTrendReportId: ${priorExhaustedTrendReportId ?? "none"}`,
      `- previousValidationIssueIdentifiers: ${previousValidationIssueIdentifiers.length > 0 ? previousValidationIssueIdentifiers.join(", ") : "none"}`,
      "- this section is the synchronous source of truth for the current run; never infer wave 1 from the base routine description",
      "- read the exact stored report through `get-trend-topic-report` with `runId`; do not substitute the latest fixture report",
      "- inspect every listed previous validation issue and exclude all phrases already submitted, parked, rejected, accepted, covered, or found duplicate",
      ...(forceFreshTrendReport ? [
        "- explicit owner request authorizes one focused live trend report inside the bounded audience_trends portfolio lane",
        `- call generate-trend-topic-report once with project_id=${TREND_PROJECT_ID}, analysis_date=${analysisDate}, only the configured ${targetAudienceSegment} audience segment, cache_policy.strategy=refresh, current Payload CMS existing_content as duplicate context only, and previous_clusters from prior campaign reports when available`,
        "- do not send products; do not put Astrogen product/service/modality terms in project.description, project.market, project.business_context, company_goal, audience_segments.name, or audience_segments.description",
        "- the exhausted report is comparison evidence only and must not be reused as the current report",
      ] : []),
        "- select at most 5 unused concrete Ukrainian phrases only after an evidence-backed current audience signal exists; evergreen how-to/checklist/explainer ideas are not trends without a recent temporal, seasonal, cultural, public-interest, search-behavior, or audience-language shift",
        "- product/service binding is downstream action context only; direct product/modality families and clinical/psychotherapy lanes do not satisfy the trend queue",
      `- every selected phrase must carry contentPortfolioTrack=audience_trends and primaryAudienceSegmentId=${targetAudienceSegment}; audience segments are diversity metadata, not hard quotas`,
      "- delegate semantic validation; do not create topic or article tasks directly",
      "- do not close because a child is merely done; read its `trendIngestionResult` from the child description",
      "- when no search-demand case was created and the wave limit remains, continue with unused eligible clusters for this same primary segment",
      "- do not claim the whole portfolio is measured until ready + reserved inventory satisfies 12/5/3/3/2; this routine is responsible only for audience_trends=3",
      "- update the canonical refill case document next-content-plan with both verifiedTopicPlan and trendOpportunityQueue; comments or chat are not the content plan",
    ].join("\n");
    const result = await request(token, "POST", `/routines/${routine.id}/run`, {
      source: "manual",
      idempotencyKey,
      descriptionAppendix,
      payload: {
        reason: "low_inventory_fallback",
        analysisDate,
        trendProjectId: TREND_PROJECT_ID,
        semanticProjectId: SEMANTIC_VALIDATION_PROJECT_ID,
        portfolioCampaign,
        campaignId,
        eligiblePlanTopicCount,
        segmentCounts,
        activeSegmentCounts,
        portfolioTrackCounts,
        activePortfolioTrackCounts,
        contentPlanTarget: CONTENT_PLAN_TARGET,
        contentPortfolioTrack: "audience_trends",
        audienceTrendTarget: AUDIENCE_TREND_TARGET,
        contentPortfolioTrackTargets: PORTFOLIO_TRACK_TARGETS,
        targetAudienceSegment,
        readyTopicLowWaterMark: CONTENT_PLAN_TARGET,
        validationWave,
        maximumValidationWaves: 3,
        maximumCandidatePhrasesPerWave: 5,
        reuseTrendReportId,
        forceFreshTrendReport,
        trendCacheStrategy: forceFreshTrendReport ? "refresh" : "use_cache",
        priorExhaustedTrendReportId,
        ownerRequestedFreshResearch: forceFreshTrendReport,
        previousValidationIssueIdentifier,
        previousValidationIssueIdentifiers,
        requireStoredTrendReportRead: true,
        audienceSignalFirstTrendDiscovery: true,
        productSeedForbiddenForTrendDiscovery: true,
        trendExistingContentDuplicateContextOnly: true,
        trendProjectIdRequired: TREND_PROJECT_ID,
        requireTrendOpportunityQueueDocument: true,
        excludePreviouslyParkedOrRejectedPhrases: true,
        requireConcreteAudienceSituationOrReaderProblemAnchor: true,
        continueUnusedClustersWhenAllParked: true,
        continueWhenAcceptedPhraseIsCoveredOrDuplicate: true,
        requireParentVisibleIngestionDisposition: true,
        terminalChildStatusAloneIsProof: false,
        requireTrendTopicSearch: true,
        requireCurrentAudienceSignal: true,
        rejectEvergreenAdviceWithoutCurrentSignal: true,
        rejectClinicalTherapyAsPrimaryTrendLane: true,
        rejectProductOrModalityTrendSeed: true,
        requireOnePrimaryAudienceSegmentPerTopic: true,
        secondaryAudienceSegmentsDoNotCount: true,
        requireNextContentPlanDocument: true,
        requireLiveModeWhenNoCurrentLiveReport: true,
        reuseCurrentProjectReportBeforePaidCall: !forceFreshTrendReport,
        semanticValidationRequired: true,
        directSemanticImportForbidden: true,
        directTopicCreationForbidden: true,
        directArticleCreationForbidden: true,
        excludedTopicFamilies: [
          "specific calendar day and month",
          "horoscope for a specific calendar date",
          "birth-date zodiac profile centered on one day and month",
          "horoscope for today",
          "daily horoscope for one zodiac sign",
          "rolling current-day horoscope content",
          "evergreen how-to without current audience signal",
          "clinical psychology or psychotherapy as primary lane",
        ],
      },
    });

    process.stdout.write(`${JSON.stringify({
      outcome: "started",
      routineId: routine.id,
      runId: result.id,
      runStatus: result.status,
      linkedIssueId: result.linkedIssueId,
      idempotencyKey,
      validationWave,
      campaignId,
      targetAudienceSegment,
      eligiblePlanTopicCount,
      portfolioTrackCounts,
      activePortfolioTrackCounts,
      segmentCounts,
      activeSegmentCounts,
      reuseTrendReportId,
      forceFreshTrendReport,
      previousValidationIssueIdentifier,
      previousValidationIssueIdentifiers,
    }, null, 2)}\n`);
  } finally {
    psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
