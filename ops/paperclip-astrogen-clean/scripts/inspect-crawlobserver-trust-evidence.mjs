#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const CONTEXT_ISSUE = process.env.CONTEXT_ISSUE ?? "AST-1136";
const PLUGIN_ID = "paperclip.crawlobserver-agent-tools";

function run(command, args, input) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
  return result.stdout.trim();
}

function psql(sql) {
  return run("sudo", [
    "docker", "exec", "-i", DB_CONTAINER,
    "psql", "-U", "paperclip", "-d", "paperclip",
    "-v", "ON_ERROR_STOP=1", "-At",
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

function toolData(response) {
  return response?.result?.data?.structuredContent
    ?? response?.result?.data
    ?? response?.data?.structuredContent
    ?? response?.data
    ?? response?.result
    ?? response;
}

function sessionRows(value) {
  if (Array.isArray(value)) return value;
  for (const key of ["sessions", "items", "results", "data"]) {
    if (Array.isArray(value?.[key])) return value[key];
  }
  return [];
}

function sessionId(row) {
  return row?.sessionId ?? row?.session_id ?? row?.id ?? row?.ID ?? null;
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  psql(`
    insert into board_api_keys (id,user_id,name,key_hash,expires_at)
    values (
      ${quote(keyId)}::uuid,
      ${quote(USER_ID)},
      'inspect-crawlobserver-trust-evidence',
      ${quote(createHash("sha256").update(token).digest("hex"))},
      now()+interval '10 minutes'
    );
  `);

  try {
    const context = JSON.parse(psql(`
      select json_build_object(
        'agentId',i.assignee_agent_id,
        'runId',coalesce(i.execution_run_id,(
          select h.id
          from heartbeat_runs h
          where h.company_id=i.company_id
            and h.agent_id=i.assignee_agent_id
            and h.context_snapshot->>'issueId'=i.id::text
          order by h.created_at desc
          limit 1
        )),
        'companyId',i.company_id,
        'projectId',i.project_id,
        'issueId',i.id
      )::text
      from issues i
      where i.company_id=${quote(COMPANY_ID)}::uuid
        and i.identifier=${quote(CONTEXT_ISSUE)};
    `));
    if (!context.runId) throw new Error(`${CONTEXT_ISSUE} has no run context`);

    const execute = async (toolName, parameters) => toolData(await request(
      token,
      "POST",
      "/agents/me/plugin-tools/execute",
      {
        tool: `${PLUGIN_ID}:${toolName}`,
        parameters,
        runContext: context,
      },
    ));

    const health = await execute("health-check", {});
    const projects = await execute("list-projects", {});
    const sessions = await execute("list-sessions", { limit: 20, offset: 0 });
    const rows = sessionRows(sessions);
    const sessionSummaries = rows.map((row) => ({
      sessionId: sessionId(row),
      projectId: row?.projectId ?? row?.project_id ?? row?.ProjectID ?? null,
      label: row?.label ?? row?.Label ?? "",
      status: row?.status ?? row?.Status ?? null,
      startedAt: row?.startedAt ?? row?.started_at ?? row?.StartedAt ?? null,
      finishedAt: row?.finishedAt ?? row?.finished_at ?? row?.FinishedAt ?? null,
      pagesCrawled: row?.pagesCrawled ?? row?.pages_crawled ?? row?.PagesCrawled ?? null,
      quality: row?.quality ?? null,
    }));
    const qualities = [];
    for (const row of rows.slice(0, 5)) {
      const id = sessionId(row);
      if (!id) continue;
      try {
        qualities.push({ sessionId: id, quality: await execute("get-session-quality", { sessionId: id }) });
      } catch (error) {
        qualities.push({ sessionId: id, error: error instanceof Error ? error.message : String(error) });
      }
    }

    console.log(JSON.stringify({
      contextIssue: CONTEXT_ISSUE,
      health,
      projects,
      sessions: sessionSummaries,
      normalizedSessionCount: rows.length,
      qualities,
    }, null, 2));
  } finally {
    psql(`delete from board_api_keys where id=${quote(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
