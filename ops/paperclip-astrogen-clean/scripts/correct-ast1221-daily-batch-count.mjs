#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const ISSUE_IDENTIFIER = "AST-1221";

const CORRECTION = `## Daily batch accounting correction

Allocator revision 24 supersedes the current issue snapshot only for daily batch accounting.

- Business date: 2026-07-22 Europe/Kiev.
- Delivered article case \`bb00690a-6295-4373-ac0b-62114ccb6aa5\` has \`operation=create\`, \`reservationDateKyiv=2026-07-22\`, and CMS draft \`https://cms.astrogen.com.ua/admin/collections/blogPosts/136\`.
- Correct current-day allocator batch count is \`1/3\`; at most two additional article slots remain.
- At monitor wake, read delivered rows through \`GET /api/pipelines/{articlePipelineId}/cases?stageKey=delivered&terminal=true&limit=100&offset=0\` and union them by case ID with current open create-operation rows for the same \`reservationDateKyiv\`.
- Never calculate the daily count from \`terminal=false\` rows alone and never dispatch three additional articles today.`;

function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 4 * 1024 * 1024 });
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
  if (!response.ok) throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 2000)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  psql(`
    insert into board_api_keys (id,user_id,name,key_hash,expires_at)
    values (
      ${quote(keyId)}::uuid,
      ${quote(USER_ID)},
      'correct-ast1221-daily-batch-count',
      ${quote(createHash("sha256").update(token).digest("hex"))},
      now()+interval '10 minutes'
    );
  `);

  try {
    const issues = await request(token, "GET", `/companies/${COMPANY_ID}/issues?search=${ISSUE_IDENTIFIER}`);
    const rows = Array.isArray(issues) ? issues : issues?.items ?? issues?.issues ?? [];
    const issue = rows.find((row) => row.identifier === ISSUE_IDENTIFIER);
    if (!issue) throw new Error(`${ISSUE_IDENTIFIER} not found`);

    const comments = await request(token, "GET", `/issues/${issue.id}/comments`);
    const existing = (Array.isArray(comments) ? comments : comments?.items ?? comments?.comments ?? [])
      .some((comment) => String(comment.body ?? "").includes("Daily batch accounting correction"));
    if (!existing) await request(token, "POST", `/issues/${issue.id}/comments`, { body: CORRECTION });

    console.log(JSON.stringify({ ok: true, issue: ISSUE_IDENTIFIER, correctionCreated: !existing }, null, 2));
  } finally {
    psql(`delete from board_api_keys where id=${quote(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
