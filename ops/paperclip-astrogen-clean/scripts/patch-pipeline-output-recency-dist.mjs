#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

const target = process.argv[2];
if (!target) {
  throw new Error("Usage: patch-pipeline-output-recency-dist.mjs <compiled-pipeline-case-outputs.js>");
}

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

let source = readFileSync(target, "utf8");
if (!source.includes(marker)) {
  if (!source.includes(oldFunction)) {
    throw new Error("Compiled pipeline output sort function was not found");
  }
  source = source.replace(oldFunction, newFunction);
  writeFileSync(target, source);
}

const verified = readFileSync(target, "utf8");
if (!verified.includes(marker)) {
  throw new Error("Pipeline output recency patch verification failed");
}

console.log(JSON.stringify({
  ok: true,
  target,
  status: "patched-or-already-present",
}));
