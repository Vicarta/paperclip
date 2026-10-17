#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = "http://127.0.0.1:3210/api";

function run(command, args, input) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input,
    maxBuffer: 8 * 1024 * 1024,
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
    throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 1600)}`);
  }
  return text ? JSON.parse(text) : null;
}

const description = [
  "Мета: виконати bounded ingestion accepted demand з AST-691 у native search-demand workflow. Не створювати topic/article/CMS work напряму з raw trend output.",
  "",
  "Accepted phrase:",
  "- `межі прогнозу таро консультація`",
  "",
  "Semantic validation proof:",
  "- source validation issue: AST-692, done",
  "- trend report: `run_20260718_223110_trend_topic_7cd4289c`",
  "- initial validation run: `run_20260719_014817_audience_need_intent_e727c6aa`",
  "- review decision: `review_20260719_014926_cfccf537`, accepted",
  "- materialized run: `run_20260719_014945_audience_need_intent_563b4e34`, mode `live`",
  "- frequency: `unavailable_not_zero`; never invent volume",
  "- cache/cost telemetry: 9 cache hits, 1 live provider call, 1 miss/write, no numeric estimated cost",
  "",
  "Required bounded workflow:",
  "- use only the accepted phrase above",
  "- verify full Payload/live CMS coverage, duplicate/cannibalization, query-to-URL ownership, current SERP grouping, and internal-link boundary",
  "- create or reuse one `astrogen-search-demand-opportunities` case at `discovered` only when the phrase remains eligible after that review",
  "- otherwise return the existing owner URL and typed covered/duplicate/cannibalization disposition",
  "- do not create topic inventory, article production, CMS mutation, image generation, publication, or Telegram delivery from this task",
  "",
  "## trendIngestionResult",
  "",
  JSON.stringify({
    finalDisposition: "covered_existing_owner",
    createdSearchDemandCaseIds: [],
    eligibleReadyTopicCountAfter: 0,
    remainingUnusedClusters: true,
    validationWave: 2,
    existingOwnerUrl: "https://astrogen.com.ua/blog/inshi/persha-konsultatsiia-taroloha-iaki-pytannia-pidhotuvaty/",
    existingOwnerCmsId: 124,
  }, null, 2),
].join("\n");

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const keyHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${q(keyId)}::uuid, ${q(USER_ID)}, 'repair-ast698-ingest-handoff',
      ${q(keyHash)}, now() + interval '10 minutes');
  `);

  try {
    const issue = JSON.parse(psql(`
      select json_build_object('id',id,'status',status)::text
      from issues where company_id=${q(COMPANY_ID)}::uuid and identifier='AST-698';
    `));
    await request(token, "PATCH", `/issues/${issue.id}`, { description });
    await request(token, "POST", `/issues/${issue.id}/comments`, {
      interrupt: !["done", "cancelled"].includes(issue.status),
      body: [
        "Corrected structured handoff and added the terminal trendIngestionResult projection to the issue description.",
        "",
        "Use the repaired issue description as the canonical input. The only accepted phrase is `межі прогнозу таро консультація`; complete CMS/ownership/cannibalization review before any native search-demand intake.",
      ].join("\n"),
    });
    const verified = JSON.parse(psql(`
      select json_build_object(
        'identifier',identifier,
        'status',status,
        'description',description
      )::text from issues where id=${q(issue.id)}::uuid;
    `));
    if (verified.description !== description) {
      throw new Error("AST-698 description verification failed");
    }
    process.stdout.write(`${JSON.stringify({
      ok: true,
      identifier: verified.identifier,
      status: verified.status,
      descriptionLength: verified.description.length,
      interruptCommentSent: true,
    }, null, 2)}\n`);
  } finally {
    psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
