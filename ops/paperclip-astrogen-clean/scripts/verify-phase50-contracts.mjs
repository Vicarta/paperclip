#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "../../..");

function read(path) {
  return readFileSync(resolve(ROOT, path), "utf8");
}

function requireText(source, needle, label) {
  if (!source.includes(needle)) throw new Error(`${label} is missing: ${needle}`);
}

function forbidText(source, needle, label) {
  if (source.includes(needle)) throw new Error(`${label} is forbidden: ${needle}`);
}

const trendPolicy = read("ops/paperclip-astrogen-clean/reference/trend-topic-policy.yaml");
const searchDemandPolicy = read("ops/paperclip-astrogen-clean/reference/search-demand-policy.yaml");
const curriculum = read("ops/paperclip-astrogen-clean/reference/western-astrology-curriculum.yaml");
const semanticProjectPolicy = read("ops/paperclip-astrogen-clean/reference/semantic-core-project-policy.json");
const pipelines = read("ops/paperclip-astrogen-clean/manifests/pipelines.yaml");
const routines = read("ops/paperclip-astrogen-clean/manifests/routines.yaml");
const workflows = read("ops/paperclip-astrogen-clean/manifests/workflows.yaml");
const plugins = read("ops/paperclip-astrogen-clean/manifests/plugins.yaml");
const outcomes = read("ops/paperclip-astrogen-clean/manifests/outcome-slos.yaml");
const bootstrap = read("ops/paperclip-astrogen-clean/scripts/bootstrap-astrogen-growth-os.mjs");
const launcher = read("ops/paperclip-astrogen-clean/scripts/run-low-inventory-trend-discovery.mjs");
const trendOverlay = read("ops/paperclip-astrogen-clean/Dockerfile.semantic-audience-trend-overlay");
const sharedValidator = read("local-paperclip/packages/shared/src/validators/pipeline.ts");
const pipelineService = read("local-paperclip/server/src/services/pipelines.ts");
const pipelineTests = read("local-paperclip/server/src/__tests__/pipelines-service.test.ts");

for (const segment of [
  "life_decisions",
  "relationships",
  "self_reflection",
  "family_and_parenting",
  "expert_selection",
]) {
  requireText(trendPolicy, `- id: ${segment}`, `trend policy segment ${segment}`);
  requireText(launcher, `"${segment}"`, `launcher segment ${segment}`);
}

for (const [track, target] of Object.entries({
  western_astrology_learning: 12,
  audience_applied_questions: 5,
  audience_trends: 3,
  trust_expert_method_boundaries: 3,
  commercial_unmet_demand: 2,
})) {
  requireText(trendPolicy, `${track}: ${target}`, `trend policy track ${track}`);
  requireText(pipelines, `${track}: ${target}`, `native grouped quota track ${track}`);
}

