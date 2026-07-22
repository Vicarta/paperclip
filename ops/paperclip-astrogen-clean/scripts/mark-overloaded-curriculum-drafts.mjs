#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const APPLY = process.argv.includes("--apply");
const CONTRACT_VERSION = "astrogen-one-concept-curriculum-v1";

const DRAFTS = [
  {
    cmsDraftId: 137,
    articleCaseKey: "article:aspekty-v-natalnii-karti-shcho-oznachaiut:reservation-v5",
    topicCaseKey: "topic:aspekty-v-natalnii-karti-shcho-oznachaiut",
    primaryConceptKey: "aspect",
    detectedNewConceptKeys: [
      "aspect",
      "aspect_type",
      "planet",
      "zodiac_sign",
      "house",
      "house_ruler",
      "empty_house",
      "twelve_houses",
      "chart_interpretation_workflow",
    ],
  },
  {
    cmsDraftId: 138,
    articleCaseKey: "article:budynky-v-natalnii-karti-shcho-oznachaiut:reservation-v9",
    topicCaseKey: "topic:budynky-v-natalnii-karti-shcho-oznachaiut",
    primaryConceptKey: "house",
    detectedNewConceptKeys: [
      "house",
      "twelve_houses",
      "zodiac_sign",
      "planet",
      "aspect",
      "empty_house",
      "house_interpretation_workflow",
    ],
  },
];

function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
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

function caseId(caseKey) {
  const id = psql(`
    select id
    from pipeline_cases
    where company_id=${quote(COMPANY_ID)}::uuid and case_key=${quote(caseKey)}
    order by updated_at desc
    limit 1;
  `);
  if (!id) throw new Error(`Pipeline case not found: ${caseKey}`);
  return id;
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
  if (!response.ok) throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 2000)}`);
  return parsed;
}

function caseRow(response) {
  return response?.case ?? response;
}

function reviewDocument(draft) {
  return [
    "# Curriculum owner review",
    "",
    `CMS draft ${draft.cmsDraftId} is not eligible for publication under ${CONTRACT_VERSION}.`,
    "",
    `Primary concept: ${draft.primaryConceptKey}`,
    `Detected teaching concepts: ${draft.detectedNewConceptKeys.join(", ")}`,
    "",
    "Decision: publication_blocked_needs_curriculum_rework.",
    "",
    "The article must be rebuilt around exactly one new concept. Adjacent astrology terms may appear only as aliases of the primary concept or as brief links to already published prerequisite lessons; they may not be defined, catalogued, compared, placed in FAQ answers, or used in an interpretation workflow.",
    "",
    "No CMS publication, deletion, image regeneration, or replacement draft was performed by this reconciliation.",
  ].join("\n");
}

async function main() {
  const plan = DRAFTS.map((draft) => ({
    ...draft,
    articleCaseId: caseId(draft.articleCaseKey),
    topicCaseId: caseId(draft.topicCaseKey),
  }));
  if (!APPLY) {
    console.log(JSON.stringify({ mode: "dry-run", contractVersion: CONTRACT_VERSION, drafts: plan }, null, 2));
    return;
  }

  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  psql(`
    insert into board_api_keys (id,user_id,name,key_hash,expires_at)
    values (
      ${quote(keyId)}::uuid,
      ${quote(USER_ID)},
      'mark-overloaded-curriculum-drafts',
      ${quote(createHash("sha256").update(token).digest("hex"))},
      now()+interval '15 minutes'
    );
  `);

  try {
    const backup = await request(token, "POST", "/instance/database-backups", {});
    const results = [];
    for (const draft of plan) {
      await request(token, "PUT", `/cases/${draft.articleCaseId}/documents/curriculum-owner-review`, {
        title: `Curriculum review for CMS draft ${draft.cmsDraftId}`,
        format: "markdown",
        body: reviewDocument(draft),
        changeSummary: "Marked delivered draft as ineligible for publication because it teaches more than one new concept",
      });
      const currentArticle = caseRow(await request(token, "GET", `/cases/${draft.articleCaseId}`));
      const article = caseRow(await request(token, "PATCH", `/cases/${draft.articleCaseId}`, {
        fieldPatch: {
          curriculumContractVersion: CONTRACT_VERSION,
          primaryConceptKey: draft.primaryConceptKey,
          curriculumOwnerReviewStatus: "rejected_concept_overload",
          curriculumPublicationStatus: "blocked_needs_curriculum_rework",
          curriculumDetectedNewConceptKeys: draft.detectedNewConceptKeys,
          curriculumReviewedAt: new Date().toISOString(),
        },
        expectedVersion: currentArticle.version,
      }));
      const currentTopic = caseRow(await request(token, "GET", `/cases/${draft.topicCaseId}`));
      const topic = caseRow(await request(token, "PATCH", `/cases/${draft.topicCaseId}`, {
        fieldPatch: {
          curriculumContractVersion: CONTRACT_VERSION,
          primaryConceptKey: draft.primaryConceptKey,
          curriculumContentDisposition: "delivered_draft_rejected_concept_overload",
          curriculumRejectedCmsDraftId: draft.cmsDraftId,
        },
        expectedVersion: currentTopic.version,
      }));
      results.push({
        cmsDraftId: draft.cmsDraftId,
        articleCaseId: draft.articleCaseId,
        articleVersion: article.version,
        topicCaseId: draft.topicCaseId,
        topicVersion: topic.version,
      });
    }
    console.log(JSON.stringify({
      mode: "apply",
      contractVersion: CONTRACT_VERSION,
      backupDir: backup.backupDir ?? null,
      results,
    }, null, 2));
  } finally {
    psql(`update board_api_keys set revoked_at=now(), last_used_at=now() where id=${quote(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
