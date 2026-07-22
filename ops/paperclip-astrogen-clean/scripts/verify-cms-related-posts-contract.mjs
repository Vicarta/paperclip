#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const pipelines = readFileSync(resolve(root, "manifests/pipelines.yaml"), "utf8");
const workflows = readFileSync(resolve(root, "manifests/workflows.yaml"), "utf8");
const bootstrap = readFileSync(resolve(root, "scripts/bootstrap-astrogen-growth-os.mjs"), "utf8");

for (const [label, source] of [["pipelines", pipelines], ["workflows", workflows]]) {
  for (const expected of ["depth=1", "_status=published", "workflowStatus=approved", "noindex=false"]) {
    if (!source.includes(expected)) throw new Error(`${label} is missing resolved related-post gate: ${expected}`);
  }
}
if (!bootstrap.includes("count resolved relations rather than submitted IDs")) {
  throw new Error("CMS agent contract is missing resolved related-post proof");
}

console.log(JSON.stringify({ ok: true, contract: "cms-related-posts-resolved-v1", checks: 9 }, null, 2));
