#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const PROJECT_ID = "d4644ea9-c025-4421-9af9-7780e41945ba";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const CANONICAL_PREFIX = "https://cms.astrogen.com.ua/admin/collections/blogPosts/";

const args = process.argv.slice(2);
const caseId = args[args.indexOf("--case-id") + 1];
const apply = args.includes("--apply");
if (!caseId || !/^[0-9a-f-]{36}$/i.test(caseId)) {
  throw new Error("Usage: repair-canonical-cms-admin-url.mjs --case-id <uuid> [--apply]");
}

function run(command, commandArgs, input) {
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    input,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
  }
  return result.stdout.trim();
}

function q(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function psql(sql) {
  return run("sudo", [
    "docker", "exec", "-i", DB_CONTAINER,
    "psql", "-U", "paperclip", "-d", "paperclip",
    "-v", "ON_ERROR_STOP=1", "-At",
  ], sql);
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
  if (!response.ok) {
    throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 2000)}`);
  }
  return text ? JSON.parse(text) : null;
}

function latestCmoRunContext() {
  const value = psql(`
    select json_build_object('agentId', a.id, 'runId', h.id)::text
    from heartbeat_runs h
    join agents a on a.id=h.agent_id
    where h.company_id=${q(COMPANY_ID)}::uuid
      and a.name='Chief Marketing Officer'
      and h.status='succeeded'
    order by h.finished_at desc nulls last
    limit 1;
  `);
  if (!value) throw new Error("No completed CMO run is available for audited Telegram correction");
  return JSON.parse(value);
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${q(keyId)}::uuid, ${q(USER_ID)}, 'repair-canonical-cms-admin-url',
      ${q(createHash("sha256").update(token).digest("hex"))}, now() + interval '10 minutes');
  `);

  try {
    let detail = await request(token, "GET", `/cases/${caseId}`);
    let pipelineCase = detail.case ?? detail;
    const draftId = pipelineCase.fields?.cmsDraftId;
    if (draftId === undefined || draftId === null || String(draftId).trim().length === 0) {
      throw new Error("Case does not have cmsDraftId");
    }
    const canonicalUrl = `${CANONICAL_PREFIX}${encodeURIComponent(String(draftId))}`;
    const currentUrl = pipelineCase.fields?.cmsAdminUrl ?? null;
    const previousCorrectionMessageId = pipelineCase.fields?.cmsAdminUrlCorrectionTelegramMessageId ?? null;

    if (!apply || (currentUrl === canonicalUrl && previousCorrectionMessageId)) {
      console.log(JSON.stringify({
        mode: apply ? "already-repaired" : "dry-run",
        caseId,
        caseKey: pipelineCase.caseKey,
        currentUrl,
        canonicalUrl,
        correctionMessageId: previousCorrectionMessageId,
      }, null, 2));
      return;
    }

    const backup = await request(token, "POST", "/instance/database-backups", {});
    const patched = await request(token, "PATCH", `/cases/${caseId}`, {
      expectedVersion: pipelineCase.version,
      fieldPatch: {
        cmsAdminUrl: canonicalUrl,
        cmsAdminUrlCorrectedFrom: currentUrl,
        cmsAdminUrlCorrectedAt: new Date().toISOString(),
      },
    });
    pipelineCase = patched.case ?? patched;

    const cmoContext = latestCmoRunContext();
    const deliveryIssueId = psql(`
      select i.id
      from pipeline_case_issue_links l
      join issues i on i.id=l.issue_id
      where l.company_id=${q(COMPANY_ID)}::uuid
        and l.case_id=${q(caseId)}::uuid
        and i.title='CMO Delivery automation'
      order by l.created_at desc
      limit 1;
    `);
    const title = pipelineCase.title ?? detail.case?.title ?? "CMS-чернетка";
    const telegram = await request(token, "POST", "/plugins/tools/execute", {
      tool: "paperclip-plugin-telegram:telegram_send_message",
      parameters: {
        text: `${title}\n${canonicalUrl}`,
        disableWebPagePreview: true,
        ...(deliveryIssueId ? { issueId: deliveryIssueId } : {}),
        contentRef: { caseId, cmsDraftId: draftId, cmsAdminUrl: canonicalUrl },
      },
      runContext: {
        agentId: cmoContext.agentId,
        runId: cmoContext.runId,
        companyId: COMPANY_ID,
        projectId: PROJECT_ID,
      },
    });
    const messageId = telegram.data?.messageId ?? telegram.result?.data?.messageId ?? null;
    if (!messageId) throw new Error("Telegram correction did not return messageId");

    detail = await request(token, "GET", `/cases/${caseId}`);
    pipelineCase = detail.case ?? detail;
    const repairedResponse = await request(token, "PATCH", `/cases/${caseId}`, {
      expectedVersion: pipelineCase.version,
      fieldPatch: {
        telegramMessageId: messageId,
        telegramDeliveryOk: true,
        cmsAdminUrlCorrectionTelegramMessageId: messageId,
      },
    });
    const repaired = repairedResponse.case ?? repairedResponse;
    console.log(JSON.stringify({
      mode: "apply",
      caseId,
      caseKey: repaired.caseKey,
      canonicalUrl,
      correctionMessageId: messageId,
      backup: {
        filename: backup.filename ?? null,
        sizeBytes: backup.sizeBytes ?? null,
      },
    }, null, 2));
  } finally {
    psql(`
      update board_api_keys
      set revoked_at=now(), last_used_at=now()
      where id=${q(keyId)}::uuid;
    `);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
