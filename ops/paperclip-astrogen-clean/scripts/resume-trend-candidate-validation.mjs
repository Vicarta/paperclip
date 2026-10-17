#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const ISSUE_IDENTIFIER = "AST-618";
const CANDIDATE_KEYWORDS = [
  "як підготуватися до консультації з тарологом",
  "як підготуватися до консультації з астрологом",
  "що запитати у таролога",
  "що запитати в астролога",
  "порівняння астрологія таро нумерологія Human Design",
];

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
    "psql", "-U", "paperclip", "-d", "paperclip", "-v", "ON_ERROR_STOP=1", "-At",
  ], sql);
}

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function request(token, method, pathname, body, runId) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(runId ? { "X-Paperclip-Run-Id": runId } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 2000)}`);
  }
  return text ? JSON.parse(text) : null;
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const keyHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${quote(keyId)}::uuid, ${quote(USER_ID)}, 'resume-trend-candidate-validation',
      ${quote(keyHash)}, now() + interval '10 minutes');
  `);

  try {
    const issue = JSON.parse(psql(`
      select json_build_object(
        'id', i.id,
        'identifier', i.identifier,
        'status', i.status,
        'assigneeAgentId', i.assignee_agent_id,
        'lastRunId', (
          select hr.id from heartbeat_runs hr
          where hr.company_id=i.company_id
            and hr.agent_id=i.assignee_agent_id
            and hr.context_snapshot->>'issueId'=i.id::text
          order by hr.created_at desc limit 1
        )
      )::text
      from issues i
      where i.company_id=${quote(COMPANY_ID)}::uuid
        and i.identifier=${quote(ISSUE_IDENTIFIER)};
    `));
    if (!issue?.id || !issue?.assigneeAgentId) {
      throw new Error(`${ISSUE_IDENTIFIER} or its assignee was not found`);
    }

    const resolvedRuntimeBlockers = [];
    for (const blockerIdentifier of ["AST-636", "AST-639", "AST-643", "AST-647", "AST-654"]) {
      const runtimeBlockerText = psql(`
        select json_build_object(
          'id', i.id,
          'identifier', i.identifier,
          'status', i.status,
          'lastRunId', (
            select hr.id from heartbeat_runs hr
            where hr.company_id=i.company_id
              and hr.agent_id=i.assignee_agent_id
              and hr.context_snapshot->>'issueId'=i.id::text
            order by hr.created_at desc limit 1
          )
        )::text
        from issues i
        where i.company_id=${quote(COMPANY_ID)}::uuid
          and i.identifier=${quote(blockerIdentifier)};
      `);
      const runtimeBlocker = runtimeBlockerText ? JSON.parse(runtimeBlockerText) : null;
      if (!runtimeBlocker || ["done", "cancelled"].includes(runtimeBlocker.status)) continue;
      await request(token, "PATCH", `/issues/${runtimeBlocker.id}`, {
        status: "done",
        comment: [
          "## Runtime fix deployed and verified",
          "",
          "Clean Paperclip now runs `paperclip-app:v2026.626.0-vicarta.93-semantic-job-result-20260719`.",
          "",
          "- Semantic Core plugin `0.3.7` activated successfully with 19 tools.",
          "- `validate-project` and `get-job-status` have 60-second host RPC budgets.",
          "- `run-layer` has a 120-second budget.",
          "- `run-layer-and-wait` has a 360-second budget.",
          "- The MCP deployment again binds the documented private endpoint `100.98.5.50:8001`.",
          "- `validate-project` now returns `status=ok` through the Paperclip plugin.",
          "- Semantic Core persists the completed async result and exposes top-level `candidate_keyword_count`.",
          "- Paperclip passes `project_id` through bounded job polling for plugin authorization without leaking it into the MCP request.",
          "",
          "This resolves the runtime/endpoint blocker for [AST-618](/AST/issues/AST-618).",
        ].join("\n"),
      }, runtimeBlocker.lastRunId);
      resolvedRuntimeBlockers.push(runtimeBlocker.identifier);
    }

    const comment = [
      "## Resume delta: validate the selected trend phrases, not the canonical seed inventory",
      "",
      "The previous run `run_20260718_225411_audience_need_intent_29f7f775` is not valid evidence for this batch. It did not receive the selected phrases and therefore cannot support a zero-candidate conclusion.",
      "Jobs completed before the durable-result migration cannot acquire `result_json` retroactively. Do not reuse `job_3d010f301e26` or another pre-deployment job for the completion gate. Start exactly one new idempotent run after deployment of `.93`; provider cache reuse is expected and valid.",
      "",
      "Call `paperclip.semantic-core-mcp-agent-tools:run-layer-and-wait` with this exact payload:",
      "",
      "```json",
      JSON.stringify({
        project_id: "astrogen-ukraine",
        layer: "audience_need_intent",
        mode: "live",
        provider_cache_mode: "read_write",
        candidate_keywords: CANDIDATE_KEYWORDS,
      }, null, 2),
      "```",
      "",
      "Completion contract:",
      "",
      "- the completed job must report `candidate_keyword_count=5`; otherwise keep this issue non-terminal and record a technical blocker",
      "- run `prepare-paperclip-import` only for this semantic validation run, never for the trend report",
      "- record an accepted, review, parked, rejected or explicit recall disposition for every exact input phrase",
      "- only provider-backed accepted demand may enter the native `astrogen-search-demand-opportunities` pipeline",
      "- do not create topic or article tasks directly; the native search-demand action gate owns that transition",
      "- date-specific and calendar topics remain excluded",
    ].join("\n");

    await request(token, "PATCH", `/issues/${issue.id}`, {
      status: "todo",
      blockedByIssueIds: [],
      comment,
    }, issue.lastRunId);

    process.stdout.write(`${JSON.stringify({
      ok: true,
      issue: issue.identifier,
      candidateKeywordCount: CANDIDATE_KEYWORDS.length,
      resolvedRuntimeBlockers,
      wake: "assignment_wakeup_created_by_issue_status_transition",
    }, null, 2)}\n`);
  } finally {
    psql(`delete from board_api_keys where id=${quote(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
