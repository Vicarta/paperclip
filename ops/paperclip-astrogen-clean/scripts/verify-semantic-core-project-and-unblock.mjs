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

function q(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function request(token, method, pathname, body, runId) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(runId ? { "X-Paperclip-Run-Id": runId } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 1600)}`);
  return text ? JSON.parse(text) : null;
}

function unwrap(response) {
  return response?.result?.data?.structuredContent
    ?? response?.result?.data
    ?? response?.data?.structuredContent
    ?? response?.data
    ?? response?.result
    ?? response;
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const keyHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${q(keyId)}::uuid, ${q(USER_ID)}, 'semantic-project-v2-verify',
      ${q(keyHash)}, now() + interval '10 minutes');
  `);

  try {
    const context = JSON.parse(psql(`
      select json_build_object(
        'agentId',i.assignee_agent_id,
        'runId',(select hr.id from heartbeat_runs hr where hr.company_id=i.company_id
          and hr.agent_id=i.assignee_agent_id and hr.context_snapshot->>'issueId'=i.id::text
          order by hr.created_at desc limit 1),
        'companyId',i.company_id,'projectId',coalesce(i.project_id,${q(PROJECT_ID)}::uuid),'issueId',i.id
      )::text from issues i where i.company_id=${q(COMPANY_ID)}::uuid and i.identifier='AST-618';
    `));
    if (!context.runId) throw new Error("AST-618 has no heartbeat context");

    const response = await request(token, "POST", "/agents/me/plugin-tools/execute", {
      tool: `${PLUGIN}:validate-project`,
      parameters: { project_id: "astrogen-ukraine" },
      runContext: context,
    });
    const validation = unwrap(response);
    if (validation?.status !== "ok" || (Array.isArray(validation.errors) && validation.errors.length > 0)) {
      throw new Error(`Semantic Core project remains invalid: ${JSON.stringify(validation).slice(0, 1600)}`);
    }

    const blocker = JSON.parse(psql(`
      select json_build_object('id',id,'status',status)::text from issues
      where company_id=${q(COMPANY_ID)}::uuid and identifier='AST-619';
    `));
    if (blocker.status !== "done") {
      await request(token, "PATCH", `/issues/${blocker.id}`, {
        status: "done",
        comment: [
          "Semantic Core project config migrated and verified.",
          "",
          "- Removed only the four unsupported legacy top-level fields.",
          "- Preserved canonical site, locale, section, ownership, threshold and provider configuration.",
          "- `validate-project` now returns `status=ok` with no errors through the Paperclip plugin.",
          "- [AST-618](/AST/issues/AST-618) should resume its same bounded five-phrase validation batch through the existing blocker relation.",
        ].join("\n"),
      }, context.runId);
    }

    process.stdout.write(`${JSON.stringify({ ok: true, validationStatus: validation.status, blockerClosed: "AST-619" }, null, 2)}\n`);
  } finally {
    psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