requireText(trendPolicy, "version: astrogen-trend-topic-v14", "trend policy version");
requireText(trendPolicy, "liveEnabled: true", "bounded live trend execution");
requireText(trendPolicy, "providerCacheModeForApprovedCandidateBatch: read_write", "approved provider cache mode");
requireText(trendPolicy, "paidCandidateBatchLimit: 10", "approved provider candidate bound");
forbidText(trendPolicy, "liveEnabled: false", "obsolete provider execution lock");
requireText(trendPolicy, "currentSignalRequired: true", "trend current signal gate");
requireText(trendPolicy, "everyCandidateRequiresCurrentSignal: true", "candidate current signal gate");
requireText(trendPolicy, "clinical or psychotherapy terminology as the primary trend lane", "clinical primary lane guard");
requireText(trendPolicy, "trendSemanticProjectId: astrogen-audience-trends-ukraine", "audience trend project id");
requireText(trendPolicy, "semanticValidationProjectId: astrogen-ukraine", "semantic validation project id");
requireText(trendPolicy, "productsFieldForbidden: true", "products forbidden in trend request");
requireText(trendPolicy, "trendOpportunityQueue", "visible trend opportunity queue");
requireText(trendPolicy, "minimumEligibleTopics: 25", "portfolio total target");
requireText(trendPolicy, "hardQuota: false", "audience segments are diversity guardrails");
requireText(trendPolicy, "contentPortfolioTrack: western_astrology_learning", "western astrology curriculum track");
requireText(trendPolicy, "secondaryAudienceSegmentsDoNotCount: true", "no segment double count");
requireText(trendPolicy, "maximumLiveRunsPerKyivDay: 1", "bounded focused report daily cap");
requireText(trendPolicy, "maximumLiveRunsPerCampaign: 3", "bounded campaign cap");
requireText(trendPolicy, "contentPlanDocumentKey: next-content-plan", "durable content plan key");
requireText(trendPolicy, "primary_audience_segment_id is not a tool field", "focused segment MCP mapping");
requireText(trendPolicy, "reviewed_fingerprints is not a tool field", "reviewed fingerprint MCP mapping");
requireText(trendPolicy, "acceptedSemanticCandidatesAreNotReadyTopics: true", "semantic candidates are not ready topics");
requireText(trendPolicy, "accepted_for_search_demand_ingestion", "semantic validation handoff disposition");
requireText(trendPolicy, "nativeOpportunityUnit: one intent cluster", "cluster-level native opportunity unit");
requireText(trendPolicy, "targetArticlesPerEuropeKievMonth: 2", "audience editorial monthly target");
requireText(trendPolicy, "maximumArticlesPerEuropeKievMonth: 4", "audience editorial monthly cap");
requireText(searchDemandPolicy, "version: astrogen-search-demand-v8", "search-demand policy version");
requireText(curriculum, "version: astrogen-western-astrology-curriculum-v1", "curriculum version");
requireText(curriculum, "newConceptsPerArticle: 1", "one-concept teaching contract");
requireText(curriculum, "termKey: cusp", "house cusp supporting gloss");
requireText(curriculum, "curriculumNodeId: wa-04-house", "house prerequisite node");
requireText(curriculum, "cmsDraftId: 137", "rejected overloaded draft 137");
requireText(curriculum, "cmsDraftId: 138", "rejected overloaded draft 138");
requireText(searchDemandPolicy, "unitOfWork: one search-demand opportunity per distinct reader intent cluster", "search-demand cluster unit");
requireText(searchDemandPolicy, "count unique intentClusterKey values", "search-demand unique cluster counting");
requireText(searchDemandPolicy, "portfolioLaneValue: audience_interest_editorial", "audience editorial lane");
requireText(semanticProjectPolicy, '"requires_editorial_bridge": true', "semantic audience-interest editorial bridge");
requireText(semanticProjectPolicy, '"domain_id": "digital_relationship_culture"', "semantic relationship audience domain");
requireText(trendPolicy, "product_narrowing_contamination", "trend product narrowing contamination guard");
requireText(trendPolicy, "productBridgeRule", "trend product bridge boundary");
requireText(trendPolicy, "never infer from accepted candidates or search-demand cases", "native topic count source");
requireText(routines, "project_id=astrogen-audience-trends-ukraine", "routine audience trend project id");
requireText(routines, "do not send products", "routine products forbidden");
requireText(routines, "explicit mode=provider", "routine canonical semantic provider mode");
requireText(routines, "provider_cache_mode=read_write", "routine approved semantic provider cache mode");
forbidText(routines, "run-layer-and-wait with explicit mode=live", "routine legacy semantic live mode");
requireText(workflows, "productSeeds: forbidden", "workflow products forbidden");
requireText(plugins, "trendProjectId: astrogen-audience-trends-ukraine", "plugin manifest trend project id");
requireText(plugins, "trendProductSeeds: forbidden", "plugin manifest product seed guard");
requireText(pipelines, "readyLowWaterMark: 25", "native topic refill threshold");
requireText(pipelines, "additionalStageKeys: [reserved]", "ready plus reserved native gate");
requireText(pipelines, "groupByField: contentPortfolioTrack", "native grouped quota field");
requireText(pipelines, "transitionFieldRequirements:", "native transition field gate");
requireText(pipelines, "supportingTerminologyFinalReviewStatus", "supporting-term final gate");
requireText(pipelines, "variant exactly soft", "canonical Коротко pipeline style");
requireText(pipelines, "requiredFields: [intentClusterKey, clusterDedupeKey", "native cluster field requirements");
requireText(pipelines, "minimumCountByGroup:", "native per-track quota map");
requireText(routines, "next-content-plan is a real case document", "routine content plan proof");
requireText(routines, "acceptedSemanticCandidateCount never increments ready or reserved topic inventory", "routine handoff count separation");
requireText(routines, "validation children and semantic-core agents do not require pipelines:write", "routine semantic-core write separation");
requireText(routines, "count unique intentClusterKey values", "routine unique cluster counting");
requireText(routines, "at most four article cases", "routine audience editorial monthly cap");
requireText(routines, "they must not say the semantic-core assignee will materialize native search-demand cases", "routine validation-child wording guard");
requireText(workflows, "contentPortfolioTrack targets 12/5/3/3/2", "workflow portfolio SLO");
requireText(workflows, "accepted candidate count is never topic inventory count", "workflow handoff count separation");
requireText(workflows, "semantic-core validation agents do not need pipelines:write", "workflow semantic-core write separation");
requireText(workflows, "native case materialization belongs to the ingestion owner", "workflow validation-child wording guard");
requireText(workflows, "one canonical opportunity with supportingQueries", "workflow cluster grouping");
requireText(outcomes, "ready plus reserved future-topic inventory is below 25", "outcome SLO");
requireText(bootstrap, "secondary segments never satisfy another quota", "agent no-double-count contract");
requireText(bootstrap, "1-10 explicit \\`candidate_keywords\\`", "agent bounded semantic batch");
requireText(bootstrap, "\\`mode=provider\\`", "agent canonical semantic provider mode");
requireText(bootstrap, "\\`provider_cache_mode=read_write\\`", "agent approved semantic provider cache mode");
forbidText(bootstrap, "\\`mode=live\\`, \\`provider_cache_mode=read_write\\`", "agent legacy semantic execution contract");
requireText(trendPolicy, "explicit mode=provider and provider_cache_mode=read_write", "review materialization provider contract");
forbidText(trendPolicy, "original partition once with explicit mode=live", "review legacy semantic live mode");
requireText(bootstrap, "linked-case-output contract", "linked case output writeback contract");
requireText(bootstrap, "Do not PATCH source growth-case fields", "delegated source case field write guard");
requireText(bootstrap, "project_id=astrogen-audience-trends-ukraine", "agent audience trend project id");
requireText(bootstrap, "trendOpportunityQueue", "agent visible trend queue contract");
requireText(bootstrap, "When a trend validation handoff has \\`acceptedSemanticCandidates\\` but no \\`createdSearchDemandCaseIds\\`", "content strategist trend ingestion ownership");
requireText(bootstrap, "must not create a CTO permission task", "semantic-core permission escalation guard");
requireText(bootstrap, "Create or reuse one canonical case per \\`intentClusterKey\\`", "agent cluster ingestion contract");
requireText(bootstrap, "at most four article cases reserved or delivered", "agent audience editorial monthly cap");
requireText(bootstrap, "do not say the semantic-core assignee will materialize native search-demand cases", "agent validation-child wording guard");
requireText(launcher, "portfolio-campaign", "segment campaign launcher mode");
requireText(launcher, "target-audience-segment", "focused segment launcher option");
requireText(launcher, "productSeedForbiddenForTrendDiscovery", "launcher product seed guard");
requireText(launcher, "contentPortfolioTrack: \"audience_trends\"", "trend-only portfolio lane");
requireText(trendOverlay, "ASTROGEN_TREND_PROJECT_REQUIRED", "runtime trend project guard overlay");
requireText(trendOverlay, "ASTROGEN_AUDIENCE_TREND_PRODUCTS_FORBIDDEN", "runtime product seed guard overlay");
requireText(sharedValidator, "minimumCountByGroup", "shared per-track quota schema");
requireText(sharedValidator, "requiredArrayLengths", "conditional array-length gate schema");
requireText(sharedValidator, "requiredFieldValues", "exact transition status gate schema");
requireText(sharedValidator, "singleItemArrayMatchesField", "primary-concept equality gate schema");
requireText(pipelineService, "pipeline_stage_group_quota_below_minimum", "native grouped quota enforcement");
requireText(pipelineService, "pipeline_case_required_array_length_mismatch", "native one-concept array-length enforcement");
requireText(pipelineService, "pipeline_case_required_field_value_mismatch", "native pass-status enforcement");
requireText(pipelineService, "pipeline_case_single_item_array_field_mismatch", "native primary-concept equality enforcement");
requireText(pipelineTests, "counts multiple eligible stages and enforces per-field inventory quotas", "grouped quota regression test");

console.log(JSON.stringify({ ok: true, phase: 50, policy: "portfolio-12-5-3-3-2" }, null, 2));
