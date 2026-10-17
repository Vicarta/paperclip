#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const PARENT_IDENTIFIER = "AST-664";
const BLOCKER_IDENTIFIER = "AST-667";
const REPORT_RUN_ID = "run_20260718_223110_trend_topic_7cd4289c";
const PREVIOUS_PHRASES = [
  "як підготуватися до консультації з тарологом",
  "як підготуватися до консультації з астрологом",
  "що запитати у таролога",
  "що запитати в астролога",
  "порівняння астрологія таро нумерологія Human Design",
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
  if (!response.ok) throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 1600)}`);
  return text ? JSON.parse(text) : null;
}

function issueSnapshot(identifier) {
  const text = psql(`
    select json_build_object(
      'id', i.id,
      'identifier', i.identifier,
      'status', i.status,
      'runId', hr.id,
      'runStatus', hr.status
    )::text
    from issues i
    left join lateral (
      select h.id,h.status from heartbeat_runs h
      where h.company_id=i.company_id and h.context_snapshot->>'issueId'=i.id::text
      order by h.created_at desc limit 1
    ) hr on true
    where i.company_id=${quote(COMPANY_ID)}::uuid and i.identifier=${quote(identifier)};
  `);
  return text ? JSON.parse(text) : null;
}

async function cancelLiveRun(token, issue) {
  if (issue?.runId && ["queued", "running"].includes(issue.runStatus)) {
    await request(token, "POST", `/heartbeat-runs/${issue.runId}/cancel`, {});
  }
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const keyHash = createHash("sha256").update(token).digest("hex");
  psql(`insert into board_api_keys (id,user_id,name,key_hash,expires_at) values (${quote(keyId)}::uuid,${quote(USER_ID)},'resume-trend-wave-stored-report',${quote(keyHash)},now()+interval '10 minutes');`);

  try {
    const parent = issueSnapshot(PARENT_IDENTIFIER);
    const blocker = issueSnapshot(BLOCKER_IDENTIFIER);
    if (!parent?.id || !blocker?.id) throw new Error("AST-664 or AST-667 was not found");
    await cancelLiveRun(token, parent);
    await cancelLiveRun(token, blocker);

    if (!["done", "cancelled"].includes(blocker.status)) {
      await request(token, "PATCH", `/issues/${blocker.id}`, {
        status: "done",
        comment: [
          "The failed fresh LLM structured response does not block this continuation.",
          "",
          `A successful live report already exists as \`${REPORT_RUN_ID}\` and is readable through Semantic Core plugin 0.3.8. Wave 2 must reuse this stored report rather than repeat trend generation. A separate generator reliability review may use the failed-run telemetry without blocking content supply.`,
        ].join("\n"),
      }, blocker.runId);
    }

    const comment = [
      "## Resume delta: wave 2 must reuse the exact successful live report",
      "",
      `Call \`paperclip.semantic-core-mcp-agent-tools:get-trend-topic-report\` with \`{\"runId\":\"${REPORT_RUN_ID}\",\"maxClusters\":8,\"maxIdeasPerCluster\":3,\"maxEvidencePerCluster\":3}\`.`,
      "",
      "Do not call `generate-trend-topic-report` in this continuation. The failed fresh structured response is non-blocking because the exact successful live report is durable.",
      "",
      "Read AST-618 as wave 1 evidence. Exclude these 5 parked phrases:",
      ...PREVIOUS_PHRASES.map((phrase) => `- ${phrase}`),
      "",
      "Management contract:",
      "- CMO selects 3-5 unused concrete Ukrainian search phrases from non-calendar clusters, with an explicit entity or reader-problem anchor",
      "- prioritize broader career/work decisions, ethical boundaries, safe expert selection, or beginner education when CMS ownership is not already present",
      "- CMO delegates one semantic validation child to SEO Semantic Core Strategist; CMO does not run the semantic layer itself",
      "- the child uses one exact `candidate_keywords` batch and must report a disposition for every phrase",
      "- only accepted demand enters `astrogen-search-demand-opportunities`; no direct topic/article task",
      "- if wave 2 is all parked and unused eligible clusters remain, continue to bounded wave 3 rather than closing content supply",
    ].join("\n");

    await request(token, "PATCH", `/issues/${parent.id}`, {
      status: "todo",
      blockedByIssueIds: [],
      comment,
    }, parent.runId);

    process.stdout.write(`${JSON.stringify({
      ok: true,
      parent: PARENT_IDENTIFIER,
      resolvedBlocker: BLOCKER_IDENTIFIER,
      reportRunId: REPORT_RUN_ID,
      previousPhraseCount: PREVIOUS_PHRASES.length,
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
