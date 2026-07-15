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
    "psql", "-U", "paperclip", "-d", "paperclip",
    "-v", "ON_ERROR_STOP=1", "-At",
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

async function response(token, method, pathname, body) {
  const result = await fetch(`${API_BASE}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await result.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: result.status, ok: result.ok, body: parsed, text };
}

async function request(token, method, pathname, body) {
  const result = await response(token, method, pathname, body);
  if (!result.ok) throw new Error(`${method} ${pathname} returned ${result.status}: ${result.text.slice(0, 2000)}`);
  return result.body;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${sqlLiteral(keyId)}::uuid, ${sqlLiteral(USER_ID)},
      'phase48-native-search-demand-verification', ${sqlLiteral(tokenHash)},
      now() + interval '15 minutes');
  `);

  try {
    const pipelineResponse = await request(token, "GET", `/companies/${COMPANY_ID}/pipelines`);
    const pipelines = asArray(pipelineResponse, ["items", "pipelines"]);
    const opportunities = pipelines.find((item) => item.key === "astrogen-search-demand-opportunities");
    const topics = pipelines.find((item) => item.key === "astrogen-topic-inventory");
    assert(opportunities && topics, "Required native pipelines are missing");

    const [opportunity, topic, opportunityHealth, topicHealth] = await Promise.all([
      request(token, "GET", `/pipelines/${opportunities.id}`),
      request(token, "GET", `/pipelines/${topics.id}`),
      request(token, "GET", `/pipelines/${opportunities.id}/health`),
      request(token, "GET", `/pipelines/${topics.id}/health`),
    ]);
    assert(opportunityHealth.ok === true, `Opportunity pipeline unhealthy: ${JSON.stringify(opportunityHealth.warnings)}`);
    assert(topicHealth.ok === true, `Topic pipeline unhealthy: ${JSON.stringify(topicHealth.warnings)}`);

    const expectedStages = [
      "discovered", "evidence_ready", "ownership_review", "action_selected",
      "delegated", "verified", "measured", "cancelled",
    ];
    assert(
      JSON.stringify(opportunity.stages.map((stage) => stage.key)) === JSON.stringify(expectedStages),
      `Unexpected opportunity lifecycle: ${opportunity.stages.map((stage) => stage.key).join(" -> ")}`,
    );
    const delegated = opportunity.stages.find((stage) => stage.key === "delegated");
    const breakdown = delegated?.config?.breakdown;
    assert(breakdown?.targetPipelineId === topics.id, "Delegated breakdown does not target topic inventory");
    assert(breakdown?.targetStageKey === "candidate", "Delegated breakdown does not target candidate");
    assert(breakdown?.whenCaseField === "selectedAction" && breakdown?.whenCaseFieldEquals === "new_article", "Breakdown action guard is missing");
    assert(breakdown?.waitForPieces === true && breakdown?.whenFinishedMoveTo === "verified", "Breakdown does not wait for downstream completion");

    const candidate = topic.stages.find((stage) => stage.key === "candidate");
    const guard = candidate?.config?.intakeGuard;
    assert(guard?.requiredParentPipelineId === opportunities.id, "Topic intake parent pipeline guard is missing");
    assert(guard?.requiredParentStageKeys?.length === 1 && guard.requiredParentStageKeys[0] === "delegated", "Topic intake parent stage guard is incorrect");
    assert(guard?.requiredParentCaseField === "selectedAction" && guard?.requiredParentCaseFieldEquals === "new_article", "Topic intake action guard is incorrect");

    const forbidden = await response(token, "POST", `/pipelines/${topics.id}/cases`, {
      caseKey: `phase48-forbidden-direct-topic-${keyId}`,
      title: "Phase 48 forbidden direct topic smoke",
      stageKey: "candidate",
      fields: { selectedAction: "new_article" },
    });
    assert(forbidden.status === 422, `Direct topic intake returned ${forbidden.status}, expected 422`);
    assert(forbidden.body?.details?.code === "intake_parent_required", `Unexpected intake rejection: ${forbidden.text}`);

    const staleRoutineRefs = psql(`
      select count(*)
      from routines
      where company_id = ${sqlLiteral(COMPANY_ID)}::uuid
        and (description ilike '%paperclip.seo-performance-loop%'
          or description ilike '%seo-detailed-report-email-send%');
    `);
    assert(staleRoutineRefs === "0", `Current routines still reference the removed plugin: ${staleRoutineRefs}`);

    console.log(JSON.stringify({
      mode: "live-contract-verification",
      opportunityPipeline: {
        id: opportunities.id,
        healthOk: true,
        stages: expectedStages,
        guardedBreakdown: true,
        waitsForDownstreamOutcome: true,
      },
      topicInventory: { id: topics.id, healthOk: true, guardedIntake: true },
      forbiddenDirectTopicSmoke: {
        status: forbidden.status,
        code: forbidden.body?.details?.code,
        persistentMutation: false,
      },
      staleRoutineReferences: Number(staleRoutineRefs),
    }, null, 2));
  } finally {
    psql(`
      update board_api_keys
      set revoked_at = now(), last_used_at = now()
      where id = ${sqlLiteral(keyId)}::uuid;
    `);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
