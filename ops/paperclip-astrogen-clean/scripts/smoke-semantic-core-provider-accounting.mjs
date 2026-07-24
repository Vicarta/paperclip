#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const PROJECT_ID = "d4644ea9-c025-4421-9af9-7780e41945ba";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const PLUGIN_KEY = "paperclip.semantic-core-mcp-agent-tools";
const TOOL = `${PLUGIN_KEY}:run-layer-and-wait`;

function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
  return result.stdout.trim();
}

function psql(sql) {
  return run("docker", [
    "exec", "-i", DB_CONTAINER,
    "psql", "-U", "paperclip", "-d", "paperclip", "-v", "ON_ERROR_STOP=1", "-At",
  ], sql);
}

function q(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function readString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const keyHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${q(keyId)}::uuid, ${q(USER_ID)}, 'semantic-provider-accounting-smoke',
      ${q(keyHash)}, now() + interval '10 minutes');
  `);

  try {
    const contextRaw = psql(`
      select json_build_object(
        'agentId', a.id,
        'runId', hr.id,
        'companyId', a.company_id,
        'projectId', ${q(PROJECT_ID)}::uuid
      )::text
      from agents a
      join lateral (
        select id from heartbeat_runs
        where company_id=a.company_id and agent_id=a.id
        order by created_at desc limit 1
      ) hr on true
      where a.company_id=${q(COMPANY_ID)}::uuid
        and a.name='SEO Semantic Core Strategist'
      limit 1;
    `);
    if (!contextRaw) throw new Error("No existing SEO Semantic Core Strategist heartbeat context");

    const response = await fetch(`${API_BASE}/agents/me/plugin-tools/execute`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        tool: TOOL,
        parameters: {
          project_id: "astrogen-ukraine",
          layer: "audience_need_intent",
          mode: "provider",
          provider_cache_mode: "read_write",
          provider_queue: "standard",
          include_search_intent: false,
          include_content_parsing: false,
          candidate_keywords: ["стрес після переїзду"],
        },
        runContext: JSON.parse(contextRaw),
      }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(`Semantic provider smoke returned HTTP ${response.status}`);
    }

    const result = body?.result?.data ?? body?.data ?? {};
    console.log(JSON.stringify({
      ok: true,
      tool: TOOL,
      runId: readString(result.run_id),
      jobId: readString(result.job_id),
      status: readString(result.status),
      candidateKeywordCount: result.candidate_keyword_count ?? null,
      cost: result.cost ?? null,
    }, null, 2));
  } finally {
    psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
