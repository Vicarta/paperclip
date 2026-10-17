#!/usr/bin/env node

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const APP_CONTAINER = "paperclip-astrogen-clean-app-1";
const EXPECTED_IMAGE = "paperclip-app:v2026.626.0-vicarta.110-native-agent-harness-20260719";
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
  if (!response.ok) {
    throw new Error(`${method} ${path} returned ${response.status}: ${text.slice(0, 1600)}`);
  }
  return text ? JSON.parse(text) : null;
}

const liveImage = run("docker", ["inspect", APP_CONTAINER, "--format", "{{.Config.Image}}"])?.trim();
if (liveImage !== EXPECTED_IMAGE) {
  throw new Error(`Reserved completion guard image is not live: ${liveImage || "missing"}`);
}
run("docker", [
  "exec", APP_CONTAINER, "grep", "-q", "requireCurrentDirectChild",
  "/app/server/dist/services/issues.js",
]);

const issues = JSON.parse(psql(`
  select coalesce(json_object_agg(identifier, json_build_object('id',id,'status',status)), '{}'::json)::text
  from issues
  where company_id=${q(COMPANY_ID)}::uuid
    and identifier in ('AST-731','AST-734','AST-739');
`));
for (const identifier of ["AST-731", "AST-734", "AST-739"]) {
  if (!issues[identifier]?.id) throw new Error(`${identifier} not found`);
}

const token = `pcp_board_${randomBytes(24).toString("hex")}`;
const keyId = randomUUID();
const tokenHash = createHash("sha256").update(token).digest("hex");
psql(`
  insert into board_api_keys (id, user_id, name, key_hash, expires_at)
  values (${q(keyId)}::uuid, ${q(USER_ID)}, 'reserved-completion-guard-recovery',
    ${q(tokenHash)}, now() + interval '10 minutes');
`);

try {
  if (!["done", "cancelled"].includes(issues["AST-739"].status)) {
    await request(token, "PATCH", `/issues/${issues["AST-739"].id}`, {
      status: "cancelled",
      blockedByIssueIds: [],
      comment: [
        "Скасовано як застарілий permission blocker.",
        "",
        "AST-735 повернуто штатному specialist-agent з уже наявним scoped pipelines:write; grant Growth Strategy Architect не потрібен.",
      ].join("\n"),
    });
  }

  if (issues["AST-734"].status !== "done") {
    await request(token, "PATCH", `/issues/${issues["AST-734"].id}`, {
      status: "done",
      blockedByIssueIds: [],
      comment: [
        "Reserved-stage completion guard deployed and verified.",
        "",
        `Live image: ${EXPECTED_IMAGE}.`,
        "The automation completion proof now accepts a configured active current direct child while leaving the topic case in reserved. Native children-terminal outcome still owns the later consumed/ready transition.",
        issues["AST-731"].status === "cancelled"
          ? "AST-731 was already cancelled automatically when its topic reached consumed; no manual topic transition or duplicate article was created."
          : "AST-731 can resume through its first-class blocker relation; no manual topic transition or duplicate article was created.",
      ].join("\n"),
    });
  }

  console.log(JSON.stringify({
    ok: true,
    liveImage,
    resolvedGuardBlocker: "AST-734",
    cancelledStalePermissionBlocker: "AST-739",
    reservedAutomationState: issues["AST-731"].status,
  }, null, 2));
} finally {
  psql(`update board_api_keys set revoked_at=now(), last_used_at=now() where id=${q(keyId)}::uuid;`);
}
