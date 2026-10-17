#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const ARTICLE_PIPELINE_KEY = "astrogen-article-production";
const SEARCH_PIPELINE_KEY = "astrogen-search-demand-opportunities";
const ARTICLE_ALLOCATOR_TITLE = "Astrogen article slot allocator";
const NO_WAIVER_MARKER = "## Mandatory native article delivery proof";

const drafts = [
  {
    cmsDraftId: 133,
    titleUk: "Як обрати між залишитися за кордоном і повернутися в Україну",
    slug: "yak-obraty-mizh-zalyshytysia-za-kordonom-i-povernutysia-v-ukrainu",
    topicKey: "repair-cms-133-return-or-stay",
    sourceSearchCaseId: "88fe7ca0-9694-4464-b542-b8cebc41f1aa",
    primaryQuery: "як обрати між залишитися за кордоном і повернутися в Україну",
    supportingQueries: [
      "як зрозуміти чи повертатися в Україну з-за кордону",
      "як скласти план повернення в Україну",
    ],
  },
  {
    cmsDraftId: 134,
    titleUk: "Як порівняти витрати на переїзд і нову роботу",
    slug: "yak-porivnyaty-vytraty-na-pereyizd-i-novu-robotu",
    topicKey: "repair-cms-134-relocation-work-costs",
    sourceSearchCaseId: "4367a7ae-0375-4a3c-a3cc-a68312e090ea",
    primaryQuery: "як порівняти витрати на переїзд і нову роботу",
    supportingQueries: [
      "витрати на переїзд і нова робота",
      "як оцінити фінансово переїзд заради роботи",
    ],
  },
];

function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
  return result.stdout.trim();
}

function psql(sql) {
  return run("sudo", [
    "docker", "exec", "-i", DB_CONTAINER,
    "psql", "-U", "paperclip", "-d", "paperclip", "-v", "ON_ERROR_STOP=1", "-At",
  ], sql);
}

