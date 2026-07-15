#!/usr/bin/env node

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const CASES = [
  {
    id: "f2d24183-891e-4767-b84d-6c5181b46030",
    operation: "create",
    title: "new article canary",
  },
  {
    id: "f58bf6a8-0d48-439f-9534-fe33020c7a16",
    operation: "refresh",
    title: "CMS 123 refresh canary",
  },
];

function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
  return result.stdout.trim();
}

function psql(sql) {
  return run("docker", [
    "exec", "-i", DB_CONTAINER, "psql", "-U", "paperclip", "-d", "paperclip",
    "-v", "ON_ERROR_STOP=1", "-At",
  ], sql);
}

function q(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function request(token, method, path) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${method} ${path} returned ${response.status}: ${text.slice(0, 1200)}`);
  return parsed;
}

const token = `pcp_board_${randomBytes(24).toString("hex")}`;
const keyId = randomUUID();
const keyHash = createHash("sha256").update(token).digest("hex");

psql(`
  insert into board_api_keys (id, user_id, name, key_hash, expires_at)
  values (${q(keyId)}::uuid, ${q(USER_ID)}, 'phase47-openrouter-native-writer-resume', ${q(keyHash)}, now() + interval '15 minutes');
`);

try {
  const writer = JSON.parse(psql(`
    select json_build_object(
      'id', id, 'status', status, 'adapterType', adapter_type,
      'model', adapter_config->>'model'
    )::text
    from agents
    where company_id=${q(COMPANY_ID)}::uuid
      and name='SEO Blog Article Writer (Claude)';
  `));
  if (writer.adapterType !== "openrouter" || !String(writer.model ?? "").startsWith("anthropic/claude-")) {
    throw new Error("Claude writer runtime no longer matches the approved OpenRouter/Claude configuration");
  }
  psql(`
    update agents
    set status='idle', error_reason=null, updated_at=now()
    where id=${q(writer.id)}::uuid and company_id=${q(COMPANY_ID)}::uuid;
  `);

  const resumed = [];
  for (const expected of CASES) {
    const detail = await request(token, "GET", `/cases/${expected.id}`);
    const pipelineCase = detail.case ?? detail;
    if (detail.stage?.key !== "draft") {
      throw new Error(`${expected.title} is not at draft: ${detail.stage?.key ?? "unknown"}`);
    }
    if (pipelineCase.fields?.operation !== expected.operation) {
      throw new Error(`${expected.title} operation mismatch: ${pipelineCase.fields?.operation ?? "missing"}`);
    }
    if (expected.operation === "refresh" && (
      pipelineCase.fields?.cmsDraftId !== 123 ||
      pipelineCase.fields?.preserveExistingMedia !== true ||
      pipelineCase.fields?.imageDefectScoped !== false
    )) {
      throw new Error("Refresh canary media-preservation guard is absent");
    }
    const result = await request(token, "POST", `/cases/${expected.id}/automation/current-stage/rerun`);
    resumed.push({
      caseId: expected.id,
      operation: expected.operation,
      stage: detail.stage.key,
      automationExecution: result.automationExecution?.status ?? null,
    });
  }

  console.log(JSON.stringify({
    ok: true,
    writer: { id: writer.id, adapterType: writer.adapterType, model: writer.model, previousStatus: writer.status },
    resumed,
  }, null, 2));
} finally {
  psql(`update board_api_keys set revoked_at=now(), last_used_at=now() where id=${q(keyId)}::uuid;`);
}
