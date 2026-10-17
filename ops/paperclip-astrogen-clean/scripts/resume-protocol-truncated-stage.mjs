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
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
  }
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
const apply = process.argv.includes("--apply");

if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(caseId ?? "")) {
  throw new Error("--case-id must be a UUID");
}
if (!/^[a-z][a-z0-9_]*$/.test(expectedStage ?? "")) {
  throw new Error("--expected-stage must be a pipeline stage key");
}

const preflight = JSON.parse(psql(`
  select json_build_object(
    'caseId', c.id,
    'caseKey', c.case_key,
    'stageKey', s.key,
    'terminalKind', c.terminal_kind,
    'blockedIssueIds', coalesce((
      select json_agg(i.id)
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
    ), '[]'::json),
    'liveRunCount', (
      select count(*)
      from pipeline_case_issue_links l
      join issues i on i.id=l.issue_id
      join heartbeat_runs h on h.company_id=i.company_id
        and (h.context_snapshot->>'issueId')=i.id::text
      where l.case_id=c.id
        and l.retired_at is null
        and h.status in ('queued','running','scheduled_retry')
    )
  )::text
  from pipeline_cases c
  join pipeline_stages s on s.id=c.stage_id
  where c.company_id=${quote(COMPANY_ID)}::uuid
    and c.id=${quote(caseId)}::uuid;
`));

if (preflight.stageKey !== expectedStage || preflight.terminalKind !== null) {
  throw new Error(`Case is not active in ${expectedStage}: ${JSON.stringify(preflight)}`);
}
if (preflight.blockedIssueIds.length < 1 || Number(preflight.liveRunCount) !== 0) {
  throw new Error(`Case is not eligible for protocol recovery: ${JSON.stringify(preflight)}`);
}

if (!apply) {
  console.log(JSON.stringify({ mode: "dry-run", preflight }, null, 2));
  process.exit(0);
}

const token = `pcp_board_${randomBytes(24).toString("hex")}`;
const keyId = randomUUID();
psql(`
  insert into board_api_keys (id,user_id,name,key_hash,expires_at)
  values (
    ${quote(keyId)}::uuid,
    ${quote(USER_ID)},
    'resume-protocol-truncated-stage',
    ${quote(createHash("sha256").update(token).digest("hex"))},
    now()+interval '10 minutes'
  );
`);

try {
  const response = await fetch(`${API_BASE}/cases/${caseId}/automation/current-stage/rerun`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Native stage rerun failed (${response.status}): ${text.slice(0, 1200)}`);
  }
  console.log(JSON.stringify({
    mode: "apply",
    preflight,
    rerun: text ? JSON.parse(text) : null,
  }, null, 2));
} finally {
  psql(`delete from board_api_keys where id=${quote(keyId)}::uuid;`);
}
