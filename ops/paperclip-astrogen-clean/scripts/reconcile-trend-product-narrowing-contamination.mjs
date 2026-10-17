#!/usr/bin/env node

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const PROJECT_ID = "d4644ea9-c025-4421-9af9-7780e41945ba";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const CMO_AGENT_ID = "a05b41d8-83ab-4f7c-8330-149f46dbd13a";
const CMS_FIXER_AGENT_ID = "ee020b0e-e901-4acc-b9bb-af83cc99e146";
const SEARCH_DEMAND_APPROVER_AGENT_ID = "d323fca3-5a70-4d97-a3f3-b43711677c17";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const OWNER_REF = "AST-853";
const POLICY_VERSION = "astrogen-trend-topic-v10/search-demand-v6";
const DELETE_TOOL = "paperclip.payload-cms-agent-tools:payload_cms_delete_owner_rejected_blog_post_draft";

const PRODUCT_NARROWED_SEARCH_CASE_IDS = [
  "708619bd-3c88-41ec-84c7-01fb3dfa83f9",
  "25226cc0-f4ea-4b7c-9aee-cf4fe61a2111",
  "3e5b28c3-60bd-497e-aaff-ab30c36e4fe2",
  "db0b62f4-febe-4aa1-9792-a7bb80c56aa6",
  "a3bb6df6-fc87-494f-a034-0ffead5d9000",
  "b543342a-98d9-41de-b20e-590e1963b6e5",
];

const PRODUCT_NARROWED_TERMINAL_CASE_IDS = [
  "eea6ce92-d561-4064-943c-f92e70b50704",
  "228ba44c-40eb-4889-a0a3-3869fe74299a",
  "c59314fc-ef2a-444d-bce8-9c6db5cb07d3",
];

const INVALIDATION_COMMENT = [
  "Owner correction: trend-derived themes must stay audience-first.",
  "",
  "Paperclip must not narrow a retained audience trend into product/service/modality language in the title, H1, slug, primary keyword, topicKey, or refresh owner. Products may appear only as natural contextual body links when organically relevant.",
  "",
  `Applied policy: ${POLICY_VERSION}. Existing product-narrowed trend artifacts are cancelled or marked invalidated and must not be used as successful training examples.`,
].join("\n");

function run(command, args, input) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
  }
  return result.stdout.trim();
}

function psql(sql) {
  return run("sudo", [
    "docker",
    "exec",
    "-i",
    DB_CONTAINER,
    "psql",
    "-U",
    "paperclip",
    "-d",
    "paperclip",
    "-v",
    "ON_ERROR_STOP=1",
    "-At",
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
  if (!response.ok) {
    throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 2000)}`);
  }
  return text ? JSON.parse(text) : null;
}

function createBoardToken() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const keyHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id,user_id,name,key_hash,expires_at)
    values (${q(keyId)}::uuid,${q(USER_ID)},'trend-product-narrowing-reconcile',
      ${q(keyHash)},now()+interval '20 minutes');
  `);
  return { token, keyId };
}

function createAgentToken(agentId, name) {
  const token = `pcp_agent_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const keyHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into agent_api_keys (id, agent_id, company_id, name, key_hash, scope_config, created_at)
    values (${q(keyId)}::uuid,${q(agentId)}::uuid,${q(COMPANY_ID)}::uuid,${q(name)},
      ${q(keyHash)}, null, now());
  `);
  return { token, keyId };
}

function createRepairRun(agentId, issueId) {
  const runId = randomUUID();
  psql(`
    insert into heartbeat_runs (
      id, company_id, agent_id, invocation_source, status,
      started_at, finished_at, context_snapshot, trigger_detail,
      created_at, updated_at
    ) values (
      ${q(runId)}::uuid,
      ${q(COMPANY_ID)}::uuid,
      ${q(agentId)}::uuid,
      'codex_owner_correction',
      'succeeded',
      now(),
      now(),
      ${q(JSON.stringify({
        issueId,
        ownerDecisionRef: OWNER_REF,
        correction: "trend_product_narrowing_contamination",
      }))}::jsonb,
      'Owner correction: reject trend-to-product narrowing contamination',
      now(),
      now()
    );
  `);
  return runId;
}

