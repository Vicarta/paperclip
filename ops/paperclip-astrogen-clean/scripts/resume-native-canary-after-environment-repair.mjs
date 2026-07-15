#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const IDENTIFIERS = ["AST-237", "AST-238"];
const RETURN_ASSIGNEE_BY_ISSUE = new Map([
  ["AST-237", "SEO CMS Technical Fixer"],
  ["AST-238", "CEO"],
]);

function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 8 * 1024 * 1024 });
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

function sqlLiteral(value) {
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
  if (!response.ok) throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 1500)}`);
  return parsed;
}

function loadIssues() {
  const output = psql(`
    select json_build_object(
      'identifier', i.identifier,
      'id', i.id,
      'status', i.status,
      'assigneeAgentId', i.assignee_agent_id
    )::text
    from issues i
    where i.company_id=${sqlLiteral(COMPANY_ID)}::uuid
      and i.identifier in ('AST-237', 'AST-238')
    order by i.identifier;
  `);
  return output.split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

function loadAgentIdsByName() {
  const output = psql(`
    select json_build_object('id', id, 'name', name)::text
    from agents
    where company_id=${sqlLiteral(COMPANY_ID)}::uuid
      and name in ('SEO CMS Technical Fixer', 'CEO');
  `);
  return new Map(
    output.split("\n").filter(Boolean).map((line) => JSON.parse(line)).map((agent) => [agent.name, agent.id]),
  );
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const keyId = randomUUID();
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${sqlLiteral(keyId)}::uuid, ${sqlLiteral(USER_ID)},
      'phase46-environment-repair-resume', ${sqlLiteral(tokenHash)}, now() + interval '10 minutes');
  `);
  try {
    const issues = loadIssues();
    const agentIdsByName = loadAgentIdsByName();
    if (issues.length !== IDENTIFIERS.length) throw new Error("Native canary automation issues are missing");
    const results = [];
    for (const issue of issues) {
      if (issue.status !== "blocked") {
        results.push({ identifier: issue.identifier, changed: false, status: issue.status });
        continue;
      }
      const returnAssigneeName = RETURN_ASSIGNEE_BY_ISSUE.get(issue.identifier);
      const returnAssigneeId = returnAssigneeName ? agentIdsByName.get(returnAssigneeName) : null;
      if (!returnAssigneeId) throw new Error(`Return assignee missing for ${issue.identifier}`);
      const updated = await request(token, "PATCH", `/issues/${issue.id}`, {
        resume: true,
        blockedByIssueIds: [],
        assigneeAgentId: returnAssigneeId,
        comment: "Systemic execution-environment schema drift has been repaired and this task is returned to its native stage owner. Resume this same native pipeline task from existing evidence; do not create duplicate work or repeat completed provider/CMS actions. Use the injected paperclip skill Native Pipeline Cases reference for case updates and transitions; do not inspect OpenAPI, frontend bundles, or server source to discover pipeline routes.",
      });
      results.push({ identifier: issue.identifier, changed: true, status: updated.status });
    }
    console.log(JSON.stringify({ resumed: results }, null, 2));
  } finally {
    psql(`
      update board_api_keys set revoked_at=now(), last_used_at=now()
      where id=${sqlLiteral(keyId)}::uuid;
    `);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
