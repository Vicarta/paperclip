#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const CASE_ID = "30e253a7-42c3-4e21-a5f1-083f07584b3e";
const RECOVERY_POLICY = {
  articleType: "zodiac_profile",
  cmsCategorySlug: "astrologiya",
  cmsCategoryTitle: "Астрологія",
};
const RECOVERABLE_BLOCKERS = new Set([
  "cms_category_resolution_failed",
  "cms_relation_policy_missing",
]);

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
  if (!response.ok) throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 2000)}`);
  return text ? JSON.parse(text) : null;
}

function caseRow(detail) {
  return detail.case ?? detail;
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${sqlLiteral(keyId)}::uuid, ${sqlLiteral(USER_ID)},
      'cms-relation-recovery-resume', ${sqlLiteral(tokenHash)}, now() + interval '10 minutes');
  `);

  try {
    const detail = await request(token, "GET", `/cases/${CASE_ID}`);
    const current = caseRow(detail);
    const fields = current.fields ?? {};
    if (detail.stage?.key !== "cms_draft") {
      throw new Error(`Refusing CMS relation recovery from stage ${detail.stage?.key ?? "unknown"}`);
    }
    if (!RECOVERABLE_BLOCKERS.has(fields.blockerClass)) {
      throw new Error(`Refusing CMS relation recovery for blocker ${String(fields.blockerClass ?? "none")}`);
    }
    if (fields.articleType !== RECOVERY_POLICY.articleType) {
      throw new Error(`Refusing CMS relation recovery for article type ${String(fields.articleType ?? "none")}`);
    }

    const backup = await request(token, "POST", "/instance/database-backups", {});
    const patched = await request(token, "PATCH", `/cases/${CASE_ID}`, {
      fields: {
        ...fields,
        ...RECOVERY_POLICY,
        blockerClass: null,
        nextReviewAt: null,
        cmsDraftStatus: "pending",
        cmsRelationPolicyVersion: "astrogen-cms-delivery-v1",
        cmsRelationRecoveryVersion: "company-scoped-relation-resolver-v1",
        cmsRelationRecoveryRequestedAt: new Date().toISOString(),
        cmsRelationRecoveryReason: "The company CMS policy now resolves the Astrogen author and article-type category before one draft create request.",
      },
      expectedVersion: current.version,
    });
    const rerun = await request(token, "POST", `/cases/${CASE_ID}/automation/current-stage/rerun`);
    const verified = await request(token, "GET", `/cases/${CASE_ID}`);
    if (verified.stage?.key !== "cms_draft" || caseRow(verified).fields?.blockerClass != null) {
      throw new Error("CMS relation recovery did not leave the case runnable at cms_draft");
    }
    console.log(JSON.stringify({
      mode: "resumed",
      caseId: CASE_ID,
      caseKey: caseRow(verified).caseKey,
      stage: verified.stage?.key ?? null,
      priorVersion: current.version,
      version: caseRow(verified).version,
      automationExecution: rerun.automationExecution?.status ?? null,
      backup: {
        filename: backup.filename ?? null,
        sizeBytes: backup.sizeBytes ?? null,
        finishedAt: backup.finishedAt ?? null,
      },
    }, null, 2));
  } finally {
    psql(`update board_api_keys set revoked_at=now(), last_used_at=now() where id=${sqlLiteral(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
