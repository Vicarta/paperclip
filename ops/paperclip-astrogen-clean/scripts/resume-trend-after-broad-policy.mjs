#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = "http://127.0.0.1:3210/api";
const POLICY_HASH = "5ef41716444dae1e87ce99ebf28528c967c4c0a0fdb7d9618ea1c3e115212460";

function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}

function psql(sql) {
  return run("docker", [
    "exec", "-i", DB_CONTAINER,
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
  if (!response.ok) throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 1800)}`);
  return text ? JSON.parse(text) : null;
}

function issue(identifier) {
  const raw = psql(`
    select json_build_object(
      'id',id,'identifier',identifier,'status',status,'description',description,
      'assigneeAgentId',assignee_agent_id,'projectId',project_id,'executionRunId',execution_run_id
    )::text
    from issues where company_id=${q(COMPANY_ID)}::uuid and identifier=${q(identifier)};
  `);
  return raw ? JSON.parse(raw) : null;
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const keyHash = createHash("sha256").update(token).digest("hex");
  psql(`insert into board_api_keys (id,user_id,name,key_hash,expires_at) values (${q(keyId)}::uuid,${q(USER_ID)},'resume-trend-after-broad-policy',${q(keyHash)},now()+interval '10 minutes');`);

  try {
    const parent = issue("AST-705");
    const child = issue("AST-708");
    if (!parent?.id || !child?.id) throw new Error("AST-705 or AST-708 was not found");

    for (const current of [parent, child]) {
      if (current.executionRunId) {
        const runStatus = psql(`select status from heartbeat_runs where id=${q(current.executionRunId)}::uuid;`);
        if (["queued", "running"].includes(runStatus)) {
          await request(token, "POST", `/heartbeat-runs/${current.executionRunId}/cancel`, {});
        }
      }
      await request(token, "POST", `/issues/${current.id}/admin/force-release`);
    }

    const marker = "## trendIngestionResult";
    const markerIndex = child.description.indexOf(marker);
    const baseDescription = (markerIndex >= 0 ? child.description.slice(0, markerIndex) : child.description).trimEnd();
    const pendingResult = {
      finalDisposition: "project_policy_correction_pending",
      createdSearchDemandCaseIds: [],
      eligibleReadyTopicCountAfter: 0,
      remainingUnusedClusters: "same_wave_policy_correction",
      validationWave: "3 of 3",
      layerValidationMatrix: [
        {
          phrase: "натальна карта для зміни роботи як сформулювати запит",
          intendedLayer: "adjacent_use_case_intent",
          previousReason: "owner_mismatch",
          correctionReason: "semantic_project_layer_policy_was_missing",
        },
        {
          phrase: "як обрати консультацію нумеролога онлайн",
          intendedLayer: "audience_interest_intent",
          previousReason: "no_entity_anchor",
          correctionReason: "semantic_project_layer_policy_was_missing",
        },
        {
          phrase: "курси астрології для початківців як обрати навчання",
          intendedLayer: "audience_interest_intent",
          previousReason: "no_entity_anchor",
          correctionReason: "semantic_project_layer_policy_was_missing",
        },
      ],
      semanticProjectPolicyHash: POLICY_HASH,
    };
    const description = [
      baseDescription,
      "",
      marker,
      "```json",
      JSON.stringify(pendingResult, null, 2),
      "```",
    ].join("\n");

    await request(token, "PATCH", `/issues/${child.id}`, {
      status: "todo",
      blockedByIssueIds: [],
      description,
      comment: [
        "## Resume after Semantic Core project-policy correction",
        "",
        `Validated source policy hash: \`${POLICY_HASH}\`.`,
        "The project now has explicit adjacent-use-case, audience-need, and audience-interest layer policies, expanded audience/use-case inputs, and 119 current Payload CMS pages for ownership evidence.",
        "",
        "Repeat only the same three policy-invalidated phrases on their already assigned layers:",
        "- `натальна карта для зміни роботи як сформулювати запит` -> `adjacent_use_case_intent`",
        "- `як обрати консультацію нумеролога онлайн` -> `audience_interest_intent`",
        "- `курси астрології для початківців як обрати навчання` -> `audience_interest_intent`",
        "",
        "Use explicit `mode=live`, `provider_cache_mode=read_write`, and exact candidate arrays. This is a same-wave policy correction, not phrase reuse after a valid final rejection. Do not generate another trend report or add phrases.",
        "",
        "A `candidate_review` is expected and nonterminal. Delegate exactly one stable review child per semantic run to SEO Semantic Core Validator. The Validator may accept broad demand based on medium/high configured non-core topic-domain match, audience fit, proof that the phrase came from an audience signal rather than a product/service seed, and a safe ownership boundary. Explicit product binding alone is not enough for a trend-derived phrase. Materialize append-only decisions once, then hand accepted evidence to SEO Blog Content Strategist for full CMS duplicate/cannibalization/ownership review and native search-demand intake.",
        "",
        "Before completion replace the pending `trendIngestionResult` with final materialized dispositions and native search-demand case proof. Never create topic or article work directly.",
      ].join("\n"),
    });
    await request(token, "PATCH", `/issues/${parent.id}`, {
      status: "blocked",
      blockedByIssueIds: [child.id],
      comment: [
        "The same trend wave is continuing after a systemic Semantic Core project-policy correction.",
        "",
        "AST-708 is the existing bounded child. The parent now waits on that first-class blocker and must not create another validation wave or trend report.",
      ].join("\n"),
    });
    process.stdout.write(`${JSON.stringify({
      ok: true,
      parent: parent.identifier,
      parentStatus: "blocked",
      child: child.identifier,
      childStatus: "todo",
      repeatedPhraseCount: pendingResult.layerValidationMatrix.length,
      newTrendReportForbidden: true,
      wakeMode: "single_assignment_wake_from_todo_transition",
    }, null, 2)}\n`);
  } finally {
    psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
