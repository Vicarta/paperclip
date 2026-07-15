#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { routineContracts } from "./bootstrap-astrogen-growth-os.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PIPELINE_MANIFEST = resolve(SCRIPT_DIR, "../manifests/pipelines.yaml");

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
    assert(value.includes(fragment), `${label} is missing invariant: ${fragment}`);
  }
}

function main() {
  const manifest = loadYaml(PIPELINE_MANIFEST);
  assert(manifest.mode === "active", "Native pipeline manifest must be active");

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

  includesAll(routineContracts.articleSlotAllocator, [
    "POST /api/cases/{topicCaseId}/breakdown",
    "{topicKey}:reservation-v{topicCaseVersion}",
    "topic-inventory-refill:{ISO-week}",
    "Never create a legacy article parent",
  ], "Article allocator contract");
  includesAll(routineContracts.leadershipBacklogTriage, [
    "already assigned, blocked, in-progress, or foreign-owned issue",
    "A 403 while attempting to mutate a foreign issue is a routing error",
  ], "Leadership contract");
  includesAll(routineContracts.weeklyGrowthPortfolio, [
    "3-10 evidence-backed",
    "native topic case ids",
  ], "Weekly CMO contract");
  includesAll(routineContracts.dailyEvidence, ["astrogen-growth-actions"], "Daily evidence contract");
  includesAll(routineContracts.gscIndexingAudit, ["astrogen-growth-actions"], "GSC audit contract");

  console.log(JSON.stringify({
    ok: true,
    checks: [
      "active native manifest",
      "ready breakdown to article opportunity",
      "outcome-aware topic consume/release",
      "no ready-stage automation",
      "allocator native dispatch and refill",
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
