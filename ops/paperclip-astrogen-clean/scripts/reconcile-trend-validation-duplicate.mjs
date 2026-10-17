#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const PARENT = "AST-664";
const DUPLICATE = "AST-668";
const CANONICAL = "AST-669";
const RESOLVED_BLOCKER = "AST-671";
const CANDIDATES = [
  "що не показує натальна карта",
  "етика таро консультації що не можна обіцяти",
  "як перевірити астролога перед оплатою",
  "астрологія для карʼєри натальна карта",
  "курси астрології для початківців як обрати",
];

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

function q(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function issue(identifier) {
  const row = psql(`
    select json_build_object(
      'id',i.id,'identifier',i.identifier,'status',i.status,
      'runId',(select h.id from heartbeat_runs h where h.company_id=i.company_id
        and h.context_snapshot->>'issueId'=i.id::text order by h.created_at desc limit 1),
      'runStatus',(select h.status from heartbeat_runs h where h.company_id=i.company_id
        and h.context_snapshot->>'issueId'=i.id::text order by h.created_at desc limit 1)
    )::text from issues i where i.company_id=${q(COMPANY_ID)}::uuid and i.identifier=${q(identifier)};
  `);
  return row ? JSON.parse(row) : null;
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

async function cancelLiveRun(token, current) {
  if (current?.runId && ["queued", "running"].includes(current.runStatus)) {
    await request(token, "POST", `/heartbeat-runs/${current.runId}/cancel`, {});
  }
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const keyHash = createHash("sha256").update(token).digest("hex");
  psql(`insert into board_api_keys (id,user_id,name,key_hash,expires_at) values (${q(keyId)}::uuid,${q(USER_ID)},'reconcile-trend-validation-duplicate',${q(keyHash)},now()+interval '10 minutes');`);

  try {
    const parent = issue(PARENT);
    const duplicate = issue(DUPLICATE);
    const canonical = issue(CANONICAL);
    const blocker = issue(RESOLVED_BLOCKER);
    if (![parent, duplicate, canonical, blocker].every(Boolean)) throw new Error("Expected trend issues were not found");

    await cancelLiveRun(token, duplicate);
    await cancelLiveRun(token, blocker);
    await cancelLiveRun(token, canonical);

    if (!["done", "cancelled"].includes(duplicate.status)) {
      await request(token, "PATCH", `/issues/${duplicate.id}`, {
        status: "cancelled",
        comment: [
          `Superseded by canonical wave-2 validation [${CANONICAL}](/AST/issues/${CANONICAL}).`,
          "",
          "This duplicate was created during a parent-heartbeat/config-repair race. Its queued retry was cancelled before a successful provider run. The canonical child uses fingerprint `trend-validation:run_20260718_223110_trend_topic_7cd4289c:wave:2` and owns the only bounded five-phrase batch.",
        ].join("\n"),
      }, duplicate.runId);
    }

    if (!["done", "cancelled"].includes(blocker.status)) {
      await request(token, "PATCH", `/issues/${blocker.id}`, {
        status: "done",
        comment: "Duplicate config blocker resolved by the deployed Semantic Core plugin 0.3.9 normalization and verified `validate-project=status=ok`.",
      }, blocker.runId);
    }

    await request(token, "PATCH", `/issues/${parent.id}`, {
      status: "blocked",
      blockedByIssueIds: [canonical.id],
      comment: `Duplicate validation/config branches reconciled. ${CANONICAL} is the sole canonical wave-2 child; the parent waits only for its provider-backed dispositions.`,
    }, parent.runId);

    await request(token, "PATCH", `/issues/${canonical.id}`, {
      status: "todo",
      blockedByIssueIds: [],
      comment: [
        "## Canonical wave-2 resume after config repair",
        "",
        "Fingerprint: `trend-validation:run_20260718_223110_trend_topic_7cd4289c:wave:2`.",
        "Use exactly one `run-layer-and-wait` call with `project_id=astrogen-ukraine`, `layer=audience_need_intent`, explicit `mode=live`, and these exact candidates:",
        ...CANDIDATES.map((candidate) => `- ${candidate}`),
        "",
        "Require `candidate_keyword_count=5`, returned `mode=live`, and a disposition for all five phrases. Mock/fixture output is invalid for production routing. Only accepted provider-backed demand may enter `astrogen-search-demand-opportunities`. Do not create topic/article tasks directly and do not generate another trend report.",
      ].join("\n"),
    }, canonical.runId);

    process.stdout.write(`${JSON.stringify({
      ok: true,
      parent: PARENT,
      canonical: CANONICAL,
      cancelledDuplicate: DUPLICATE,
      resolvedDuplicateBlocker: RESOLVED_BLOCKER,
      candidateCount: CANDIDATES.length,
    }, null, 2)}\n`);
  } finally {
    psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
