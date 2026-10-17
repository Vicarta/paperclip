#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";

function run(command, args, input) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input,
    maxBuffer: 16 * 1024 * 1024,
  });
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

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const caseId = readArg("--case-id");
const expectedStage = readArg("--expected-stage");
const targetStage = readArg("--target-stage");
const apply = process.argv.includes("--apply");

for (const [name, value] of [["--case-id", caseId], ["--expected-stage", expectedStage], ["--target-stage", targetStage]]) {
  const valid = name === "--case-id"
    ? /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value ?? "")
    : /^[a-z][a-z0-9_]*$/.test(value ?? "");
  if (!valid) throw new Error(`${name} is invalid`);
}

const preflight = JSON.parse(psql(`
  select json_build_object(
    'caseId', c.id,
    'caseKey', c.case_key,
    'version', c.version,
    'stageKey', s.key,
    'terminalKind', c.terminal_kind,
    'liveRunCount', (
      select count(*)
      from pipeline_case_issue_links l
      join issues i on i.id=l.issue_id
      join heartbeat_runs h on h.company_id=i.company_id
        and (h.context_snapshot->>'issueId')=i.id::text
      where l.case_id=c.id
        and l.retired_at is null
        and h.status in ('queued','running','scheduled_retry')
    ),
    'protocolIssues', coalesce((
      select json_agg(json_build_object(
        'id', i.id,
        'identifier', i.identifier,
        'attachmentCount', (
          select count(*) from issue_attachments a where a.issue_id=i.id
        ),
        'artifactPreserved', exists (
          select 1 from issue_comments ic
          where ic.issue_id=i.id
            and ic.deleted_at is null
            and ic.body like '%artifact was preserved for transition-only recovery%'
        )
      ) order by i.created_at)
      from pipeline_case_issue_links l
      join issues i on i.id=l.issue_id
      where l.case_id=c.id
        and l.retired_at is null
        and l.role='automation'
        and i.status='blocked'
        and exists (
          select 1 from issue_comments ic
          where ic.issue_id=i.id
            and ic.deleted_at is null
            and ic.body like '%OpenRouter adapter blocked%'
        )
    ), '[]'::json)
  )::text
  from pipeline_cases c
  join pipeline_stages s on s.id=c.stage_id
  where c.company_id=${quote(COMPANY_ID)}::uuid
    and c.id=${quote(caseId)}::uuid;
`));

if (preflight.stageKey !== expectedStage || preflight.terminalKind !== null || Number(preflight.liveRunCount) !== 0) {
  throw new Error(`Case is not eligible: ${JSON.stringify(preflight)}`);
}
const preservedIssues = preflight.protocolIssues.filter((issue) => issue.artifactPreserved && Number(issue.attachmentCount) > 0);
if (preservedIssues.length < 1) {
  throw new Error(`No preserved artifact-backed protocol issue: ${JSON.stringify(preflight)}`);
}

const token = `pcp_board_${randomBytes(24).toString("hex")}`;
const keyId = randomUUID();
psql(`
  insert into board_api_keys (id,user_id,name,key_hash,expires_at)
  values (
    ${quote(keyId)}::uuid,
    ${quote(USER_ID)},
    'resume-preserved-openrouter-artifact',
    ${quote(createHash("sha256").update(token).digest("hex"))},
    now()+interval '10 minutes'
  );
`);

try {
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const detailResponse = await fetch(`${API_BASE}/cases/${caseId}`, { headers });
  const detail = await detailResponse.json();
  if (!detailResponse.ok) throw new Error(`Case read failed: ${JSON.stringify(detail)}`);
  const pipelineResponse = await fetch(`${API_BASE}/pipelines/${detail.pipeline.id}`, { headers });
  const pipeline = await pipelineResponse.json();
  if (!pipelineResponse.ok) throw new Error(`Pipeline read failed: ${JSON.stringify(pipeline)}`);
  const stageById = new Map((pipeline.stages ?? []).map((stage) => [stage.id, stage]));
  const candidates = (pipeline.transitions ?? [])
    .filter((transition) => transition.fromStageId === detail.stage.id)
    .map((transition) => stageById.get(transition.toStageId))
    .filter((stage) => stage && stage.kind !== "cancelled" && stage.key !== "cancelled");
  if (candidates.length !== 1 || candidates[0]?.key !== targetStage) {
    throw new Error(`Expected one non-cancel transition to ${targetStage}: ${JSON.stringify(candidates)}`);
  }

  if (!apply) {
    console.log(JSON.stringify({ mode: "dry-run", preflight, target: candidates[0] }, null, 2));
    process.exit(0);
  }

  const transitionResponse = await fetch(`${API_BASE}/cases/${caseId}/transition`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      toStageKey: targetStage,
      expectedVersion: detail.case.version,
      reason: "Transition-only recovery from a preserved OpenRouter artifact; no content regeneration.",
    }),
  });
  const transition = await transitionResponse.json();
  if (!transitionResponse.ok) throw new Error(`Transition failed: ${JSON.stringify(transition)}`);

  for (const issue of preflight.protocolIssues) {
    const response = await fetch(`${API_BASE}/issues/${issue.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        status: "done",
        comment: `Protocol recovery complete: preserved artifact accepted and native case transitioned from ${expectedStage} to ${targetStage} without regenerating content.`,
      }),
    });
    if (!response.ok) throw new Error(`Issue ${issue.identifier} cleanup failed: ${await response.text()}`);
  }

  console.log(JSON.stringify({
    mode: "apply",
    preflight,
    target: candidates[0],
    transition,
    resolvedIssues: preflight.protocolIssues.map(({ identifier }) => identifier),
  }, null, 2));
} finally {
  psql(`delete from board_api_keys where id=${quote(keyId)}::uuid;`);
}

process.exit(0);
