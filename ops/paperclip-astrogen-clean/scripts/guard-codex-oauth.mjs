#!/usr/bin/env node

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const PROJECT_ID = "d4644ea9-c025-4421-9af9-7780e41945ba";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const STATE_PATH =
  process.env.CODEX_OAUTH_GUARD_STATE ??
  "/home/paperclip/apps/paperclip-astrogen-clean/runtime/codex-oauth-guard-state.json";
const OWNER_EMAIL = "o.savitsky@gmail.com";

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

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function psql(sql) {
  return run(
    "sudo",
    [
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
    ],
    sql,
  );
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

async function withBoardToken(name, callback) {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const keyHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id,user_id,name,key_hash,expires_at)
    values (${quote(keyId)}::uuid,${quote(USER_ID)},${quote(name)},${quote(keyHash)},now()+interval '20 minutes');
  `);
  try {
    return await callback(token);
  } finally {
    psql(`update board_api_keys set revoked_at=now(),last_used_at=now() where id=${quote(keyId)}::uuid;`);
  }
}

async function readState() {
  try {
    return JSON.parse(await readFile(STATE_PATH, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return {};
    throw error;
  }
}

async function writeState(state) {
  await mkdir(dirname(STATE_PATH), { recursive: true });
  const temporaryPath = `${STATE_PATH}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await rename(temporaryPath, STATE_PATH);
}

function latestRevokedRun() {
  const value = psql(`
    select json_build_object(
      'runId', h.id,
      'agentId', h.agent_id,
      'agentName', a.name,
      'finishedAt', h.finished_at,
      'error', h.error
    )::text
    from heartbeat_runs h
    join agents a on a.id=h.agent_id
    where h.company_id=${quote(COMPANY_ID)}::uuid
      and a.adapter_type='codex_local'
      and h.status='failed'
      and (
        h.error ilike '%refresh token was revoked%'
        or h.error ilike '%log out and sign in again%'
      )
    order by h.finished_at desc nulls last
    limit 1;
  `);
  return value ? JSON.parse(value) : null;
}

function latestNotificationContext() {
  const value = psql(`
    select json_build_object('agentId',a.id,'runId',h.id)::text
    from heartbeat_runs h
    join agents a on a.id=h.agent_id
    where h.company_id=${quote(COMPANY_ID)}::uuid
      and a.name='Chief Marketing Officer'
      and h.status='succeeded'
    order by h.finished_at desc nulls last
    limit 1;
  `);
  if (!value) throw new Error("No successful CMO run is available for notification delivery");
  return JSON.parse(value);
}

async function notify(token, incident, phase) {
  const context = latestNotificationContext();
  const started = phase === "started";
  const subject = started
    ? "Astrogen Paperclip: потрібне повторне підключення OpenAI"
    : "Astrogen Paperclip: підключення OpenAI відновлено";
  const text = started
    ? "OpenAI скасував поточну сесію. Роботу агентів призупинено, щоб не створювати помилки або незавершені матеріали. Розпочато процедуру повторного підключення OpenAI."
    : "Підключення OpenAI перевірено. Агенти повернуті до Codex; Claude використовується лише для написання статей. Призупинені процеси можна продовжувати з наявного стану.";
  const html = `<p>${text}</p><p><strong>Дія:</strong> ${
    started
      ? "відкрити процедуру OpenAI device login після повідомлення оператора."
      : "додаткових дій не потрібно."
  }</p>`;
  const runContext = {
    agentId: context.agentId,
    runId: context.runId,
    companyId: COMPANY_ID,
    projectId: PROJECT_ID,
  };
  await request(token, "POST", "/plugins/tools/execute", {
    tool: "paperclip.email-notifications:email-notification-send",
    parameters: {
      recipientEmails: [OWNER_EMAIL],
      subject,
      text,
      html,
      idempotencyKey: `codex-oauth:${incident.runId}:${phase}`,
      metadata: { kind: "codex_oauth_reconnect", phase },
    },
    runContext,
  });
  await request(token, "POST", "/plugins/tools/execute", {
    tool: "paperclip-plugin-telegram:telegram_send_message",
    parameters: {
      text: `${subject}\n\n${text}`,
      disableWebPagePreview: true,
      contentRef: { kind: "codex_oauth_reconnect", incidentRunId: incident.runId, phase },
    },
    runContext,
  });
}

async function initialize() {
  const incident = latestRevokedRun();
  await writeState({
    status: "healthy",
    baselineRunId: incident?.runId ?? null,
    updatedAt: new Date().toISOString(),
  });
  console.log(JSON.stringify({ ok: true, mode: "initialize", baselineRunId: incident?.runId ?? null }));
}

async function check() {
  const state = await readState();
  const incident = latestRevokedRun();
  if (!incident || incident.runId === state.baselineRunId || incident.runId === state.incidentRunId) {
    console.log(JSON.stringify({ ok: true, mode: "check", action: "none" }));
    return;
  }
  await withBoardToken("codex-oauth-guard", async (token) => {
    const backup = await request(token, "POST", "/instance/database-backups", {});
    const response = await request(token, "GET", `/companies/${COMPANY_ID}/agents`);
    const agents = Array.isArray(response) ? response : response.items ?? response.agents ?? [];
    const pausedAgentIds = [];
    for (const agent of agents) {
      if (["paused", "terminated", "pending_approval"].includes(agent.status)) continue;
      await request(token, "POST", `/agents/${agent.id}/pause`, {});
      pausedAgentIds.push(agent.id);
    }
    await notify(token, incident, "started");
    await writeState({
      status: "awaiting_oauth",
      baselineRunId: state.baselineRunId ?? null,
      incidentRunId: incident.runId,
      incidentAgentName: incident.agentName,
      pausedAgentIds,
      backupDir: backup.backupDir ?? null,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });
  console.log(JSON.stringify({ ok: true, mode: "check", action: "paused_and_notified" }));
}

const mode = process.argv[2] ?? "--check";
if (mode === "--initialize") {
  await initialize();
} else if (mode === "--check") {
  await check();
} else {
  throw new Error("Use --initialize or --check");
}
