#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";

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
  const responseText = await response.text();
  const parsed = responseText ? JSON.parse(responseText) : null;
  if (!response.ok) {
    throw new Error(`${method} ${path} returned ${response.status}: ${responseText.slice(0, 1200)}`);
  }
  return parsed;
}

const candidates = JSON.parse(psql(`
  select coalesce(json_agg(candidate order by candidate."updatedAt"), '[]'::json)::text
  from (
    select distinct c.id as "caseId", i.identifier, i.updated_at as "updatedAt",
           s.config->'inlineContextDocumentKeys' as "documentKeys",
           s.config->>'inlineContextMaxChars' as "maxChars"
    from pipeline_cases c
    join pipeline_stages s on s.id=c.stage_id
    join pipeline_case_issue_links l on l.case_id=c.id
    join issues i on i.id=l.issue_id
    where c.company_id=${q(COMPANY_ID)}::uuid
      and c.retired_at is null
      and c.terminal_kind is null
      and i.status='blocked'
      and s.config ? 'inlineContextDocumentKeys'
      and exists (
        select 1 from issue_comments ic
        where ic.issue_id=i.id
          and (
            ic.body ilike '%brief_content_unavailable%'
            or ic.body ilike '%brief_document_not_injected%'
            or ic.body ilike '%pipeline_inline_context_incomplete%'
          )
      )
    order by i.updated_at
    limit 10
  ) candidate;
`));

const token = `pcp_board_${randomBytes(24).toString("hex")}`;
const keyId = randomUUID();
const keyHash = createHash("sha256").update(token).digest("hex");
psql(`
  insert into board_api_keys (id, user_id, name, key_hash, expires_at)
  values (${q(keyId)}::uuid, ${q(USER_ID)}, 'resume-inline-context-blocked-stages',
    ${q(keyHash)}, now() + interval '10 minutes');
`);

try {
  const backup = candidates.length > 0
    ? await request(token, "POST", "/instance/database-backups", {})
    : null;
  const resumed = [];

  for (const candidate of candidates) {
    const keys = Array.isArray(candidate.documentKeys) ? candidate.documentKeys : [];
    const maxChars = Number(candidate.maxChars);
    if (keys.length < 1 || !Number.isInteger(maxChars)) {
      throw new Error(`Inline context config is incomplete for ${candidate.identifier}`);
    }
    const documents = JSON.parse(psql(`
      select coalesce(json_agg(json_build_object('key', pcd.key, 'bodyChars', length(d.latest_body))), '[]'::json)::text
      from pipeline_case_documents pcd
      join documents d on d.id=pcd.document_id
      where pcd.company_id=${q(COMPANY_ID)}::uuid
        and pcd.case_id=${q(candidate.caseId)}::uuid
        and pcd.key in (${keys.map(q).join(",")});
    `));
    const presentKeys = new Set(documents.map((document) => document.key));
    const missingKeys = keys.filter((key) => !presentKeys.has(key));
    const totalChars = documents.reduce((sum, document) => sum + Number(document.bodyChars ?? 0), 0);
    if (missingKeys.length > 0 || totalChars > maxChars) {
      throw new Error(`Inline context preflight failed for ${candidate.identifier}: missing=${missingKeys.join(",")} totalChars=${totalChars} maxChars=${maxChars}`);
    }
    const rerun = await request(token, "POST", `/cases/${candidate.caseId}/automation/current-stage/rerun`);
    resumed.push({
      identifier: candidate.identifier,
      caseId: candidate.caseId,
      documentKeys: keys,
      totalChars,
      maxChars,
      automationStatus: rerun.automationExecution?.status ?? null,
    });
  }

  console.log(JSON.stringify({
    ok: true,
    resumed,
    backup: backup
      ? { filename: backup.filename ?? null, sizeBytes: backup.sizeBytes ?? null }
      : null,
  }, null, 2));
} finally {
  psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
}
