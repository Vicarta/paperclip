#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const DELIVERED_TOPIC_ID = "76124cf7-235b-4071-b073-742bdf3cd11c";
const DELIVERED_ARTICLE_ID = "f2d24183-891e-4767-b84d-6c5181b46030";
const DUPLICATE_TOPIC_ID = "f71f7e11-d216-4785-90c4-8a1f8ffc0bb8";

function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
  return result.stdout.trim();
}

function psql(sql) {
  return run("sudo", [
    "docker", "exec", "-i", DB_CONTAINER,
    "psql", "-U", "paperclip", "-d", "paperclip",
    "-v", "ON_ERROR_STOP=1", "-qAt",
  ], sql);
}

function q(value) {
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

function caseRow(detail) {
  return detail.case ?? detail;
}

async function reconcileTopic(token, input) {
  let detail = await request(token, "GET", `/cases/${input.caseId}`);
  if (detail.stage?.key === input.fromStageKey) {
    detail = await request(token, "POST", `/cases/${input.caseId}/transition`, {
      toStageKey: input.toStageKey,
      expectedVersion: caseRow(detail).version,
      reason: input.reason,
    });
  }
  const verified = await request(token, "GET", `/cases/${input.caseId}`);
  if (verified.stage?.key !== input.expectedStageKey) {
    throw new Error(`${input.caseId} expected ${input.expectedStageKey}, got ${verified.stage?.key ?? "unknown"}`);
  }
  return verified;
}

function reconcileStaleBlockedIssues() {
  const output = psql(`
    begin;
    create temp table eligible_terminal_issues on commit drop as
    select distinct i.id as issue_id, i.identifier
    from issues i
    join pipeline_case_issue_links candidate_link on candidate_link.issue_id=i.id
    join pipeline_cases candidate_case on candidate_case.id=candidate_link.case_id
    where i.company_id=${q(COMPANY_ID)}::uuid
      and i.status='blocked'
      and candidate_link.retired_at is null
      and candidate_link.role in ('automation','work')
      and (candidate_case.terminal_kind is not null or candidate_case.retired_at is not null)
      and not exists (
        select 1
        from pipeline_case_issue_links live_link
        join pipeline_cases live_case on live_case.id=live_link.case_id
        where live_link.issue_id=i.id
          and live_link.retired_at is null
          and live_case.terminal_kind is null
          and live_case.retired_at is null
      );

    select coalesce(jsonb_agg(identifier order by identifier), '[]'::jsonb)
    from eligible_terminal_issues;

    insert into pipeline_case_events (
      company_id, case_id, type, actor_type, payload
    )
    select c.company_id, c.id, 'terminal_execution_issues_reconciled', 'system',
      jsonb_build_object(
        'source', 'historical_terminal_state_reconciliation',
        'terminalKind', c.terminal_kind,
        'cancelledIssueIds', jsonb_agg(distinct e.issue_id)
      )
    from eligible_terminal_issues e
    join pipeline_case_issue_links l on l.issue_id=e.issue_id and l.retired_at is null
    join pipeline_cases c on c.id=l.case_id
    where c.terminal_kind is not null or c.retired_at is not null
    group by c.company_id, c.id, c.terminal_kind;

    update issues i
    set status='cancelled', cancelled_at=now(), completed_at=null,
      checkout_run_id=null, execution_run_id=null, execution_agent_name_key=null,
      execution_locked_at=null, monitor_next_check_at=null,
      monitor_wake_requested_at=null, updated_at=now()
    from eligible_terminal_issues e
    where i.id=e.issue_id and i.status='blocked';

    update pipeline_case_issue_links l
    set retired_at=now(), retired_reason='historical_case_terminal_reconciliation', updated_at=now()
    from eligible_terminal_issues e
    where l.issue_id=e.issue_id
      and l.role in ('automation','work')
      and l.retired_at is null;
    commit;
  `);
  return JSON.parse(output.split("\n")[0] ?? "[]");
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${q(keyId)}::uuid, ${q(USER_ID)}, 'topic-terminal-state-reconciliation',
      ${q(tokenHash)}, now() + interval '10 minutes');
  `);

  try {
    const delivered = await reconcileTopic(token, {
      caseId: DELIVERED_TOPIC_ID,
      fromStageKey: "ready",
      toStageKey: "reserved",
      expectedStageKey: "consumed",
      reason: "Historical delivered child reconciliation through typed children-terminal outcome.",
    });
    if (caseRow(delivered).fields?.consumingArticleProof?.childCaseId !== DELIVERED_ARTICLE_ID) {
      throw new Error("Delivered topic is consumed without proof for the expected article child");
    }

    const duplicate = await reconcileTopic(token, {
      caseId: DUPLICATE_TOPIC_ID,
      fromStageKey: "ready",
      toStageKey: "rejected_duplicate",
      expectedStageKey: "rejected_duplicate",
      reason: "Historical child cancellation proved an existing first-party article; prevent reallocation.",
    });
    const cancelledIssues = reconcileStaleBlockedIssues();
    console.log(JSON.stringify({
      ok: true,
      deliveredTopicStage: delivered.stage.key,
      deliveredTopicProof: caseRow(delivered).fields.consumingArticleProof,
      duplicateTopicStage: duplicate.stage.key,
      cancelledStaleIssues: cancelledIssues,
    }, null, 2));
  } finally {
    psql(`update board_api_keys set revoked_at=now(), last_used_at=now() where id=${q(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