function q(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function asArray(value, keys = []) {
  if (Array.isArray(value)) return value;
  for (const key of keys) {
    if (Array.isArray(value?.[key])) return value[key];
  }
  return [];
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

function withNoWaiverAddendum(description, scope) {
  const current = description ?? "";
  if (current.includes(NO_WAIVER_MARKER)) return current;
  return `${current.trim()}\n\n${NO_WAIVER_MARKER}\n\n${scope}`.trim();
}

async function patchRoutineDescription(token, routineId, scope) {
  const routine = await request(token, "GET", `/routines/${routineId}`);
  const description = withNoWaiverAddendum(routine.description, scope);
  if (description === routine.description) return { id: routine.id, changed: false };
  const updated = await request(token, "PATCH", `/routines/${routine.id}`, {
    description,
    baseRevisionId: routine.latestRevisionId,
  });
  return { id: routine.id, changed: true, revision: updated.latestRevisionNumber ?? null };
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const keyHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id,user_id,name,key_hash,expires_at)
    values (${q(keyId)}::uuid,${q(USER_ID)},'migrate-cover-waiver-drafts',${q(keyHash)},now()+interval '20 minutes');
  `);

  try {
    const backup = await request(token, "POST", "/instance/database-backups", {});
    const [pipelineResponse, routineResponse] = await Promise.all([
      request(token, "GET", `/companies/${COMPANY_ID}/pipelines`),
      request(token, "GET", `/companies/${COMPANY_ID}/routines`),
    ]);
    const pipelines = asArray(pipelineResponse, ["items", "pipelines"]);
    const routines = asArray(routineResponse, ["items", "routines"]);
    const articlePipeline = pipelines.find((item) => item.key === ARTICLE_PIPELINE_KEY);
    const searchPipeline = pipelines.find((item) => item.key === SEARCH_PIPELINE_KEY);
    if (!articlePipeline || !searchPipeline) throw new Error("Required native pipelines are missing");

    const policyUpdates = [];
    const searchAddendum = "For selectedAction=new_article, only a terminal astrogen-article-production case with authenticated CMS draft evidence, non-empty coverImage and ogImage media IDs, and CMO delivery proof is valid. Never create or accept a direct CMS draft, CMS-only recovery, narrative handoff, or cover-image waiver. Return invalid proof to the native article path while unrelated cases continue.";
    for (const stageKey of ["delegated", "verified"]) {
      const stage = searchPipeline.stages.find((item) => item.key === stageKey);
      const routineId = stage?.config?.onEnter?.routineId;
      if (!routineId) throw new Error(`Search-demand ${stageKey} automation routine is missing`);
      policyUpdates.push(await patchRoutineDescription(token, routineId, searchAddendum));
    }
    const allocator = routines.find((item) => item.title === ARTICLE_ALLOCATOR_TITLE);
    if (!allocator) throw new Error("Article allocator routine is missing");
    policyUpdates.push(await patchRoutineDescription(
      token,
      allocator.id,
      "A CMS draft is complete only when an accepted image is attached as both coverImage and ogImage. Draft-only means publish is forbidden; it never permits a media waiver. A hard image failure blocks only that article case and does not reduce independent allocator throughput.",
    ));

    const migrated = [];
    for (const draft of drafts) {
      const fields = {
        operation: "refresh",
        topicKey: draft.topicKey,
        titleUk: draft.titleUk,
        lockedTitle: draft.titleUk,
        lockedH1: draft.titleUk,
        targetQueryCluster: [draft.primaryQuery, ...draft.supportingQueries],
        primaryQuery: draft.primaryQuery,
        supportingQueries: draft.supportingQueries,
        intentClusterKey: `life_decisions:${draft.topicKey}`,
        queryFamilyFingerprint: `life_decisions:${draft.topicKey}`,
        ctaRoute: "https://astrogen.com.ua/experts/astrologiya",
        targetPublicUrl: `https://astrogen.com.ua/blog/${draft.slug}/`,
        cmsDraftId: draft.cmsDraftId,
        targetCmsDraftId: draft.cmsDraftId,
        cmsAdminUrl: `https://cms.astrogen.com.ua/admin/collections/blogPosts/${draft.cmsDraftId}`,
        targetCmsAdminUrl: `https://cms.astrogen.com.ua/admin/collections/blogPosts/${draft.cmsDraftId}`,
        cmsDraftSlug: draft.slug,
        articleType: "life_situation_decision",
        cmsCategorySlug: "inshi",
        cmsCategoryTitle: "Інші",
        portfolioLane: "audience_applied_questions",
        primaryAudienceSegmentId: "life_decisions",
        demandClass: "trend_emerging",
        taskRevision: `cms-draft-${draft.cmsDraftId}-native-quality-cover-recovery-v1`,
        refreshScope: "Run the existing CMS draft through Winning Structure and all article quality gates, preserve the CMS draft ID, and generate the missing cover/OG image without publishing.",
        beforeAfterDiffRequired: true,
        preserveExistingMedia: false,
        imageDefectScoped: true,
        imageDefect: "CMS draft has neither coverImage nor ogImage; no media waiver is allowed.",
        coverImageProviderCallCount: 0,
        sourceSearchDemandCaseId: draft.sourceSearchCaseId,
        sourceCmsRecoveryClass: "invalid_cover_waiver_direct_cms_bypass",
      };
      const result = await request(token, "POST", `/pipelines/${articlePipeline.id}/cases`, {
        caseKey: `article:${draft.topicKey}`,
        title: `Native article recovery: ${draft.titleUk}`,
        summary: `Repair existing CMS draft ${draft.cmsDraftId} through the complete Winning Structure and article-production pipeline; generate mandatory cover/OG media and remain draft-only.`,
        fields,
        stageKey: "strategy_input",
        parentCaseId: draft.sourceSearchCaseId,
        requestKey: `native-cover-recovery:cms:${draft.cmsDraftId}:v1`,
      });
      const articleCase = result.case ?? result;
      const searchDetail = await request(token, "GET", `/cases/${draft.sourceSearchCaseId}`);
      const searchCase = searchDetail.case ?? searchDetail;
      await request(token, "PATCH", `/cases/${draft.sourceSearchCaseId}`, {
        fieldPatch: {
          verificationProof: {
            status: "invalid_cover_waiver_native_recovery_active",
            cmsDraftId: draft.cmsDraftId,
            articleCaseId: articleCase.id,
            reason: "The direct CMS draft has no coverImage or ogImage and cannot satisfy new-article delivery.",
          },
          nativeRecoveryArticleCaseId: articleCase.id,
          nativeRecoveryStatus: "active",
        },
        expectedVersion: searchCase.version,
      });
      migrated.push({
        cmsDraftId: draft.cmsDraftId,
        articleCaseId: articleCase.id,
        caseKey: articleCase.caseKey,
        stageKey: result.stage?.key ?? null,
        version: articleCase.version,
        automationStatus: result.automationExecution?.status ?? null,
      });
    }

    console.log(JSON.stringify({
      ok: true,
      backup: {
        backupDir: backup.backupDir ?? null,
        sizeBytes: backup.sizeBytes ?? null,
        finishedAt: backup.finishedAt ?? null,
      },
      policyUpdates,
      migrated,
    }, null, 2));
  } finally {
    psql(`update board_api_keys set revoked_at=now(),last_used_at=now() where id=${q(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
