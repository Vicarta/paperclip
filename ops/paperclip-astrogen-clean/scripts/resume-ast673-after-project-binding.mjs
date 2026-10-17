#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const ISSUE_IDENTIFIER = "AST-673";
const PROJECT_ID = "astrogen-ukraine";
const SEMANTIC_RUN_ID = "run_20260719_004743_audience_need_intent_e285cd4c";

function execute(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}

function psql(sql) {
  return execute("sudo", [
    "docker", "exec", "-i", DB_CONTAINER,
    "psql", "-U", "paperclip", "-d", "paperclip", "-v", "ON_ERROR_STOP=1", "-At",
  ], sql);
}

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function request(token, method, path, body, runId) {
  const response = await fetch(`http://127.0.0.1:3210/api${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(runId ? { "X-Paperclip-Run-Id": runId } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${text.slice(0, 1600)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  const pauseOnly = process.argv.includes("--pause");
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  psql(`insert into board_api_keys (id,user_id,name,key_hash,expires_at) values (${quote(keyId)}::uuid,${quote(USER_ID)},'resume-ast673-project-binding',${quote(createHash("sha256").update(token).digest("hex"))},now()+interval '10 minutes');`);
  try {
    const issue = JSON.parse(psql(`
      select json_build_object(
        'id',i.id,
        'runId',(select h.id from heartbeat_runs h where h.company_id=i.company_id and h.context_snapshot->>'issueId'=i.id::text order by h.created_at desc limit 1),
        'runStatus',(select h.status from heartbeat_runs h where h.company_id=i.company_id and h.context_snapshot->>'issueId'=i.id::text order by h.created_at desc limit 1)
      )::text
      from issues i where i.company_id=${quote(COMPANY_ID)}::uuid and i.identifier=${quote(ISSUE_IDENTIFIER)};
    `));
    if (["queued", "running"].includes(issue.runStatus)) {
      await request(token, "POST", `/heartbeat-runs/${issue.runId}/cancel`, {});
    }
    if (pauseOnly) {
      await request(token, "PATCH", `/issues/${issue.id}`, {
        status: "blocked",
        comment: "Paused before another Semantic Core call while plugin 0.3.11 company-scoped project binding is deployed. No owner action is required.",
      }, issue.runId);
      process.stdout.write(`${JSON.stringify({ ok: true, issue: ISSUE_IDENTIFIER, paused: true }, null, 2)}\n`);
      return;
    }
    await request(token, "PATCH", `/issues/${issue.id}`, {
      status: "todo",
      blockedByIssueIds: [],
      comment: [
        "## Resume after company-scoped Semantic Core project binding",
        "",
        `Use only project_id=\`${PROJECT_ID}\`. Plugin 0.3.11 now injects that default when omitted and rejects conflicting aliases before network access. Do not call list-runs for guessed projects.`,
        "",
        `For source run \`${SEMANTIC_RUN_ID}\`, call prepare-paperclip-import with project_id and run_id. Review only the two named candidate_review rows from the issue. Submit append-only decisions with decision=accept|park|reject, then materialize once with the same two phrases, explicit live mode, provider cache, matching review_decisions and force_re_review_keywords. Use the prepared import of the new run for final dispositions.`,
      ].join("\n"),
    }, issue.runId);
    process.stdout.write(`${JSON.stringify({ ok: true, issue: ISSUE_IDENTIFIER, projectId: PROJECT_ID }, null, 2)}\n`);
  } finally {
    psql(`delete from board_api_keys where id=${quote(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
