#!/usr/bin/env node

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const PROJECT_ID = "d4644ea9-c025-4421-9af9-7780e41945ba";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const PLUGIN_PREFIX = "paperclip.winning-structure-mcp-agent-tools";
const caseId = process.argv[2];

if (!caseId) {
  throw new Error("Usage: resume-winning-structure-after-contract-repair.mjs <case-id>");
}

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
    throw new Error(`${method} ${path} returned ${response.status}: ${text.slice(0, 1600)}`);
  }
  return parsed;
}

function parseJsonContent(value) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = parseJsonContent(item?.text ?? item?.content ?? item);
      if (parsed) return parsed;
    }
  }
  return value && typeof value === "object" ? value : null;
}

function extractValidation(result) {
  const execution = result?.result ?? result;
  const structured = execution?.data?.structuredContent
    ?? execution?.data?.data?.structuredContent
    ?? execution?.structuredContent
    ?? null;
  return {
    execution,
    validation: structured
      ?? parseJsonContent(execution?.data?.content)
      ?? parseJsonContent(execution?.content)
      ?? {},
  };
}

const token = `pcp_board_${randomBytes(24).toString("hex")}`;
const keyId = randomUUID();
const tokenHash = createHash("sha256").update(token).digest("hex");

psql(`
  insert into board_api_keys (id, user_id, name, key_hash, expires_at)
  values (${q(keyId)}::uuid, ${q(USER_ID)}, 'winning-structure-contract-repair-resume',
    ${q(tokenHash)}, now() + interval '10 minutes');
`);

try {
  const detail = await request(token, "GET", `/cases/${caseId}`);
  const current = detail.case ?? detail;
  const stageKey = detail.stage?.key;
  const fields = current.fields ?? {};

  if (stageKey === "winning_structure") {
    console.log(JSON.stringify({
      ok: true,
      caseId,
      changed: false,
      reason: "already at winning_structure",
      version: current.version,
    }, null, 2));
    process.exit(0);
  }
  if (stageKey !== "strategy_input") {
    throw new Error(`Case must be at strategy_input, found ${stageKey ?? "unknown"}`);
  }
  if (fields.winningStructureStatus !== "strategy_input_normalized_for_remote_validation") {
    throw new Error(`Case is not the normalized pre-start repair state: ${fields.winningStructureStatus ?? "missing"}`);
  }
  if (fields.winningStructureRunId || fields.winningStructureInputHash || fields.winningStructureEffectiveInputHash) {
    throw new Error("Refusing to resume a case with MCP lifecycle-owned runtime fields");
  }

  const inputDocument = await request(token, "GET", `/cases/${caseId}/documents/winning-structure-input`);
  const body = inputDocument.latestBody ?? inputDocument.body ?? inputDocument.document?.latestBody;
  if (typeof body !== "string" || !body.trim()) {
    throw new Error("winning-structure-input is missing or empty");
  }
  const payload = JSON.parse(body);
  const runContext = JSON.parse(psql(`
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
      and a.name='SEO Blog Content Strategist'
    limit 1;
  `));

  const validationResult = await request(token, "POST", "/agents/me/plugin-tools/execute", {
    tool: `${PLUGIN_PREFIX}:validate-task-input`,
    runContext,
    parameters: payload,
  });
  const { execution, validation } = extractValidation(validationResult);
  if (execution?.isError === true || validation?.valid !== true) {
    throw new Error(`Remote validation rejected normalized input: ${JSON.stringify(validation).slice(0, 1600)}`);
  }
  if (validation.validation_source !== "remote_mcp" || typeof validation.input_hash !== "string" || !validation.input_hash) {
    throw new Error(`Remote validation proof is incomplete: ${JSON.stringify(validation).slice(0, 1600)}`);
  }

  const transitioned = await request(token, "POST", `/cases/${caseId}/transition`, {
    toStageKey: "winning_structure",
    expectedVersion: current.version,
    reason: "The existing strategy input passed live remote MCP validation after the typed contract repair; continue the same article case through the native stage.",
  });
  const resumed = transitioned.case ?? transitioned;

  const staleIssues = JSON.parse(psql(`
    select coalesce(json_agg(json_build_object('id', i.id, 'identifier', i.identifier)), '[]'::json)::text
    from pipeline_case_issue_links l
    join issues i on i.id=l.issue_id
    where l.case_id=${q(caseId)}::uuid
      and i.status='blocked'
      and i.title in (
        'Strategy Input automation',
        'Fix Winning Structure start parser required-field rejection for validated strategy input'
      );
  `));
  const resolutionComment = [
    "Systemic blocker resolved.",
    "",
    "The case input was normalized from legacy aliases to the typed remote contract and then validated through the live Paperclip plugin.",
    `Proof: validation_source=remote_mcp; input_hash=${validation.input_hash}.`,
    "The same article case now continues through the native winning_structure stage. No new article, routine, CMS action, image generation, publication, or Telegram action was created by this repair.",
  ].join("\n");
  for (const issue of staleIssues) {
    await request(token, "PATCH", `/issues/${issue.id}`, {
      status: "done",
      comment: resolutionComment,
    });
  }

  console.log(JSON.stringify({
    ok: true,
    caseId,
    changed: true,
    stage: transitioned.stage?.key ?? null,
    version: resumed.version,
    validationSource: validation.validation_source,
    inputHash: validation.input_hash,
    resolvedIssues: staleIssues.map((issue) => issue.identifier),
  }, null, 2));
} finally {
  psql(`update board_api_keys set revoked_at=now(), last_used_at=now() where id=${q(keyId)}::uuid;`);
}
