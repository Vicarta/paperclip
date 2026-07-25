#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { routineContracts } from "./bootstrap-astrogen-growth-os.mjs";
import { existsSync, readFileSync } from "node:fs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PIPELINE_MANIFEST = resolve(SCRIPT_DIR, "../manifests/pipelines.yaml");
const AGENT_MANIFEST = resolve(SCRIPT_DIR, "../manifests/agents.yaml");
const SECRET_MANIFEST = resolve(SCRIPT_DIR, "../manifests/secrets.yaml");
const ROUTINE_MANIFEST = resolve(SCRIPT_DIR, "../manifests/routines.yaml");
const WORKFLOW_MANIFEST = resolve(SCRIPT_DIR, "../manifests/workflows.yaml");
const TREND_POLICY = resolve(SCRIPT_DIR, "../reference/trend-topic-policy.yaml");

function loadYaml(pathname) {
  const source = [
    "import json, pathlib, sys, yaml",
    "print(json.dumps(yaml.safe_load(pathlib.Path(sys.argv[1]).read_text()), ensure_ascii=False))",
  ].join("; ");
  const result = spawnSync("python3", ["-c", source, pathname], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function includesAll(value, fragments, label) {
  for (const fragment of fragments) {
    assert(value.toLowerCase().includes(fragment.toLowerCase()), `${label} is missing invariant: ${fragment}`);
  }
}

function main() {
  const manifest = loadYaml(PIPELINE_MANIFEST);
  const agentManifest = loadYaml(AGENT_MANIFEST);
  const secretManifest = loadYaml(SECRET_MANIFEST);
  const routineManifest = loadYaml(ROUTINE_MANIFEST);
  const workflowManifest = loadYaml(WORKFLOW_MANIFEST);
  const trendPolicy = loadYaml(TREND_POLICY);
  assert(manifest.mode === "active", "Native pipeline manifest must be active");
  assert(
    agentManifest.policy?.writerHarness?.adapterType === "claude_local",
    "Primary article writer must use claude_local",
  );
  assert(
    agentManifest.policy?.writerHarness?.openRouterTextGeneration === "disabled",
    "OpenRouter text generation must be disabled",
  );
  assert(
    !secretManifest.secrets?.requiredNow?.some((secret) => secret.key === "openrouter_api_key_4texts"),
    "OpenRouter text key must not be a required clean secret",
  );
  assert(
    secretManifest.secrets?.optionalParked?.some((secret) =>
      secret.key === "openrouter_api_key_4texts"
      && String(secret.activation).includes("disabled")),
    "Legacy OpenRouter text key must be explicitly parked",
  );
  includesAll(JSON.stringify(routineManifest), [
    "authenticated Claude CLI subscription",
    "OpenRouter text generation is disabled",
  ], "Routine writer harness contract");
  const bootstrapSource = readFileSync(resolve(SCRIPT_DIR, "bootstrap-astrogen-growth-os.mjs"), "utf8");
  includesAll(bootstrapSource, [
    '"SEO Blog Article Writer (Claude)"',
    '"claude_local"',
    'model: "sonnet"',
    "maxTurnsPerRun: 32",
    "dangerouslySkipPermissions: true",
    "authenticated \\`claude_local\\` subscription adapter",
  ], "Bootstrap Claude CLI writer contract");
  assert(
    !bootstrapSource.includes("The Claude writer runs through the OpenRouter prompt adapter"),
    "Legacy OpenRouter writer instructions must be absent",
  );

  const topic = manifest.pipelines.find((pipeline) => pipeline.key === "astrogen-topic-inventory");
  assert(topic, "Topic inventory pipeline is missing");
  const ready = topic.stages.find((stage) => stage.key === "ready");
  assert(ready?.config?.breakdown?.targetPipelineKey === "astrogen-article-production", "Ready breakdown must target article production");
  assert(ready.config.breakdown.targetStageKey === "opportunity", "Ready breakdown must target opportunity");
  assert(ready.config.breakdown.advanceTo === "reserved", "Ready breakdown must advance topic to reserved");
  assert(ready.config.breakdown.waitForPieces === true, "Ready breakdown must track child completion");
  assert(ready.config.breakdown.whenFinishedMoveTo === "ready", "Cancelled article fallback must return topic to ready");
  assert(!topic.stageAutomation?.ready, "Ready stage must not have on-enter automation");
  const reserved = topic.stages.find((stage) => stage.key === "reserved");
  const outcome = reserved?.config?.childrenTerminalOutcome;
  assert(outcome?.allDoneToStageKey === "consumed", "Delivered article must consume the reserved topic");
  assert(outcome?.anyCancelledToStageKey === "ready", "Cancelled article must release the reserved topic");
  assert(outcome?.requireCurrentDirectChild === true, "Topic terminal outcome must require the current article child");
  assert(outcome?.childCaseIdField === "consumingArticleCaseId", "Topic terminal outcome must store the article child id");
  assert(outcome?.proofField === "consumingArticleProof", "Topic terminal outcome must store durable terminal proof");
  assert(
    topic.transitions.some((transition) => transition.from === "ready" && transition.to === "rejected_duplicate"),
    "Proven duplicate reconciliation must be able to reject a released topic",
  );
  const article = manifest.pipelines.find((pipeline) => pipeline.key === "astrogen-article-production");
  const draft = article?.stages?.find((stage) => stage.key === "draft");
  assert(
    JSON.stringify(draft?.config?.inlineContextDocumentKeys) === JSON.stringify(["writer-brief"]),
    "Draft stage must inject only the compact writer-brief document",
  );
  assert(draft?.config?.inlineContextMaxChars === 48_000, "Draft writer-brief limit must be 48000 characters");
  assert(draft?.config?.inlineContextRequireComplete === true, "Draft stage must reject incomplete inline context");
  const canonicalCmsAdminPrefix = "https://cms.astrogen.com.ua/admin/collections/blogPosts/";
  const cmsDraft = article.stages.find((stage) => stage.key === "cms_draft");
  const cmoDelivery = article.stages.find((stage) => stage.key === "cmo_delivery");
  assert(
    cmsDraft?.config?.transitionFieldRequirements?.some((requirement) =>
      requirement.toStageKey === "cmo_delivery"
      && requirement.requiredStringPrefixes?.cmsAdminUrl === canonicalCmsAdminPrefix),
    "CMS draft must reject non-canonical admin URLs",
  );
  assert(
    cmoDelivery?.config?.transitionFieldRequirements?.some((requirement) =>
      requirement.toStageKey === "delivered"
      && requirement.requiredStringPrefixes?.cmsAdminUrl === canonicalCmsAdminPrefix),
    "CMO delivery must reject non-canonical admin URLs",
  );
  const imageRecovery = article?.stages?.find((stage) => stage.key === "image_recovery_review");
  assert(imageRecovery?.position === 1350, "CMO image recovery review stage is missing");
  assert(
    article.transitions.some((transition) => transition.from === "image" && transition.to === "image_recovery_review"),
    "Hard visual QA failures must route to the CMO recovery stage",
  );
  assert(
    article.transitions.some((transition) => transition.from === "image_recovery_review" && transition.to === "image"),
    "CMO recovery must return a case to image only through the native pipeline",
  );
  assert(
    article.transitions.some((transition) => transition.from === "image_recovery_review"
      && transition.to === "cms_draft"
      && transition.label === "accept_existing_after_visual_review"),
    "CMO recovery must accept a valid existing candidate without another provider call",
  );
  const winningStructureInstructions = article?.stageAutomation?.winning_structure?.instructions ?? "";
  includesAll(winningStructureInstructions, [
    "mentioned only in evidenceRefs",
    "upstream evidence, not proof that this article case started a run",
    "exactly equals the current remote validation input_hash",
    "start exactly one run for the current taskRevision/idempotency_key",
    "preserve the old run as upstream provenance",
  ], "Winning Structure current-article run lineage");
  const structureReview = article?.stageAutomation?.structure_review;
  assert(
    structureReview?.review?.requestChangesTo === "strategy_input",
    "Structure review content changes must return to strategy_input",
  );
  includesAll(structureReview?.instructions ?? "", [
    "only for same-run re-import or verification of an incomplete import",
    "requires request_changes to strategy_input",
    "never send that class of defect back to the same completed run",
  ], "Structure review loop prevention");
  const growth = manifest.pipelines.find((pipeline) => pipeline.key === "astrogen-growth-actions");
  const growthExecutingInstructions = growth?.stageAutomation?.executing?.instructions ?? "";
  includesAll(growthExecutingInstructions, [
    "needs_manager_action",
    "otherwise it delegates one bounded approval issue to the configured approver",
    "relies on the linked-work terminal wake",
    "must receive the sourceCaseId and a stable resultDocumentKey",
    "a terminal child summary is never a substitute for the document",
    "A consumed topic or delivered article means that curriculum node is already fulfilled",
    "audience_trends is a Paperclip portfolio track, never a Semantic Core layer or plugin enum",
    "delegate the first prerequisite-ready missing curriculum node instead",
    "empty Semantic Core snapshot is not evidence exhaustion",
  ], "Growth manager-only approval handoff");
  const growthExecuting = growth?.stages?.find((stage) => stage.key === "executing");
  assert(
    growthExecuting?.config?.transitionFieldRequirements?.some((requirement) =>
      requirement.toStageKey === "external_wait"
      && requirement.whenCaseField === "actionType"
      && requirement.whenCaseFieldEquals === "topic_inventory_refill"
      && requirement.requiredFieldValues?.ownerActionRequired === true),
    "Topic-inventory refill must not enter external_wait without a real owner action",
  );
  assert(
    JSON.stringify(growthExecuting?.config?.agentFieldAllowedValues?.ownerActionRequired) === JSON.stringify([false]),
    "An agent must not be able to declare a topic refill owner action",
  );
  includesAll(growthExecutingInstructions, [
    "The CMO is a manager, not the external owner",
    "must never change ownerActionRequired from false to true",
  ], "Growth owner-decision authority boundary");
  const growthExternalWaitInstructions = growth?.stageAutomation?.external_wait?.instructions ?? "";
  includesAll(growthExternalWaitInstructions, [
    "regardless of a worker's finalDisposition or blocker label",
    "clear blockerClass/blockerOwner/blockerAction",
    "transition this source case to executing in the same heartbeat",
    "do not schedule a monitor or create recovery work",
    "ownerActionRequired=false is never a valid external_wait state",
    "A zero accepted-keyword snapshot is not evidence that this curriculum lane is exhausted",
    "first prerequisite-ready missing node",
  ], "Growth manager-only approval external-wait exit");

  includesAll(bootstrapSource, [
    "A local Semantic Core snapshot with zero accepted keywords or clusters is not a no-topic result",
    "first prerequisite-ready missing node",
    "never justifies",
    "keep the canonical refill case in \\`executing\\` with typed lane-local cooldown fields",
    "An inactive Paperclip policy is a lane-local monitor inside the canonical refill's executing path",
  ], "Curriculum refill continuation contract");
  assert(
    !bootstrapSource.includes("move the canonical refill case to \\`external_wait\\` with typed bounded-cooldown fields"),
    "A source-lane cooldown must not move the canonical refill to external_wait",
  );
  includesAll(String(trendPolicy.executionPolicy?.enabledBehavior ?? ""), [
    "lane-local monitor",
    "canonical refill executing",
  ], "Trend policy cooldown behavior");
  const pipelineSyncSource = readFileSync(resolve(SCRIPT_DIR, "sync-native-growth-pipelines.mjs"), "utf8");
  includesAll(pipelineSyncSource, [
    "findRestoredPermissionAutomationCases",
    "pipeline_write_forbidden",
    "rerunRestoredPermissionAutomations",
    "/automation/current-stage/rerun",
  ], "Restored pipeline permission automation recovery");

  includesAll(routineContracts.articleSlotAllocator, [
    "POST /api/cases/{topicCaseId}/breakdown",
    "{topicKey}:reservation-v{topicCaseVersion}",
    "topic-inventory-refill:{ISO-week}",
    "Target three new CMS drafts per Europe/Kiev day",
    "Classify an open article case as productive only",
    "A nonterminal article case with no live work wrapper is `idle_or_blocked`",
    "availableSlots = min(3 - currentDayNewArticleBatchCount, 3 - productiveWipCount, eligibleReadyTopicCount)",
    "stageKey=delivered&terminal=true&limit=100",
    "Never derive the daily count from `terminal=false` rows alone",
    "Every `/pipelines/{pipelineId}/cases` response is a direct JSON array",
    "A single successful breakdown does not satisfy a remaining daily batch deficit",
    "A refill stage name is not liveness proof",
    "executionPolicy.monitor.nextCheckAt",
    "topic-inventory-refill:{ISO-week}:continuation:v{caseVersion}",
    "portfolio-diversification deficit",
    "daily capacity planner owns the current day plus next two Europe/Kyiv calendar-day dispatchability matrix",
    "A cooldown or external wait belongs only to its named source lane",
    "must never set the allocator to `blocked` or add `blockedByIssueIds`",
    "The worker does not receive `astrogen-growth-actions` `pipelines:write`",
    "Never create a legacy article parent",
  ], "Article allocator contract");
  includesAll(routineContracts.articleCapacityPlanning, [
    "next two Europe/Kyiv calendar days",
    "nine independently dispatchable topics",
    "It never reserves a future topic or changes editorial selection",
    "A cooldown in audience_trends may retain its own monitor",
    "never blocked merely because a family cap excludes remaining ready topics",
  ], "Article capacity planning contract");
  assert(
    routineManifest.routines?.some((routine) =>
      routine.title === "Daily Astrogen article capacity planner"
      && routine.cron === "30 8 * * *"
      && routine.triggerEnabled === true
      && routine.processContract?.capacityMatrix?.some((line) =>
        String(line).includes("healthy buffer is nine independently dispatchable topics"),
      ),
    ),
    "Article capacity planner routine manifest is missing or drifted",
  );
  const cadenceWorkflow = workflowManifest.workflows?.article_cadence;
  assert(cadenceWorkflow?.capacityPlanning?.planningWindowDays === 3, "Article cadence capacity planning window must be three days");
  assert(cadenceWorkflow?.capacityPlanning?.healthyDispatchableBuffer === 9, "Article cadence capacity buffer must be nine topics");
  includesAll(routineContracts.monthlyTrendDiscovery, [
    "sourceCaseId",
    "resultDocumentKey=trend-ingestion-result-{childIssueIdentifierLower}",
    "PUT the same complete projection into that source case document",
    "never use a bounded child summary as the full handoff",
  ], "Trend validation durable source-case handoff");
  const routineSyncSource = readFileSync(resolve(SCRIPT_DIR, "sync-autonomous-growth-routines.mjs"), "utf8");
  includesAll(routineSyncSource, [
    "env: null",
    "Routine env drift remains after sync",
  ], "Routine synchronization contract");
  const capacityReconcilePath = resolve(SCRIPT_DIR, "reconcile-current-topic-refill-capacity-lanes.mjs");
  assert(existsSync(capacityReconcilePath), "Capacity-lane reconciliation helper is missing");
  includesAll(readFileSync(capacityReconcilePath, "utf8"), [
    "capacity_refill_requires_non_trend_lane",
    "A trend cooldown cannot park separate non-trend portfolio deficits",
    "nonTrendDeficits",
  ], "Capacity-lane reconciliation helper");
  includesAll(routineContracts.leadershipBacklogTriage, [
    "already assigned, blocked, in-progress, or foreign-owned issue",
    "A 403 while attempting to mutate a foreign issue is a routing error",
  ], "Leadership contract");
  includesAll(routineContracts.weeklyGrowthPortfolio, [
    "25 lineage-valid future topics",
    "next-content-plan",
    "exact `caseKey=growth:topic-inventory-refill:{ISO-week}`",
    "A stage label such as `executing` is not evidence of execution",
  ], "Weekly CMO contract");
  includesAll(routineContracts.dailyEvidence, ["astrogen-growth-actions"], "Daily evidence contract");
  includesAll(routineContracts.gscIndexingAudit, ["astrogen-growth-actions"], "GSC audit contract");

  console.log(JSON.stringify({
    ok: true,
    checks: [
      "active native manifest",
      "Claude CLI subscription writer harness",
      "OpenRouter text generation parked",
      "ready breakdown to article opportunity",
      "outcome-aware topic consume/release",
      "no ready-stage automation",
      "complete bounded writer-brief preflight",
      "canonical CMS admin URL transition gates",
      "manager-only approval handoff continuity",
      "manager-only approval external-wait exit",
      "agent owner-decision write protection",
      "consumed curriculum-node selection guard",
      "allocator native dispatch and refill",
      "three-slot daily batch and deficit reconciliation",
      "three-day article capacity planning",
      "CEO foreign-issue boundary",
      "weekly native topic supply",
      "collector growth-case dedup",
    ],
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
