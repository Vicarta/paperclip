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
  if (source.includes(needle)) throw new Error(`${label} still contains forbidden text: ${needle}`);
}

const pluginManifest = read("local-paperclip/packages/plugins/plugin-semantic-core-mcp-agent-tools/src/manifest.ts");
const pluginWorker = read("local-paperclip/packages/plugins/plugin-semantic-core-mcp-agent-tools/src/worker.ts");
const crawlObserverManifest = read("local-paperclip/packages/plugins/plugin-crawlobserver-agent-tools/src/manifest.ts");
const crawlObserverClient = read("local-paperclip/packages/plugins/plugin-crawlobserver-agent-tools/src/crawlobserver-client.ts");
const routines = read("ops/paperclip-astrogen-clean/manifests/routines.yaml");
const workflows = read("ops/paperclip-astrogen-clean/manifests/workflows.yaml");
const pipelines = read("ops/paperclip-astrogen-clean/manifests/pipelines.yaml");
const bootstrap = read("ops/paperclip-astrogen-clean/scripts/bootstrap-astrogen-growth-os.mjs");
const searchPolicy = read("ops/paperclip-astrogen-clean/reference/search-demand-policy.yaml");
const trendPolicy = read("ops/paperclip-astrogen-clean/reference/trend-topic-policy.yaml");
const semanticProjectPolicy = JSON.parse(read("ops/paperclip-astrogen-clean/reference/semantic-core-project-policy.json"));
const semanticAudience = read("ops/paperclip-astrogen-clean/reference/semantic-core-audience-summary.md");
const trendLauncher = read("ops/paperclip-astrogen-clean/scripts/run-low-inventory-trend-discovery.mjs");
const pipelineRoutes = read("local-paperclip/server/src/routes/pipelines.ts");
const pipelineService = read("local-paperclip/server/src/services/pipelines.ts");
const issueService = read("local-paperclip/server/src/services/issues.ts");
const pipelineCasesReference = read("local-paperclip/skills/paperclip/references/pipeline-cases.md");
const fieldPatchOverlay = read("ops/paperclip-astrogen-clean/Dockerfile.case-field-patch-overlay");