function loadIssue(identifier) {
  const value = psql(`
    select json_build_object('id',id,'identifier',identifier,'status',status,'title',title)::text
    from issues
    where company_id=${q(COMPANY_ID)}::uuid and identifier=${q(identifier)}
    limit 1;
  `);
  return value ? JSON.parse(value) : null;
}

function loadCase(caseId) {
  const value = psql(`
    select json_build_object(
      'id', pc.id,
      'caseKey', pc.case_key,
      'title', pc.title,
      'version', pc.version,
      'terminalKind', pc.terminal_kind,
      'stageKey', ps.key,
      'fields', pc.fields
    )::text
    from pipeline_cases pc
    join pipeline_stages ps on ps.id=pc.stage_id
    where pc.company_id=${q(COMPANY_ID)}::uuid
      and pc.id=${q(caseId)}::uuid
      and pc.retired_at is null;
  `);
  return value ? JSON.parse(value) : null;
}

async function patchCase(token, caseRecord, fieldPatch, runId) {
  const updated = await request(token, "PATCH", `/cases/${caseRecord.id}`, {
    expectedVersion: caseRecord.version,
    fieldPatch,
  }, runId);
  return updated.case ?? updated;
}

async function cancelCase(token, caseRecord, reason, runId) {
  if (caseRecord.terminalKind) {
    return { skipped: true, terminalKind: caseRecord.terminalKind };
  }
  const transitioned = await request(token, "POST", `/cases/${caseRecord.id}/transition`, {
    toStageKey: "cancelled",
    expectedVersion: caseRecord.version,
    reason,
  }, runId);
  return transitioned.case ?? transitioned;
}

function loadOpenIssuesReferencingCases(caseIds) {
  const values = caseIds.map((id) => `(${q(id)})`).join(",");
  const value = psql(`
    with ids(case_id) as (values ${values})
    select coalesce(json_agg(json_build_object(
      'id', issue_rows.id,
      'identifier', issue_rows.identifier,
      'status', issue_rows.status,
      'title', issue_rows.title
    ) order by issue_rows.identifier),'[]'::json)::text
    from (
      select distinct i.id, i.identifier, i.status, i.title
      from issues i
      join ids on i.description ilike '%' || ids.case_id || '%'
      where i.company_id=${q(COMPANY_ID)}::uuid
        and i.status not in ('done','cancelled')
    ) issue_rows;
  `);
  return JSON.parse(value);
}

function issueAlreadyHasOwnerCorrectionComment(issueId) {
  const count = psql(`
    select count(*)
    from issue_comments
    where company_id=${q(COMPANY_ID)}::uuid
      and issue_id=${q(issueId)}::uuid
      and deleted_at is null
      and body ilike '%Applied policy: ${POLICY_VERSION}%'
      and body ilike '%product/service/modality%';
  `);
  return Number(count) > 0;
}

function invalidationPatch(extra = {}) {
  const now = new Date().toISOString();
  return {
    invalidatedByOwnerCorrection: true,
    invalidatedAt: now,
    invalidationReasonCode: "product_narrowing_contamination",
    actionReasonCode: "product_narrowing_contamination",
    doNotUseAsSuccessfulTrainingExample: true,
    productBridgePolicy: "contextual_body_links_only",
    trendAudienceThemePolicy: "preserve_audience_discussion_theme",
    ownerCorrection: {
      correctedAt: now,
      correctedBy: "owner_via_codex",
      ownerDecisionRef: OWNER_REF,
      policyVersion: POLICY_VERSION,
      rule: "Do not narrow trend-derived audience themes to Astrogen products, services, modalities, routes, keyword families, or existing product owners.",
      productMentionsAllowedOnlyAs: "organic contextual body links",
    },
    ...extra,
  };
}

