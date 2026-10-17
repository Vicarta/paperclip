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
  const responseText = await response.text();
  const parsed = responseText ? JSON.parse(responseText) : null;
  if (!response.ok) {
    throw new Error(`${method} ${path} returned ${response.status}: ${responseText.slice(0, 1200)}`);
  }
  return parsed;
}

const staleIssues = JSON.parse(psql(`
  select coalesce(json_agg(stale order by stale."updatedAt"), '[]'::json)::text
  from (
    select i.id as "issueId", i.identifier, c.id as "caseId", c.case_key as "caseKey",
           s.key as "currentStage", i.updated_at as "updatedAt"
    from issues i
    join pipeline_case_issue_links l on l.issue_id=i.id
    join pipeline_cases c on c.id=l.case_id
    join pipelines p on p.id=c.pipeline_id
    join pipeline_stages s on s.id=c.stage_id
    where i.company_id=${q(COMPANY_ID)}::uuid
      and i.status='blocked'
      and i.title='Delegated automation'
      and p.key='astrogen-search-demand-opportunities'
      and s.key in ('verified', 'measured', 'cancelled')
    order by i.updated_at
    limit 10
  ) stale;
`));

const token = `pcp_board_${randomBytes(24).toString("hex")}`;
const keyId = randomUUID();
const keyHash = createHash("sha256").update(token).digest("hex");
psql(`
  insert into board_api_keys (id, user_id, name, key_hash, expires_at)
  values (${q(keyId)}::uuid, ${q(USER_ID)}, 'reconcile-terminal-delegated-stage-issues',
    ${q(keyHash)}, now() + interval '10 minutes');
`);

try {
  const backup = staleIssues.length > 0
    ? await request(token, "POST", "/instance/database-backups", {})
    : null;
  const resolved = [];

  for (const issue of staleIssues) {
    await request(token, "POST", `/issues/${issue.issueId}/comments`, {
      body: [
        "## Delegated stage completed",
        "",
        `Native case \`${issue.caseKey}\` has already advanced to \`${issue.currentStage}\` after its guarded topic child reached a terminal outcome. This blocked issue is a superseded stage attempt, not a live dependency. Closing it allows the existing canonical refill parent to continue; no new task or topic is created.`,
      ].join("\n"),
    });
    await request(token, "PATCH", `/issues/${issue.issueId}`, { status: "done" });
    resolved.push({ identifier: issue.identifier, caseId: issue.caseId, currentStage: issue.currentStage });
  }

  console.log(JSON.stringify({
    ok: true,
    resolved,
    backup: backup
      ? { filename: backup.filename ?? null, sizeBytes: backup.sizeBytes ?? null }
      : null,
  }, null, 2));
} finally {
  psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
}
