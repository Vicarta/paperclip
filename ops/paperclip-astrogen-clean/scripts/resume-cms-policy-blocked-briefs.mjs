#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const PLUGIN_KEY = "paperclip.payload-cms-agent-tools";

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

function caseRow(detail) {
  return detail.case ?? detail;
}

const config = JSON.parse(psql(`
  select pc.config_json::text
  from plugin_config pc
  join plugins p on p.id=pc.plugin_id
  where p.plugin_key=${q(PLUGIN_KEY)}
    and p.status='ready'
    and p.last_error is null
    and pc.last_error is null;
`));
const categoryDefaults = config.articleTypeCategoryDefaults ?? {};
if (Object.keys(categoryDefaults).length < 1) {
  throw new Error("Payload CMS article-type category policy is not configured");
}

const candidates = JSON.parse(psql(`
  select coalesce(json_agg(candidate order by candidate."createdAt"), '[]'::json)::text
  from (
    select c.id as "caseId", i.id as "issueId", i.identifier,
           c.fields->>'articleType' as "articleType", i.created_at as "createdAt"
    from pipeline_cases c
    join pipeline_stages s on s.id=c.stage_id
    join pipeline_case_issue_links l on l.case_id=c.id
    join issues i on i.id=l.issue_id
    where c.company_id=${q(COMPANY_ID)}::uuid
      and c.retired_at is null
      and c.terminal_kind is null
      and s.key='brief'
      and c.fields->>'blockerClass'='missing_cms_delivery_policy'
      and i.status='blocked'
    order by i.created_at
    limit 10
  ) candidate;
`));

const token = `pcp_board_${randomBytes(24).toString("hex")}`;
const keyId = randomUUID();
const keyHash = createHash("sha256").update(token).digest("hex");
psql(`
  insert into board_api_keys (id, user_id, name, key_hash, expires_at)
  values (${q(keyId)}::uuid, ${q(USER_ID)}, 'resume-cms-policy-blocked-briefs',
    ${q(keyHash)}, now() + interval '10 minutes');
`);

try {
  const backup = candidates.length > 0
    ? await request(token, "POST", "/instance/database-backups", {})
    : null;
  const resumed = [];

  for (const candidate of candidates) {
    const category = categoryDefaults[candidate.articleType];
    if (!category?.slug || !category?.title) {
      throw new Error(`No approved CMS category mapping for ${candidate.identifier} articleType=${candidate.articleType}`);
    }

    const detail = await request(token, "GET", `/cases/${candidate.caseId}`);
    const current = caseRow(detail);
    if (detail.stage?.key !== "brief"
        || current.fields?.blockerClass !== "missing_cms_delivery_policy") {
      continue;
    }
    const patched = await request(token, "PATCH", `/cases/${candidate.caseId}`, {
      fields: {
        ...current.fields,
        blockerClass: null,
        blockerOwner: null,
        blockerAction: null,
        briefStatus: "ready_for_policy_verified_retry",
        cmsCategorySlug: category.slug,
        cmsCategoryTitle: category.title,
        cmsCategoryResolutionStatus: "resolved_from_company_plugin_policy",
        cmsCategoryPolicyVersion: "astrogen-cms-delivery-v1",
        cmsCategoryPolicyResolvedAt: new Date().toISOString(),
      },
      expectedVersion: current.version,
    });
    const rerun = await request(token, "POST", `/cases/${candidate.caseId}/automation/current-stage/rerun`);
    resumed.push({
      identifier: candidate.identifier,
      caseId: candidate.caseId,
      articleType: candidate.articleType,
      category,
      version: caseRow(patched).version,
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