async function deleteCmsDraft132(token, runId, issueId) {
  let result;
  try {
    result = await request(token, "POST", "/plugins/tools/execute", {
      tool: DELETE_TOOL,
      runContext: {
        agentId: CMS_FIXER_AGENT_ID,
        runId,
        companyId: COMPANY_ID,
        projectId: PROJECT_ID,
        issueId,
      },
      parameters: {
        id: 132,
        expectedSlug: "taro-self-knowledge-exercises",
        expectedTitle: "Таро для самопізнання: вправи без фаталізму",
        ownerDecisionRef: OWNER_REF,
        confirmOwnerApprovedDraftDeletion: true,
      },
    }, runId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/not found/i.test(message)) {
      return {
        ok: true,
        alreadyAbsent: true,
        id: 132,
        slug: "taro-self-knowledge-exercises",
        title: "Таро для самопізнання: вправи без фаталізму",
      };
    }
    throw error;
  }
  const deletedDoc = result?.data?.deletedDoc ?? result?.result?.data?.deletedDoc ?? null;
  return {
    ok: result?.data?.deleted === true || result?.result?.data?.deleted === true,
    id: deletedDoc?.id ?? 132,
    slug: deletedDoc?.slug ?? "taro-self-knowledge-exercises",
    title: deletedDoc?.title ?? "Таро для самопізнання: вправи без фаталізму",
  };
}

