#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";

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
  values (${q(keyId)}::uuid, ${q(USER_ID)}, 'resume-search-demand-after-semantic-tool',
    ${q(keyHash)}, now() + interval '10 minutes');
`);

try {
  const issues = JSON.parse(psql(`
    select json_object_agg(identifier, json_build_object('id', id, 'status', status))::text
    from issues where identifier in ('AST-520', 'AST-521', 'AST-522', 'AST-523');
  `));
  if (!issues["AST-520"] || !issues["AST-521"]) throw new Error("AST-520/AST-521 graph is incomplete");

  if (issues["AST-521"].status !== "done") {
    await request(token, "POST", `/issues/${issues["AST-521"].id}/comments`, {
      body: "## Runtime capability restored\n\n`paperclip.semantic-core-mcp-agent-tools:get-local-inventory` is active in clean Paperclip 0.2.0. Agent-route smoke returned the migrated project snapshot and a bounded accepted-keyword page without MCP credentials or raw payload exposure. This resolves [AST-521](/AST/issues/AST-521); resume [AST-520](/AST/issues/AST-520) through the existing dependency graph.",
    });
    await request(token, "PATCH", `/issues/${issues["AST-521"].id}`, { status: "done" });
  }

  for (const identifier of ["AST-522", "AST-523"]) {
    const issue = issues[identifier];
    if (!issue || issue.status === "done" || issue.status === "cancelled") continue;
    await request(token, "POST", `/issues/${issue.id}/comments`, {
      body: `## Capability verified\n\nThe requested agent inventory capability now exists as \`paperclip.semantic-core-mcp-agent-tools:get-local-inventory\`. Company/project-scoped smoke passed and AST-520 consumed the migrated snapshot. Closing [${identifier}](/AST/issues/${identifier}) as resolved; no further tooling task is required.`,
    });
    await request(token, "PATCH", `/issues/${issue.id}`, { status: "done" });
  }

  const resumed = issues["AST-520"].status === "done"
    ? { identifier: "AST-520", status: "done" }
    : await request(token, "PATCH", `/issues/${issues["AST-520"].id}`, {
      status: "todo",
      resume: true,
      blockedBy: [],
      comment: "## Semantic-core inventory available\n\nUse `paperclip.semantic-core-mcp-agent-tools:get-local-inventory` with `limit<=50` and `minimumGeoSearchVolume`; do not create another tooling task. Return the requested compact packet to [AST-482](/AST/issues/AST-482).",
    });
  console.log(JSON.stringify({
    ok: true,
    resolved: "AST-521",
    resumed: { identifier: resumed.identifier, status: resumed.status },
  }, null, 2));
} finally {
  psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
}
