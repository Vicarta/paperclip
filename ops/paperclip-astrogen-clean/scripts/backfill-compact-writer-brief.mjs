#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const SOURCE_KEY = "brief";
const WRITER_KEY = "writer-brief";
const MAX_WRITER_BRIEF_CHARS = 48_000;

function usage() {
  console.error("Usage: backfill-compact-writer-brief.mjs --case-id <uuid> [--apply] [--rerun]");
  process.exit(2);
}

function run(command, args, input) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
  }
  return result.stdout.trim();
}

function psql(sql) {
  return run("sudo", [
    "docker", "exec", "-i", DB_CONTAINER,
    "psql", "-U", "paperclip", "-d", "paperclip",
    "-v", "ON_ERROR_STOP=1", "-At",
  ], sql);
}

function q(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function parseArgs() {
  const caseIndex = process.argv.indexOf("--case-id");
  if (caseIndex < 0) usage();
  const caseId = process.argv[caseIndex + 1];
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(caseId ?? "")) {
    usage();
  }
  return {
    caseId,
    apply: process.argv.includes("--apply"),
    rerun: process.argv.includes("--rerun"),
  };
}

function readSource(caseId) {
  const raw = psql(`
    select json_build_object(
      'caseId', c.id,
      'caseKey', c.case_key,
      'caseVersion', c.version,
      'stageKey', s.key,
      'terminalKind', c.terminal_kind,
      'sourceDocumentId', d.id,
      'sourceRevisionId', d.latest_revision_id,
      'sourceBody', d.latest_body
    )::text
    from pipeline_cases c
    join pipelines p on p.id=c.pipeline_id
    join pipeline_stages s on s.id=c.stage_id
    join pipeline_case_documents pcd
      on pcd.case_id=c.id
     and pcd.company_id=c.company_id
     and pcd.key=${q(SOURCE_KEY)}
    join documents d on d.id=pcd.document_id
    where c.id=${q(caseId)}::uuid
      and c.company_id=${q(COMPANY_ID)}::uuid
      and p.key='astrogen-article-production';
  `);
  if (!raw) throw new Error("Article case or canonical brief document was not found");
  return JSON.parse(raw);
}

function compactSection(section) {
  return Object.fromEntries([
    ["section_id", section.section_id],
    ["level", section.level],
    ["title", section.title],
    ["section_type", section.section_type],
    ["priority", section.priority],
    ["intent_covered", section.intent_covered],
    ["section_purpose", section.section_purpose],
    ["writer_instruction", section.writer_instruction],
    ["source_evidence", section.source_evidence],
    ["review_flags", section.review_flags],
  ].filter(([, value]) => value !== undefined));
}

