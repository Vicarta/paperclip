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

function caseRow(detail) {
  return detail.case ?? detail;
}

const candidates = JSON.parse(psql(`
  select coalesce(json_agg(candidate order by candidate."updatedAt"), '[]'::json)::text
  from (
    select c.id as "caseId", c.updated_at as "updatedAt"
    from pipeline_cases c
    join pipelines p on p.id=c.pipeline_id
    join pipeline_stages s on s.id=c.stage_id
    where c.company_id=${q(COMPANY_ID)}::uuid
      and p.key='astrogen-topic-inventory'
      and s.key='waiting_evidence'
      and c.retired_at is null
      and c.terminal_kind is null
      and c.fields->>'serpGroupingStatus'='checked_no_matching_segment'
      and c.fields#>>'{serpGroupingEvidence,projectId}'='astrogen-ukraine'
      and coalesce((c.fields#>>'{serpGroupingEvidence,matchingPrimaryOrSupportingQuerySegmentFound}')::boolean, false)=false
    order by c.updated_at
    limit 10
  ) candidate;
`));

const token = `pcp_board_${randomBytes(24).toString("hex")}`;
const keyId = randomUUID();
const keyHash = createHash("sha256").update(token).digest("hex");
psql(`
  insert into board_api_keys (id, user_id, name, key_hash, expires_at)
  values (${q(keyId)}::uuid, ${q(USER_ID)}, 'expire-no-coverage-topic-candidates',
    ${q(keyHash)}, now() + interval '10 minutes');
`);

try {
  const backup = candidates.length > 0
    ? await request(token, "POST", "/instance/database-backups", {})
    : null;
  const expired = [];

  for (const candidate of candidates) {
    const detail = await request(token, "GET", `/cases/${candidate.caseId}`);
    const current = caseRow(detail);
    const fields = current.fields ?? {};
    if (detail.stage?.key !== "waiting_evidence"
        || fields.serpGroupingStatus !== "checked_no_matching_segment"
        || fields.serpGroupingEvidence?.projectId !== "astrogen-ukraine"
        || fields.serpGroupingEvidence?.matchingPrimaryOrSupportingQuerySegmentFound !== false) {
      continue;
    }

    const patched = await request(token, "PATCH", `/cases/${candidate.caseId}`, {
      fields: {
        ...fields,
        evidenceStatus: "expired_no_matching_serp_coverage",
        blockerClass: null,
        nextReviewAt: null,
        expiryReason: "bounded_semantic_core_check_returned_no_matching_query_or_segment_coverage",
        expiredAt: new Date().toISOString(),
        rediscoveryRule: "A new evidence-source fingerprint may create a new guarded search-demand opportunity; do not reopen this candidate unchanged.",
      },
      expectedVersion: current.version,
    });
    const transitioned = await request(token, "POST", `/cases/${candidate.caseId}/transition`, {
      toStageKey: "expired",
      expectedVersion: caseRow(patched).version,
    });

    const linkedIssues = JSON.parse(psql(`
      select coalesce(json_agg(json_build_object('id', i.id, 'identifier', i.identifier)), '[]'::json)::text
      from pipeline_case_issue_links l
      join issues i on i.id=l.issue_id
      where l.case_id=${q(candidate.caseId)}::uuid
        and i.status='blocked';
    `));
    for (const issue of linkedIssues) {
      await request(token, "POST", `/issues/${issue.id}/comments`, {
        body: [
          "## Candidate expired after bounded evidence check",
          "",
          "Semantic Core MCP responded successfully for project `astrogen-ukraine`, but returned no matching query or SERP segment coverage. This is a terminal no-coverage outcome for this candidate, not a runtime blocker. The native topic case moved to `expired`; the canonical refill must continue to other, broader candidates. Rediscovery requires a changed evidence fingerprint.",
        ].join("\n"),
      });
      await request(token, "PATCH", `/issues/${issue.id}`, { status: "done" });
    }

    expired.push({
      caseId: candidate.caseId,
      caseKey: caseRow(transitioned).caseKey,
      stage: transitioned.stage?.key ?? "expired",
      version: caseRow(transitioned).version,
      resolvedIssues: linkedIssues.map((issue) => issue.identifier),
    });
  }

  console.log(JSON.stringify({
    ok: true,
    expired,
    backup: backup
      ? { filename: backup.filename ?? null, sizeBytes: backup.sizeBytes ?? null }
      : null,
  }, null, 2));
} finally {
  psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
}
