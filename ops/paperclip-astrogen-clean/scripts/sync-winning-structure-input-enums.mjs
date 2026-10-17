#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const STRATEGY_INPUT_ROUTINE_ID = "0658be4f-9338-4a79-b85a-71c19d49a823";
const MARKER = "## Winning Structure strict input enums";

const ADDENDUM = `${MARKER}

For every existing CMS draft, refresh, repair, or before-after revision, task.page_mode is exactly existing. Use new only when no target page exists. editorial_constraints is always a JSON list of strings, never an object.

reader_value_evidence.evidence_type must be exactly one of: official_documentation, expert_observation, original_test, original_visual, anonymized_case, support_data, internal_analytics, business_evidence, aggregated_community_pattern.

manual_value_commitments.asset_type must be exactly one of: original_test, original_screenshot, original_video, expert_review, first_party_data, anonymized_case, non_serp_research, other.

Map local source labels to the nearest truthful allowed enum while preserving the detailed source in source/title/summary. Never mint a custom enum. Before transitioning, parse the document and confirm these shapes locally; remote validate_task_input remains the authority.`;

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

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function psql(sql) {
  return run("sudo", [
    "docker", "exec", "-i", DB_CONTAINER,
    "psql", "-U", "paperclip", "-d", "paperclip", "-v", "ON_ERROR_STOP=1", "-At",
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
  if (!response.ok) throw new Error(`${method} ${pathname} returned ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const keyHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id,user_id,name,key_hash,expires_at)
    values (${quote(keyId)}::uuid,${quote(USER_ID)},'sync-winning-structure-input-enums',${quote(keyHash)},now()+interval '15 minutes');
  `);

  try {
    const backup = await request(token, "POST", "/instance/database-backups", {});
    const routine = await request(token, "GET", `/routines/${STRATEGY_INPUT_ROUTINE_ID}`);
    const current = routine.description ?? "";
    if (current.includes(MARKER)) {
      console.log(JSON.stringify({ ok: true, changed: false, backup }, null, 2));
      return;
    }
    const updated = await request(token, "PATCH", `/routines/${STRATEGY_INPUT_ROUTINE_ID}`, {
      description: `${current.trim()}\n\n${ADDENDUM}`.trim(),
      baseRevisionId: routine.latestRevisionId,
    });
    console.log(JSON.stringify({
      ok: true,
      changed: true,
      backup: { backupDir: backup.backupDir, sizeBytes: backup.sizeBytes },
      routineId: STRATEGY_INPUT_ROUTINE_ID,
      revision: updated.latestRevisionNumber,
    }, null, 2));
  } finally {
    psql(`update board_api_keys set revoked_at=now(),last_used_at=now() where id=${quote(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
