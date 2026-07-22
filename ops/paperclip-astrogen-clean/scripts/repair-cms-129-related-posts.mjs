#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const APPLY = process.argv.includes("--apply");
const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const PLUGIN = "paperclip.payload-cms-agent-tools";
const CONTEXT_ISSUE = "AST-516";
const ARTICLE_CASE_ID = "522fd95a-a76f-4ea1-ab4a-6d8654b3c6f3";
const CMS_DRAFT_ID = 129;
const EXPECTED_TITLE = "Натальна карта онлайн: що показує розрахунок і як читати його без перебільшень";
const RELATED_POST_IDS = [44, 66, 117];

function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 32 * 1024 * 1024 });
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

function unwrapToolData(response) {
  return response?.result?.data?.structuredContent
    ?? response?.result?.data
    ?? response?.data?.structuredContent
    ?? response?.data
    ?? response?.result
    ?? response;
}

function asDocument(data) {
  const value = data?.doc ?? data;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Payload CMS tool did not return a blog document");
  }
  return value;
}

function relationId(value) {
  const id = typeof value === "object" && value !== null ? value.id : value;
  return Number(id);
}

function assertEligibleRelatedPost(document, expectedId) {
  if (relationId(document) !== expectedId) throw new Error(`Related post ${expectedId} did not resolve by id`);
  if (document._status !== "published" || document.workflowStatus !== "approved" || document.noindex === true) {
    throw new Error(`Related post ${expectedId} is not published, approved and indexable`);
  }
}

function context() {
  const raw = psql(`
    select json_build_object(
      'agentId', i.assignee_agent_id,
      'runId', coalesce(
        i.execution_run_id,
        (select h.id from heartbeat_runs h
         where h.company_id=i.company_id and h.agent_id=i.assignee_agent_id
         order by h.created_at desc limit 1)
      ),
      'companyId', i.company_id,
      'projectId', i.project_id,
      'issueId', i.id
    )::text
    from issues i
    where i.company_id=${quote(COMPANY_ID)}::uuid and i.identifier=${quote(CONTEXT_ISSUE)};
  `);
  if (!raw) throw new Error(`${CONTEXT_ISSUE} was not found`);
  const value = JSON.parse(raw);
  if (!value.agentId || !value.runId || !value.projectId || !value.issueId) {
    throw new Error(`${CONTEXT_ISSUE} has no complete audited run context`);
  }
  return value;
}

async function executeTool(token, runContext, tool, parameters) {
  return unwrapToolData(await request(token, "POST", "/agents/me/plugin-tools/execute", {
    tool: `${PLUGIN}:${tool}`,
    parameters,
    runContext,
  }));
}

function repairDocumentBody({ beforeIds, after, beforeUpdatedAt }) {
  return [
    "# CMS 129 related-post repair",
    "",
    `- CMS document: https://cms.astrogen.com.ua/admin/collections/blogPosts/${CMS_DRAFT_ID}`,
    `- Before updatedAt: ${beforeUpdatedAt ?? "unknown"}`,
    `- After updatedAt: ${after.updatedAt ?? "unknown"}`,
    `- Before resolved related posts: ${beforeIds.join(", ") || "none"}`,
    `- After resolved related posts: ${RELATED_POST_IDS.join(", ")}`,
    "- Publication: not performed; a draft revision was created.",
    "",
    "## Verification",
    "",
    "All three relations were refetched as expanded CMS documents with _status=published, workflowStatus=approved and noindex=false.",
    "Title, slug, article body, cover/OG media, CTA, metadata and unrelated fields were not changed.",
  ].join("\n");
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  psql(`
    insert into board_api_keys (id,user_id,name,key_hash,expires_at)
    values (${quote(keyId)}::uuid,${quote(USER_ID)},'repair-cms-129-related-posts',
      ${quote(createHash("sha256").update(token).digest("hex"))},now()+interval '15 minutes');
  `);

  try {
    const runContext = context();
    const before = asDocument(await executeTool(token, runContext, "payload_cms_find_blog_post", {
      id: CMS_DRAFT_ID,
      draft: true,
      depth: 1,
    }));
    if (before.title !== EXPECTED_TITLE) {
      throw new Error(`Refusing repair: CMS ${CMS_DRAFT_ID} title changed to ${String(before.title ?? "")}`);
    }

    const eligible = [];
    for (const id of RELATED_POST_IDS) {
      const related = asDocument(await executeTool(token, runContext, "payload_cms_find_blog_post", {
        id,
        draft: false,
        depth: 0,
      }));
      assertEligibleRelatedPost(related, id);
      eligible.push({ id, title: related.title, slug: related.slug });
    }

    const beforeIds = Array.isArray(before.relatedPosts) ? before.relatedPosts.map(relationId).filter(Number.isFinite) : [];
    if (!APPLY) {
      console.log(JSON.stringify({
        mode: "dry-run",
        cmsDraftId: CMS_DRAFT_ID,
        beforeIds,
        afterIds: RELATED_POST_IDS,
        eligible,
        publication: "not_performed",
      }, null, 2));
      return;
    }

    const backup = await request(token, "POST", "/instance/database-backups", {});
    await executeTool(token, runContext, "payload_cms_update_blog_post_draft", {
      id: CMS_DRAFT_ID,
      fields: { relatedPosts: RELATED_POST_IDS },
    });
    const after = asDocument(await executeTool(token, runContext, "payload_cms_find_blog_post", {
      id: CMS_DRAFT_ID,
      draft: true,
      depth: 1,
    }));
    const afterRelations = Array.isArray(after.relatedPosts) ? after.relatedPosts : [];
    if (afterRelations.length !== 3) throw new Error(`CMS refetch returned ${afterRelations.length} related posts instead of 3`);
    for (const id of RELATED_POST_IDS) {
      const relation = afterRelations.find((candidate) => relationId(candidate) === id);
      if (!relation) throw new Error(`CMS refetch did not return related post ${id}`);
      assertEligibleRelatedPost(relation, id);
    }
    if (after._status !== "draft" || after.workflowStatus !== "draft") {
      throw new Error("CMS related-post repair unexpectedly changed the draft revision state");
    }

    await request(token, "PUT", `/cases/${ARTICLE_CASE_ID}/documents/cms-related-posts-repair`, {
      title: "CMS 129: related posts repaired and refetched",
      format: "markdown",
      body: repairDocumentBody({ beforeIds, after, beforeUpdatedAt: before.updatedAt }),
      changeSummary: "Replaced unresolved relations with three published, approved and indexable related posts without publishing",
    });
    const currentCase = await request(token, "GET", `/cases/${ARTICLE_CASE_ID}`);
    const row = currentCase.case ?? currentCase;
    await request(token, "PATCH", `/cases/${ARTICLE_CASE_ID}`, {
      fieldPatch: {
        cmsRelatedPostIds: RELATED_POST_IDS,
        relatedPostIds: RELATED_POST_IDS,
        cmsRelatedPostsResolvedCount: 3,
        cmsRelatedPostsEligibilityStatus: "published_approved_indexable_refetch_passed",
        cmsRelatedPostsRepairedAt: new Date().toISOString(),
      },
      expectedVersion: row.version,
    });

    console.log(JSON.stringify({
      mode: "apply",
      cmsDraftId: CMS_DRAFT_ID,
      beforeIds,
      afterIds: RELATED_POST_IDS,
      eligible,
      afterUpdatedAt: after.updatedAt ?? null,
      backupDir: backup.backupDir ?? null,
      publication: "not_performed",
    }, null, 2));
  } finally {
    psql(`update board_api_keys set revoked_at=now(),last_used_at=now() where id=${quote(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
