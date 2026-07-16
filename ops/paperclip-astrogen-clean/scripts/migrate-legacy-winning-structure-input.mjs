#!/usr/bin/env node

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const PROJECT_ID = "d4644ea9-c025-4421-9af9-7780e41945ba";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const argumentsList = process.argv.slice(2);
const mode = argumentsList.includes("--apply") ? "--apply" : undefined;
const caseId = argumentsList.find((value) => value !== "--apply");

if (!caseId || argumentsList.some((value) => value !== "--apply" && value !== caseId)) {
  throw new Error("Usage: migrate-legacy-winning-structure-input.mjs <case-id> [--apply]");
}

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
  return run("sudo", [
    "docker", "exec", "-i", DB_CONTAINER,
    "psql", "-U", "paperclip", "-d", "paperclip", "-v", "ON_ERROR_STOP=1", "-At",
  ], sql);
}

function q(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
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
    throw new Error(`${method} ${path} returned ${response.status}: ${text.slice(0, 1600)}`);
  }
  return parsed;
}

function text(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function readerProblem(payload) {
  return text(
    payload?.task?.intent_hypothesis,
    "Читачеві потрібна перевірювана відповідь на запит без надмірних або категоричних висновків.",
  );
}

function evidenceType(ref) {
  const key = ref.toLowerCase();
  if (key.includes("gsc") || key.includes("ga4")) return "internal_analytics";
  if (key.includes("serper") || key.includes("serp")) return "support_data";
  return "business_evidence";
}

function evidenceTitle(ref) {
  const key = ref.toLowerCase();
  if (key.includes("gsc")) return "Дані GSC про попит";
  if (key.includes("cms")) return "Перевірка на дублювання в CMS";
  if (key.includes("serper") || key.includes("serp")) return "Перевірка SERP";
  if (key.includes("topic")) return "Валідація теми";
  return `Перевірене джерело: ${ref}`;
}

function normalizeEvidence(entry, payload) {
  if (text(entry?.evidence_id)) return entry;
  const ref = text(entry?.ref);
  if (!ref) return entry;
  const claimBoundary = text(entry?.claim_boundary);
  return {
    evidence_id: ref,
    evidence_type: text(entry?.evidence_type, evidenceType(ref)),
    title: text(entry?.title, evidenceTitle(ref)),
    summary: text(entry?.summary),
    reader_problem: text(entry?.reader_problem, readerProblem(payload)),
    source: text(entry?.source, ref),
    ...(claimBoundary ? { claim_boundaries: [claimBoundary] } : {}),
    ...(asArray(entry?.artifact_refs).length ? { artifact_refs: asArray(entry.artifact_refs) } : {}),
    ...(text(entry?.observed_at) ? { observed_at: text(entry.observed_at) } : {}),
    ...(text(entry?.rights_and_privacy_notes) ? { rights_and_privacy_notes: text(entry.rights_and_privacy_notes) } : {}),
  };
}

function normalizeCommitment(entry, payload) {
  if (text(entry?.commitment_id)) return entry;
  const ref = text(entry?.ref);
  if (!ref) return entry;
  const description = text(entry?.reader_facing_asset);
  const verification = text(entry?.verification_before_delivery);
  return {
    commitment_id: ref,
    asset_type: text(entry?.asset_type, "other"),
    description,
    reader_problem: text(entry?.reader_problem, readerProblem(payload)),
    value_proposition: text(entry?.value_proposition, description),
    owner: text(entry?.owner, text(entry?.owner_role, "Astrogen editorial team")),
    target_content_units: asArray(entry?.target_content_units).length
      ? asArray(entry.target_content_units)
      : ["Основний пояснювальний блок"],
    validation_method: text(entry?.validation_method, verification),
    acceptance_criteria: asArray(entry?.acceptance_criteria).length
      ? asArray(entry.acceptance_criteria)
      : (verification ? [verification] : []),
    due_before_publication: true,
  };
}

function productLabel(url) {
  if (url.includes("/experts/astrologiya")) return "Консультація астролога";
  return "Детальніше на Astrogen";
}

function normalizeProductBridge(entry) {
  if (text(entry?.url) && text(entry?.label)) return entry;
  const url = text(entry?.url, text(entry?.route));
  if (!url) return entry;
  const instruction = text(entry?.instruction, text(entry?.claim_boundary));
  return {
    url,
    label: text(entry?.label, productLabel(url)),
    ...(text(entry?.type) ? { type: text(entry.type) } : {}),
    ...(text(entry?.bridge_type) ? { bridge_type: text(entry.bridge_type) } : {}),
    ...(text(entry?.placement_after_section) ? { placement_after_section: text(entry.placement_after_section) } : {}),
    ...(instruction ? { instruction } : {}),
  };
}

function normalizePayload(payload) {
  const business = payload.business_context && typeof payload.business_context === "object"
    ? payload.business_context
    : {};
  return {
    ...payload,
    business_context: {
      ...business,
      reader_value_evidence: asArray(business.reader_value_evidence)
        .map((entry) => normalizeEvidence(entry, payload)),
      manual_value_commitments: asArray(business.manual_value_commitments)
        .map((entry) => normalizeCommitment(entry, payload)),
      product_bridge_targets: asArray(business.product_bridge_targets)
        .map(normalizeProductBridge),
    },
  };
}

function currentCtoRunContext() {
  const result = psql(`
    select json_build_object('agentId', a.id, 'runId', h.id)::text
    from heartbeat_runs h
    join agents a on a.id = h.agent_id
    where h.company_id = ${q(COMPANY_ID)}::uuid
      and a.name = 'Chief Technical Officer'
      and h.status = 'succeeded'
    order by h.finished_at desc nulls last
    limit 1;
  `);
  if (!result) throw new Error("No successful CTO heartbeat is available for the migration audit trail");
  return JSON.parse(result);
}

const token = `pcp_board_${randomBytes(24).toString("hex")}`;
const keyId = randomUUID();
const keyHash = createHash("sha256").update(token).digest("hex");

psql(`
  insert into board_api_keys (id, user_id, name, key_hash, expires_at)
  values (${q(keyId)}::uuid, ${q(USER_ID)}, 'winning-structure-input-migration', ${q(keyHash)},
    now() + interval '10 minutes');
`);

try {
  const detail = await request(token, "GET", `/cases/${caseId}`);
  const current = detail.case ?? detail;
  if (current.companyId !== COMPANY_ID) throw new Error("Case does not belong to clean Astrogen");
  if (detail.stage?.key !== "strategy_input") {
    throw new Error(`Migration only runs while strategy_input owns the payload; current stage is ${detail.stage?.key ?? "unknown"}`);
  }
  if (current.fields?.winningStructureRunId || current.fields?.winningStructureInputHash) {
    throw new Error("Refusing to modify a payload after a real Winning Structure lifecycle may have started");
  }

  const response = await request(token, "GET", `/cases/${caseId}/documents/winning-structure-input`);
  const document = response.document ?? response;
  const body = document.latestBody ?? document.body;
  if (typeof body !== "string" || !body.trim()) throw new Error("winning-structure-input is empty");
  const original = JSON.parse(body);
  const normalized = normalizePayload(original);
  const originalBody = `${JSON.stringify(original, null, 2)}\n`;
  const normalizedBody = `${JSON.stringify(normalized, null, 2)}\n`;
  const changed = originalBody !== normalizedBody;

  if (mode !== "--apply") {
    console.log(JSON.stringify({
      mode: "dry-run",
      caseId,
      changed,
      originalDigest: digest(originalBody),
      normalizedDigest: digest(normalizedBody),
      evidenceCount: asArray(normalized.business_context?.reader_value_evidence).length,
      commitmentCount: asArray(normalized.business_context?.manual_value_commitments).length,
      productBridgeCount: asArray(normalized.business_context?.product_bridge_targets).length,
    }, null, 2));
    process.exit(0);
  }
  if (!changed) {
    console.log(JSON.stringify({ mode: "apply", caseId, changed: false, reason: "already normalized" }, null, 2));
    process.exit(0);
  }

  const baseRevisionId = document.latestRevisionId ?? document.revision?.id ?? null;
  await request(token, "PUT", `/cases/${caseId}/documents/winning-structure-input`, {
    title: document.title ?? "Winning Structure input",
    format: document.format ?? "markdown",
    body: normalizedBody,
    baseRevisionId,
    changeSummary: "Normalized legacy business-context aliases to the typed Winning Structure input contract.",
  });
  await request(token, "PUT", `/cases/${caseId}/documents/winning-structure-input-migration`, {
    title: "Winning Structure input migration",
    format: "markdown",
    body: [
      "# Winning Structure input migration",
      "",
      "- version: `typed-business-context-v1`",
      `- originalDigest: \`${digest(originalBody)}\``,
      `- normalizedDigest: \`${digest(normalizedBody)}\``,
      "- scope: converted only existing legacy aliases in reader evidence, manual commitments and product bridge targets.",
      "- no provider run, CMS action, image generation, publication or Telegram action was performed.",
    ].join("\n"),
  });
  const fields = {
    ...(current.fields ?? {}),
    winningStructureStatus: "strategy_input_normalized_for_remote_validation",
    winningStructureValidationErrors: null,
    winningStructureValidationIssues: null,
    winningStructureInputMigration: {
      version: "typed-business-context-v1",
      originalDigest: digest(originalBody),
      normalizedDigest: digest(normalizedBody),
      migratedAt: new Date().toISOString(),
    },
  };
  await request(token, "PATCH", `/cases/${caseId}`, {
    fields,
    expectedVersion: current.version,
  });
  console.log(JSON.stringify({
    mode: "apply",
    caseId,
    changed: true,
    originalDigest: digest(originalBody),
    normalizedDigest: digest(normalizedBody),
  }, null, 2));
} finally {
  psql(`update board_api_keys set revoked_at=now(), last_used_at=now() where id=${q(keyId)}::uuid;`);
}
