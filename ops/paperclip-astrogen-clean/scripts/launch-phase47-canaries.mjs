#!/usr/bin/env node

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const PROJECT_ID = "d4644ea9-c025-4421-9af9-7780e41945ba";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const NEW_TOPIC_CASE_ID = "76124cf7-235b-4071-b073-742bdf3cd11c";
const DUPLICATE_TOPIC_CASE_ID = "f71f7e11-d216-4785-90c4-8a1f8ffc0bb8";
const DUPLICATE_ARTICLE_CASE_ID = "4f7ec53c-ca08-43ca-bae2-684ddc80074e";
const ARTICLE_PIPELINE_ID = "f1a443a6-b275-4f3f-b3f3-133311b4df7e";

function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
  return result.stdout.trim();
}

function psql(sql) {
  return run("docker", [
    "exec", "-i", DB_CONTAINER, "psql", "-U", "paperclip", "-d", "paperclip",
    "-v", "ON_ERROR_STOP=1", "-At",
  ], sql);
}

function q(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function request(token, method, path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${method} ${path} returned ${response.status}: ${text.slice(0, 1200)}`);
  return parsed;
}

function baseFields(operation, topicKey, titleUk, targetQueryCluster, ctaRoute, evidenceRefs) {
  return {
    operation,
    topicKey,
    titleUk,
    targetQueryCluster,
    ctaRoute,
    evidenceRefs,
    taskRevision: "phase47-canary-v1",
    winningStructureNamespace: {
      company_id: COMPANY_ID,
      project_id: PROJECT_ID,
      client_key: "astrogen-ukraine",
    },
    winningStructureIdempotencyKey: null,
    winningStructureRunId: null,
    winningStructureInputHash: null,
    winningStructureEffectiveInputHash: null,
    winningStructureDecisionSetVersion: null,
    winningStructureStatus: null,
    winningStructureRetentionExpiresAt: null,
    winningStructureResultDocumentId: null,
    contentQualityRequirements: null,
    publicationRequirements: [],
    articleType: null,
    selectedValueUnits: [],
    valueEvidenceRefs: [],
    valueCommitmentRefs: [],
    geoRetrievabilityRequired: false,
    mcQualityOutcome: null,
    mcQualitySurfaceRevisionCount: 0,
    mcQualitySubstantiveRevisionCount: 0,
    blockerClass: null,
    nextReviewAt: null,
    attemptCount: 0,
    cmsDraftId: null,
    cmsAdminUrl: null,
    telegramMessageId: null,
  };
}

const token = `pcp_board_${randomBytes(24).toString("hex")}`;
const keyId = randomUUID();
const tokenHash = createHash("sha256").update(token).digest("hex");

psql(`
  insert into board_api_keys (id, user_id, name, key_hash, expires_at)
  values (${q(keyId)}::uuid, ${q(USER_ID)}, 'phase47-canary-launch', ${q(tokenHash)},
    now() + interval '10 minutes');
`);

try {
  const duplicateTopic = await request(token, "GET", `/cases/${DUPLICATE_TOPIC_CASE_ID}`);
  const duplicateArticle = await request(token, "GET", `/cases/${DUPLICATE_ARTICLE_CASE_ID}`);
  const duplicateTopicCase = duplicateTopic.case ?? duplicateTopic;
  const duplicateArticleCase = duplicateArticle.case ?? duplicateArticle;
  if (
    duplicateTopic.stage?.key === "reserved"
    && duplicateArticle.stage?.key === "cancelled"
    && [
      "duplicate_existing_cms_article",
      "rejected_duplicate_existing_first_party_article",
    ].includes(duplicateArticleCase.fields?.blockerClass)
  ) {
    await request(token, "POST", `/cases/${DUPLICATE_TOPIC_CASE_ID}/transition`, {
      toStageKey: "rejected_duplicate",
      expectedVersion: duplicateTopicCase.version,
      reason: "Phase 47 strategy evidence proved an existing CMS article; prevent repeated allocation.",
    });
  }

  const topic = await request(token, "GET", `/cases/${NEW_TOPIC_CASE_ID}`);
  if (topic.stage?.key !== "ready" && topic.stage?.key !== "reserved") {
    throw new Error(`New-article canary topic is not dispatchable: ${topic.stage?.key ?? "unknown"}`);
  }
  const topicFields = topic.case?.fields ?? topic.fields ?? {};

  const newArticle = await request(token, "POST", `/cases/${NEW_TOPIC_CASE_ID}/breakdown`, {
    items: [{
      key: topicFields.topicKey,
      title: topicFields.titleUk,
      summary: "Phase 47 new-article canary through Winning Structure; CMS draft only.",
      fields: baseFields(
        "create",
        topicFields.topicKey,
        topicFields.titleUk,
        [topicFields.primaryQuery, ...(topicFields.supportingQueries ?? [])].filter(Boolean),
        topicFields.ctaRoute,
        topicFields.evidenceRefs ?? topicFields.evidenceReferences ?? [],
      ),
    }],
  });

  const refreshFields = {
    ...baseFields(
      "refresh",
      "phase47-refresh-karmology-cms-123",
      "Кармологія: що це таке і коли консультація може бути доречною",
      ["кармологія", "кармологія онлайн", "консультація кармолога"],
      "https://astrogen.com.ua/experts/karmichnyy-menedzhment-karmologiya",
      ["AST-154", "AST-161", "CMS blogPosts/123"],
    ),
    targetCmsDraftId: 123,
    targetCmsAdminUrl: "https://cms.astrogen.com.ua/admin/collections/blogPosts/123",
    targetPublicUrl: "https://astrogen.com.ua/blog/karmolohiya-shcho-tse-i-koly-dorechna-konsultatsiya/",
    preserveExistingMedia: true,
    imageDefectScoped: false,
    beforeAfterDiffRequired: true,
    refreshScope: "Winning Structure evidence-backed main-content improvement canary; preserve image and remain draft-only.",
  };
  const refresh = await request(token, "POST", `/pipelines/${ARTICLE_PIPELINE_ID}/cases/batch`, {
    items: [{
      caseKey: "article:phase47-refresh-karmology-cms-123-v1",
      title: "Phase 47 refresh canary: Кармологія",
      summary: "Winning Structure refresh canary for CMS blogPosts/123; preserve existing media; no publish.",
      stageKey: "opportunity",
      fields: refreshFields,
    }],
  });

  const newResult = newArticle.items?.[0] ?? null;
  const refreshResult = refresh?.[0] ?? null;
  console.log(JSON.stringify({
    ok: true,
    newArticle: {
      topicCaseId: NEW_TOPIC_CASE_ID,
      topicStage: newArticle.parentCase?.stageKey ?? "reserved",
      articleCaseId: newResult?.case?.id ?? newResult?.id ?? null,
      reused: newResult?.reused ?? false,
    },
    refresh: {
      articleCaseId: refreshResult?.case?.id ?? refreshResult?.id ?? null,
      reused: refreshResult?.reused ?? false,
      cmsDraftId: 123,
      preserveExistingMedia: true,
    },
  }, null, 2));
} finally {
  psql(`update board_api_keys set revoked_at=now() where id=${q(keyId)}::uuid;`);
}
