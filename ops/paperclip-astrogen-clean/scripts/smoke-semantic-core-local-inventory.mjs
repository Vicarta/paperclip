#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const PROJECT_ID = "d4644ea9-c025-4421-9af9-7780e41945ba";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const PLUGIN_KEY = "paperclip.semantic-core-mcp-agent-tools";
const TOOL = `${PLUGIN_KEY}:get-local-inventory`;

function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
  return result.stdout.trim();
}

function psql(sql) {
  return run("docker", [
    "exec", "-i", DB_CONTAINER,
    "psql", "-U", "paperclip", "-d", "paperclip",
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
  if (!response.ok) throw new Error(`${method} ${path} returned ${response.status}: ${text.slice(0, 800)}`);
  return parsed;
}

const token = `pcp_board_${randomBytes(24).toString("hex")}`;
const keyId = randomUUID();
const keyHash = createHash("sha256").update(token).digest("hex");

psql(`
  insert into board_api_keys (id, user_id, name, key_hash, expires_at)
  values (${q(keyId)}::uuid, ${q(USER_ID)}, 'semantic-core-local-inventory-smoke',
    ${q(keyHash)}, now() + interval '10 minutes');
`);

try {
  const context = JSON.parse(psql(`
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
      and a.name='SEO Blog Content Strategist'
    limit 1;
  `));
  const tools = await request(token, "GET", `/agents/me/plugin-tools?pluginId=${encodeURIComponent(PLUGIN_KEY)}`);
  if (!tools.some((tool) => tool.name === "get-local-inventory" || tool.name === TOOL)) {
    throw new Error("get-local-inventory is not registered for agent tool execution");
  }
  const response = await request(token, "POST", "/agents/me/plugin-tools/execute", {
    tool: TOOL,
    parameters: { limit: 3, minimumGeoSearchVolume: 20 },
    runContext: context,
  });
  const result = response?.result?.data ?? response?.data;
  if (result?.status !== "ok" || result?.acceptedKeywords?.length < 1) {
    throw new Error(`Local semantic inventory smoke failed: ${JSON.stringify(result ?? null)}`);
  }
  if (result.acceptedKeywords.length > 3 || result.page?.limit !== 3) {
    throw new Error("Local semantic inventory did not enforce the requested bound");
  }
  console.log(JSON.stringify({
    ok: true,
    pluginKey: PLUGIN_KEY,
    snapshot: result.snapshot,
    totals: result.totals,
    returned: result.acceptedKeywords.length,
    highestGeoVolume: result.acceptedKeywords[0]?.geoSearchVolume ?? null,
  }, null, 2));
} finally {
  psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
}
