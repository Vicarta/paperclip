#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";

const args = process.argv.slice(2);
const caseId = args[args.indexOf("--case-id") + 1];
const apply = args.includes("--apply");

if (!caseId || !/^[0-9a-f-]{36}$/i.test(caseId)) {
  throw new Error("Usage: rerun-native-case-stage.mjs --case-id <uuid> [--apply]");
}

function run(command, commandArgs, input) {
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    input,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
  }
  return result.stdout.trim();
}

function q(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function psql(sql) {
  return run("sudo", [
    "docker", "exec", "-i", DB_CONTAINER,
    "psql", "-U", "paperclip", "-d", "paperclip",
    "-v", "ON_ERROR_STOP=1", "-At",
  ], sql);
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
  if (!response.ok) {
    throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 2000)}`);
  }
  return text ? JSON.parse(text) : null;
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${q(keyId)}::uuid, ${q(USER_ID)}, 'native-case-stage-rerun',
      ${q(tokenHash)}, now() + interval '10 minutes');
  `);

  try {
    const detail = await request(token, "GET", `/cases/${caseId}`);
    const pipelineCase = detail.case ?? detail;
    const stage = detail.stage ?? null;
    const summary = {
      caseId,
      caseKey: pipelineCase.caseKey,
      stageKey: stage?.key ?? pipelineCase.stageKey ?? null,
      version: pipelineCase.version,
    };
    if (!apply) {
      console.log(JSON.stringify({ mode: "dry-run", ...summary }, null, 2));
      return;
    }

    const backup = await request(token, "POST", "/instance/database-backups", {});
    const rerun = await request(
      token,
      "POST",
      `/cases/${caseId}/automation/current-stage/rerun`,
      { expectedVersion: pipelineCase.version },
    );
    console.log(JSON.stringify({
      mode: "apply",
      ...summary,
      backup: {
        filename: backup.filename ?? null,
        sizeBytes: backup.sizeBytes ?? null,
      },
      automationStatus: rerun.status ?? rerun.automation?.status ?? null,
      automationIssueId: rerun.issueId ?? rerun.automation?.issueId ?? null,
    }, null, 2));
  } finally {
    psql(`
      update board_api_keys
      set revoked_at = now(), last_used_at = now()
      where id = ${q(keyId)}::uuid;
    `);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
