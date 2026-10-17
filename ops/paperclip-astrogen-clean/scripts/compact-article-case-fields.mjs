#!/usr/bin/env node
/**
 * One-time, auditable migration for an oversized active article case.
 *
 * The Paperclip case API correctly rejects fields above 64 KiB. Older article
 * runs copied full Winning Structure artifacts into fields, so they can no
 * longer write delivery proof. This migration first writes those artifacts to
 * a durable case document through the native API, then atomically replaces
 * only the explicit bulky keys with compact document references in Postgres.
 * It is intentionally not a generic field deleter.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const ARCHIVE_KEY = "winning-structure-inline-field-archive-v1";
const MIN_FIELD_BYTES = 48 * 1024;
const ARCHIVABLE_KEYS = new Set([
  "contentQualityRequirements",
  "publicationRequirements",
  "winningStructureSections",
  "winningStructureAddedValuePlans",
  "winningStructureCost",
  "winningStructureProvenance",
  "winningStructureQualityFlags",
  "winningStructureSerpSummary",
  "selectedValueUnits",
  "selectedValueUnitMappings",
  "publicationBlockerCommitments",
]);

function usage() {
  console.error("Usage: compact-article-case-fields.mjs --case-id <uuid> [--apply]");
  process.exit(2);
}

function run(command, args, input) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input,
    maxBuffer: 32 * 1024 * 1024,
  });
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

function jsonSize(value) {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function parseArgs() {
  const caseIndex = process.argv.indexOf("--case-id");
  if (caseIndex < 0) usage();
  const caseId = process.argv[caseIndex + 1];
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(caseId ?? "")) {
    usage();
  }
  return { caseId, apply: process.argv.includes("--apply") };
}

function readCase(caseId) {
  const raw = psql(`
    select json_build_object(
      'id', c.id,
      'companyId', c.company_id,
      'version', c.version,
      'caseKey', c.case_key,
      'stageKey', s.key,
      'terminalKind', c.terminal_kind,
      'fields', c.fields,
      'fieldBytes', octet_length(c.fields::text)
    )::text
    from pipeline_cases c
    join pipeline_stages s on s.id=c.stage_id
    join pipelines p on p.id=c.pipeline_id
    where c.id=${sqlLiteral(caseId)}::uuid
      and c.company_id=${sqlLiteral(COMPANY_ID)}::uuid
      and p.key='astrogen-article-production';
  `);
  if (!raw) throw new Error("Article case was not found in clean Astrogen");
  return JSON.parse(raw);
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
  if (!response.ok) throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 1000)}`);
  return parsed;
}

function selectArchive(caseRow) {
  const entries = Object.entries(caseRow.fields ?? {})
    .filter(([key]) => ARCHIVABLE_KEYS.has(key))
    .filter(([, value]) => jsonSize(value) > 1024);
  if (entries.length === 0) throw new Error("No approved oversized Winning Structure fields are available to archive");
  return Object.fromEntries(entries);
}

function documentIdentity(response) {
  const document = response?.document ?? response?.caseDocument ?? response;
  const revision = response?.revision ?? document?.revision ?? null;
  const id = document?.id ?? response?.documentId;
  const revisionId = revision?.id ?? response?.revisionId;
  if (typeof id !== "string" || typeof revisionId !== "string") {
    throw new Error("Case document response did not return a document and revision identity");
  }
  return { id, revisionId };
}

async function main() {
  const { caseId, apply } = parseArgs();
  const caseRow = readCase(caseId);
  if (caseRow.fieldBytes < MIN_FIELD_BYTES) {
    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", skipped: "below_compaction_threshold", caseId, fieldBytes: caseRow.fieldBytes }, null, 2));
    return;
  }
  if (!["cmo_delivery", "delivered"].includes(caseRow.stageKey)) {
    throw new Error(`Refusing compaction outside cmo_delivery/delivered; current stage is ${caseRow.stageKey}`);
  }
  const archiveFields = selectArchive(caseRow);
  const planned = {
    mode: apply ? "apply" : "dry-run",
    caseId,
    caseKey: caseRow.caseKey,
    stageKey: caseRow.stageKey,
    beforeBytes: caseRow.fieldBytes,
    archiveKeys: Object.keys(archiveFields),
    archiveBytes: jsonSize(archiveFields),
  };
  if (!apply) {
    console.log(JSON.stringify(planned, null, 2));
    return;
  }

  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${sqlLiteral(keyId)}::uuid, ${sqlLiteral(USER_ID)},
      'article-case-field-compaction', ${sqlLiteral(tokenHash)}, now() + interval '20 minutes');
  `);

  try {
    const backup = await request(token, "POST", "/instance/database-backups", {});
    const existing = await request(token, "GET", `/cases/${caseId}/documents/${ARCHIVE_KEY}`).catch((error) => {
      if (String(error).includes("returned 404")) return null;
      throw error;
    });
    if (existing) throw new Error(`Refusing to overwrite existing archive document ${ARCHIVE_KEY}`);

    const archiveBody = JSON.stringify({
      schemaVersion: "astrogen.article-case-field-archive.v1",
      archivedAt: new Date().toISOString(),
      reason: "Move legacy inline Winning Structure payloads out of bounded pipeline case fields",
      sourceCaseId: caseId,
      sourceCaseVersion: caseRow.version,
      sourceFieldBytes: caseRow.fieldBytes,
      archivedFields: archiveFields,
    }, null, 2);
    const written = await request(token, "PUT", `/cases/${caseId}/documents/${ARCHIVE_KEY}`, {
      title: "Archived inline Winning Structure payloads",
      format: "markdown",
      body: archiveBody,
      changeSummary: "Archived legacy oversized inline fields before delivery completion",
    });
    const document = documentIdentity(written);

    const latest = readCase(caseId);
    if (latest.version !== caseRow.version) {
      throw new Error(`Case changed during document archival (${caseRow.version} -> ${latest.version}); no field mutation applied`);
    }
    const nextFields = { ...(latest.fields ?? {}) };
    for (const key of Object.keys(archiveFields)) delete nextFields[key];
    Object.assign(nextFields, {
      winningStructureInlineFieldArchiveDocumentKey: ARCHIVE_KEY,
      winningStructureInlineFieldArchiveDocumentId: document.id,
      winningStructureInlineFieldArchiveRevisionId: document.revisionId,
      caseFieldBudgetVersion: "astrogen-article-case-fields-v1",
      caseFieldBudgetCompactedAt: new Date().toISOString(),
      caseFieldBudgetBytesBeforeCompaction: latest.fieldBytes,
    });
    const nextBytes = jsonSize(nextFields);
    if (nextBytes >= MIN_FIELD_BYTES || nextBytes > 64 * 1024) {
      throw new Error(`Compaction did not reach the safe case-field budget (${nextBytes} bytes)`);
    }
    const changedFieldKeys = [...Object.keys(archiveFields),
      "winningStructureInlineFieldArchiveDocumentKey",
      "winningStructureInlineFieldArchiveDocumentId",
      "winningStructureInlineFieldArchiveRevisionId",
      "caseFieldBudgetVersion",
      "caseFieldBudgetCompactedAt",
      "caseFieldBudgetBytesBeforeCompaction",
    ].sort();
    const eventPayload = JSON.stringify({
      version: latest.version + 1,
      previousVersion: latest.version,
      changedFieldKeys,
      reviewMaterialChanged: false,
      systemMaintenance: "astrogen_article_case_field_compaction_v1",
      archiveDocumentKey: ARCHIVE_KEY,
      archiveDocumentId: document.id,
      beforeBytes: latest.fieldBytes,
      afterBytes: nextBytes,
    });
    const result = psql(`
      with updated as (
        update pipeline_cases
        set fields=${sqlLiteral(JSON.stringify(nextFields))}::jsonb,
            version=version+1,
            updated_at=now()
        where id=${sqlLiteral(caseId)}::uuid
          and company_id=${sqlLiteral(COMPANY_ID)}::uuid
          and version=${Number(latest.version)}
        returning id, company_id, version, updated_at
      ), event_written as (
        insert into pipeline_case_events (
          id, company_id, case_id, type, actor_type, payload, created_at, updated_at
        )
        select gen_random_uuid(), company_id, id, 'updated', 'system',
          ${sqlLiteral(eventPayload)}::jsonb, updated_at, updated_at
        from updated
        returning case_id
      )
      select json_build_object('version', u.version, 'updatedAt', u.updated_at)::text
      from updated u join event_written e on e.case_id=u.id;
    `);
    if (!result) throw new Error("Case field compaction lost its version race; archive document is retained for audit");
    console.log(JSON.stringify({ ...planned, backup, document, after: JSON.parse(result), afterBytes: nextBytes }, null, 2));
  } finally {
    psql(`update board_api_keys set revoked_at=now(), last_used_at=now() where id=${sqlLiteral(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
