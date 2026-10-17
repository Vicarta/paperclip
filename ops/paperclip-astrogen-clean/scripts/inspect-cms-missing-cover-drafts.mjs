#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const PAYLOAD_PLUGIN = "paperclip.payload-cms-agent-tools";
const CONTEXT_ISSUE = process.env.CONTEXT_ISSUE ?? "AST-1061";
const titleFragments = ["витрати на переїзд", "залишитися за кордоном", "повернутися в Україну"];

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
  const parsed = text ? JSON.parse(text) : null;
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

function scalar(value) {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number") return value;
  return value.id ?? value.value ?? null;
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const keyHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id,user_id,name,key_hash,expires_at)
    values (${q(keyId)}::uuid,${q(USER_ID)},'inspect-cms-missing-cover-drafts',${q(keyHash)},now()+interval '10 minutes');
  `);
  try {
    const context = JSON.parse(psql(`
      select json_build_object(
        'agentId',i.assignee_agent_id,
        'runId',coalesce(
          i.execution_run_id,
          (
            select hr.id from heartbeat_runs hr
            where hr.company_id=i.company_id
              and hr.agent_id=i.assignee_agent_id
              and hr.context_snapshot->>'issueId'=i.id::text
            order by hr.created_at desc limit 1
          )
        ),
        'companyId',i.company_id,
        'projectId',i.project_id,
        'issueId',i.id
      )::text
      from issues i where i.company_id=${q(COMPANY_ID)}::uuid and i.identifier=${q(CONTEXT_ISSUE)};
    `));
    if (!context.runId) throw new Error(`${CONTEXT_ISSUE} has no execution run context`);

    const matches = [];
    for (let page = 1; page <= 4; page += 1) {
      const response = await request(token, "POST", "/agents/me/plugin-tools/execute", {
        tool: `${PAYLOAD_PLUGIN}:payload_cms_list_blog_posts`,
        parameters: { status: "any", limit: 100, page, depth: 1, sort: "-updatedAt" },
        runContext: context,
      });
      const data = unwrapToolData(response);
      const docs = Array.isArray(data?.docs) ? data.docs : [];
      for (const doc of docs) {
        const title = typeof doc.title === "string" ? doc.title : doc.title?.value ?? "";
        const normalized = title.toLocaleLowerCase("uk");
        if (!titleFragments.some((fragment) => normalized.includes(fragment.toLocaleLowerCase("uk")))) continue;
        matches.push({
          id: doc.id,
          title,
          slug: doc.slug,
          status: doc._status ?? doc.status ?? null,
          coverImage: scalar(doc.coverImage),
          ogImage: scalar(doc.ogImage),
          updatedAt: doc.updatedAt ?? null,
        });
      }
      if (docs.length < 100) break;
    }
    console.log(JSON.stringify({ contextIssue: CONTEXT_ISSUE, matches }, null, 2));
  } finally {
    psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