function buildWriterBrief(source, sourceRevisionId) {
  const readerFacingSectionIds = Array.isArray(source.readerFacingSectionIds)
    ? source.readerFacingSectionIds.filter((value) => typeof value === "string")
    : [];
  if (readerFacingSectionIds.length === 0) {
    throw new Error("Canonical brief has no readerFacingSectionIds");
  }
  const allowedIds = new Set(readerFacingSectionIds);
  const sections = Array.isArray(source.sections)
    ? source.sections
      .filter((section) => section && allowedIds.has(section.section_id))
      .map(compactSection)
    : [];
  if (sections.length !== readerFacingSectionIds.length) {
    throw new Error(
      `Canonical brief reader-facing section mismatch: ids=${readerFacingSectionIds.length}, sections=${sections.length}`,
    );
  }
  return {
    schemaVersion: "astrogen.writer-brief.v1",
    documentRole: "writerBrief",
    sourceBriefRevisionId: sourceRevisionId,
    briefContractVersion: source.briefContractVersion ?? null,
    case: source.case ?? null,
    status: source.status ?? null,
    lockedBasics: source.lockedBasics ?? null,
    searchAndDemand: source.searchAndDemand ?? null,
    curriculumScope: source.curriculumScope ?? null,
    informationGain: source.informationGain ?? [],
    historicalContextNote: source.historicalContextNote ?? null,
    selectedReaderValueUnits: source.selectedReaderValueUnits ?? [],
    valueUnitFitProof: source.valueUnitFitProof ?? [],
    sourceEvidenceBoundaries: source.sourceEvidenceBoundaries ?? null,
    ctaAndLinks: source.ctaAndLinks ?? null,
    avoidFromSerpAndValueGap: source.avoidFromSerpAndValueGap ?? [],
    readerFacingSectionIds,
    sections,
  };
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
  if (!response.ok) {
    throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 1200)}`);
  }
  return parsed;
}

function documentIdentity(response) {
  const document = response?.document ?? response?.caseDocument ?? response;
  const revision = response?.revision ?? document?.revision ?? null;
  const documentId = document?.id ?? response?.documentId;
  const revisionId = revision?.id ?? response?.revisionId;
  if (typeof documentId !== "string" || typeof revisionId !== "string") {
    throw new Error("Case document response did not return document and revision IDs");
  }
  return { documentId, revisionId };
}

async function main() {
  const { caseId, apply, rerun } = parseArgs();
  if (rerun && !apply) throw new Error("--rerun requires --apply");
  const sourceRow = readSource(caseId);
  if (sourceRow.terminalKind) throw new Error(`Refusing terminal case ${sourceRow.caseKey}`);
  if (sourceRow.stageKey !== "draft") {
    throw new Error(`Expected current stage draft, found ${sourceRow.stageKey}`);
  }
  const source = JSON.parse(sourceRow.sourceBody);
  const writerBrief = buildWriterBrief(source, sourceRow.sourceRevisionId);
  const body = JSON.stringify(writerBrief);
  const bodyChars = body.length;
  if (bodyChars > MAX_WRITER_BRIEF_CHARS) {
    throw new Error(`Compact writer brief is still too large: ${bodyChars} > ${MAX_WRITER_BRIEF_CHARS}`);
  }
  const planned = {
    mode: apply ? "apply" : "dry-run",
    caseId,
    caseKey: sourceRow.caseKey,
    sourceRevisionId: sourceRow.sourceRevisionId,
    sourceChars: sourceRow.sourceBody.length,
    writerBriefChars: bodyChars,
    readerFacingSectionCount: writerBrief.sections.length,
    rerun,
  };
  if (!apply) {
    console.log(JSON.stringify(planned, null, 2));
    return;
  }

  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const keyHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${q(keyId)}::uuid, ${q(USER_ID)}, 'compact-writer-brief-backfill',
      ${q(keyHash)}, now() + interval '20 minutes');
  `);

  try {
    const backup = await request(token, "POST", "/instance/database-backups", {});
    const existing = await request(token, "GET", `/cases/${caseId}/documents/${WRITER_KEY}`).catch((error) => {
      if (String(error).includes("returned 404")) return null;
      throw error;
    });
    const existingDocument = existing?.document ?? existing?.caseDocument ?? existing;
    const written = await request(token, "PUT", `/cases/${caseId}/documents/${WRITER_KEY}`, {
      title: "Compact writer brief",
      format: "json",
      body,
      changeSummary: "Created bounded writer-only projection from canonical brief",
      ...(existingDocument?.latestRevisionId
        ? { baseRevisionId: existingDocument.latestRevisionId }
        : {}),
    });
    const identity = documentIdentity(written);
    const latest = await request(token, "GET", `/cases/${caseId}`);
    const latestCase = latest?.case ?? latest;
    const updated = await request(token, "PATCH", `/cases/${caseId}`, {
      expectedVersion: latestCase.version,
      fieldPatch: {
        writerBriefDocumentKey: WRITER_KEY,
        writerBriefDocumentId: identity.documentId,
        writerBriefRevisionId: identity.revisionId,
        writerBriefChars: bodyChars,
        writerBriefContractVersion: "astrogen.writer-brief.v1",
      },
    });
    const rerunResult = rerun
      ? await request(token, "POST", `/cases/${caseId}/automation/current-stage/rerun`)
      : null;
    console.log(JSON.stringify({
      ...planned,
      backup: {
        filename: backup?.filename ?? null,
        sizeBytes: backup?.sizeBytes ?? null,
      },
      writerBriefDocumentId: identity.documentId,
      writerBriefRevisionId: identity.revisionId,
      caseVersion: (updated?.case ?? updated)?.version ?? null,
      automationStatus: rerunResult?.automationExecution?.status ?? null,
    }, null, 2));
  } finally {
    psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
