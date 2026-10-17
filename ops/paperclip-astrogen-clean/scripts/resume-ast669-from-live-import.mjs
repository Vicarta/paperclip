#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const ISSUE_IDENTIFIER = "AST-669";
const SEMANTIC_RUN_ID = "run_20260719_004743_audience_need_intent_e285cd4c";
const TOOL = "paperclip.semantic-core-mcp-agent-tools:prepare-paperclip-import";
const CANDIDATES = new Set([
  "що не показує натальна карта",
  "етика таро консультації що не можна обіцяти",
  "як перевірити астролога перед оплатою",
  "астрологія для карʼєри натальна карта",
  "курси астрології для початківців як обрати",
]);

function execute(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}

function psql(sql) {
  return execute("sudo", ["docker", "exec", "-i", DB_CONTAINER, "psql", "-U", "paperclip", "-d", "paperclip", "-v", "ON_ERROR_STOP=1", "-At"], sql);
}

function q(value) {
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

function unwrap(response) {
  return response?.result?.data?.structuredContent
    ?? response?.result?.data
    ?? response?.data?.structuredContent
    ?? response?.data
    ?? response?.result
    ?? response;
}

function phrase(row) {
  return row?.keyword_text ?? row?.keyword ?? row?.normalized_keyword ?? row?.phrase ?? row?.text ?? null;
}

function compactRows(payload) {
  const rows = [];
  const artifacts = payload?.artifacts && typeof payload.artifacts === "object" ? payload.artifacts : {};
  for (const [artifact, value] of Object.entries(artifacts)) {
    const candidates = Array.isArray(value) ? value : Array.isArray(value?.rows) ? value.rows : [];
    for (const row of candidates) {
      const keyword = phrase(row);
      if (!keyword || !CANDIDATES.has(keyword)) continue;
      rows.push({
        keyword,
        artifact,
        status: row.status ?? row.layer_membership ?? artifact,
        reason: row.parked_reason ?? row.rejected_reason ?? row.human_review_reason ?? null,
        recommendedDecision: row.recommended_human_decision ?? null,
        geoSearchVolume: row.geo_search_volume ?? row.search_volume ?? null,
        opportunityClass: row.traffic_opportunity_class ?? null,
        productBinding: row.product_binding ?? null,
      });
    }
  }
  return rows;
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  psql(`insert into board_api_keys (id,user_id,name,key_hash,expires_at) values (${q(keyId)}::uuid,${q(USER_ID)},'resume-ast669-live-import',${q(createHash("sha256").update(token).digest("hex"))},now()+interval '10 minutes');`);
  try {
    const issue = JSON.parse(psql(`
      select json_build_object('id',i.id,'status',i.status,'assigneeAgentId',i.assignee_agent_id,'projectId',i.project_id,
        'runId',(select h.id from heartbeat_runs h where h.company_id=i.company_id and h.context_snapshot->>'issueId'=i.id::text order by h.created_at desc limit 1),
        'runStatus',(select h.status from heartbeat_runs h where h.company_id=i.company_id and h.context_snapshot->>'issueId'=i.id::text order by h.created_at desc limit 1))::text
      from issues i where i.company_id=${q(COMPANY_ID)}::uuid and i.identifier=${q(ISSUE_IDENTIFIER)};
    `));
    if (["queued", "running"].includes(issue.runStatus)) await request(token, "POST", `/heartbeat-runs/${issue.runId}/cancel`, {});

    const response = await request(token, "POST", "/agents/me/plugin-tools/execute", {
      tool: TOOL,
      parameters: { project_id: "astrogen-ukraine", run_id: SEMANTIC_RUN_ID },
      runContext: { agentId: issue.assigneeAgentId, runId: issue.runId, companyId: COMPANY_ID, projectId: issue.projectId, issueId: issue.id },
    });
    const prepared = unwrap(response);
    const rows = compactRows(prepared);
    const totals = prepared?.totals ?? prepared?.summary?.totals ?? null;
    const status = prepared?.status ?? null;
    const schemaVersion = prepared?.schema_version ?? prepared?.schemaVersion ?? null;
    if (!schemaVersion || !String(schemaVersion).includes("paperclip_import")) {
      throw new Error(`Unexpected import response: ${JSON.stringify({status,schemaVersion,keys:Object.keys(prepared ?? {})})}`);
    }

    const comment = [
      "## Resume delta: live provider run already complete; use its prepared typed import",
      "",
      `Semantic run: \`${SEMANTIC_RUN_ID}\`, mode live, candidate_keyword_count 5. Do not call run-layer again.`,
      `Prepared schema: \`${schemaVersion}\`; status: \`${status ?? "unknown"}\`; totals: \`${JSON.stringify(totals)}\`.`,
      "",
      ...(rows.length > 0 ? ["Candidate rows:", ...rows.map((row) => `- ${row.keyword}: ${row.status}; reason=${row.reason ?? "none"}; geo=${row.geoSearchVolume ?? "unknown"}; recommended=${row.recommendedDecision ?? "none"}`)] : ["The typed import was persisted, but the compact response did not expose candidate rows. Read the stored semantic-core import candidate for this exact run; do not use get-keywords and do not infer missing statuses."]),
      "",
      "Completion requires explicit disposition of all five exact phrases and returned mode=live. Route only accepted rows to search-demand. Review rows must follow the bounded Semantic Core review policy; parked/rejected rows do not enter topic inventory.",
    ].join("\n");
    await request(token, "PATCH", `/issues/${issue.id}`, { status: "todo", blockedByIssueIds: [], comment }, issue.runId);

    process.stdout.write(`${JSON.stringify({ok:true,issue:ISSUE_IDENTIFIER,semanticRunId:SEMANTIC_RUN_ID,status,schemaVersion,totals,rows},null,2)}\n`);
  } finally {
    psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
