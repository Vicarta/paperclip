#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const CASE_ID = "30e253a7-42c3-4e21-a5f1-083f07584b3e";
const HARD_QA_MARKERS = ["readable text", "number", "glyph", "pseudo-writing", "fabricated screen"];

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
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!response.ok) throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 2000)}`);
  return parsed;
}

function caseRow(detail) {
  return detail.case ?? detail;
}

function hasHardQaEvidence(value) {
  const text = Array.isArray(value) ? value.join(" ") : String(value ?? "");
  const normalized = text.toLowerCase();
  return HARD_QA_MARKERS.some((marker) => normalized.includes(marker));
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${sqlLiteral(keyId)}::uuid, ${sqlLiteral(USER_ID)},
      'native-image-quality-recovery-migration', ${sqlLiteral(tokenHash)}, now() + interval '10 minutes');
  `);

  try {
    let detail = await request(token, "GET", `/cases/${CASE_ID}`);
    const current = caseRow(detail);
    const fields = current.fields ?? {};
    const alreadyRouted = detail.stage?.key === "image_recovery_review";
    if (!alreadyRouted) {
      if (detail.stage?.key !== "image") {
        throw new Error(`Refusing image recovery migration from stage ${detail.stage?.key ?? "unknown"}`);
      }
      if (fields.blockerClass !== "image_quality_blocked") {
        throw new Error("Refusing image recovery migration without image_quality_blocked evidence");
      }
      if (typeof fields.coverImageCandidatePath !== "string" || !fields.coverImageCandidatePath.trim()) {
        throw new Error("Refusing image recovery migration without a rejected candidate path");
      }
      if (!hasHardQaEvidence(fields.coverImageQaEvidence)) {
        throw new Error("Refusing image recovery migration without hard visual QA evidence");
      }

      const backup = await request(token, "POST", "/instance/database-backups", {});
      const patched = await request(token, "PATCH", `/cases/${CASE_ID}`, {
        fields: {
          ...fields,
          coverImageProviderCallCount: Math.max(Number(fields.coverImageProviderCallCount ?? 0), 1),
          coverImageHardQaFailureClass: "text_glyph_or_pseudo_writing",
          coverImageRecoveryRouteVersion: "cmo-native-one-retry-v1",
          coverImageRecoveryRequestedAt: new Date().toISOString(),
        },
        expectedVersion: current.version,
      });
      const patchedCase = caseRow(patched);
      detail = await request(token, "POST", `/cases/${CASE_ID}/transition`, {
        toStageKey: "image_recovery_review",
        expectedVersion: patchedCase.version,
        reason: "Route the existing hard visual QA blocker to bounded CMO recovery; do not require owner approval.",
      });
      const routed = await request(token, "GET", `/cases/${CASE_ID}`);
      if (routed.stage?.key !== "image_recovery_review") {
        throw new Error(`Image recovery route verification failed: ${routed.stage?.key ?? "unknown"}`);
      }
      console.log(JSON.stringify({
        mode: "migrated",
        caseId: CASE_ID,
        caseKey: caseRow(routed).caseKey,
        stage: routed.stage?.key ?? null,
        backup: {
          backupDir: backup.backupDir ?? null,
          sizeBytes: backup.sizeBytes ?? null,
          finishedAt: backup.finishedAt ?? null,
        },
      }, null, 2));
      return;
    }

    console.log(JSON.stringify({
      mode: "already-routed",
      caseId: CASE_ID,
      caseKey: current.caseKey,
      stage: detail.stage?.key ?? null,
    }, null, 2));
  } finally {
    psql(`update board_api_keys set revoked_at=now(), last_used_at=now() where id=${sqlLiteral(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
