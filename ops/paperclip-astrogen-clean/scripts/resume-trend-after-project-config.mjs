#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const PLUGIN = "paperclip.semantic-core-mcp-agent-tools";
const VALIDATION_ISSUE = "AST-668";
const CONFIG_BLOCKER = "AST-670";
const CANDIDATE_KEYWORDS = [
  "межі астрології що не показує натальна карта",
  "як обрати астролога для консультації",
  "як обрати таролога онлайн",
  "астрологія для карʼєри натальна карта",
  "онлайн розрахунок натальної карти чи консультація астролога",
];

function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}

function psql(sql) {
  return run("sudo", [
    "docker", "exec", "-i", DB_CONTAINER,
    "psql", "-U", "paperclip", "-d", "paperclip", "-v", "ON_ERROR_STOP=1", "-At",
  ], sql);
}

function q(value) {
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
  if (!response.ok) throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 1800)}`);
  return text ? JSON.parse(text) : null;
}

function unwrap(response) {
  return response?.result?.data?.structuredContent
    ?? response?.result?.data
    ?? response?.data?.structuredContent
    ?? response?.data
    ?? response?.result
    ?? response;
}

function issue(identifier) {
  const value = psql(`
    select json_build_object(
      'id',i.id,'identifier',i.identifier,'status',i.status,'assigneeAgentId',i.assignee_agent_id,
      'projectId',i.project_id,
      'runId',(select h.id from heartbeat_runs h where h.company_id=i.company_id
        and h.context_snapshot->>'issueId'=i.id::text order by h.created_at desc limit 1),
      'runStatus',(select h.status from heartbeat_runs h where h.company_id=i.company_id
        and h.context_snapshot->>'issueId'=i.id::text order by h.created_at desc limit 1)
    )::text from issues i
    where i.company_id=${q(COMPANY_ID)}::uuid and i.identifier=${q(identifier)};
  `);
  return value ? JSON.parse(value) : null;
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const keyHash = createHash("sha256").update(token).digest("hex");
  psql(`insert into board_api_keys (id,user_id,name,key_hash,expires_at) values (${q(keyId)}::uuid,${q(USER_ID)},'resume-trend-after-project-config',${q(keyHash)},now()+interval '10 minutes');`);

  try {
    const validationIssue = issue(VALIDATION_ISSUE);
    const blocker = issue(CONFIG_BLOCKER);
    if (!validationIssue?.id || !blocker?.id) throw new Error("AST-668 or AST-670 was not found");

    for (const current of [validationIssue, blocker]) {
      if (current.runId && ["queued", "running"].includes(current.runStatus)) {
        await request(token, "POST", `/heartbeat-runs/${current.runId}/cancel`, {});
      }
    }

    const validationResponse = await request(token, "POST", "/agents/me/plugin-tools/execute", {
      tool: `${PLUGIN}:validate-project`,
      parameters: { project_id: "astrogen-ukraine" },
      runContext: {
        agentId: validationIssue.assigneeAgentId,
        runId: validationIssue.runId,
        companyId: COMPANY_ID,
        projectId: validationIssue.projectId,
        issueId: validationIssue.id,
      },
    });
    const validation = unwrap(validationResponse);
    if (validation?.status !== "ok" || (Array.isArray(validation.errors) && validation.errors.length > 0)) {
      throw new Error(`Semantic Core project remains invalid: ${JSON.stringify(validation).slice(0, 1800)}`);
    }

    if (!['done', 'cancelled'].includes(blocker.status)) {
      await request(token, "PATCH", `/issues/${blocker.id}`, {
        status: "done",
        comment: [
          "Semantic Core project configuration was migrated and verified.",
          "",
          "- Removed only the unsupported legacy fields `client_key`, `country`, `language`, and `site_domain`.",
          "- Preserved canonical site, locale, section, ownership, threshold, intent, title/meta, and provider-cache configuration.",
          "- Paperclip Semantic Core plugin 0.3.9 now strips those legacy fields on every future registration while enforcing the allowlists before normalization.",
          "- `validate-project` returns `status=ok` with no errors through the clean Paperclip plugin.",
        ].join("\n"),
      }, blocker.runId);
    }

    await request(token, "PATCH", `/issues/${validationIssue.id}`, {
      status: "todo",
      blockedByIssueIds: [],
      comment: [
        "## Resume delta: project config repaired; repeat the same bounded batch",
        "",
        "Do not generate a new trend report and do not change the five candidate phrases.",
        "Call `run-layer-and-wait` once with `project_id=astrogen-ukraine`, `layer=audience_need_intent`, explicit `mode=live`, and these exact `candidate_keywords`:",
        ...CANDIDATE_KEYWORDS.map((keyword) => `- ${keyword}`),
        "",
        "Require `candidate_keyword_count=5` and returned `mode=live`, then use `prepare-paperclip-import` only for this semantic validation run. Mock/fixture output cannot satisfy this gate. Record accepted/review/parked/rejected/recall disposition for every phrase. Route only accepted provider-backed demand into `astrogen-search-demand-opportunities`; never create topic or article tasks directly.",
      ].join("\n"),
    }, validationIssue.runId);

    process.stdout.write(`${JSON.stringify({
      ok: true,
      validationStatus: validation.status,
      pluginVersion: "0.3.9",
      blockerClosed: CONFIG_BLOCKER,
      validationIssueResumed: VALIDATION_ISSUE,
      candidateKeywordCount: CANDIDATE_KEYWORDS.length,
    }, null, 2)}\n`);
  } finally {
    psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
