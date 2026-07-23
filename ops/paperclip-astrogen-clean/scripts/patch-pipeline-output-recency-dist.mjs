#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

const target = process.argv[2];
if (!target) {
  throw new Error("Usage: patch-pipeline-output-recency-dist.mjs <compiled-pipeline-case-outputs.js>");
}

const directCaseDocumentMarkers = [
  "pipelineCaseDocuments",
  "case_output_direct_document_latest_revision",
  "case_output_direct_latest_revision",
  "sourceCaseDocumentPath",
];
const oldFunction = `function sortOutputs(a, b) {
    const groupDiff = outputSortGroup(a) - outputSortGroup(b);
    if (groupDiff !== 0)
        return groupDiff;
    const dateDiff = Date.parse(String(b.updatedAt)) - Date.parse(String(a.updatedAt));
    if (dateDiff !== 0)
        return dateDiff;
    return a.id.localeCompare(b.id);
}`;
const newFunction = `function sortOutputs(a, b) {
    const dateDiff = Date.parse(String(b.updatedAt)) - Date.parse(String(a.updatedAt));
    if (dateDiff !== 0)
        return dateDiff;
    const groupDiff = outputSortGroup(a) - outputSortGroup(b);
    if (groupDiff !== 0)
        return groupDiff;
    return a.id.localeCompare(b.id);
}`;
const marker = `function sortOutputs(a, b) {
    const dateDiff = Date.parse(String(b.updatedAt)) - Date.parse(String(a.updatedAt));`;
const sourceBuildMarker = `function sortPipelineCaseOutputItems(a, b) {
    const dateDiff = Date.parse(String(b.updatedAt)) - Date.parse(String(a.updatedAt));`;

let source = readFileSync(target, "utf8");
if (!source.includes(marker) && !source.includes(sourceBuildMarker)) {
  if (!source.includes(oldFunction)) {
    throw new Error("Compiled pipeline output sort function was not found");
  }
  source = source.replace(oldFunction, newFunction);
  writeFileSync(target, source);
}

const verified = readFileSync(target, "utf8");
if (!verified.includes(marker) && !verified.includes(sourceBuildMarker)) {
  throw new Error("Pipeline output recency patch verification failed");
}
for (const directMarker of directCaseDocumentMarkers) {
  if (!verified.includes(directMarker)) {
    throw new Error(`Direct pipeline case document support is missing: ${directMarker}`);
  }
}

console.log(JSON.stringify({
  ok: true,
  target,
  status: "source-build-verified-or-recency-patched",
}));
