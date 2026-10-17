#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const PIPELINE_KEY = "astrogen-article-production";
const STAGE_KEY = "cmo_delivery";
const CASE_ID = process.env.ARTICLE_CASE_ID ?? "e0b3f0f6-4976-4597-9f95-f6d6258ecf7e";

const stageInstructions = {
  layout_validate: `Validate articleContent.v1, Коротко, CTA, related-post plan, visible copy, and absence of schema/process residue. Deterministically reject any paragraph without string text or whose text differs from the concatenated spans[].text when spans exist; do not approve a spans-only paragraph and leave this repair to CMS. Reject any twoColumnText block whose leftBody or rightBody is empty, and require non-empty CMS-ready SEO title and meta description before approval. For human_scene cover direction, require one explicit typed gaze plan but never require a viewer-facing candidate or final image: viewer-facing is valid only when it strengthens the lived emotional event, while interaction/object/off-camera gaze is equally valid when it explains the topic better. Use the native review decision: approve to image, request changes to layout, or reject with durable evidence.`,
  cms_draft: `Consume only accepted pipeline artifacts. For operation=create, make one typed payload_cms_create_blog_post_draft call with articleType and the accepted cmsCategorySlug/cmsCategoryTitle when a topic-specific category was selected. The company-scoped CMS plugin is the canonical relation resolver: it idempotently resolves the default Astrogen editorial author and the approved article-type category before its single Payload create. Do not pre-call raw CMS APIs, guess numeric relations, omit articleType, or trial-and-error author/category fields. An explicitly scoped expert article must instead pass its verified author relation.

Before the first CMS mutation, verify every paragraph has string text and that it equals concatenated spans[].text when spans exist, every twoColumnText side is non-empty, and the CMS-ready envelope has non-empty SEO title and meta description. Any mismatch must return to layout validation instead of using the CMS create call as a validator or trying alternate Payload shapes. Then upload the accepted cover, create or update one Payload CMS draft, set exactly three valid relatedPosts, verify articleContent.v1, Коротко, CTA, cover/OG media and authenticated CMS refetch evidence. Keep draft-only, write cmsDraftId and cmsAdminUrl to the case, and transition to cmo_delivery. Never publish. If relation resolution fails, record cms_relation_policy_missing with the exact adapter evidence, retain the same case/stage, and route the repair to the CMS delivery policy rather than asking the owner for a technical choice.`,
  cmo_delivery: `Act as the final delivery reviewer. Verify the CMS draft/admin URL and all completion evidence. If valid Telegram delivery proof already exists in case fields, reuse it and do not send a duplicate. Otherwise send exactly one gender-neutral Ukrainian Telegram message containing only the article title and CMS admin edit URL, then record ok=true, messageId and delivery-proof writeback. For operation=create, verify the linked topic is reserved by this article case; the native children-terminal outcome contract consumes that topic atomically after approval moves this article to delivered. Never mutate the topic lifecycle manually. For operation=refresh or repair, require the verified before-after diff and do not require or mutate a topic reservation. Submit the native review decision approve only after Telegram delivery proof and the operation-specific gate succeed. Request changes to cms_draft when final CMS evidence is incomplete, or reject only with durable evidence. Never use a direct case transition, resend an existing delivery, or send internal stage or technical status.`,
};
const stageOwners = {
  layout_validate: "SEO Blog Article Layout Validator",
  cms_draft: "SEO CMS Technical Fixer",
  cmo_delivery: "Chief Marketing Officer",
};

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