requireText(pluginManifest, "TOOL_NAMES.generateTrendTopicReport", "plugin manifest");
requireText(pluginManifest, "TOOL_NAMES.getTrendTopicReport", "stored trend report reader");
requireText(pluginWorker, "semanticImportAllowed: false", "plugin persistence boundary");
requireText(pluginWorker, "amountMicros", "plugin cost precision");
requireText(routines, "row.parentCase.pipeline.key=astrogen-search-demand-opportunities", "allocator wrapper contract");
requireText(routines, "trend output is portfolio evidence", "allocator trend boundary");
requireText(workflows, "generate-trend-topic-report", "trend workflow");
requireText(pipelines, "A trend phrase must pass the normal semantic-core validation workflow", "search-demand evidence gate");
requireText(pipelines, "from: waiting_evidence, to: expired", "bounded no-coverage terminal transition");
requireText(pipelines, "project_id=astrogen-ukraine", "canonical Semantic Core project ID");
requireText(bootstrap, "direct JSON array of wrapper rows", "bootstrap allocator wrapper contract");
requireText(bootstrap, "Never call \\`prepare_paperclip_import\\` for a trend run", "bootstrap trend import boundary");
requireText(bootstrap, "Never probe guessed aliases", "agent MCP project guard");
requireText(searchPolicy, "owner_policy_calendar_date_topics_paused", "explicit-date pause");
requireText(searchPolicy, "maxTopicsFromSameQueryFamily: 1", "portfolio family bound");
requireText(trendPolicy, "zeroClusters: valid successful outcome", "zero-cluster rule");
requireText(trendPolicy, "directTopicInventoryForbidden: true", "trend topic boundary");
requireText(trendPolicy, "daily horoscope for one zodiac sign", "ephemeral daily horoscope exclusion");
requireText(searchPolicy, "owner_policy_ephemeral_daily_horoscope_paused", "daily horoscope owner pause");
requireText(trendPolicy, "exhaustedReportAllowsFreshRunOnNextKyivDay: true", "exhausted report continuation");
requireText(trendPolicy, "normalMaximumLiveRunsPerKyivDay: 1", "normal trend paid-run daily bound");
requireText(trendPolicy, "maxWavesPerReport: 3", "bounded trend continuation");
requireText(trendPolicy, "candidateReviewIsTerminal: false", "nonterminal semantic review");
requireText(searchPolicy, "demandEvidenceClass=trend_emerging", "emerging trend demand fallback");
requireText(searchPolicy, "productNarrowingContamination", "search-demand product narrowing guard");
requireText(searchPolicy, "trendRefreshRequiresSameAudienceThemeOwner", "trend refresh owner boundary");
requireText(bootstrap, "## Bounded Semantic Review Authority", "validator review authority");
requireText(crawlObserverManifest, "sessionsQuerySchema", "CrawlObserver session inventory schema");
requireText(crawlObserverClient, "RETRYABLE_READ_STATUSES", "CrawlObserver bounded read retry");
requireText(bootstrap, "config.allowedProjectId = \"fe5261b6-e793-44ae-a093-253a19b3c78e\"", "CrawlObserver Astrogen project scope");
requireText(pipelines, "no_action terminates through action_selected -> cancelled", "terminal no-action contract");
requireText(pipelines, "The discovered stage never writes selectedAction", "stage-owned action selection");
requireText(routines, "terminal child status alone never satisfies this gate", "trend parent completion gate");
requireText(workflows, "terminal ingestion has a parent-readable machine result projection", "trend workflow result projection");
requireText(trendPolicy, "terminalStatusAloneIsProof: false", "trend ingestion result projection policy");
requireText(bootstrap, "## trendIngestionResult", "strategist trend ingestion output contract");
requireText(bootstrap, "A terminal validation child is not success evidence by status alone", "CMO trend continuation contract");
requireText(bootstrap, "Never inline a case payload into a shell command", "native case payload shell-safety contract");
requireText(bootstrap, "Never append \\`rm\\`, temp-directory cleanup", "agent mutation cleanup guard");
requireText(bootstrap, "use \\`fieldPatch\\` for incremental top-level field changes", "agent field merge contract");
requireText(pipelineRoutes, "fieldPatch: jsonObjectSchema.optional()", "case field patch API");
requireText(pipelineService, "{ ...(current.fields ?? {}), ...input.fieldPatch }", "atomic case field merge");
requireText(pipelineCasesReference, "Use `fieldPatch` for incremental field updates", "agent case field patch reference");
requireText(pipelineCasesReference, "detail envelope, not a bare case row", "case detail envelope reference");
requireText(pipelineCasesReference, "current content in `.revision.body`", "case document envelope reference");
requireText(pipelineCasesReference, "typed provider/plugin output from `.result.data`", "plugin dispatcher envelope reference");
requireText(fieldPatchOverlay, "/app/skills/paperclip/references/pipeline-cases.md", "runtime field patch reference overlay");
requireText(issueService, "childrenTerminalOutcome?.requireCurrentDirectChild === true", "reserved automation completion guard");
requireText(fieldPatchOverlay, "/app/server/dist/services/issues.js", "runtime reserved completion overlay");
requireText(pipelines, "winning-structure-input.business_context.selected_value_units", "durable selected value unit mapping path");
requireText(pipelines, "executionPolicy monitor", "active Winning Structure issue monitor");
requireText(routines, "partition the wave by layer while keeping at most 5 phrases total", "trend layer routing contract");
requireText(workflows, "correct it once inside the same wave and never sweep all layers", "trend layer correction bound");
requireText(trendPolicy, "blindLayerSweepForbidden: true", "trend layer sweep guard");
requireText(bootstrap, "Require \\`layerValidationMatrix\\` in the trend ingestion result", "CMO layer result gate");
requireText(routines, "core_product_intent is not a candidate-keyword validation layer", "trend core-layer boundary");
requireText(workflows, "never submit core_product_intent to candidate-keyword validation", "workflow core-layer boundary");
requireText(trendPolicy, "unsupportedCandidateLayers:", "trend unsupported candidate layer policy");
requireText(routines, "never combine phrases from different intended layers", "routine materialization partition guard");
requireText(trendPolicy, "partition reviewed phrases by original semanticRunId and intended non-core layer", "review materialization partition policy");
requireText(trendPolicy, "productsFieldForbidden: true", "trend products forbidden");
requireText(trendPolicy, "productNarrowingForbidden: true", "trend product narrowing forbidden");
requireText(trendPolicy, "evidence that the phrase derives from an audience signal", "audience-signal trend review authority");
requireText(trendPolicy, "trendOpportunityQueue", "visible trend queue");
requireText(semanticAudience, "Ширша тема може бути релевантною", "broad audience contract");
requireText(trendLauncher, "force-fresh-trend-report", "owner-requested fresh trend preflight");
requireText(trendLauncher, "cache_policy.strategy=refresh", "fresh trend cache policy");
requireText(pipelines, "A spans-only paragraph is invalid", "layout paragraph text invariant");
requireText(bootstrap, "a spans-only paragraph is invalid", "layout agent paragraph text invariant");
requireText(workflows, "text different from concatenated spans[].text", "workflow paragraph text gate");
requireText(pipelines, "Generic monitorNextCheckAt/monitorNotes fields are not the writable API contract", "verified-stage monitor API contract");
requireText(bootstrap, "Do not create a human interaction, owner request, publication child task", "performance analyst publication monitor contract");
requireText(workflows, "waits on the current verification issue through executionPolicy.monitor", "workflow publication monitor contract");
requireText(pipelines, "Treat the current typed case fields as authoritative", "growth external-wait typed-state authority");
requireText(pipelines, "executionPolicy.monitor.nextCheckAt equal to case.nextReviewAt", "growth cooldown first-class monitor");
requireText(pipelines, "stale blocker closure cannot resume it", "growth cooldown stale-blocker invariant");
requireText(bootstrap, "current typed case fields outrank stale linked issues and artifacts", "CMO cooldown authority contract");
requireText(bootstrap, "Do not resume because an older blocker issue became done", "CMO stale-blocker guard");
for (const layer of ["adjacent_use_case_intent", "audience_need_intent", "audience_interest_intent"]) {
  const policy = semanticProjectPolicy.project_config.semantic_expansion.layer_policies[layer];
  if (!policy) throw new Error(`Semantic Core layer policy is missing: ${layer}`);
  if (policy.requires_product_binding !== false) throw new Error(`${layer} must not require direct product binding`);
  if (policy.requires_topic_domain_match !== true) throw new Error(`${layer} must require topic-domain evidence`);
  if (policy.auto_accept !== false) throw new Error(`${layer} must keep auto acceptance disabled`);
  if (policy.weak_traffic_evidence_membership !== "candidate_review") {
    throw new Error(`${layer} must route weak demand evidence to candidate_review`);
  }
}
forbidText(pipelines, "emerging-trend exception", "native pipeline contract");
forbidText(bootstrap, "typed current emerging-trend exception", "bootstrap agent contract");

console.log(JSON.stringify({
  ok: true,
  checks: 74,
  phase: 49,
}, null, 2));
