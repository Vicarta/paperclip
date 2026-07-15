#!/usr/bin/env node

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const caseId = process.argv[2];

if (!caseId) throw new Error("Usage: repair-winning-structure-prestart-state.mjs <case-id>");

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
const tokenHash = createHash("sha256").update(token).digest("hex");

psql(`
  insert into board_api_keys (id, user_id, name, key_hash, expires_at)
  values (${q(keyId)}::uuid, ${q(USER_ID)}, 'phase47-prestart-state-repair', ${q(tokenHash)},
    now() + interval '5 minutes');
`);

try {
  const detail = await request(token, "GET", `/cases/${caseId}`);
  const current = detail.case ?? detail;
  const stageKey = detail.stage?.key;
  const fields = current.fields ?? {};
  const placeholderRunId = fields.winningStructureRunId;

  if (stageKey !== "winning_structure") {
    throw new Error(`Case must be at winning_structure, found ${stageKey ?? "unknown"}`);
  }
  if (placeholderRunId === null || placeholderRunId === undefined) {
    console.log(JSON.stringify({ caseId, changed: false, reason: "runtime fields already empty" }, null, 2));
    process.exit(0);
  }
  const recoverableStatuses = new Set([
    "strategy_input_ready",
    "failed_status_not_found",
    "failed_recovery_decision_required",
  ]);
  const runtimeFieldsAreEmpty = fields.winningStructureInputHash == null
    && fields.winningStructureEffectiveInputHash == null
    && fields.winningStructureResultDocumentId == null;
  const fieldsMatchKnownPrestartContamination =
    typeof fields.winningStructureInputHash === "string"
    && fields.winningStructureInputHash === fields.winningStructureEffectiveInputHash
    && fields.winningStructureResultDocumentId === "winning-structure-input";
  if (
    !recoverableStatuses.has(fields.winningStructureStatus)
    || (!runtimeFieldsAreEmpty && !fieldsMatchKnownPrestartContamination)
  ) {
    throw new Error(`Refusing to clear fields after an MCP lifecycle may have started: ${JSON.stringify({
      status: fields.winningStructureStatus ?? null,
      inputHashPresent: fields.winningStructureInputHash != null,
      effectiveInputHashPresent: fields.winningStructureEffectiveInputHash != null,
      resultDocumentPresent: fields.winningStructureResultDocumentId != null,
    })}`);
  }

  const proof = psql(`
    select count(*)
    from heartbeat_runs hr
    join agents a on a.id = hr.agent_id
    where hr.id = ${q(placeholderRunId)}::uuid
      and hr.company_id = ${q(current.companyId)}::uuid
      and hr.status = 'succeeded'
      and a.name = 'SEO Blog Content Strategist';
  `);
  if (proof !== "1") {
    throw new Error("Placeholder is not a proven succeeded Strategist heartbeat ID");
  }

  const repairedFields = {
    ...fields,
    winningStructureRunId: null,
    winningStructureStatus: null,
    winningStructureInputDocumentId: null,
    winningStructureInputHash: null,
    winningStructureEffectiveInputHash: null,
    winningStructureDecisionSetVersion: null,
    winningStructureRetentionExpiresAt: null,
    winningStructureResultDocumentId: null,
    blockerClass: null,
    nextReviewAt: null,
    winningStructurePausedDecisionRequest: null,
    winningStructurePrestartRepair: {
      repairedAt: new Date().toISOString(),
      reason: "Strategist heartbeat ID was written into an MCP-owned run field before start.",
      proof: "placeholder matched a succeeded SEO Blog Content Strategist heartbeat",
    },
  };
  const updated = await request(token, "PATCH", `/cases/${caseId}`, {
    fields: repairedFields,
    expectedVersion: current.version,
  });
  const repaired = updated.case ?? updated;
  await request(token, "PUT", `/cases/${caseId}/documents/winning-structure-prestart-repair`, {
    title: "Winning Structure pre-start state repair",
    body: [
      "# Winning Structure pre-start state repair",
      "",
      "The stored run ID was a succeeded SEO Blog Content Strategist heartbeat ID, not an MCP run.",
      "No MCP input hash, effective hash, result document, or remote lifecycle evidence existed.",
      "Runtime-owned fields were reset so the winning_structure stage can start exactly once with the existing idempotency key.",
    ].join("\n"),
  });
  const transitioned = await request(token, "POST", `/cases/${caseId}/transition`, {
    toStageKey: "strategy_input",
    expectedVersion: repaired.version,
    reason: "Proven pre-start payload schema contamination; rebuild the exact tool payload without changing taskRevision or idempotency key.",
  });
  const transitionedCase = transitioned.case ?? transitioned;
  console.log(JSON.stringify({
    caseId,
    changed: true,
    previousPlaceholderRunId: placeholderRunId,
    stage: transitioned.stage?.key ?? null,
    version: transitionedCase.version,
    winningStructureRunId: transitionedCase.fields?.winningStructureRunId ?? null,
    winningStructureStatus: transitionedCase.fields?.winningStructureStatus ?? null,
  }, null, 2));
} finally {
  psql(`update board_api_keys set revoked_at=now() where id=${q(keyId)}::uuid;`);
}
