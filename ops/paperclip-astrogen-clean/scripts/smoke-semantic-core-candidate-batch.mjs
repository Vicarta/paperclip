#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const PROJECT_ID = "d4644ea9-c025-4421-9af9-7780e41945ba";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const TOOL = "paperclip.semantic-core-mcp-agent-tools:run-layer";
const CANDIDATE_KEYWORDS = [
  "як підготуватися до консультації з тарологом",
  "як підготуватися до консультації з астрологом",
  "що запитати у таролога",
  "що запитати в астролога",
  "порівняння астрологія таро нумерологія Human Design",
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

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const keyHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id,user_id,name,key_hash,expires_at)
    values (${quote(keyId)}::uuid,${quote(USER_ID)},'semantic-candidate-batch-smoke',${quote(keyHash)},now()+interval '10 minutes');
  `);

  try {
    const context = JSON.parse(psql(`
      select json_build_object(
        'agentId',i.assignee_agent_id,
        'runId',(
          select hr.id from heartbeat_runs hr
          where hr.company_id=i.company_id
            and hr.agent_id=i.assignee_agent_id
            and hr.context_snapshot->>'issueId'=i.id::text
          order by hr.created_at desc limit 1
        ),
        'companyId',i.company_id,
        'projectId',coalesce(i.project_id,${quote(PROJECT_ID)}::uuid),
        'issueId',i.id
      )::text
      from issues i
      where i.company_id=${quote(COMPANY_ID)}::uuid and i.identifier='AST-618';
    `));

    const response = await fetch(`${API_BASE}/agents/me/plugin-tools/execute`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: TOOL,
        parameters: {
          project_id: "astrogen-ukraine",
          layer: "audience_need_intent",
          mode: "live",
          provider_cache_mode: "read_write",
          candidate_keywords: CANDIDATE_KEYWORDS,
        },
        runContext: context,
      }),
    });
    const text = await response.text();
    process.stdout.write(`${JSON.stringify({
      ok: response.ok,
      status: response.status,
      body: text ? JSON.parse(text) : null,
    }, null, 2)}\n`);
    if (!response.ok) process.exitCode = 1;
  } finally {
    psql(`delete from board_api_keys where id=${quote(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
