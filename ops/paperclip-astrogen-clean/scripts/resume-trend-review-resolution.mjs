#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const PARENT_IDENTIFIER = "AST-664";
const WAVE_IDENTIFIER = "AST-669";
const SEMANTIC_RUN_ID = "run_20260719_004743_audience_need_intent_e285cd4c";
const REVIEW_FINGERPRINT = `trend-review:${SEMANTIC_RUN_ID}`;

function execute(command, args, input) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input,
    maxBuffer: 16 * 1024 * 1024,
  });
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

function issue(identifier) {
  const raw = psql(`
    select json_build_object(
      'id', i.id,
      'identifier', i.identifier,
      'status', i.status,
      'runId', (
        select h.id from heartbeat_runs h
        where h.company_id=i.company_id and h.context_snapshot->>'issueId'=i.id::text
        order by h.created_at desc limit 1
      )
    )::text
    from issues i
    where i.company_id=${quote(COMPANY_ID)}::uuid and i.identifier=${quote(identifier)};
  `);
  if (!raw) throw new Error(`Issue not found: ${identifier}`);
  return JSON.parse(raw);
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
  psql(`
    insert into board_api_keys (id,user_id,name,key_hash,expires_at)
    values (
      ${quote(keyId)}::uuid,
      ${quote(USER_ID)},
      'resume-trend-review-resolution',
      ${quote(createHash("sha256").update(token).digest("hex"))},
      now()+interval '10 minutes'
    );
  `);

  try {
    const parent = issue(PARENT_IDENTIFIER);
    const wave = issue(WAVE_IDENTIFIER);
    const comment = [
      "## Resume under nonterminal Semantic Core review contract",
      "",
      `Live semantic run: \`${SEMANTIC_RUN_ID}\`. Review fingerprint: \`${REVIEW_FINGERPRINT}\`.`,
      "",
      "The following rows are unresolved and must not be reported as owner direction or terminal completion:",
      "- `що не показує натальна карта`: candidate_review, low_confidence, high entity anchor, canonized astrology binding, strong service pathway",
      "- `етика таро консультації що не можна обіцяти`: candidate_review, low_confidence, high entity anchor, canonized tarology binding, strong service pathway",
      "",
      "Reuse or create exactly one direct review child assigned to SEO Semantic Core Validator with the fingerprint above. The Validator must inspect the prepared import and decision trace, submit append-only `accept`, `park`, or `reject` decisions, then run one cached live materializing rerun with the same two phrases, matching review_decisions and force_re_review_keywords.",
      "",
      "Do not ask the owner. Do not create topic or article tasks. Accepted rows go to native search-demand only, with real Ukraine frequency or the fully evidenced `trend_emerging` fallback from the live report. Parked/rejected rows stop. AST-669 is complete only when both rows have final materialized dispositions and accepted rows have downstream case proof.",
    ].join("\n");

    await request(token, "PATCH", `/issues/${wave.id}`, {
      status: "todo",
      blockedByIssueIds: [],
      comment,
    }, wave.runId);

    await request(token, "PATCH", `/issues/${parent.id}`, {
      status: "blocked",
      blockedByIssueIds: [wave.id],
      comment: [
        "Trend discovery was reopened because `candidate_review` is nonterminal under revision 5.",
        "",
        `[${WAVE_IDENTIFIER}](/AST/issues/${WAVE_IDENTIFIER}) now owns bounded Validator resolution for ${REVIEW_FINGERPRINT}. This parent must not close until the reviewed phrases have final dispositions and any accepted demand has search-demand routing proof.`,
      ].join("\n"),
    }, parent.runId);

    process.stdout.write(`${JSON.stringify({
      ok: true,
      parent: PARENT_IDENTIFIER,
      wave: WAVE_IDENTIFIER,
      semanticRunId: SEMANTIC_RUN_ID,
      reviewFingerprint: REVIEW_FINGERPRINT,
      wake: "existing-wave-reopened",
    }, null, 2)}\n`);
  } finally {
    psql(`delete from board_api_keys where id=${quote(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
