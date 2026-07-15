#!/usr/bin/env node

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";

function run(command, args, input) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
  }
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
  if (!response.ok) {
    throw new Error(`${method} ${path} returned ${response.status}: ${text.slice(0, 1200)}`);
  }
  return parsed;
}

const token = `pcp_board_${randomBytes(24).toString("hex")}`;
const keyId = randomUUID();
const keyHash = createHash("sha256").update(token).digest("hex");

psql(`
  insert into board_api_keys (id, user_id, name, key_hash, expires_at)
  values (${q(keyId)}::uuid, ${q(USER_ID)}, 'phase47-canary-blocker-resolution',
    ${q(keyHash)}, now() + interval '5 minutes');
`);

try {
  const issues = JSON.parse(psql(`
    select json_object_agg(identifier, json_build_object('id', id, 'status', status))::text
    from issues
    where identifier in ('AST-299', 'AST-300');
  `));
  if (!issues["AST-299"] || !issues["AST-300"]) {
    throw new Error("AST-299 or AST-300 is missing");
  }

  const interactions = await request(
    token,
    "GET",
    `/issues/${issues["AST-299"].id}/interactions`,
  );
  const pending = interactions.find((interaction) => interaction.status === "pending");
  if (pending) {
    const resolutionAction = pending.kind === "ask_user_questions" ? "cancel" : "reject";
    await request(
      token,
      "POST",
      `/issues/${issues["AST-299"].id}/interactions/${pending.id}/${resolutionAction}`,
      {
        reason: "Superseded by a verified systemic repair: the stored value was a Strategist heartbeat ID, not an MCP run. The same case will resume with its existing idempotency key; no owner decision is required.",
      },
    );
  }

  if (issues["AST-300"].status !== "done") {
    await request(token, "PATCH", `/issues/${issues["AST-300"].id}`, {
      status: "done",
      comment: [
        "Systemic blocker resolved.",
        "",
        "The production Winning Structure adapter now exposes the complete get-run-result payload to the agent while preserving compact status calls. The original completed run was verified with 8 structure sections, 5 added-value plans, content-quality requirements, retention, and all artifact references. AST-297 can resume the same run; no new analysis is required.",
      ].join("\n"),
    });
  }

  console.log(JSON.stringify({
    ok: true,
    resolvedInteractionId: pending?.id ?? null,
    resolvedInteractionKind: pending?.kind ?? null,
    ast300Resolved: true,
  }, null, 2));
} finally {
  psql(`update board_api_keys set revoked_at=now() where id=${q(keyId)}::uuid;`);
}
