#!/usr/bin/env node
/**
 * Bounded recovery for an active article case created before native
 * superseded-automation reconciliation was deployed.
 *
 * It retires only an automation issue that is blocked, belongs only to this
 * non-terminal case, and has a later successful execution of the same routine
 * with a done issue. No content, CMS record, topic lifecycle, or Telegram
 * delivery is touched.
 */
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
  return run("sudo", ["docker", "exec", "-i", DB_CONTAINER, "psql", "-U", "paperclip", "-d", "paperclip", "-v", "ON_ERROR_STOP=1", "-At"], sql);
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function parseArgs() {
  const index = process.argv.indexOf("--case-id");
  const caseId = index >= 0 ? process.argv[index + 1] : null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(caseId ?? "")) {
    console.error("Usage: reconcile-superseded-article-automation.mjs --case-id <uuid> [--apply]");
    process.exit(2);
  }
  return {
    caseId,
    apply: process.argv.includes("--apply"),
    resumeCmoDelivery: process.argv.includes("--resume-cmo-delivery"),
    resumeWorkIssueId: process.argv.includes("--resume-work-issue")
      ? process.argv[process.argv.indexOf("--resume-work-issue") + 1]
      : null,
  };
}

function candidatesSql(caseId) {
  return `
    select json_agg(row_to_json(candidate) order by candidate.identifier)::text
    from (
      select distinct l.id as "linkId", i.id as "issueId", i.identifier, e.routine_id as "routineId"
      from pipeline_case_issue_links l
      join issues i on i.id=l.issue_id
      join pipeline_automation_executions e on e.execution_issue_id=i.id
      join pipeline_cases c on c.id=l.case_id
      join pipelines p on p.id=c.pipeline_id
      where l.company_id=${sqlLiteral(COMPANY_ID)}::uuid
        and l.case_id=${sqlLiteral(caseId)}::uuid
        and l.role='automation'
        and l.retired_at is null
        and i.company_id=${sqlLiteral(COMPANY_ID)}::uuid
        and i.status='blocked'
        and e.company_id=${sqlLiteral(COMPANY_ID)}::uuid
        and e.case_id=${sqlLiteral(caseId)}::uuid
        and p.key='astrogen-article-production'
        and c.terminal_kind is null
        and c.retired_at is null
        and not exists (
          select 1
          from pipeline_case_issue_links other_link
          join pipeline_cases other_case on other_case.id=other_link.case_id
          where other_link.issue_id=i.id
            and other_link.id<>l.id
            and other_link.retired_at is null
            and other_case.retired_at is null
            and other_case.terminal_kind is null
        )
        and exists (
          select 1
          from pipeline_automation_executions successor_execution
          join issues successor_issue on successor_issue.id=successor_execution.execution_issue_id
          where successor_execution.company_id=${sqlLiteral(COMPANY_ID)}::uuid
            and successor_execution.case_id=${sqlLiteral(caseId)}::uuid
            and successor_execution.routine_id=e.routine_id
            and successor_execution.created_at>e.created_at
            and successor_execution.status='succeeded'
            and successor_issue.company_id=${sqlLiteral(COMPANY_ID)}::uuid
            and successor_issue.status='done'
        )
    ) candidate;
  `;
}

