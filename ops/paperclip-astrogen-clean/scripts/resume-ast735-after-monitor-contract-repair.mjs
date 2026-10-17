#!/usr/bin/env node

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const PIPELINE_ID = "f1a443a6-b275-4f3f-b3f3-133311b4df7e";

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

const state = JSON.parse(psql(`
  select json_build_object(
    'specialistAgentId', (select id from agents where company_id=${q(COMPANY_ID)}::uuid and name='MKT Competitive Intelligence Analyst'),
    'specialistGrant', (
      select scope from principal_permission_grants
      where company_id=${q(COMPANY_ID)}::uuid
        and principal_type='agent'
        and principal_id=(select id::text from agents where company_id=${q(COMPANY_ID)}::uuid and name='MKT Competitive Intelligence Analyst')
        and permission_key='pipelines:write'
    ),
    'issues', (
      select json_object_agg(identifier, json_build_object('id',id,'status',status,'assigneeAgentId',assignee_agent_id))
      from issues where company_id=${q(COMPANY_ID)}::uuid and identifier in ('AST-735','AST-737','AST-738')
    )
  )::text;
`));

if (!state.specialistAgentId) throw new Error("Competitive Intelligence Analyst not found");
if (!state.specialistGrant?.pipelineIds?.includes(PIPELINE_ID)) {
  throw new Error("Competitive Intelligence Analyst lacks the scoped article pipeline grant");
}
for (const identifier of ["AST-735", "AST-737", "AST-738"]) {
  if (!state.issues?.[identifier]?.id) throw new Error(`${identifier} not found`);
}

const token = `pcp_board_${randomBytes(24).toString("hex")}`;
const keyId = randomUUID();
const tokenHash = createHash("sha256").update(token).digest("hex");

psql(`
  insert into board_api_keys (id, user_id, name, key_hash, expires_at)
  values (${q(keyId)}::uuid, ${q(USER_ID)}, 'ast735-monitor-contract-repair',
    ${q(tokenHash)}, now() + interval '10 minutes');
`);

try {
  const obsoleteComment = [
    "Скасовано після системного виправлення маршрутизації.",
    "",
    "Додатковий grant керівнику не потрібен. AST-735 повертається штатному власнику stage, який уже має scoped pipelines:write для article pipeline.",
    "Першопричина була не в permission policy: активний MCP run не мав first-class issue monitor, тому recovery помилково передав execution керівнику.",
  ].join("\n");

  for (const identifier of ["AST-738", "AST-737"]) {
    await request(token, "PATCH", `/issues/${state.issues[identifier].id}`, {
      status: "cancelled",
      blockedByIssueIds: [],
      comment: obsoleteComment,
    });
  }

  const resumeComment = [
    "Systemic continuation repair applied.",
    "",
    "- The completed Winning Structure run is reused; no new MCP start or article was created.",
    "- This automation issue is returned to MKT Competitive Intelligence Analyst, the manifest owner with scoped article-pipeline write access.",
    "- Full selected value units must be read from `winning-structure-input.business_context.selected_value_units`; compact case fields intentionally contain IDs only.",
    "- Future active polls must set a first-class issue executionPolicy monitor at the same `nextReviewAt`, preventing manager recovery reassignment.",
  ].join("\n");

  await request(token, "PATCH", `/issues/${state.issues["AST-735"].id}`, {
    status: "todo",
    assigneeAgentId: state.specialistAgentId,
    blockedByIssueIds: [],
    executionPolicy: null,
    comment: resumeComment,
  });

  console.log(JSON.stringify({
    ok: true,
    resumed: "AST-735",
    assigneeAgentId: state.specialistAgentId,
    cancelledObsoleteBlockers: ["AST-737", "AST-738"],
    reusedRun: "wsrun_20260719034951942101_c21fa02d0f",
  }, null, 2));
} finally {
  psql(`update board_api_keys set revoked_at=now(), last_used_at=now() where id=${q(keyId)}::uuid;`);
}
