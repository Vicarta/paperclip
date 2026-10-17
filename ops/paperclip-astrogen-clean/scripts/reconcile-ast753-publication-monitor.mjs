#!/usr/bin/env node

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const APP_CONTAINER = "paperclip-astrogen-clean-app-1";
const EXPECTED_IMAGE = "paperclip-app:v2026.626.0-vicarta.110-native-agent-harness-20260719";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const SEARCH_DEMAND_CASE_ID = "708619bd-3c88-41ec-84c7-01fb3dfa83f9";

function run(command, args, input) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
  }
  return result.stdout.trim();
}

function psql(sql) {
  return run("docker", [
    "exec", "-i", DB_CONTAINER,
    "psql", "-U", "paperclip", "-d", "paperclip",
    "-v", "ON_ERROR_STOP=1", "-At",
  ], sql);
}

function q(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function request(token, method, path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${path} returned ${response.status}: ${text.slice(0, 1600)}`);
  }
  return text ? JSON.parse(text) : null;
}

const liveImage = run("docker", ["inspect", APP_CONTAINER, "--format", "{{.Config.Image}}"]);
if (liveImage !== EXPECTED_IMAGE) {
  throw new Error(`Expected repaired live image, got ${liveImage || "missing"}`);
}

const state = JSON.parse(psql(`
  select json_build_object(
    'issues', (
      select json_object_agg(identifier, json_build_object('id',id,'status',status))
      from issues
      where company_id=${q(COMPANY_ID)}::uuid and identifier in ('AST-753','AST-754','AST-755')
    ),
    'runningRelevantHeartbeats', (
      select count(*) from heartbeat_runs
      where company_id=${q(COMPANY_ID)}::uuid
        and status='running'
        and context_snapshot::jsonb->'paperclipWake'->'issue'->>'identifier' in ('AST-753','AST-754','AST-755')
    ),
    'caseStage', (
      select ps.key from pipeline_cases pc join pipeline_stages ps on ps.id=pc.stage_id
      where pc.id=${q(SEARCH_DEMAND_CASE_ID)}::uuid
    ),
    'nextReviewAt', (
      select fields->>'nextReviewAt' from pipeline_cases where id=${q(SEARCH_DEMAND_CASE_ID)}::uuid
    )
  )::text;
`));

if (state.runningRelevantHeartbeats !== 0) {
  throw new Error(`Relevant heartbeat is still active: ${state.runningRelevantHeartbeats}`);
}
if (!state.issues?.["AST-753"]?.id) throw new Error("AST-753 not found");
for (const child of ["AST-754", "AST-755"]) {
  if (state.issues?.[child] && !["done", "cancelled"].includes(state.issues[child].status)) {
    throw new Error(`${child} is not terminal: ${state.issues[child].status}`);
  }
}
if (state.caseStage !== "verified") throw new Error(`Search-demand case is not verified: ${state.caseStage}`);
const nextReviewAt = state.nextReviewAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

const token = `pcp_board_${randomBytes(24).toString("hex")}`;
const keyId = randomUUID();
const tokenHash = createHash("sha256").update(token).digest("hex");
psql(`
  insert into board_api_keys (id, user_id, name, key_hash, expires_at)
  values (${q(keyId)}::uuid, ${q(USER_ID)}, 'ast753-publication-monitor-repair',
    ${q(tokenHash)}, now() + interval '10 minutes');
`);

try {
  const result = await request(token, "PATCH", `/issues/${state.issues["AST-753"].id}`, {
    status: "in_progress",
    blockedByIssueIds: [],
    executionPolicy: {
      mode: "normal",
      commentRequired: true,
      stages: [],
      monitor: {
        nextCheckAt: nextReviewAt,
        scheduledBy: "assignee",
        notes: "Recheck CMS draft 132 publication/schedule state for verified search-demand case 708619bd-3c88-41ec-84c7-01fb3dfa83f9.",
      },
    },
    comment: [
      "Publication wait continuation repaired.",
      "",
      "- CMS draft 132 and its article delivery are valid; content commitments are closed.",
      "- The search-demand case remains verified until the draft is published or scheduled.",
      "- This issue now owns one first-class monitor. No owner interaction, publication child task, or return to delegated is required.",
      `- Next check: ${nextReviewAt}.`,
    ].join("\n"),
  });

  console.log(JSON.stringify({
    ok: true,
    liveImage,
    issue: result.identifier ?? "AST-753",
    status: result.status,
    nextReviewAt,
    childStates: {
      "AST-754": state.issues?.["AST-754"]?.status ?? null,
      "AST-755": state.issues?.["AST-755"]?.status ?? null,
    },
  }, null, 2));
} finally {
  psql(`update board_api_keys set revoked_at=now(), last_used_at=now() where id=${q(keyId)}::uuid;`);
}
