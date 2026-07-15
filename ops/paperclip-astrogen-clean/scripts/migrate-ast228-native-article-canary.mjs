#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const ARTICLE_PIPELINE_KEY = "astrogen-article-production";
const TOPIC_PIPELINE_KEY = "astrogen-topic-inventory";
const TOPIC_KEY = "numerology-online-expert-vs-calculator";
const TITLE = "Нумерологія онлайн: коли достатньо розрахунку, а коли потрібен експерт";

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
    "psql", "-U", "paperclip", "-d", "paperclip",
    "-v", "ON_ERROR_STOP=1", "-At",
  ], sql);
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function issueRows() {
  const output = psql(`
    select json_build_object(
      'identifier', identifier,
      'id', id,
      'status', status
    )::text
    from issues
    where company_id=${sqlLiteral(COMPANY_ID)}::uuid
      and identifier in ('AST-228', 'AST-233', 'AST-235', 'AST-236')
    order by identifier;
  `);
  return output.split("\n").filter(Boolean).map((line) => JSON.parse(line));
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
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!response.ok) {
    throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 2000)}`);
  }
  return parsed;
}

async function ensureIssueLink(token, caseId, issueId, role) {
  const links = await request(token, "GET", `/cases/${caseId}/issue-links`);
  if (links.some((row) => row.issue?.id === issueId && row.link?.role === role)) return false;
  await request(token, "POST", `/cases/${caseId}/issue-links`, { issueId, role });
  return true;
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const keyId = randomUUID();
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${sqlLiteral(keyId)}::uuid, ${sqlLiteral(USER_ID)},
      'phase46-ast228-native-canary', ${sqlLiteral(tokenHash)}, now() + interval '15 minutes');
  `);

  try {
    const issues = new Map(issueRows().map((issue) => [issue.identifier, issue]));
    for (const identifier of ["AST-228", "AST-233", "AST-235", "AST-236"]) {
      if (!issues.has(identifier)) throw new Error(`Issue not found: ${identifier}`);
    }

    const pipelineResponse = await request(token, "GET", `/companies/${COMPANY_ID}/pipelines`);
    const pipelines = Array.isArray(pipelineResponse) ? pipelineResponse : pipelineResponse.items ?? pipelineResponse.pipelines ?? [];
    const articlePipeline = pipelines.find((pipeline) => pipeline.key === ARTICLE_PIPELINE_KEY);
    const topicPipeline = pipelines.find((pipeline) => pipeline.key === TOPIC_PIPELINE_KEY);
    if (!articlePipeline || !topicPipeline) throw new Error("Native article/topic pipelines are missing");

    const now = new Date();
    const articleResult = await request(token, "POST", `/pipelines/${articlePipeline.id}/cases`, {
      caseKey: `article:${TOPIC_KEY}`,
      title: TITLE,
      summary: "Native continuation of the accepted AST-228 article from the CMS draft stage. Existing layout and cover artifacts are reused; image generation must not run again.",
      stageKey: "cms_draft",
      fields: {
        operation: "create",
        topicKey: TOPIC_KEY,
        titleUk: TITLE,
        targetQueryCluster: ["нумерологія онлайн"],
        ctaRoute: "https://astrogen.com.ua/experts/numerologiya",
        evidenceRefs: ["AST-175", "AST-177", "AST-233", "AST-235"],
        blockerClass: null,
        nextReviewAt: null,
        attemptCount: 1,
        cmsDraftId: null,
        cmsAdminUrl: null,
        telegramMessageId: null,
        layoutWorkProductId: "9d2cd51f-c664-49fc-84e4-3e5425094e24",
        layoutAttachmentId: "1983d89d-4500-4c96-b7f1-0a50c76fae69",
        imageWorkProductId: "7d967467-9c39-4ba9-8d3e-cb43a8339b3a",
        imageAttachmentId: "d5268940-e725-4a0e-895b-94f54a2be3c9",
        imageTargetWidth: 1472,
        imageTargetHeight: 822,
        imageActualWidth: 1344,
        imageActualHeight: 768,
        imageWidthDeviationPercent: 8.6957,
        imageHeightDeviationPercent: 6.5693,
        imageAcceptedWithinTolerance: true,
        imageDimensionTolerancePercent: 20,
        imageProviderCallsAcceptedByPolicy: 1,
        migrationSource: "phase46-ast228-native-canary",
        legacyIssueIdentifiers: ["AST-228", "AST-233", "AST-235", "AST-236"],
      },
      workspaceRef: {
        name: "AST-228 accepted article artifacts",
        workspacePath: "articles/numerology-online-expert-vs-calculator",
      },
    });
    const articleCase = articleResult.case ?? articleResult;

    const topicResult = await request(token, "POST", `/pipelines/${topicPipeline.id}/cases`, {
      caseKey: `topic:${TOPIC_KEY}`,
      title: TITLE,
      summary: "Accepted topic reservation migrated with the active native article case.",
      stageKey: "reserved",
      fields: {
        topicKey: TOPIC_KEY,
        titleUk: TITLE,
        fingerprint: "numerology-online-expert-vs-calculator",
        queryCluster: ["нумерологія онлайн"],
        intent: "Вибір між онлайн-розрахунком і консультацією експерта",
        ctaRoute: "https://astrogen.com.ua/experts/numerologiya",
        evidenceRefs: ["AST-175", "AST-177", "AST-228"],
        evidenceFreshAt: now.toISOString(),
        duplicateVerdict: "accepted_no_cannibalization",
        reservationExpiresAt: new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString(),
        consumingArticleCaseId: articleCase.id,
      },
    });
    const topicCase = topicResult.case ?? topicResult;

    let articleDetail = await request(token, "GET", `/cases/${articleCase.id}`);
    const currentArticle = articleDetail.case ?? articleDetail;
    if (currentArticle.parentCaseId !== topicCase.id) {
      articleDetail = await request(token, "PATCH", `/cases/${articleCase.id}`, {
        parentCaseId: topicCase.id,
        expectedVersion: currentArticle.version,
      });
    }

    await Promise.all([
      ensureIssueLink(token, articleCase.id, issues.get("AST-228").id, "origin"),
      ensureIssueLink(token, articleCase.id, issues.get("AST-233").id, "work"),
      ensureIssueLink(token, articleCase.id, issues.get("AST-235").id, "work"),
    ]);
    await request(token, "PUT", `/cases/${articleCase.id}/documents/migration-handoff`, {
      title: "AST-228 native migration handoff",
      body: [
        "# AST-228 native migration handoff",
        "",
        "Continue from the CMS draft stage using the already accepted artifacts.",
        "",
        "- Layout work product: 9d2cd51f-c664-49fc-84e4-3e5425094e24",
        "- Layout attachment: 1983d89d-4500-4c96-b7f1-0a50c76fae69",
        "- Cover work product: 7d967467-9c39-4ba9-8d3e-cb43a8339b3a",
        "- Cover attachment: d5268940-e725-4a0e-895b-94f54a2be3c9",
        "- Cover dimensions: 1344x768; deviations are 8.70% width and 6.57% height.",
        "- The cover is accepted under the 20% per-axis tolerance rule.",
        "- Do not generate, upscale, crop, convert, or replace the image.",
      ].join("\n"),
      changeSummary: "Migrate accepted legacy article artifacts into the native pipeline.",
    });

    await request(token, "PATCH", `/issues/${issues.get("AST-236").id}`, {
      status: "done",
      blockedByIssueIds: [],
      comment: "Resolved by the native image invariant: the accepted 1344x768 cover differs from 1472x822 by 8.70% in width and 6.57% in height, both within the 20% per-axis tolerance. No further provider call, resize, crop, or format-only conversion is allowed.",
    });
    await request(token, "PATCH", `/issues/${issues.get("AST-228").id}`, {
      status: "cancelled",
      blockedByIssueIds: [],
      comment: `Superseded by native article case ${articleCase.id} at cms_draft. Existing layout and image artifacts were linked; no image regeneration is permitted.`,
    });

    const finalArticle = await request(token, "GET", `/cases/${articleCase.id}`);
    const finalTopic = await request(token, "GET", `/cases/${topicCase.id}`);
    console.log(JSON.stringify({
      articleCase: {
        id: articleCase.id,
        caseKey: (finalArticle.case ?? finalArticle).caseKey,
        stage: finalArticle.stage?.key ?? null,
        version: (finalArticle.case ?? finalArticle).version,
      },
      topicCase: {
        id: topicCase.id,
        caseKey: (finalTopic.case ?? finalTopic).caseKey,
        stage: finalTopic.stage?.key ?? null,
        version: (finalTopic.case ?? finalTopic).version,
      },
      legacy: {
        parent: "AST-228 cancelled as superseded",
        imageRecovery: "AST-236 done under tolerance invariant",
      },
    }, null, 2));
  } finally {
    psql(`
      update board_api_keys set revoked_at=now(), last_used_at=now()
      where id=${sqlLiteral(keyId)}::uuid;
    `);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
