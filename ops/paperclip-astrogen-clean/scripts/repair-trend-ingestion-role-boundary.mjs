#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const CONTENT_STRATEGIST_ID = "4af38b84-1551-4e9d-802c-38ef5ae5c24c";
const CMO_ID = "a05b41d8-83ab-4f7c-8330-149f46dbd13a";

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

function q(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function request(token, method, pathname, body) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
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

function issue(identifier) {
  const raw = psql(`
    select json_build_object(
      'id', id,
      'identifier', identifier,
      'title', title,
      'status', status,
      'assigneeAgentId', assignee_agent_id,
      'parentId', parent_id
    )::text
    from issues
    where company_id=${q(COMPANY_ID)}::uuid
      and identifier=${q(identifier)};
  `);
  if (!raw) throw new Error(`Issue not found: ${identifier}`);
  return JSON.parse(raw);
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const keyHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${q(keyId)}::uuid, ${q(USER_ID)}, 'repair-trend-ingestion-role-boundary',
      ${q(keyHash)}, now() + interval '15 minutes');
  `);

  try {
    const backup = await request(token, "POST", "/instance/database-backups", {});
    const ast890 = issue("AST-890");
    const ast914 = issue("AST-914");
    const ast916 = issue("AST-916");
    const ast919 = issue("AST-919");
    const ast920 = issue("AST-920");

    const ingestionDescription = [
      "Purpose: materialize accepted audience-first trend semantic candidates from AST-916 into native `astrogen-search-demand-opportunities` cases.",
      "",
      "This is not a CTO permission task. Do not grant `pipelines:write` to SEO Semantic Core Strategist or SEO Semantic Core Validator.",
      "",
      "Parent: AST-916 Validate Astrogen life_decisions trend candidates wave 1",
      "Source trend report: `run_20260720_190230_trend_topic_29f5ef5b`",
      "Primary audience segment: `life_decisions`",
      "Target pipeline: `astrogen-search-demand-opportunities`",
      "Target stage: `discovered`",
      "",
      "Accepted candidates to create or reuse:",
      "",
      "1. `як зрозуміти чи повертатися в Україну з-за кордону`",
      "   - caseKey: `trend-ingestion-run_20260720_190230_trend_topic_29f5ef5b-wave-1-life_decisions-return-ukraine-abroad`",
      "   - semantic run: `run_20260720_191315_adjacent_use_case_intent_86881550`",
      "   - intended layer: `adjacent_use_case_intent`",
      "   - source cluster: `trend_14c02ae5b3e1`",
      "",
      "2. `план повернення в Україну з ЄС 2026`",
      "   - caseKey: `trend-ingestion-run_20260720_190230_trend_topic_29f5ef5b-wave-1-life_decisions-return-plan-eu-2026`",
      "   - semantic run: `run_20260720_191324_adjacent_use_case_intent_6e0a2ec2`",
      "   - intended layer: `adjacent_use_case_intent`",
      "   - source cluster: `trend_14c02ae5b3e1`",
      "",
      "3. `як обрати між залишитися за кордоном і повернутися в Україну`",
      "   - caseKey: `trend-ingestion-run_20260720_190230_trend_topic_29f5ef5b-wave-1-life_decisions-stay-abroad-or-return`",
      "   - semantic run: `run_20260720_191455_adjacent_use_case_intent_29206777`",
      "   - intended layer: `adjacent_use_case_intent`",
      "   - source cluster: `trend_14c02ae5b3e1`",
      "",
      "Required behavior:",
      "- create or reuse only native search-demand opportunity cases; do not create topic or article cases",
      "- keep titles, phrases, topic keys and action reasons audience-first; do not narrow them to Astrogen product/service/modality names",
      "- set frequency as unavailable_not_zero when provider volume is unavailable; never invent search volume",
      "- set CMS coverage, cannibalization and URL ownership as required/not_reviewed until the normal ownership_review stage proves the verdict",
      "- preserve `trendReportRunId`, `primaryAudienceSegmentId`, `validationWave`, `semanticProjectId=astrogen-ukraine`, and source evidence refs in fields",
      "- on completion, comment on AST-916 with the real native search-demand case IDs and set this task done",
    ].join("\n");

    await request(token, "PATCH", `/issues/${ast919.id}`, {
      title: "Ingest accepted AST-916 trend demand into search-demand cases",
      description: ingestionDescription,
      status: "todo",
      assigneeAgentId: CONTENT_STRATEGIST_ID,
      priority: "high",
      blockedByIssueIds: [],
      comment: [
        "Role boundary corrected.",
        "",
        "This task is now the bounded ingestion handoff for accepted trend candidates from AST-916. It must be executed by SEO Blog Content Strategist, not by granting `pipelines:write` to semantic-core agents.",
      ].join("\n"),
    });

    await request(token, "PATCH", `/issues/${ast916.id}`, {
      status: "blocked",
      blockedByIssueIds: [ast919.id],
      assigneeAgentId: "2eb6826a-fc1b-4290-8d28-bcd864cbbe44",
      comment: [
        "System correction applied.",
        "",
        "AST-919 is no longer a permission request. It is the authorized ingestion handoff to SEO Blog Content Strategist. Semantic-core roles keep read/validation scope only.",
      ].join("\n"),
    });

    await request(token, "PATCH", `/issues/${ast914.id}`, {
      status: "todo",
      assigneeAgentId: CMO_ID,
      blockedByIssueIds: [],
      comment: [
        "Resolved stale blocker edge.",
        "",
        `${ast920.identifier} is already terminal. Resume the audience-first relationships trend flow from its result projection: if the focused segment remains below five and eligible clusters remain, continue the next bounded wave; otherwise record explicit exhausted evidence and move to the next deficient segment. Do not narrow trend topics to Astrogen products.`,
      ].join("\n"),
    });

    await request(token, "PATCH", `/issues/${ast890.id}`, {
      status: "todo",
      assigneeAgentId: CMO_ID,
      blockedByIssueIds: [],
      comment: [
        "Resolved stale blocker edges.",
        "",
        "The return-to-Ukraine topic was materialized as a ready native topic and the VPO voucher branch was intentionally cancelled as authority mismatch. Resume only if the portfolio gate still needs more audience-first topics for `life_decisions`; otherwise close this report with durable evidence.",
      ].join("\n"),
    });

    console.log(JSON.stringify({
      ok: true,
      backup: {
        backupDir: backup.backupDir ?? null,
        sizeBytes: backup.sizeBytes ?? null,
        finishedAt: backup.finishedAt ?? null,
      },
      updated: [
        { issue: "AST-919", status: "todo", assignee: "SEO Blog Content Strategist" },
        { issue: "AST-916", status: "blocked", blockedBy: "AST-919" },
        { issue: "AST-914", status: "todo", blockedBy: [] },
        { issue: "AST-890", status: "todo", blockedBy: [] },
      ],
    }, null, 2));
  } finally {
    psql(`update board_api_keys set revoked_at=now(), last_used_at=now() where id=${q(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
