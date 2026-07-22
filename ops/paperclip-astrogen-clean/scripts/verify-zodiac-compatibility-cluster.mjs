#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

function requireText(source, expected, label) {
  if (!source.includes(expected)) throw new Error(`Missing ${label}: ${expected}`);
}

const policy = read("reference/zodiac-compatibility-cluster.yaml");
const bootstrap = read("scripts/bootstrap-astrogen-growth-os.mjs");
const sync = read("scripts/sync-search-discovery-policies.mjs");
const launcher = read("scripts/start-zodiac-compatibility-cluster-campaign.mjs");
const pipelines = read("manifests/pipelines.yaml");
const routines = read("manifests/routines.yaml");
const searchDemandPolicy = read("reference/search-demand-policy.yaml");
const coexistenceRepair = read("scripts/repair-content-source-lane-coexistence.mjs");

requireText(policy, "version: astrogen-zodiac-compatibility-cluster-v1", "policy version");
requireText(policy, "count: 12", "twelve sign hubs");
requireText(policy, "maximumCanonicalCount: 78", "canonical pair maximum");
requireText(policy, "reverseOrderCreatesNewPage: false", "reverse-order dedupe");
requireText(policy, "requiredForEveryProposedPage: true", "page-level semantic evidence gate");
requireText(policy, "intendedLayer: adjacent_use_case_intent", "semantic layer");
requireText(policy, "batchDiscoveryAllowed: true", "bounded batch discovery");
requireText(policy, "directMassArticleCreationForbidden: true", "mass article guard");
requireText(policy, "winningStructureRequiredBeforeBrief: true", "Winning Structure gate");
requireText(policy, "allocationFamily: zodiac_compatibility", "shared allocation family");
requireText(policy, "contentPortfolioTrack: audience_applied_questions", "portfolio track assignment");
requireText(policy, "compatibilityNeverCountsAsAudienceTrend: true", "trend quota isolation");

requireText(searchDemandPolicy, "allocationFamilyCaps:", "allocation family caps");
requireText(searchDemandPolicy, "zodiac_compatibility: 1", "daily compatibility cap");
requireText(searchDemandPolicy, "independentSourceLaneRefill:", "independent refill lanes");
requireText(searchDemandPolicy, "maxActiveContinuationsPerSourceLane: 1", "per-lane continuation cap");

requireText(sync, "zodiac-compatibility-cluster.yaml", "policy sync registration");
requireText(sync, "astrogen-zodiac-compatibility-cluster-v1", "policy sync version");

requireText(bootstrap, "/companies/astrogen/reference/zodiac-compatibility-cluster.yaml", "agent policy reference");
requireText(bootstrap, "every proposed URL requires its own accepted pageKeywordPacket", "content strategist packet gate");
requireText(bootstrap, "return a separate accepted pageKeywordPacket for every proposed page", "semantic strategist packet gate");
requireText(bootstrap, "allocationFamily=zodiac_compatibility", "agent allocation family contract");
requireText(bootstrap, "independent source lanes", "agent independent refill contract");

requireText(pipelines, "whenCaseFieldEquals: compatibility_reference", "native compatibility transition gate");
requireText(pipelines, "requiredFieldValues: { allocationFamily: zodiac_compatibility, contentPortfolioTrack: audience_applied_questions, portfolioLane: search_demand_core }", "native compatibility exact values");
requireText(pipelines, "- allocationFamily", "native allocation-family carryover");

requireText(routines, "allocationFamily=zodiac_compatibility is capped at one article per daily batch", "allocator compatibility cap");
requireText(routines, "semantic_core_and_curriculum and audience_trends are independent refill source lanes", "routine independent refill lanes");

requireText(coexistenceRepair, "content-source-coexistence-v1", "live coexistence migration");
requireText(coexistenceRepair, "allocationFamilyCaps: { zodiac_compatibility: 1 }", "live allocation cap migration");
requireText(coexistenceRepair, "sourceLaneContinuations", "live source-lane state migration");

requireText(launcher, "CMO керує кампанією та делегує роботу", "manager boundary");
requireText(launcher, "12 sign hubs", "first-wave hub scope");
requireText(launcher, "12-20", "first-wave pair scope");
requireText(launcher, "candidate_review", "review continuation");
requireText(launcher, "compatibility-keyword-research", "visible research document");
requireText(launcher, "selectedAction=new_article", "native pipeline boundary");

console.log(JSON.stringify({
  ok: true,
  policyVersion: "astrogen-zodiac-compatibility-cluster-v1",
  checks: 37,
}, null, 2));