function sqlLiteral(value) {
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

function caseRow(detail) {
  return detail.case ?? detail;
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${sqlLiteral(keyId)}::uuid, ${sqlLiteral(USER_ID)},
      'cmo-delivery-final-review-repair', ${sqlLiteral(tokenHash)}, now() + interval '15 minutes');
  `);

  try {
    const [pipelineResponse, agentResponse, caseDetail] = await Promise.all([
      request(token, "GET", `/companies/${COMPANY_ID}/pipelines`),
      request(token, "GET", `/companies/${COMPANY_ID}/agents`),
      request(token, "GET", `/cases/${CASE_ID}`),
    ]);
    const pipeline = asArray(pipelineResponse, ["items", "pipelines"]).find((item) => item.key === PIPELINE_KEY);
    const agents = asArray(agentResponse, ["items", "agents"]);
    const agentByName = new Map(agents.map((item) => [item.name, item]));
    const cmo = agentByName.get("Chief Marketing Officer");
    if (!pipeline) throw new Error(`Pipeline not found: ${PIPELINE_KEY}`);
    if (!cmo) throw new Error("Chief Marketing Officer agent not found");
    const stages = new Map(pipeline.stages.map((item) => [item.key, item]));
    for (const stageKey of Object.keys(stageInstructions)) {
      if (!stages.has(stageKey)) throw new Error(`Stage not found: ${stageKey}`);
    }
    const stage = stages.get(STAGE_KEY);

    const currentCase = caseRow(caseDetail);
    const caseAlreadyDelivered = caseDetail.stage?.key === "delivered" && currentCase.terminalKind === "done";
    if (caseDetail.stage?.key !== STAGE_KEY && !caseAlreadyDelivered) {
      throw new Error(`Refusing recovery from stage ${caseDetail.stage?.key ?? "unknown"}`);
    }
    if (!currentCase.fields?.cmsAdminUrl || !currentCase.fields?.telegramMessageId || currentCase.fields?.telegramDeliveryOk !== true) {
      throw new Error("Current article case does not have reusable CMS and Telegram delivery proof");
    }

    const backup = await request(token, "POST", "/instance/database-backups", {});
    for (const stageKey of ["layout_validate", "cms_draft"]) {
      const currentStage = stages.get(stageKey);
      const owner = agentByName.get(stageOwners[stageKey]);
      if (!owner) throw new Error(`Stage owner not found: ${stageOwners[stageKey]}`);
      await request(token, "PATCH", `/pipelines/${pipeline.id}/stages/${currentStage.id}`, {
        config: {
          ...(currentStage.config ?? {}),
          automation: {
            assigneeAgentId: owner.id,
            instructionsBody: stageInstructions[stageKey],
            projectId: pipeline.projectId ?? null,
          },
        },
      });
    }
    const cmoConfig = {
      ...(stage.config ?? {}),
      requireApproval: true,
      approver: { kind: "agent", id: cmo.id },
      approveToStageKey: "delivered",
      requestChangesToStageKey: "cms_draft",
      rejectToStageKey: "cancelled",
      requireRejectReason: true,
      requireRequestChangesReason: true,
      automation: {
        assigneeAgentId: cmo.id,
        instructionsBody: stageInstructions.cmo_delivery,
        projectId: pipeline.projectId ?? null,
      },
    };
    await request(token, "PATCH", `/pipelines/${pipeline.id}/stages/${stage.id}`, {
      kind: "review",
      config: cmoConfig,
    });

    let patchedCase = null;
    let rerun = null;
    if (!caseAlreadyDelivered) {
      patchedCase = await request(token, "PATCH", `/cases/${CASE_ID}`, {
        fieldPatch: {
          blockerClass: null,
          nextReviewAt: null,
          cmoFinalReviewContractVersion: "native-review-v1",
          cmoFinalReviewRecoveredAt: new Date().toISOString(),
        },
        expectedVersion: currentCase.version,
      });
      rerun = await request(token, "POST", `/cases/${CASE_ID}/automation/current-stage/rerun`, {});
    }
    const verifiedPipelineResponse = await request(token, "GET", `/companies/${COMPANY_ID}/pipelines`);
    const verifiedPipeline = asArray(verifiedPipelineResponse, ["items", "pipelines"]).find((item) => item.key === PIPELINE_KEY);
    const verifiedStage = verifiedPipeline?.stages?.find((item) => item.key === STAGE_KEY);
    if (verifiedStage?.kind !== "review" || verifiedStage.config?.approveToStageKey !== "delivered") {
      throw new Error("CMO delivery native review contract was not persisted");
    }

    console.log(JSON.stringify({
      ok: true,
      pipelineId: pipeline.id,
      stageId: stage.id,
      stageKind: verifiedStage.kind,
      approveToStageKey: verifiedStage.config.approveToStageKey,
      caseId: CASE_ID,
      recoveryMode: caseAlreadyDelivered ? "contract-sync-only" : "contract-sync-and-rerun",
      patchedCaseVersion: patchedCase ? caseRow(patchedCase).version : currentCase.version,
      automationStatus: rerun?.automationExecution?.status ?? null,
      existingTelegramMessageId: currentCase.fields.telegramMessageId,
      backup: {
        backupDir: backup.backupDir ?? null,
        sizeBytes: backup.sizeBytes ?? null,
        finishedAt: backup.finishedAt ?? null,
      },
    }, null, 2));
  } finally {
    psql(`update board_api_keys set revoked_at=now(), last_used_at=now() where id=${sqlLiteral(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
