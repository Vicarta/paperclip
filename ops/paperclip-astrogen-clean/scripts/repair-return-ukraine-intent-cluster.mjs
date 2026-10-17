#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";

const CANONICAL_OPPORTUNITY_ID = "88fe7ca0-9694-4464-b542-b8cebc41f1aa";
const DUPLICATE_OPPORTUNITY_IDS = [
  "d30a1614-adfb-4474-8a02-8b1f5bcb246f",
  "751a3bcc-0c41-4711-ae4e-bef69586da06",
  "ad366f9e-8b30-49be-af99-58c451699b3f",
];
const DUPLICATE_TOPIC_IDS = [
  "82f71047-93af-4672-9860-b2d68e74f5f5",
  "818cd40a-933d-43d8-92e0-20d6f048ab65",
];

function run(command, args, input) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input,
    maxBuffer: 32 * 1024 * 1024,
  });
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

function caseRow(detail) {
  return detail?.case ?? detail;
}

function stageKey(detail) {
  return detail?.stage?.key ?? null;
}

async function patchFields(token, caseId, fieldPatch) {
  const detail = await request(token, "GET", `/cases/${caseId}`);
  const row = caseRow(detail);
  return request(token, "PATCH", `/cases/${caseId}`, {
    fieldPatch,
    expectedVersion: row.version,
  });
}

async function transitionIfNeeded(token, caseId, targetStageKey, allowedSourceStages) {
  const detail = await request(token, "GET", `/cases/${caseId}`);
  const row = caseRow(detail);
  const currentStage = stageKey(detail);
  if (currentStage === targetStageKey) return { caseId, from: currentStage, to: targetStageKey, changed: false };
  if (row.terminalKind) return { caseId, from: currentStage, to: currentStage, changed: false, terminalKind: row.terminalKind };
  if (!allowedSourceStages.includes(currentStage)) {
    throw new Error(`Unexpected stage for ${caseId}: ${currentStage}`);
  }
  try {
    const transitioned = await request(token, "POST", `/cases/${caseId}/transition`, {
      toStageKey: targetStageKey,
      expectedVersion: row.version,
      reason: `Merged into canonical intent cluster ${CANONICAL_OPPORTUNITY_ID}`,
    });
    return { caseId, from: currentStage, to: stageKey(transitioned), changed: true };
  } catch (error) {
    if (error instanceof Error && error.message.includes("review_required")) {
      return { caseId, from: currentStage, to: targetStageKey, changed: false, pendingAgentReview: true };
    }
    throw error;
  }
}

function issueState(identifier) {
  const raw = psql(`
    select json_build_object('id',id,'identifier',identifier,'status',status)::text
    from issues
    where company_id=${q(COMPANY_ID)}::uuid and identifier=${q(identifier)}
    limit 1;
  `);
  if (!raw) throw new Error(`Issue ${identifier} not found`);
  return JSON.parse(raw);
}

