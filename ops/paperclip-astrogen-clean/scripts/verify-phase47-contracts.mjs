#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "..");

function loadYaml(path) {
  const source = [
    "import json, pathlib, sys, yaml",
    "print(json.dumps(yaml.safe_load(pathlib.Path(sys.argv[1]).read_text()), ensure_ascii=False))",
  ].join("; ");
  const result = spawnSync("python3", ["-c", source, path], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(result.stderr || `Unable to parse ${path}`);
  return JSON.parse(result.stdout);
}

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

const pipelines = loadYaml(resolve(root, "manifests/pipelines.yaml"));
const routines = loadYaml(resolve(root, "manifests/routines.yaml"));
const valueSystem = loadYaml(resolve(root, "reference/article-value-system.yaml"));
const quality = loadYaml(resolve(root, "reference/content-quality-contract.yaml"));
const cmsDeliveryPolicy = loadYaml(resolve(root, "reference/cms-delivery-policy.yaml"));
const searchDemandPolicy = loadYaml(resolve(root, "reference/search-demand-policy.yaml"));
const winningStructurePolicy = loadYaml(resolve(root, "reference/winning-structure-policy.yaml"));
const plugins = loadYaml(resolve(root, "manifests/plugins.yaml"));
const article = pipelines.pipelines.find((pipeline) => pipeline.key === "astrogen-article-production");
requireValue(article, "Astrogen article pipeline is missing");
const topic = pipelines.pipelines.find((pipeline) => pipeline.key === "astrogen-topic-inventory");
requireValue(topic, "Astrogen topic inventory pipeline is missing");
const searchDemand = pipelines.pipelines.find((pipeline) => pipeline.key === "astrogen-search-demand-opportunities");
requireValue(searchDemand, "Astrogen search-demand pipeline is missing");
requireValue(searchDemandPolicy.version === "astrogen-search-demand-v8", "Search-demand policy version is missing");
requireValue(
  winningStructurePolicy.version === "astrogen-winning-structure-phase32-33-v1",
  "Winning Structure Phase 32/33 policy version is missing",
);
requireValue(winningStructurePolicy.gist?.defaultEnabled === true, "GIST must default to enabled");
requireValue(
  winningStructurePolicy.gist?.comparison?.requiresDistinctIdempotencyKey === true,
  "GIST baseline comparison must use a distinct idempotency key",
);
requireValue(
  winningStructurePolicy.evidenceRouting?.competitorText?.orderedProviders?.join(",")
    === "dataforseo_content_parsing,serper_scrape,llmlayer_standard,llmlayer_eligible_proxy_once",
  "Phase 32 competitor evidence route is not canonical",
);
requireValue(
  winningStructurePolicy.costPolicy?.partialPricingRule === "priced_subtotal_is_lower_bound_not_total",
  "Partial Winning Structure pricing rule is missing",
);
requireValue(
  searchDemandPolicy.newArticleEligibility?.gscFallback?.minimumImpressions === 20,
  "Search-demand GSC fallback threshold is missing",
);
requireValue(
  searchDemand.writerAgents?.includes("SEO Blog Content Strategist"),
  "Content strategist search-demand writer grant source is missing",
);
const readyTopicStage = topic.stages.find((stage) => stage.key === "ready");
requireValue(
  readyTopicStage?.config?.breakdown?.whenCaseField === "selectedAction"
    && readyTopicStage?.config?.breakdown?.whenCaseFieldEquals === "new_article",
  "Topic ready breakdown eligibility guard is missing",
);

const expectedStages = [
  "opportunity",
  "strategy_input",
  "winning_structure",
  "structure_decision",
  "structure_review",
  "brief",
  "draft",
  "validate",
  "humanize",
  "mc_quality",
  "layout",
  "layout_validate",
  "image",
  "image_recovery_review",
  "cms_draft",
  "cmo_delivery",
  "delivered",
  "cancelled",
];
const stageKeys = article.stages.map((stage) => stage.key);
requireValue(JSON.stringify(stageKeys) === JSON.stringify(expectedStages), "Article stage order is not the Phase 47 contract");
const cmoDelivery = article.stages.find((stage) => stage.key === "cmo_delivery");
requireValue(cmoDelivery, "CMO Delivery stage is missing");
requireValue(cmoDelivery.kind === "review", "CMO Delivery must be a native review stage");
requireValue(article.stageAutomation?.cmo_delivery?.review?.approver === "Chief Marketing Officer", "CMO Delivery approver is missing");
requireValue(article.stageAutomation?.cmo_delivery?.review?.approveTo === "delivered", "CMO Delivery approval target is invalid");
requireValue(article.stageAutomation?.cmo_delivery?.review?.requestChangesTo === "cms_draft", "CMO Delivery request-changes target is invalid");
for (const prefix of ["cms", "delivery", "cmoDelivery", "telegram", "topicReservation"]) {
  requireValue(
    cmoDelivery.config?.reviewSafeFieldPrefixes?.includes(prefix),
    `CMO delivery review-safe prefix is missing: ${prefix}`,
  );
}
const cmsDraft = article.stages.find((stage) => stage.key === "cms_draft");
requireValue(cmsDraft?.config?.reviewSafeFieldPrefixes?.includes("cms"), "CMS Draft must allow verified cms metadata");
for (const stageKey of ["image", "image_recovery_review", "cms_draft", "cmo_delivery"]) {
  const stage = article.stages.find((candidate) => candidate.key === stageKey);
  for (const key of ["attemptCount", "blockerClass", "nextReviewAt"]) {
    requireValue(
      stage?.config?.reviewSafeFieldKeys?.includes(key),
      `${stageKey} must allow operational review-safe key: ${key}`,
    );
  }
}
for (const key of ["telegramMessageId", "telegramDeliveryOk"]) {
  requireValue(
    cmoDelivery.config?.reviewSafeFieldKeys?.includes(key),
    `CMO delivery review-safe key is missing: ${key}`,
  );
}
requireValue(article.stageMigrations?.serp_check === "strategy_input", "serp_check migration is missing");
requireValue(!stageKeys.includes("serp_check"), "Legacy serp_check stage remains in the desired pipeline");
requireValue(
  article.transitions.some((transition) => transition.from === "image"
    && transition.to === "image_recovery_review"
    && transition.label === "hard_visual_qa_failure"),
  "Image hard-QA recovery transition is missing",
);
requireValue(
  article.transitions.some((transition) => transition.from === "image_recovery_review"
    && transition.to === "image"
    && transition.label === "authorize_one_corrective_retry"),
  "CMO one-retry image transition is missing",
);
requireValue(
  article.transitions.some((transition) => transition.from === "image_recovery_review"
    && transition.to === "cms_draft"
    && transition.label === "accept_existing_after_visual_review"),
  "CMO existing-candidate acceptance transition is missing",
);
for (const marker of [
  "coverImageProviderCallCount",
  "coverImageRetryAuthorizationCount=1",
  "accept_existing_after_visual_review",
  "familiar non-linguistic pictogram",
  "does not require owner approval",
]) {
  requireValue(
    article.stageAutomation?.image_recovery_review?.instructions?.includes(marker),
    `Image recovery contract marker is missing: ${marker}`,
  );
}
for (const marker of ["twoColumnText", "SEO title", "meta description"]) {
  requireValue(
    article.stageAutomation?.layout_validate?.instructions?.includes(marker),
    `Layout validation completeness marker is missing: ${marker}`,
  );
}
for (const marker of ["reuse it", "do not send a duplicate", "native review decision approve", "Never use a direct case transition"]) {
  requireValue(
    article.stageAutomation?.cmo_delivery?.instructions?.includes(marker),
    `CMO final review marker is missing: ${marker}`,
  );
}
for (const marker of [
  "payload_cms_create_blog_post_draft",
  "company-scoped CMS plugin",
  "cms_relation_policy_missing",
]) {
  requireValue(
    article.stageAutomation?.cms_draft?.instructions?.includes(marker),
    `CMS default-author contract marker is missing: ${marker}`,
  );
}
requireValue(cmsDeliveryPolicy.version === "astrogen-cms-delivery-v1", "CMS delivery policy version is missing");
requireValue(cmsDeliveryPolicy.defaultEditorialAuthor?.slug === "astrogen", "CMS delivery default author is missing");
for (const articleType of Object.keys(valueSystem.articleTypes ?? {})) {
  const category = cmsDeliveryPolicy.articleTypeCategoryDefaults?.[articleType];
  requireValue(category?.slug && category?.title, `CMS delivery default category is missing for ${articleType}`);
}
const reservedTopic = topic.stages.find((stage) => stage.key === "reserved");
requireValue(
  reservedTopic?.config?.childrenTerminalOutcome?.allDoneToStageKey === "consumed",
  "Delivered article must atomically consume its reserved topic",
);
requireValue(
  reservedTopic?.config?.childrenTerminalOutcome?.anyCancelledToStageKey === "ready",
  "Cancelled article must atomically release its reserved topic",
);
requireValue(
  article.stageAutomation?.strategy_input?.instructions?.includes("Leave winningStructureRunId"),
  "Strategy Input must preserve MCP runtime field ownership",
);
for (const marker of [
  "winning-structure-input",
  "task_input",
  "one business_context object",
  "parses as JSON",
  "targetIntentCovered",
  "Do not write targetSectionIds",
  "Every reader_value_evidence entry must contain",
  "Never use legacy aliases",
]) {
  requireValue(
    article.stageAutomation?.strategy_input?.instructions?.includes(marker),
    `Strategy Input exact payload marker is missing: ${marker}`,
  );
}
requireValue(
  article.stageAutomation?.winning_structure?.instructions?.includes("top-level parameters"),
  "Winning Structure must use typed top-level plugin parameters",
);
requireValue(
  article.stageAutomation?.winning_structure?.instructions?.includes("pass that exact object unchanged"),
  "Winning Structure must consume the exact durable payload",
);
requireValue(
  article.stageAutomation?.winning_structure?.instructions?.includes("validation_source=remote_mcp"),
  "Winning Structure must require remote MCP validation proof",
);
requireValue(
  article.stageAutomation?.winning_structure?.instructions?.includes("validation_issues fingerprint"),
  "Winning Structure must suppress unchanged pre-start validation retry loops",
);
requireValue(
  article.stageAutomation?.winning_structure?.instructions?.includes("paperclip_normalization_from_selected_value_unit"),
  "Winning Structure must define the typed selected-value-unit overlay",
);
requireValue(
  article.transitions.some((transition) => transition.from === "winning_structure"
    && transition.to === "strategy_input"
    && transition.label === "proven pre-start payload repair"),
  "The proven pre-start payload repair transition is missing",
);

const requiredFields = new Set(article.requiredFields);
for (const field of [
  "winningStructureRunId",
  "winningStructureInputDocumentId",
  "winningStructureInputHash",
  "winningStructureEffectiveInputHash",
  "winningStructureDecisionSetVersion",
  "winningStructureGistEnabled",
  "winningStructureRetentionExpiresAt",
  "winningStructureResultDocumentId",
  "winningStructureContentSelectionAuditDocumentId",
  "winningStructureMetaEvidenceBriefDocumentId",
  "winningStructureProviderProvenanceDocumentId",
  "winningStructureCostDocumentId",
  "winningStructureCostEstimationStatus",
  "winningStructureOverlayDocumentId",
  "structureMappingStatus",
  "publicationRequirementsSummary",
  "articleType",
  "selectedValueUnitIds",
  "mcQualityOutcome",
]) {
  requireValue(requiredFields.has(field), `Required article field is missing: ${field}`);
}
for (const field of ["contentQualityRequirements", "publicationRequirements", "selectedValueUnits"]) {
  requireValue(!requiredFields.has(field), `Bulky Winning Structure field must be document-backed: ${field}`);
}
for (const field of ["contentQualityRequirementsSummary", "publicationRequirementsSummary", "selectedValueUnitIds"]) {
  requireValue(requiredFields.has(field), `Compact Winning Structure field is missing: ${field}`);
}
for (const marker of [
  "Case fields may contain only compact IDs",
  "combined case fields budget is 48 KiB",
  "no individual field may exceed 8 KiB",
]) {
  requireValue(
    article.stageAutomation?.winning_structure?.instructions?.includes(marker),
    `Winning Structure field-budget marker is missing: ${marker}`,
  );
}
for (const marker of [
  "gist_enabled=true",
  "winning-structure-policy.yaml",
  "baseline comparison is forbidden",
  "cost_policy",
]) {
  requireValue(
    article.stageAutomation?.strategy_input?.instructions?.includes(marker),
    `Winning Structure Phase 32/33 input marker is missing: ${marker}`,
  );
}
for (const marker of [
  "winning-structure-content-selection-audit",
  "winning-structure-meta-evidence-brief",
  "DataForSEO Content Parsing",
  "no_visual_conclusion",
  "estimation_status=estimated",
  "priced_subtotal",
]) {
  requireValue(
    article.stageAutomation?.winning_structure?.instructions?.includes(marker),
    `Winning Structure Phase 32/33 execution marker is missing: ${marker}`,
  );
}

const articleTypes = Object.keys(valueSystem.articleTypes ?? {});
requireValue(articleTypes.length === 8, `Expected 8 article types, found ${articleTypes.length}`);
const allowedEvidenceTypes = new Set(valueSystem.evidencePolicy?.allowedTypes ?? []);
const mcpEvidenceTypes = new Set([
  "official_documentation",
  "expert_observation",
  "original_test",
  "original_visual",
  "anonymized_case",
  "support_data",
  "internal_analytics",
  "business_evidence",
  "aggregated_community_pattern",
]);
for (const evidenceType of allowedEvidenceTypes) {
  requireValue(mcpEvidenceTypes.has(evidenceType), `Unsupported Winning Structure evidence type: ${evidenceType}`);
}

requireValue(quality.mainContentAudit?.runsAfter === "humanize", "MC quality must run after humanize");
requireValue(quality.mainContentAudit?.runsBefore === "layout", "MC quality must run before layout");
requireValue(quality.naturalnessPolicy?.broadPassesPerDraftRevision === 1, "Naturalness pass must be bounded to one");
requireValue(quality.geoRetrievabilityPolicy?.defaultEnabled === false, "GEO audit must remain selective");

const routineTitles = new Set(routines.routines.map((routine) => routine.title));
requireValue(routineTitles.has("Monthly Astrogen trend discovery"), "Monthly trend routine is missing");
requireValue(routineTitles.has("Monthly Astrogen scaled-content audit"), "Monthly scaled-content routine is missing");

const activePluginKeys = new Set(plugins.plugins.active.map((plugin) => plugin.key));
requireValue(activePluginKeys.has("paperclip.winning-structure-mcp-agent-tools"), "Winning Structure plugin is not active in the source manifest");

const bootstrap = readFileSync(resolve(root, "scripts/bootstrap-astrogen-growth-os.mjs"), "utf8");
const policySync = readFileSync(resolve(root, "scripts/sync-winning-structure-policy.mjs"), "utf8");
requireValue(
  policySync.includes("astrogen-winning-structure-phase32-33-v1")
    && policySync.includes("apply-and-verify"),
  "Winning Structure company policy sync is missing",
);
for (const marker of [
  "winning-structure-mcp-token",
  "Final Main-Content Quality Gate",
  "Bounded Editorial Naturalness Contract",
  "leave MCP run ID, status, hashes, decision version, retention and result fields null",
  "winning-structure-input",
  "Never use \\`task_input\\`",
  "defaultEditorialAuthor",
  "articleTypeCategoryDefaults",
]) {
  requireValue(bootstrap.includes(marker), `Bootstrap contract marker is missing: ${marker}`);
}
const pluginConstantsCandidates = [
  process.env.PAPERCLIP_SOURCE_ROOT
    ? resolve(process.env.PAPERCLIP_SOURCE_ROOT, "packages/plugins/plugin-winning-structure-mcp-agent-tools/src/constants.ts")
    : null,
  resolve(root, "../../local-paperclip/packages/plugins/plugin-winning-structure-mcp-agent-tools/src/constants.ts"),
  resolve(root, "../source/packages/plugins/plugin-winning-structure-mcp-agent-tools/src/constants.ts"),
].filter(Boolean);
const pluginConstantsPath = pluginConstantsCandidates.find((candidate) => existsSync(candidate));
requireValue(pluginConstantsPath, "Winning Structure plugin constants are missing from the verifier runtime");
const pluginConstants = readFileSync(pluginConstantsPath, "utf8");
requireValue(pluginConstants.includes("submit_run_decisions"), "Five-operation plugin contract is missing submit_run_decisions");
requireValue(pluginConstants.includes('PLUGIN_VERSION = "0.3.0"'), "Winning Structure plugin v0.3.0 is not selected");
requireValue(pluginConstants.includes('winning-structure-mcp-v1.5'), "Winning Structure cost model v1.5 is not selected");

const payloadPluginCandidates = [
  process.env.PAPERCLIP_SOURCE_ROOT
    ? resolve(process.env.PAPERCLIP_SOURCE_ROOT, "packages/plugins/plugin-payload-cms-agent-tools/src/payload-cms-client.ts")
    : null,
  resolve(root, "../../local-paperclip/packages/plugins/plugin-payload-cms-agent-tools/src/payload-cms-client.ts"),
  resolve(root, "../source/packages/plugins/plugin-payload-cms-agent-tools/src/payload-cms-client.ts"),
].filter(Boolean);
const payloadPluginPath = payloadPluginCandidates.find((candidate) => existsSync(candidate));
requireValue(payloadPluginPath, "Payload CMS plugin source is missing from the verifier runtime");
const payloadPlugin = readFileSync(payloadPluginPath, "utf8");
for (const marker of [
  "defaultEditorialAuthor",
  "articleTypeCategoryDefaults",
  "Payload CMS category is required",
  "requireAuthor: true, requireCategory: true",
]) {
  requireValue(payloadPlugin.includes(marker), `Payload relation-resolver marker is missing: ${marker}`);
}

console.log(JSON.stringify({
  ok: true,
  articleStages: stageKeys.length,
  articleTypes: articleTypes.length,
  evidenceTypes: [...allowedEvidenceTypes].sort(),
  winningStructurePolicyVersion: winningStructurePolicy.version,
  monthlyRoutines: [
    "Monthly Astrogen trend discovery",
    "Monthly Astrogen scaled-content audit",
  ],
}, null, 2));
