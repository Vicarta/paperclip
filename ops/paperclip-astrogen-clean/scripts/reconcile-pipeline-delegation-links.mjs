#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";

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
  const parsed = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 2000)}`);
  return parsed;
}

function delegationRows() {
  const output = psql(`
    select json_build_object(
      'caseId', pc.id,
      'caseKey', pc.case_key,
      'stageKey', ps.key,
      'issueId', i.id,
      'issueIdentifier', i.identifier,
      'issueStatus', i.status
    )::text
    from pipeline_cases pc
    join pipeline_stages ps on ps.id = pc.stage_id
    join issues i
      on i.company_id = pc.company_id
     and i.id = nullif(pc.fields->>'executionIssueId', '')::uuid
    left join pipeline_case_issue_links l
      on l.company_id = pc.company_id
     and l.case_id = pc.id
     and l.issue_id = i.id
     and l.retired_at is null
    where pc.company_id = ${sqlLiteral(COMPANY_ID)}::uuid
      and pc.terminal_kind is null
      and l.id is null
    order by pc.updated_at, pc.id;
  `);
  return output ? output.split("\n").filter(Boolean).map((line) => JSON.parse(line)) : [];
}

function staleExecutionRows() {
  const output = psql(`
    select json_build_object(
      'caseId', pc.id,
      'caseKey', pc.case_key,
      'stageKey', ps.key,
      'issueId', i.id,
      'issueIdentifier', i.identifier,
      'issueStatus', i.status
    )::text
    from pipeline_cases pc
    join pipeline_stages ps on ps.id = pc.stage_id
    join issues i
      on i.company_id = pc.company_id
     and i.id = nullif(pc.fields->>'executionIssueId', '')::uuid
    where pc.company_id = ${sqlLiteral(COMPANY_ID)}::uuid
      and pc.terminal_kind is null
      and ps.key = 'executing'
      and (
        i.status = 'done'
        or (
          i.status = 'blocked'
          and exists (
            select 1 from issue_work_products product
            where product.company_id = pc.company_id
              and product.issue_id = i.id
          )
          or i.status = 'blocked'
          and exists (
            select 1 from issue_documents issue_document
            where issue_document.company_id = pc.company_id
              and issue_document.issue_id = i.id
              and issue_document.key not in ('continuation-summary', 'pipeline-case-body')
          )
        )
      )
      and not exists (
        select 1
        from pipeline_case_issue_links work_link
        join issues work_issue on work_issue.id = work_link.issue_id
        where work_link.company_id = pc.company_id
          and work_link.case_id = pc.id
          and work_link.role = 'work'
          and work_link.retired_at is null
          and (
            work_issue.status in ('backlog', 'todo', 'in_progress')
            or (
              work_issue.status = 'blocked'
              and not exists (
                select 1 from issue_work_products blocked_product
                where blocked_product.company_id = pc.company_id
                  and blocked_product.issue_id = work_issue.id
              )
              and not exists (
                select 1 from issue_documents blocked_document
                where blocked_document.company_id = pc.company_id
                  and blocked_document.issue_id = work_issue.id
                  and blocked_document.key not in ('continuation-summary', 'pipeline-case-body')
              )
            )
          )
      )
      and not exists (
        select 1
        from pipeline_case_issue_links automation_link
        join issues automation_issue on automation_issue.id = automation_link.issue_id
        where automation_link.company_id = pc.company_id
          and automation_link.case_id = pc.id
          and automation_link.role = 'automation'
          and automation_link.retired_at is null
          and automation_issue.status in ('backlog', 'todo', 'in_progress')
      )
      and coalesce((
        select max(execution.created_at)
        from pipeline_automation_executions execution
        where execution.company_id = pc.company_id
          and execution.case_id = pc.id
      ), '-infinity'::timestamptz) < pc.updated_at
    order by pc.updated_at, pc.id;
  `);
  return output ? output.split("\n").filter(Boolean).map((line) => JSON.parse(line)) : [];
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${sqlLiteral(keyId)}::uuid, ${sqlLiteral(USER_ID)},
      'phase46-delegation-link-convergence', ${sqlLiteral(tokenHash)}, now() + interval '10 minutes');
  `);

  try {
    const candidates = delegationRows();
    const staleExecutions = staleExecutionRows();
    if (candidates.length === 0 && staleExecutions.length === 0) {
      console.log(JSON.stringify({ linked: [], rerun: [], mode: "already-converged" }, null, 2));
      return;
    }
    const backup = await request(token, "POST", "/instance/database-backups", {});
    const linked = [];
    const rerun = [];
    for (const candidate of candidates) {
      await request(token, "POST", `/cases/${candidate.caseId}/issue-links`, {
        issueId: candidate.issueId,
        role: "work",
      });
      linked.push(candidate);
    }

    const remaining = delegationRows();
    if (remaining.length > 0) throw new Error(`Delegation link convergence incomplete: ${JSON.stringify(remaining)}`);

    const rerunByCaseId = new Map(
      [...staleExecutions, ...staleExecutionRows()].map((candidate) => [candidate.caseId, candidate]),
    );
    for (const candidate of rerunByCaseId.values()) {
      const result = await request(token, "POST", `/cases/${candidate.caseId}/automation/current-stage/rerun`, {});
      rerun.push({ caseKey: candidate.caseKey, issueIdentifier: candidate.issueIdentifier, result });
    }

    const remainingStaleExecutions = staleExecutionRows();
    if (remainingStaleExecutions.length > 0) {
      throw new Error(`Execution convergence incomplete: ${JSON.stringify(remainingStaleExecutions)}`);
    }
    console.log(JSON.stringify({
      backup: {
        filename: backup.filename ?? null,
        backupDir: backup.backupDir ?? null,
        sizeBytes: backup.sizeBytes ?? null,
      },
      linked,
      rerun,
      remaining: 0,
      remainingStaleExecutions: 0,
    }, null, 2));
  } finally {
    psql(`update board_api_keys set revoked_at=now(), last_used_at=now() where id=${sqlLiteral(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
