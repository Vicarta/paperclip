#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";

function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
  return result.stdout.trim();
}

function psql(sql) {
  return run("sudo", [
    "docker", "exec", "-i", DB_CONTAINER,
    "psql", "-U", "paperclip", "-d", "paperclip", "-v", "ON_ERROR_STOP=1", "-At",
  ], sql);
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function asArray(value, keys = []) {
  if (Array.isArray(value)) return value;
  for (const key of keys) if (Array.isArray(value?.[key])) return value[key];
  return [];
}

async function request(token, method, pathname, body) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 2000)}`);
  return parsed;
}

function isoWeekKey(date = new Date()) {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((value - yearStart) / 86400000) + 1) / 7);
  return `${value.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${sqlLiteral(keyId)}::uuid, ${sqlLiteral(USER_ID)},
      'phase46-current-topic-refill', ${sqlLiteral(tokenHash)}, now() + interval '10 minutes');
  `);

  try {
    const [pipelineResponse, agentResponse] = await Promise.all([
      request(token, "GET", `/companies/${COMPANY_ID}/pipelines`),
      request(token, "GET", `/companies/${COMPANY_ID}/agents`),
    ]);
    const pipelines = asArray(pipelineResponse, ["items", "pipelines"]);
    const agents = asArray(agentResponse, ["items", "agents"]);
    const growth = pipelines.find((pipeline) => pipeline.key === "astrogen-growth-actions");
    const topic = pipelines.find((pipeline) => pipeline.key === "astrogen-topic-inventory");
    const cmo = agents.find((agent) => agent.name === "Chief Marketing Officer");
    const strategist = agents.find((agent) => agent.name === "SEO Blog Content Strategist");
    if (!growth || !topic || !cmo || !strategist) throw new Error("Native refill dependencies are missing");

    const readyCases = asArray(await request(token, "GET", `/pipelines/${topic.id}/cases?stageKey=ready&terminal=false`), ["items", "cases"]);
    const week = isoWeekKey();
    const fingerprint = `topic-inventory-refill:${week}`;
    const result = await request(token, "POST", `/pipelines/${growth.id}/cases`, {
      caseKey: `growth:${fingerprint}`,
      title: `Refill Astrogen topic inventory for ${week}`,
      summary: "Generate and validate an evidence-backed topic supply from Payload CMS, GSC/GA4, semantic-core and CrawlObserver so the scheduled allocator has safe ready cases.",
      stageKey: "finding",
      fields: {
        findingFingerprint: fingerprint,
        actionClass: "content_supply",
        businessOutcome: "Maintain at least 3 ready topics and target 10 so daily article cadence can continue without operator intervention.",
        evidenceRefs: [`readyTopicCount:${readyCases.length}`, "Payload CMS", "GSC/GA4", "semantic-core", "CrawlObserver"],
        managerId: cmo.id,
        executorId: strategist.id,
        blockerClass: null,
        nextReviewAt: new Date(Date.now() + 86400000).toISOString(),
        completionProof: "3-10 stable native topic candidate case ids are present; validator transitions evidence-backed safe topics to ready; low-water mark is at least 3 when evidence supports it.",
        measurementWindow: "Review ready inventory before the next daily 10:00 Europe/Kiev allocator run.",
      },
    });
    const pipelineCase = result.case ?? result;
    console.log(JSON.stringify({
      mode: result.created ? "created" : "reused",
      readyTopicCountBefore: readyCases.length,
      caseId: pipelineCase.id,
      caseKey: pipelineCase.caseKey,
      stageKey: pipelineCase.stageKey ?? "finding",
    }, null, 2));
  } finally {
    psql(`update board_api_keys set revoked_at=now(), last_used_at=now() where id=${sqlLiteral(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
