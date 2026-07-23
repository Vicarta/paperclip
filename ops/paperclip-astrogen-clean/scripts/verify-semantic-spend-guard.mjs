#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const PROJECT_ID = "d4644ea9-c025-4421-9af9-7780e41945ba";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const PLUGIN = "paperclip.semantic-core-mcp-agent-tools";

function run(command, args, input) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
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

async function execute(token, context, tool, parameters) {
  const response = await fetch(`${API_BASE}/agents/me/plugin-tools/execute`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tool: `${PLUGIN}:${tool}`,
      parameters,
      runContext: context,
    }),
  });
  const text = await response.text();
  return { status: response.status, text };
}

function requireGuard(result, code) {
  if (!result.text.includes(code)) {
    throw new Error(`Expected ${code}, received HTTP ${result.status}: ${result.text.slice(0, 1200)}`);
  }
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const keyHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id,user_id,name,key_hash,expires_at)
    values (${q(keyId)}::uuid,${q(USER_ID)},'verify-semantic-spend-guard',${q(keyHash)},now()+interval '10 minutes');
  `);

  try {
    const context = JSON.parse(psql(`
      select json_build_object(
        'agentId',a.id,
        'runId',h.id,
        'companyId',a.company_id,
        'projectId',${q(PROJECT_ID)}::uuid
      )::text
      from agents a
      join lateral (
        select id from heartbeat_runs
        where company_id=a.company_id and agent_id=a.id
        order by created_at desc limit 1
      ) h on true
      where a.company_id=${q(COMPANY_ID)}::uuid
        and a.name='SEO Semantic Core Strategist'
      limit 1;
    `));

    const semantic = await execute(token, context, "run-layer", {
      project_id: "astrogen-ukraine",
      layer: "audience_need_intent",
      mode: "provider",
      candidate_keywords: ["безпечна тестова фраза"],
    });
    requireGuard(semantic, "SEMANTIC_CORE_PROVIDER_EXECUTION_DISABLED");

    const trend = await execute(token, context, "generate-trend-topic-report", {
      project_id: "astrogen-audience-trends-ukraine",
      project: {
        name: "Astrogen",
        description: "Audience situations and current information needs",
        market: "Ukraine",
        geographies: ["Ukraine"],
        output_language: "uk",
      },
      audience_segments: [
        {
          id: "life_decisions",
          name: "Life decisions",
          description: "People comparing difficult life choices",
        },
      ],
      analysis_date: "2026-07-23",
      mode: "live",
    });
    requireGuard(trend, "SEMANTIC_CORE_TREND_LIVE_DISABLED");

    const inventory = await execute(token, context, "get-local-inventory", { limit: 1 });
    if (inventory.status !== 200 || !inventory.text.includes('"status"')) {
      throw new Error(`Local inventory verification failed: HTTP ${inventory.status} ${inventory.text.slice(0, 1200)}`);
    }

    console.log(JSON.stringify({
      ok: true,
      providerGuard: "SEMANTIC_CORE_PROVIDER_EXECUTION_DISABLED",
      trendGuard: "SEMANTIC_CORE_TREND_LIVE_DISABLED",
      localInventoryStatus: inventory.status,
    }, null, 2));
  } finally {
    psql(`update board_api_keys set revoked_at=now(),last_used_at=now() where id=${q(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
