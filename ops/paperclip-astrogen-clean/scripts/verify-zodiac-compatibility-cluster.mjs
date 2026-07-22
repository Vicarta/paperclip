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

requireText(policy, "version: astrogen-zodiac-compatibility-cluster-v1", "policy version");
requireText(policy, "count: 12", "twelve sign hubs");
requireText(policy, "maximumCanonicalCount: 78", "canonical pair maximum");
requireText(policy, "reverseOrderCreatesNewPage: false", "reverse-order dedupe");
requireText(policy, "requiredForEveryProposedPage: true", "page-level semantic evidence gate");
requireText(policy, "intendedLayer: adjacent_use_case_intent", "semantic layer");
requireText(policy, "batchDiscoveryAllowed: true", "bounded batch discovery");
requireText(policy, "directMassArticleCreationForbidden: true", "mass article guard");
requireText(policy, "winningStructureRequiredBeforeBrief: true", "Winning Structure gate");

requireText(sync, "zodiac-compatibility-cluster.yaml", "policy sync registration");
requireText(sync, "astrogen-zodiac-compatibility-cluster-v1", "policy sync version");

requireText(bootstrap, "/companies/astrogen/reference/zodiac-compatibility-cluster.yaml", "agent policy reference");
requireText(bootstrap, "every proposed URL requires its own accepted pageKeywordPacket", "content strategist packet gate");
requireText(bootstrap, "return a separate accepted pageKeywordPacket for every proposed page", "semantic strategist packet gate");

requireText(launcher, "CMO керує кампанією та делегує роботу", "manager boundary");
requireText(launcher, "12 sign hubs", "first-wave hub scope");
requireText(launcher, "12-20", "first-wave pair scope");
requireText(launcher, "candidate_review", "review continuation");
requireText(launcher, "compatibility-keyword-research", "visible research document");
requireText(launcher, "selectedAction=new_article", "native pipeline boundary");

console.log(JSON.stringify({
  ok: true,
  policyVersion: "astrogen-zodiac-compatibility-cluster-v1",
  checks: 20,
}, null, 2));
