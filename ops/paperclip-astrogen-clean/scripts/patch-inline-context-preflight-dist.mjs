#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

const target = process.argv[2];
if (!target) {
  throw new Error("Usage: patch-inline-context-preflight-dist.mjs <compiled-pipelines.js>");
}

const helperMarker = "async function assertInlinePipelineContextComplete(";
const helperAnchor = "function formatInlinePipelineContextDocuments(documents) {";
const transitionAnchor = `        if (toConfig.autonomy === "auto") {
            throw unprocessable("Pipeline auto autonomy is not enabled", { code: "autonomy_not_enabled" });
        }
        let forcedTransition = false;`;
const transitionPatch = `        if (toConfig.autonomy === "auto") {
            throw unprocessable("Pipeline auto autonomy is not enabled", { code: "autonomy_not_enabled" });
        }
        await assertInlinePipelineContextComplete(tx, {
            companyId: input.companyId,
            caseId: current.id,
            stage: toStage,
        });
        let forcedTransition = false;`;
const helper = `async function assertInlinePipelineContextComplete(dbOrTx, input) {
    const config = stageConfig(input.stage);
    if (config.inlineContextRequireComplete !== true)
        return;
    const inlineDocuments = await loadInlinePipelineContextDocuments(dbOrTx, {
        companyId: input.companyId,
        caseId: input.caseId,
        config,
    });
    const invalidDocuments = (inlineDocuments ?? [])
        .filter((document) => document.format === "missing" || document.truncated || document.bodyRedacted)
        .map((document) => ({
        key: document.key,
        missing: document.format === "missing",
        truncated: document.truncated,
        bodyRedacted: document.bodyRedacted,
        revisionId: document.revisionId,
    }));
    if (!inlineDocuments?.length || invalidDocuments.length > 0) {
        throw conflict("Pipeline inline context is incomplete for the destination stage", {
            code: "pipeline_inline_context_incomplete",
            stageKey: input.stage.key,
            invalidDocuments,
        });
    }
}
`;

let source = readFileSync(target, "utf8");
if (source.includes(helperMarker)) {
  if (!source.includes("await assertInlinePipelineContextComplete(tx, {")) {
    throw new Error("Helper exists but transition preflight call is missing");
  }
  console.log(JSON.stringify({ ok: true, target, status: "already_patched" }));
  process.exit(0);
}
if (!source.includes(helperAnchor)) {
  throw new Error("Inline context helper anchor was not found");
}
if (!source.includes(transitionAnchor)) {
  throw new Error("Transition preflight anchor was not found");
}
source = source.replace(helperAnchor, `${helper}${helperAnchor}`);
source = source.replace(transitionAnchor, transitionPatch);
writeFileSync(target, source);

const verified = readFileSync(target, "utf8");
if (
  !verified.includes(helperMarker)
  || !verified.includes("await assertInlinePipelineContextComplete(tx, {")
) {
  throw new Error("Compiled pipeline preflight patch verification failed");
}
console.log(JSON.stringify({ ok: true, target, status: "patched" }));