async function request(token, method, pathname, body) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 1000)}`);
  return text ? JSON.parse(text) : null;
}

function blockedCurrentCmoDeliveryIssue(caseId) {
  const raw = psql(`
    select json_build_object('id',i.id,'identifier',i.identifier,'status',i.status)::text
    from pipeline_cases c
    join pipeline_stages s on s.id=c.stage_id
    join pipeline_automation_executions e on e.case_id=c.id
      and e.routine_id=(s.config->'onEnter'->>'routineId')::uuid
    join issues i on i.id=e.execution_issue_id
    where c.id=${sqlLiteral(caseId)}::uuid
      and c.company_id=${sqlLiteral(COMPANY_ID)}::uuid
      and s.key='cmo_delivery'
      and i.status='blocked'
      and c.fields->>'telegramMessageId' is not null
    order by e.created_at desc
    limit 1;
  `);
  return raw ? JSON.parse(raw) : null;
}

function blockedLinkedWorkIssue(caseId, issueId) {
  if (!issueId) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(issueId)) {
    throw new Error("--resume-work-issue must be a UUID");
  }
  const raw = psql(`
    select json_build_object('id',i.id,'identifier',i.identifier,'status',i.status)::text
    from pipeline_case_issue_links l
    join issues i on i.id=l.issue_id
    join pipeline_cases c on c.id=l.case_id
    where l.case_id=${sqlLiteral(caseId)}::uuid
      and l.company_id=${sqlLiteral(COMPANY_ID)}::uuid
      and l.role='work'
      and l.retired_at is null
      and i.id=${sqlLiteral(issueId)}::uuid
      and i.status='blocked'
      and c.terminal_kind is null
      and c.fields->>'telegramMessageId' is not null
    limit 1;
  `);
  return raw ? JSON.parse(raw) : null;
}

async function main() {
  const { caseId, apply, resumeCmoDelivery, resumeWorkIssueId } = parseArgs();
  const candidates = JSON.parse(psql(candidatesSql(caseId)) || "[]");
  if (!apply) {
    console.log(JSON.stringify({
      mode: "dry-run",
      caseId,
      candidates,
      cmoDeliveryIssueToResume: resumeCmoDelivery ? blockedCurrentCmoDeliveryIssue(caseId) : null,
      workIssueToResume: blockedLinkedWorkIssue(caseId, resumeWorkIssueId),
    }, null, 2));
    return;
  }
  if (candidates.length === 0 && !resumeCmoDelivery && !resumeWorkIssueId) {
    console.log(JSON.stringify({ mode: "apply", caseId, skipped: "no_superseded_blocked_automation" }, null, 2));
    return;
  }

  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  psql(`insert into board_api_keys (id,user_id,name,key_hash,expires_at) values (${sqlLiteral(keyId)}::uuid,${sqlLiteral(USER_ID)},'superseded-article-automation-reconciliation',${sqlLiteral(createHash("sha256").update(token).digest("hex"))},now()+interval '20 minutes');`);
  try {
    const backup = await request(token, "POST", "/instance/database-backups", {});
    let summary = { cancelledIssueCount: 0, retiredLinkCount: 0, eventWritten: false };
    if (candidates.length > 0) {
      const issueIds = candidates.map((candidate) => candidate.issueId);
      const linkIds = candidates.map((candidate) => candidate.linkId);
      const eventPayload = JSON.stringify({
        reason: "superseded_by_later_successful_automation",
        cancelledIssueIds: issueIds,
        retiredLinkIds: linkIds,
        routineIds: [...new Set(candidates.map((candidate) => candidate.routineId))],
        migration: "astrogen_superseded_article_automation_v1",
      });
      const issueList = issueIds.map(sqlLiteral).join(",");
      const linkList = linkIds.map(sqlLiteral).join(",");
      const result = psql(`
      with cancelled as (
        update issues set status='cancelled', cancelled_at=now(), completed_at=null,
          checkout_run_id=null, execution_run_id=null, execution_agent_name_key=null,
          execution_locked_at=null, monitor_next_check_at=null, monitor_wake_requested_at=null, updated_at=now()
        where company_id=${sqlLiteral(COMPANY_ID)}::uuid and status='blocked' and id in (${issueList})
        returning id
      ), retired as (
        update pipeline_case_issue_links set retired_at=now(), retired_reason='superseded_by_later_successful_automation', updated_at=now()
        where company_id=${sqlLiteral(COMPANY_ID)}::uuid and retired_at is null and id in (${linkList})
        returning id
      ), event_written as (
        insert into pipeline_case_events (id,company_id,case_id,type,actor_type,payload,created_at,updated_at)
        select gen_random_uuid(),${sqlLiteral(COMPANY_ID)}::uuid,${sqlLiteral(caseId)}::uuid,'automation_effects_retired','system',${sqlLiteral(eventPayload)}::jsonb,now(),now()
        where (select count(*) from cancelled)=(select count(*) from retired)
        returning id
      )
      select json_build_object('cancelledIssueCount',(select count(*) from cancelled),'retiredLinkCount',(select count(*) from retired),'eventWritten',exists(select 1 from event_written))::text;
    `);
      summary = JSON.parse(result);
      if (summary.cancelledIssueCount !== candidates.length || summary.retiredLinkCount !== candidates.length || !summary.eventWritten) {
        throw new Error(`Reconciliation did not atomically affect every planned candidate: ${result}`);
      }
    }
    const cmoDeliveryIssue = resumeCmoDelivery ? blockedCurrentCmoDeliveryIssue(caseId) : null;
    const resumed = cmoDeliveryIssue
      ? await request(token, "PATCH", `/issues/${cmoDeliveryIssue.id}`, {
        status: "todo",
        comment: [
          "System reconciliation complete.",
          "",
          "Older blocked automation runs were superseded by later successful runs of the same routine and retired from the pipeline case.",
          "Resume this same CMO delivery issue. Telegram proof already exists, so retry only the native transition to delivered and do not resend the owner message.",
        ].join("\n"),
      })
      : null;
    const workIssue = blockedLinkedWorkIssue(caseId, resumeWorkIssueId);
    const resumedWork = workIssue
      ? await request(token, "PATCH", `/issues/${workIssue.id}`, {
        status: "todo",
        comment: [
          "System review-safe configuration is now synchronized for image, CMS, and CMO operational evidence.",
          "",
          "Resume this same issue and retry only the native article transition to delivered. Existing CMS and Telegram proof are valid; do not publish and do not resend Telegram.",
        ].join("\n"),
      })
      : null;
    console.log(JSON.stringify({
      mode: "apply",
      caseId,
      candidates,
      backup,
      ...summary,
      resumedCmoDeliveryIssue: resumed?.issue?.identifier ?? cmoDeliveryIssue?.identifier ?? null,
      resumedWorkIssue: resumedWork?.issue?.identifier ?? workIssue?.identifier ?? null,
    }, null, 2));
  } finally {
    psql(`update board_api_keys set revoked_at=now(),last_used_at=now() where id=${sqlLiteral(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
