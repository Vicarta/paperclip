#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const APPLY = process.argv.includes("--apply");
const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const PLUGIN = "paperclip.payload-cms-agent-tools";
const CONTEXT_ISSUE = "AST-1290";
const ARTICLE_CASE_ID = "11c1e100-4a2c-49cc-8777-6bd4bffbbc00";
const CMS_DRAFT_ID = 138;
const EXPECTED_TITLE = "Будинки в натальній карті: що вони означають і як не перебільшувати висновки";
const OLD_CUSP_SENTENCE = "Початок кожного будинку називають куспідом — це точка, де сектор починається.";
const NEW_CUSP_SENTENCE = "Межу, від якої починається кожен дім, в астрології називають куспідом — простіше кажучи, це початкова лінія сектора на схемі натальної карти; у цій статті достатньо цього базового значення.";

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

function repairArticleContent(articleContent) {
  if (articleContent?.schemaVersion !== "articleContent.v1" || !Array.isArray(articleContent.blocks)) {
    throw new Error("CMS draft 138 does not contain canonical articleContent.v1");
  }
  const repaired = structuredClone(articleContent);
  const summaryIndex = repaired.blocks.findIndex(
    (block) => block?.type === "editorialCallout" && block.title === "Коротко",
  );
  if (summaryIndex < 0 || summaryIndex > 4) throw new Error("CMS draft 138 has no early Коротко callout");
  repaired.blocks[summaryIndex].variant = "soft";

  let cuspBlockIndex = -1;
  for (let index = 0; index < repaired.blocks.length; index += 1) {
    const block = repaired.blocks[index];
    if (block?.type !== "paragraph" || typeof block.text !== "string") continue;
    if (block.text.includes(OLD_CUSP_SENTENCE)) {
      block.text = block.text.replace(OLD_CUSP_SENTENCE, NEW_CUSP_SENTENCE);
      cuspBlockIndex = index;
      break;
    }
    if (block.text.includes(NEW_CUSP_SENTENCE)) {
      cuspBlockIndex = index;
      break;
    }
  }
  if (cuspBlockIndex < 0) throw new Error("CMS draft 138 cusp first-use paragraph was not found");
  return { repaired, summaryIndex, cuspBlockIndex };
}

function repairDocumentBody({ beforeUpdatedAt, afterUpdatedAt, summaryIndex, cuspBlockIndex }) {
  return [
    "# CMS 138 editorial repair",
    "",
    `- CMS draft: https://cms.astrogen.com.ua/admin/collections/blogPosts/${CMS_DRAFT_ID}`,
    `- Before updatedAt: ${beforeUpdatedAt ?? "unknown"}`,
    `- After updatedAt: ${afterUpdatedAt ?? "unknown"}`,
    "- Publication: not performed; workflow remains draft.",
    "",
    "## Changed",
    "",
    `- Коротко block ${summaryIndex}: variant changed to soft.`,
    `- Paragraph block ${cuspBlockIndex}: куспід now has an immediate plain-language first-use definition.`,
    "",
    "## Preserved",
    "",
    "- Title, slug, cover/OG media, author, category, related posts, CTA, and all unrelated article blocks.",
    "- The primary teaching concept remains house; cusp is a one-sentence supporting gloss, not a second lesson.",
  ].join("\n");
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  psql(`
    insert into board_api_keys (id,user_id,name,key_hash,expires_at)
    values (${quote(keyId)}::uuid,${quote(USER_ID)},'repair-cms-138-cusp-summary',
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
    if (before._status !== "draft" || before.workflowStatus !== "draft") {
      throw new Error(`Refusing repair: CMS ${CMS_DRAFT_ID} is not a draft`);
    }

    const { repaired, summaryIndex, cuspBlockIndex } = repairArticleContent(before.articleContent);
    const plan = {
      cmsDraftId: CMS_DRAFT_ID,
      summaryIndex,
      summaryVariantBefore: before.articleContent.blocks[summaryIndex].variant,
      summaryVariantAfter: repaired.blocks[summaryIndex].variant,
      cuspBlockIndex,
      publication: "not_performed",
    };
    if (!APPLY) {
      console.log(JSON.stringify({ mode: "dry-run", ...plan }, null, 2));
      return;
    }

    const backup = await request(token, "POST", "/instance/database-backups", {});
    await executeTool(token, runContext, "payload_cms_validate_article_content", { articleContent: repaired });
    await executeTool(token, runContext, "payload_cms_update_blog_post_draft", {
      id: CMS_DRAFT_ID,
      fields: { articleContent: repaired },
    });
    const after = asDocument(await executeTool(token, runContext, "payload_cms_find_blog_post", {
      id: CMS_DRAFT_ID,
      draft: true,
      depth: 1,
    }));
    if (after._status !== "draft" || after.workflowStatus !== "draft") {
      throw new Error("CMS draft repair unexpectedly changed publication state");
    }
    if (after.articleContent?.blocks?.[summaryIndex]?.variant !== "soft") {
      throw new Error("CMS draft repair did not preserve the soft summary variant");
    }
    if (!after.articleContent.blocks[cuspBlockIndex]?.text?.includes(NEW_CUSP_SENTENCE)) {
      throw new Error("CMS draft repair did not preserve the cusp first-use definition");
    }

    await request(token, "PUT", `/cases/${ARTICLE_CASE_ID}/documents/cms-editorial-repair`, {
      title: "CMS 138: cusp gloss and Коротко style repair",
      format: "markdown",
      body: repairDocumentBody({
        beforeUpdatedAt: before.updatedAt,
        afterUpdatedAt: after.updatedAt,
        summaryIndex,
        cuspBlockIndex,
      }),
      changeSummary: "Defined cusp at first use and normalized the Коротко callout to soft without publishing",
    });
    const currentCase = await request(token, "GET", `/cases/${ARTICLE_CASE_ID}`);
    const row = currentCase.case ?? currentCase;
    await request(token, "PATCH", `/cases/${ARTICLE_CASE_ID}`, {
      fieldPatch: {
        summaryCalloutVariant: "soft",
        supportingTermGlossary: [{
          termKey: "cusp",
          termUk: "куспід",
          plainLanguageDefinitionUk: "межа, від якої починається дім на схемі натальної карти",
          firstUseBlockIndex: cuspBlockIndex,
          necessity: "needed_to_name_the_start_boundary_of_a_house",
        }],
        supportingTerminologyRepairStatus: "passed",
        cmsEditorialRepairAt: new Date().toISOString(),
      },
      expectedVersion: row.version,
    });

    console.log(JSON.stringify({
      mode: "apply",
      ...plan,
      afterUpdatedAt: after.updatedAt ?? null,
      paperclipBackupDir: backup.backupDir ?? null,
      durableDocumentKey: "cms-editorial-repair",
    }, null, 2));
  } finally {
    psql(`update board_api_keys set revoked_at=now(),last_used_at=now() where id=${quote(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
