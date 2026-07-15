#!/usr/bin/env node

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const PROJECT_ID = "d4644ea9-c025-4421-9af9-7780e41945ba";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const PLUGIN_PREFIX = "paperclip.winning-structure-mcp-agent-tools";
const RUN_ID = "wsrun_20260714160900714831_5ebe73f984";

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
  const parsed = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${method} ${path} returned ${response.status}: ${text.slice(0, 800)}`);
  }
  return parsed;
}

const token = `pcp_board_${randomBytes(24).toString("hex")}`;
const keyId = randomUUID();
const keyHash = createHash("sha256").update(token).digest("hex");

psql(`
  insert into board_api_keys (id, user_id, name, key_hash, expires_at)
  values (${q(keyId)}::uuid, ${q(USER_ID)}, 'phase47-winning-structure-final-result-verify',
    ${q(keyHash)}, now() + interval '5 minutes');
`);

try {
  const context = JSON.parse(psql(`
    select json_build_object(
      'agentId', a.id,
      'runId', hr.id,
      'companyId', a.company_id,
      'projectId', ${q(PROJECT_ID)}::uuid
    )::text
    from agents a
    join lateral (
      select id from heartbeat_runs
      where company_id=a.company_id and agent_id=a.id
      order by created_at desc limit 1
    ) hr on true
    where a.company_id=${q(COMPANY_ID)}::uuid
      and a.name='MKT Competitive Intelligence Analyst'
    limit 1;
  `));

  const response = await request(token, "POST", "/agents/me/plugin-tools/execute", {
    tool: `${PLUGIN_PREFIX}:get-run-result`,
    runContext: context,
    parameters: {
      company_id: COMPANY_ID,
      project_id: PROJECT_ID,
      client_key: "astrogen-ukraine",
      run_id: RUN_ID,
    },
  });
  const execution = response?.result ?? response;
  const content = typeof execution?.content === "string"
    ? JSON.parse(execution.content)
    : null;
  if (!content || content.status !== "completed") {
    throw new Error("Completed final result payload is not agent-visible");
  }
  if (!Array.isArray(content.winning_structure) || content.winning_structure.length === 0) {
    throw new Error("Final result has no winning_structure sections");
  }
  if (!content.content_quality_requirements) {
    throw new Error("Final result has no content_quality_requirements");
  }

  console.log(JSON.stringify({
    ok: true,
    runId: content.run_id,
    status: content.status,
    sectionCount: content.winning_structure.length,
    addedValuePlanCount: Array.isArray(content.added_value_plans)
      ? content.added_value_plans.length
      : 0,
    contentQualityRequirementsPresent: Boolean(content.content_quality_requirements),
    artifactKeys: content.artifacts && typeof content.artifacts === "object"
      ? Object.keys(content.artifacts).sort()
      : [],
    retentionPresent: Boolean(content.retention),
    provenancePresent: Boolean(content.provenance),
    agentVisibleBytes: Buffer.byteLength(execution.content, "utf8"),
  }, null, 2));
} finally {
  psql(`update board_api_keys set revoked_at=now() where id=${q(keyId)}::uuid;`);
}