async function main() {
  const { token, keyId } = createBoardToken();
  const approverKey = createAgentToken(
    SEARCH_DEMAND_APPROVER_AGENT_ID,
    "temporary trend product narrowing owner correction",
  );
  const ast853 = loadIssue("AST-853");
  const runId = createRepairRun(CMS_FIXER_AGENT_ID, ast853?.id ?? null);
  const cmoRunId = createRepairRun(CMO_AGENT_ID, ast853?.id ?? null);
  const approverRunId = createRepairRun(SEARCH_DEMAND_APPROVER_AGENT_ID, ast853?.id ?? null);
  const report = {
    cmsDraft132: null,
    cancelledSearchDemandCases: [],
    patchedTerminalCases: [],
    updatedIssues: [],
    remainingActiveProductNarrowedTrendCases: null,
  };

  try {
    report.cmsDraft132 = await deleteCmsDraft132(token, runId, ast853?.id);

    for (const caseId of PRODUCT_NARROWED_SEARCH_CASE_IDS) {
      const current = loadCase(caseId);
      if (!current) {
        report.cancelledSearchDemandCases.push({ id: caseId, skipped: "not_found" });
        continue;
      }
      if (current.terminalKind === "cancelled" && current.fields?.invalidatedByOwnerCorrection === true) {
        report.cancelledSearchDemandCases.push({
          id: current.id,
          title: current.title,
          previousStage: current.stageKey,
          finalStage: current.stageKey,
          finalTerminalKind: current.terminalKind,
          skipped: "already_cancelled_invalidated",
        });
        continue;
      }
      const patched = await patchCase(token, current, invalidationPatch({
        previousSelectedAction: current.fields?.selectedAction ?? null,
        selectedActionStatus: "owner_invalidated_cancelled",
      }), cmoRunId);
      const afterPatch = { ...current, version: patched.version, terminalKind: patched.terminalKind };
      const cancelled = await cancelCase(
        approverKey.token,
        afterPatch,
        "Owner correction: trend-derived audience topics were narrowed into product/service/modality language.",
        approverRunId,
      );
      report.cancelledSearchDemandCases.push({
        id: current.id,
        title: current.title,
        previousStage: current.stageKey,
        finalStage: cancelled.stageKey ?? "cancelled",
        finalTerminalKind: cancelled.terminalKind ?? "cancelled",
      });
    }

    for (const caseId of PRODUCT_NARROWED_TERMINAL_CASE_IDS) {
      const current = loadCase(caseId);
      if (!current) {
        report.patchedTerminalCases.push({ id: caseId, skipped: "not_found" });
        continue;
      }
      const patch = invalidationPatch({
        cmsDraftDeletion: caseId === "c59314fc-ef2a-444d-bce8-9c6db5cb07d3"
          ? {
              status: report.cmsDraft132?.ok ? "deleted" : "delete_attempted",
              cmsId: 132,
              slug: "taro-self-knowledge-exercises",
              deletedAt: new Date().toISOString(),
              ownerDecisionRef: OWNER_REF,
            }
          : undefined,
        publicationReadinessStatus: caseId === "c59314fc-ef2a-444d-bce8-9c6db5cb07d3"
          ? "owner_rejected_do_not_publish"
          : undefined,
      });
      const updated = await patchCase(token, current, patch, cmoRunId);
      report.patchedTerminalCases.push({
        id: current.id,
        title: current.title,
        stage: current.stageKey,
        terminalKind: current.terminalKind,
        version: updated.version,
      });
    }

    for (const identifier of ["AST-725", "AST-753"]) {
      const issue = loadIssue(identifier);
      if (!issue || ["done", "cancelled"].includes(issue.status)) continue;
      const updated = await request(token, "PATCH", `/issues/${issue.id}`, {
        status: "cancelled",
        blockedByIssueIds: [],
        comment: [
          "Cancelled after owner correction.",
          "",
          "The downstream trend-derived article path was invalidated because Paperclip narrowed an audience trend into product/service/modality language. Do not resume this task or publish CMS draft 132.",
        ].join("\n"),
      }, cmoRunId);
      report.updatedIssues.push({ identifier, previousStatus: issue.status, finalStatus: updated.status });
    }

    if (ast853 && !issueAlreadyHasOwnerCorrectionComment(ast853.id)) {
      await request(token, "POST", `/issues/${ast853.id}/comments`, {
        interrupt: true,
        body: INVALIDATION_COMMENT,
      }, cmoRunId);
      report.updatedIssues.push({ identifier: "AST-853", comment: "owner correction recorded" });
    }

    for (const issue of loadOpenIssuesReferencingCases(PRODUCT_NARROWED_SEARCH_CASE_IDS)) {
      if (issue.identifier === "AST-853") continue;
      const updated = await request(token, "PATCH", `/issues/${issue.id}`, {
        status: "cancelled",
        blockedByIssueIds: [],
        comment: [
          "Cancelled after owner correction.",
          "",
          "The referenced trend/search-demand pipeline case is now cancelled because it narrowed an audience trend into product/service/modality language. Do not resume this automation issue.",
        ].join("\n"),
      }, cmoRunId);
      report.updatedIssues.push({
        identifier: issue.identifier,
        previousStatus: issue.status,
        finalStatus: updated.status,
      });
    }

    const refreshedAst853 = loadIssue("AST-853");
    if (refreshedAst853 && !["done", "cancelled"].includes(refreshedAst853.status)) {
      report.updatedIssues.push({
        identifier: "AST-853",
        status: refreshedAst853.status,
        keptOpen: "external_wait_topic_inventory_refill",
      });
    }

    const remaining = psql(`
      select coalesce(json_agg(json_build_object(
        'id',pc.id,
        'caseKey',pc.case_key,
        'title',pc.title,
        'stage',ps.key,
        'terminalKind',pc.terminal_kind,
        'invalidated',coalesce((pc.fields->>'invalidatedByOwnerCorrection')::boolean,false)
      ) order by pc.updated_at desc),'[]'::json)::text
      from pipeline_cases pc
      join pipelines p on p.id=pc.pipeline_id
      join pipeline_stages ps on ps.id=pc.stage_id
      where pc.company_id=${q(COMPANY_ID)}::uuid
        and p.key='astrogen-search-demand-opportunities'
        and pc.retired_at is null
        and pc.terminal_kind is null
        and (pc.case_key ilike '%trend%' or pc.fields ? 'trendReportRunId' or pc.fields ? 'trendEvidenceFingerprint' or pc.fields ? 'trend_fp')
        and (
          lower(pc.title) ~ '(таро|таролог|натальн|синастр|дизайн людини|human design|соляр|нумеролог|матриц|гороскоп|астрологічн|астрологія|прогноз)'
          or lower(coalesce(pc.fields->>'titleUk','')) ~ '(таро|таролог|натальн|синастр|дизайн людини|human design|соляр|нумеролог|матриц|гороскоп|астрологічн|астрологія|прогноз)'
        );
    `);
    report.remainingActiveProductNarrowedTrendCases = JSON.parse(remaining);

    process.stdout.write(`${JSON.stringify({ ok: true, report }, null, 2)}\n`);
  } finally {
    psql(`update board_api_keys set revoked_at=now(), last_used_at=now() where id=${q(keyId)}::uuid;`);
    psql(`update agent_api_keys set revoked_at=now(), last_used_at=now() where id=${q(approverKey.keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
