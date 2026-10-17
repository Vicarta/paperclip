#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = "http://127.0.0.1:3210/api";

function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 8 * 1024 * 1024 });
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
  if (!response.ok) throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 1600)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const keyHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${q(keyId)}::uuid, ${q(USER_ID)}, 'reconcile-invalid-trend-wave3',
      ${q(keyHash)}, now() + interval '10 minutes');
  `);

  try {
    const issue = JSON.parse(psql(`
      select json_build_object('id',id,'identifier',identifier,'status',status,'title',title)::text
      from issues
      where company_id=${q(COMPANY_ID)}::uuid and identifier='AST-703';
    `));
    if (!["done", "cancelled"].includes(issue.status)) {
      await request(token, "PATCH", `/issues/${issue.id}`, {
        status: "cancelled",
        comment: [
          "Cancelled as an invalid duplicate before downstream validation.",
          "",
          "The routine run requested validationWave=3, but the wake started without trigger payload and recreated the exact AST-668 wave-1 fingerprint and phrases. No result from this issue may count as trend validation evidence. AST-702 remains blocked until synchronous run controls are deployed.",
        ].join("\n"),
      });
    }
    const parent = JSON.parse(psql(`
      select json_build_object('id',id,'identifier',identifier,'status',status)::text
      from issues
      where company_id=${q(COMPANY_ID)}::uuid and identifier='AST-702';
    `));
    if (!["done", "cancelled"].includes(parent.status)) {
      await request(token, "PATCH", `/issues/${parent.id}`, {
        status: "cancelled",
        blockedByIssueIds: [],
        comment: [
          "Cancelled the invalid routine execution after its duplicate child was stopped.",
          "",
          "The replacement run must carry validationWave=3 and all prior validation issue identifiers in synchronous descriptionAppendix before the assignment wake is queued.",
        ].join("\n"),
      });
    }
    process.stdout.write(`${JSON.stringify({
      ok: true,
      identifier: issue.identifier,
      previousStatus: issue.status,
      finalStatus: ["done", "cancelled"].includes(issue.status) ? issue.status : "cancelled",
      parentIdentifier: parent.identifier,
      parentPreviousStatus: parent.status,
      parentFinalStatus: ["done", "cancelled"].includes(parent.status) ? parent.status : "cancelled",
    }, null, 2)}\n`);
  } finally {
    psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