async function wakeExistingVerificationIssue(token, identifier) {
  const issue = issueState(identifier);
  const marker = `intent-cluster-repair:${CANONICAL_OPPORTUNITY_ID}`;
  const existing = psql(`
    select count(*)::int
    from issue_comments
    where issue_id=${q(issue.id)}::uuid and body like ${q(`%${marker}%`)};
  `);
  if (Number(existing) > 0) return { identifier, changed: false, status: issue.status };
  const comment = [
    "Кластеризацію виправлено системно.",
    "",
    `- Canonical opportunity: [AST search-demand case](/AST/pipelines/957d394b-ecae-4400-82f4-27c88959f378/cases/${CANONICAL_OPPORTUNITY_ID})`,
    "- Поточний case має actionReasonCode=merged_into_intent_cluster і canonicalOpportunityCaseId.",
    "- Це варіант запиту, а не окрема тема. Не вимагати окрему CMS delivery.",
    "- Виконати штатне native review: reject до cancelled. Не створювати нову тему або статтю.",
    "",
    marker,
  ].join("\n");
  if (issue.status === "blocked") {
    await request(token, "PATCH", `/issues/${issue.id}`, {
      status: "todo",
      blockedByIssueIds: [],
      comment,
    });
  } else {
    await request(token, "POST", `/issues/${issue.id}/comments`, { body: comment });
  }
  return { identifier, changed: true, previousStatus: issue.status };
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const keyHash = createHash("sha256").update(token).digest("hex");
  psql(`insert into board_api_keys (id,user_id,name,key_hash,expires_at) values (${q(keyId)}::uuid,${q(USER_ID)},'repair-return-ukraine-intent-cluster',${q(keyHash)},now()+interval '15 minutes');`);

  try {
    const backup = await request(token, "POST", "/instance/database-backups", {});
    const canonicalBefore = await request(token, "GET", `/cases/${CANONICAL_OPPORTUNITY_ID}`);
    const existingSupporting = Array.isArray(caseRow(canonicalBefore).fields?.supportingQueries)
      ? caseRow(canonicalBefore).fields.supportingQueries
      : [];
    const supportingQueries = [...new Set([
      ...existingSupporting,
      "як зрозуміти чи повертатися в Україну з-за кордону",
      "як обрати між залишитися за кордоном і повернутися в Україну",
      "як скласти план повернення в Україну",
      "план повернення в Україну з ЄС 2026",
      "як підготуватися до повернення в Україну",
    ])];
    await patchFields(token, CANONICAL_OPPORTUNITY_ID, {
      intentClusterKey: "life_decisions:return-to-ukraine-or-stay",
      clusterDedupeKey: "search-demand:life_decisions:return-to-ukraine-or-stay",
      queryFamilyFingerprint: "life_decisions:return-to-ukraine-or-stay",
      primaryQuery: "як обрати між залишитися за кордоном і повернутися в Україну",
      supportingQueries,
      sourceSemanticCandidateIds: [
        "run_20260720_191315_adjacent_use_case_intent_86881550:return-ukraine-abroad",
        "run_20260720_191324_adjacent_use_case_intent_6e0a2ec2:return-plan-eu-2026",
        "run_20260720_191455_adjacent_use_case_intent_29206777:stay-abroad-or-return",
        "run_20260720_183443_adjacent_use_case_intent_7578fd9c:plan-return-ukraine",
      ],
      sourceClusterIds: ["trend_14c02ae5b3e1", "trend_d1bc7f95c6d9"],
      portfolioLane: "search_demand_core",
      mergedOpportunityCaseIds: DUPLICATE_OPPORTUNITY_IDS,
      legacyCaseKeyPreservedForDeliveredLineage: true,
      intentClusterReconciledAt: new Date().toISOString(),
    });

    const topicTransitions = [];
    for (const topicId of DUPLICATE_TOPIC_IDS) {
      await patchFields(token, topicId, {
        canonicalOpportunityCaseId: CANONICAL_OPPORTUNITY_ID,
        canonicalIntentClusterKey: "life_decisions:return-to-ukraine-or-stay",
        rejectionReason: "merged_into_intent_cluster",
      });
      topicTransitions.push(await transitionIfNeeded(token, topicId, "rejected_duplicate", ["candidate", "evidence_ready", "ready", "reserved"]));
    }

    for (const opportunityId of DUPLICATE_OPPORTUNITY_IDS) {
      await patchFields(token, opportunityId, {
        canonicalOpportunityCaseId: CANONICAL_OPPORTUNITY_ID,
        canonicalIntentClusterKey: "life_decisions:return-to-ukraine-or-stay",
        actionReasonCode: "merged_into_intent_cluster",
        actionReasonSummary: "Query variant merged into the canonical return-or-stay intent cluster; it must not create another topic or article.",
      });
    }

    const opportunityTransitions = [];
    for (const opportunityId of DUPLICATE_OPPORTUNITY_IDS) {
      opportunityTransitions.push(await transitionIfNeeded(token, opportunityId, "cancelled", ["discovered", "evidence_ready", "ownership_review", "action_selected", "delegated", "verified"]));
    }

    const verificationIssueWakes = [];
    verificationIssueWakes.push(await wakeExistingVerificationIssue(token, "AST-966"));
    verificationIssueWakes.push(await wakeExistingVerificationIssue(token, "AST-991"));

    const canonicalAfter = await request(token, "GET", `/cases/${CANONICAL_OPPORTUNITY_ID}`);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      backup,
      canonical: {
        id: CANONICAL_OPPORTUNITY_ID,
        stage: stageKey(canonicalAfter),
        intentClusterKey: caseRow(canonicalAfter).fields?.intentClusterKey,
        supportingQueryCount: caseRow(canonicalAfter).fields?.supportingQueries?.length ?? 0,
        cmsAdminUrl: caseRow(canonicalAfter).fields?.verificationProof?.adminUrl ?? null,
      },
      topicTransitions,
      opportunityTransitions,
      verificationIssueWakes,
    }, null, 2)}\n`);
  } finally {
    psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
