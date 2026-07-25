#!/usr/bin/env node
/**
 * One-time reconciliation for monitors created before the core stage-exit
 * lifecycle guard was deployed. It never creates work, wakes agents, edits
 * content, or touches CMS/Telegram. Only a dormant future monitor whose
 * automation does not belong to the case's current stage is retired.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const APPLY = process.argv.includes("--apply");

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

function q(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function candidateSql() {
  return `
    select coalesce(json_agg(row_to_json(candidate) order by candidate.identifier), '[]'::json)::text
    from (
      select distinct
        link.id as "linkId",
        issue.id as "issueId",
        issue.identifier,
        issue.title,
        issue.description,
        case_row.id as "caseId",
        case_row.case_key as "caseKey",
        current_stage.key as "currentStageKey",
        execution.automation_id as "automationId"
      from pipeline_case_issue_links link
      join issues issue on issue.id=link.issue_id
      join pipeline_automation_executions execution on (
        execution.id=link.automation_attempt_id
        or (link.automation_attempt_id is null and execution.execution_issue_id=link.issue_id)
      )
      join pipeline_cases case_row on case_row.id=link.case_id
      join pipeline_stages current_stage on current_stage.id=case_row.stage_id
      where link.company_id=${q(COMPANY_ID)}::uuid
        and link.role='automation'
        and link.retired_at is null
        and issue.company_id=${q(COMPANY_ID)}::uuid
        and issue.status in ('in_progress','in_review')
        and issue.monitor_next_check_at > now()
        and issue.execution_run_id is null
        and issue.checkout_run_id is null
        and execution.company_id=${q(COMPANY_ID)}::uuid
        and execution.case_id=case_row.id
        and case_row.company_id=${q(COMPANY_ID)}::uuid
        and case_row.terminal_kind is null
        and case_row.retired_at is null
        and (
          current_stage.config->'onEnter'->>'type' is distinct from 'run_routine'
          or execution.automation_id <> coalesce(
            nullif(current_stage.config->'onEnter'->>'id', ''),
            current_stage.id::text || ':on_enter'
          )
        )
        and not exists (
          select 1
          from pipeline_case_issue_links other_link
          join pipeline_cases other_case on other_case.id=other_link.case_id
          where other_link.issue_id=issue.id
            and other_link.id<>link.id
            and other_link.retired_at is null
            and other_case.retired_at is null
            and other_case.terminal_kind is null
        )
    ) candidate;
  `;
}

function issueDiagnosticSql(identifier) {
  return `
    select coalesce(json_agg(row_to_json(diagnostic) order by diagnostic.execution_created_at), '[]'::json)::text
    from (
      select
        issue.identifier,
        issue.status,
        issue.monitor_next_check_at as "monitorNextCheckAt",
        issue.execution_policy as "executionPolicy",
        issue.execution_state as "executionState",
        issue.execution_run_id as "executionRunId",
        issue.checkout_run_id as "checkoutRunId",
        link.id as "linkId",
        link.automation_attempt_id as "automationAttemptId",
        link.retired_at as "linkRetiredAt",
        execution.id as "executionId",
        execution.automation_id as "automationId",
        execution.created_at as execution_created_at,
        case_row.id as "caseId",
        case_row.case_key as "caseKey",
        current_stage.key as "currentStageKey",
        current_stage.config->'onEnter' as "currentStageOnEnter",
        coalesce((
          select json_agg(row_to_json(comment) order by comment."createdAt" desc)
          from (
            select issue_comment.created_at as "createdAt", issue_comment.body
            from issue_comments issue_comment
            where issue_comment.issue_id=issue.id
            order by issue_comment.created_at desc
            limit 5
          ) comment
        ), '[]'::json) as "latestComments"
      from issues issue
      left join pipeline_case_issue_links link on link.issue_id=issue.id
      left join pipeline_automation_executions execution on (
        execution.id=link.automation_attempt_id
        or execution.execution_issue_id=issue.id
      )
      left join pipeline_cases case_row on case_row.id=link.case_id
      left join pipeline_stages current_stage on current_stage.id=case_row.stage_id
      where issue.company_id=${q(COMPANY_ID)}::uuid
        and issue.identifier=${q(identifier)}
    ) diagnostic;
  `;
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
  if (!response.ok) throw new Error(`${method} ${pathname}: ${response.status} ${text.slice(0, 1200)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  const inspectArgument = process.argv.find((argument) => argument.startsWith("--inspect-issue="));
  if (inspectArgument) {
    const identifier = inspectArgument.slice("--inspect-issue=".length);
    if (!/^[A-Z][A-Z0-9]*-[0-9]+$/.test(identifier)) throw new Error("Invalid --inspect-issue identifier");
    console.log(JSON.stringify({ ok: true, identifier, diagnostics: JSON.parse(psql(issueDiagnosticSql(identifier)) || "[]") }, null, 2));
    return;
  }
  const candidates = JSON.parse(psql(candidateSql()));
  if (!APPLY || candidates.length === 0) {
    console.log(JSON.stringify({ ok: true, mode: APPLY ? "no-op" : "dry-run", candidates }, null, 2));
    return;
  }

  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${q(keyId)}::uuid, ${q(USER_ID)}, 'reconcile-exited-stage-future-monitors',
      ${q(createHash("sha256").update(token).digest("hex"))}, now() + interval '15 minutes');
  `);
  try {
    const backup = await request(token, "POST", "/instance/database-backups", {});
    const values = candidates.map((candidate) =>
      `(${q(candidate.linkId)}::uuid,${q(candidate.issueId)}::uuid,${q(candidate.caseId)}::uuid,${q(candidate.automationId)},${q(candidate.currentStageKey)})`,
    ).join(",");
    const result = JSON.parse(psql(`
      with candidate(link_id, issue_id, case_id, automation_id, current_stage_key) as (
        values ${values}
      ), cancelled as (
        update issues issue
        set status='cancelled', cancelled_at=now(), completed_at=null,
          checkout_run_id=null, execution_run_id=null, execution_agent_name_key=null,
          execution_locked_at=null, monitor_next_check_at=null,
          monitor_wake_requested_at=null, monitor_notes=null,
          monitor_scheduled_by=null, updated_at=now()
        from candidate
        where issue.id=candidate.issue_id
          and issue.company_id=${q(COMPANY_ID)}::uuid
          and issue.status in ('in_progress','in_review')
          and issue.execution_run_id is null
          and issue.checkout_run_id is null
        returning issue.id
      ), retired as (
        update pipeline_case_issue_links link
        set retired_at=now(), retired_reason='stage_exited_future_monitor', updated_at=now()
        from candidate
        where link.id=candidate.link_id
          and link.company_id=${q(COMPANY_ID)}::uuid
          and link.retired_at is null
        returning link.id
      ), events as (
        insert into pipeline_case_events (id, company_id, case_id, type, actor_type, payload, created_at, updated_at)
        select gen_random_uuid(), ${q(COMPANY_ID)}::uuid, candidate.case_id,
          'automation_effects_retired', 'system',
          jsonb_build_object(
            'reason','stage_exited_future_monitor',
            'migration','astrogen_stage_exit_monitor_backfill_v1',
            'automationId',candidate.automation_id,
            'currentStageKey',candidate.current_stage_key,
            'cancelledIssueIds',jsonb_build_array(candidate.issue_id),
            'retiredLinkIds',jsonb_build_array(candidate.link_id)
          ), now(), now()
        from candidate
        join cancelled on cancelled.id=candidate.issue_id
        join retired on retired.id=candidate.link_id
        returning id
      )
      select json_build_object(
        'cancelledIssueCount',(select count(*) from cancelled),
        'retiredLinkCount',(select count(*) from retired),
        'eventCount',(select count(*) from events)
      )::text;
    `));
    if (result.cancelledIssueCount !== candidates.length
      || result.retiredLinkCount !== candidates.length
      || result.eventCount !== candidates.length) {
      throw new Error(`Reconciliation was not atomic: ${JSON.stringify(result)}`);
    }
    console.log(JSON.stringify({
      ok: true,
      mode: "reconciled",
      candidates,
      result,
      backup: backup.filename ?? backup.backupDir ?? null,
    }, null, 2));
  } finally {
    psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
