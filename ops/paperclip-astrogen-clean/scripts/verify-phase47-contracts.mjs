#!/usr/bin/env node
import { readFileSync } from "node:fs";
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
const plugins = loadYaml(resolve(root, "manifests/plugins.yaml"));
const article = pipelines.pipelines.find((pipeline) => pipeline.key === "astrogen-article-production");
requireValue(article, "Astrogen article pipeline is missing");

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
  "cms_draft",
  "cmo_delivery",
  "delivered",
  "cancelled",
];
const stageKeys = article.stages.map((stage) => stage.key);
requireValue(JSON.stringify(stageKeys) === JSON.stringify(expectedStages), "Article stage order is not the Phase 47 contract");
requireValue(article.stageMigrations?.serp_check === "strategy_input", "serp_check migration is missing");
requireValue(!stageKeys.includes("serp_check"), "Legacy serp_check stage remains in the desired pipeline");
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
  "winningStructureRetentionExpiresAt",
  "winningStructureResultDocumentId",
  "winningStructureOverlayDocumentId",
  "structureMappingStatus",
  "publicationRequirements",
  "articleType",
  "selectedValueUnits",
  "mcQualityOutcome",
]) {
  requireValue(requiredFields.has(field), `Required article field is missing: ${field}`);
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
for (const marker of [
  "winning-structure-mcp-token",
  "Final Main-Content Quality Gate",
  "Bounded Editorial Naturalness Contract",
  "leave MCP run ID, status, hashes, decision version, retention and result fields null",
  "winning-structure-input",
  "Never use \\`task_input\\`",
]) {
  requireValue(bootstrap.includes(marker), `Bootstrap contract marker is missing: ${marker}`);
}
const pluginConstants = readFileSync(resolve(
  root,
  "../../local-paperclip/packages/plugins/plugin-winning-structure-mcp-agent-tools/src/constants.ts",
), "utf8");
requireValue(pluginConstants.includes("submit_run_decisions"), "Five-operation plugin contract is missing submit_run_decisions");

console.log(JSON.stringify({
  ok: true,
  articleStages: stageKeys.length,
  articleTypes: articleTypes.length,
  evidenceTypes: [...allowedEvidenceTypes].sort(),
  monthlyRoutines: [
    "Monthly Astrogen trend discovery",
    "Monthly Astrogen scaled-content audit",
  ],
}, null, 2));
