#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const ISSUE_IDENTIFIER = "AST-674";
const ASSIGNEE_NAME = "SEO Blog Content Strategist";

function execute(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}

function psql(sql) {
  return execute("sudo", ["docker", "exec", "-i", DB_CONTAINER, "psql", "-U", "paperclip", "-d", "paperclip", "-v", "ON_ERROR_STOP=1", "-At"], sql);
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
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  psql(`insert into board_api_keys (id,user_id,name,key_hash,expires_at) values (${quote(keyId)}::uuid,${quote(USER_ID)},'reassign-ast674-content-strategist',${quote(createHash("sha256").update(token).digest("hex"))},now()+interval '10 minutes');`);
  try {
    const issue = JSON.parse(psql(`
      select json_build_object(
        'id',i.id,
        'runId',(select h.id from heartbeat_runs h where h.company_id=i.company_id and h.context_snapshot->>'issueId'=i.id::text order by h.created_at desc limit 1),
        'runStatus',(select h.status from heartbeat_runs h where h.company_id=i.company_id and h.context_snapshot->>'issueId'=i.id::text order by h.created_at desc limit 1)
      )::text from issues i where i.company_id=${quote(COMPANY_ID)}::uuid and i.identifier=${quote(ISSUE_IDENTIFIER)};
    `));
    const assigneeId = psql(`select id from agents where company_id=${quote(COMPANY_ID)}::uuid and name=${quote(ASSIGNEE_NAME)} and status<>'terminated' order by created_at limit 1;`);
    if (!assigneeId) throw new Error(`${ASSIGNEE_NAME} not found`);
    if (["queued", "running"].includes(issue.runStatus)) {
      await request(token, "POST", `/heartbeat-runs/${issue.runId}/cancel`, {});
    }
    await request(token, "PATCH", `/issues/${issue.id}`, {
      title: "Ingest accepted trend demand into native search-demand pipeline",
      assigneeAgentId: assigneeId,
      status: "todo",
      blockedByIssueIds: [],
      comment: [
        "## Corrected ownership and native ingest contract",
        "",
        "This existing issue is reassigned from CTO to SEO Blog Content Strategist. Do not grant `pipelines:write` to Semantic Core Validator and do not create another task.",
        "",
        "Create or idempotently reuse exactly two cases in `astrogen-search-demand-opportunities` at `discovered`:",
        "- `search-demand:trend-emerging-shcho-ne-pokazuje-natalna-karta`",
        "- `search-demand:trend-emerging-etyka-taro-konsultatsiyi`",
        "",
        "POST shape: top-level `caseKey`, `title`, `summary`, `stageKey=discovered`; all typed evidence under `fields`. Preserve accepted semantic materialized run `run_20260719_010339_audience_need_intent_be3cc145`, `demandEvidenceClass=trend_emerging`, `geoFrequencyStatus=unavailable_not_zero`, report `run_20260718_223110_trend_topic_7cd4289c`, exact evidence refs, expiry/falsifier/confidence/warnings, and no invented volume.",
        "",
        "Do not create topic/article work. Native stage automation must perform CMS ownership, duplicate/cannibalization, SERP and internal-link review before action selection.",
      ].join("\n"),
    }, issue.runId);
    process.stdout.write(`${JSON.stringify({ ok: true, issue: ISSUE_IDENTIFIER, assignee: ASSIGNEE_NAME, assigneeId }, null, 2)}\n`);
  } finally {
    psql(`delete from board_api_keys where id=${quote(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
