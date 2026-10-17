#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const PARENT_IDENTIFIER = "AST-914";
const CHILD_IDENTIFIER = "AST-923";
const POLICY_HASH = "15fbd0339ba3ee3b23f7821dbd832f3a332f458fba6fb06af6efa00a2a1128fd";

const CANDIDATES = [
  {
    phrase: "стосунки на відстані як домовитись про зв'язок",
    intendedLayer: "audience_need_intent",
    audienceSignalId: "trend_c869bf80ec69",
    intendedClusterKey: "relationships:healthy-digital-communication",
  },
  {
    phrase: "довіра у стосунках коли партнер часто онлайн у Telegram",
    intendedLayer: "audience_need_intent",
    audienceSignalId: "trend_c869bf80ec69",
    intendedClusterKey: "relationships:healthy-digital-communication",
  },
  {
    phrase: "як не сваритися через месенджери у стосунках",
    intendedLayer: "audience_need_intent",
    audienceSignalId: "trend_c869bf80ec69",
    intendedClusterKey: "relationships:healthy-digital-communication",
  },
  {
    phrase: "сленг у переписці з хлопцем що означає",
    intendedLayer: "audience_interest_intent",
    audienceSignalId: "trend_9a31f9d86789",
    intendedClusterKey: "relationships:digital-dating-signals",
  },
  {
    phrase: "як зрозуміти флірт у TikTok переписці",
    intendedLayer: "audience_interest_intent",
    audienceSignalId: "trend_9a31f9d86789",
    intendedClusterKey: "relationships:digital-dating-signals",
  },
];

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

function quote(value) {
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
  if (!response.ok) {
    throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 2000)}`);
  }
  return text ? JSON.parse(text) : null;
}

function issue(identifier) {
  const raw = psql(`
    select json_build_object(
      'id', id,
      'identifier', identifier,
      'status', status,
      'description', description,
      'assigneeAgentId', assignee_agent_id,
      'executionRunId', execution_run_id
    )::text
    from issues
    where company_id=${quote(COMPANY_ID)}::uuid
      and identifier=${quote(identifier)};
  `);
  if (!raw) throw new Error(`Issue not found: ${identifier}`);
  return JSON.parse(raw);
}

function staleRecoveryIssue() {
  const raw = psql(`
    select json_build_object(
      'id', id,
      'identifier', identifier,
      'status', status,
      'parentId', parent_id,
      'assigneeAgentId', assignee_agent_id
    )::text
    from issues
    where company_id=${quote(COMPANY_ID)}::uuid
      and title=${quote("Recover case-visible AST-923 trend validation result")}
      and status in ('backlog', 'todo', 'in_progress', 'in_review', 'blocked')
    order by created_at desc
    limit 1;
  `);
  return raw ? JSON.parse(raw) : null;
}

function activeRunIdsForIssue(issueId) {
  return psql(`
    select id
    from heartbeat_runs
    where company_id=${quote(COMPANY_ID)}::uuid
      and context_snapshot->>'issueId'=${quote(issueId)}
      and status in ('queued', 'running', 'scheduled_retry')
    order by created_at;
  `).split("\n").map((value) => value.trim()).filter(Boolean);
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const keyHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${quote(keyId)}::uuid, ${quote(USER_ID)},
      'resume-relationships-after-editorial-lane-policy', ${quote(keyHash)},
      now() + interval '15 minutes');
  `);

  try {
    const parent = issue(PARENT_IDENTIFIER);
    const child = issue(CHILD_IDENTIFIER);
    const staleRecovery = staleRecoveryIssue();
    const pendingDisposition = "editorial_policy_correction_pending";
    if (["todo", "in_progress"].includes(child.status)
      && child.description.includes(pendingDisposition)
      && child.description.includes(POLICY_HASH)
      && !staleRecovery) {
      process.stdout.write(`${JSON.stringify({
        ok: true,
        noOp: true,
        reason: "existing_policy_correction_is_live",
        issue: child.identifier,
        status: child.status,
      }, null, 2)}\n`);
      return;
    }

    const backup = await request(token, "POST", "/instance/database-backups", {});
    let reconciledRecovery = null;
    if (staleRecovery) {
      const recoveryRunIds = activeRunIdsForIssue(staleRecovery.id);
      for (const runId of recoveryRunIds) {
        await request(token, "POST", `/heartbeat-runs/${runId}/cancel`, {});
      }
      if (recoveryRunIds.length > 0) {
        await request(token, "POST", `/issues/${staleRecovery.id}/admin/force-release`);
      }
      await request(token, "POST", `/agents/${staleRecovery.assigneeAgentId}/runtime-state/reset-session`, {
        taskKey: staleRecovery.id,
      });
      await request(token, "PATCH", `/issues/${staleRecovery.id}`, {
        status: "cancelled",
        blockedByIssueIds: [],
        comment: [
          "Cancelled as a stale evidence-recovery duplicate.",
          "",
          "AST-923 is live again under the final Semantic Core policy hash and owns the canonical `trendIngestionResult`. A parallel recovery copy would race with that source of truth.",
        ].join("\n"),
      });
      if (staleRecovery.parentId) {
        await request(token, "PATCH", `/issues/${staleRecovery.parentId}`, {
          status: "blocked",
          blockedByIssueIds: [child.id],
          comment: [
            "Removed the stale AST-997 recovery edge.",
            "",
            "Wait directly on AST-923, which is re-running with a fresh task session and the final editorial-bridge policy. Do not create another recovery issue while AST-923 has a live or queued path.",
          ].join("\n"),
        });
      }
      reconciledRecovery = {
        issue: staleRecovery.identifier,
        cancelledRunIds: recoveryRunIds,
        automationIssueId: staleRecovery.parentId,
      };
    }

    const correctionAlreadyLive = ["todo", "in_progress"].includes(child.status)
      && child.description.includes(pendingDisposition)
      && child.description.includes(POLICY_HASH);
    if (correctionAlreadyLive) {
      process.stdout.write(`${JSON.stringify({
        ok: true,
        noOp: false,
        reason: "stale_recovery_reconciled_existing_policy_correction_kept_live",
        issue: child.identifier,
        status: child.status,
        reconciledRecovery,
        backup: {
          backupDir: backup.backupDir ?? null,
          sizeBytes: backup.sizeBytes ?? null,
          finishedAt: backup.finishedAt ?? null,
        },
      }, null, 2)}\n`);
      return;
    }

    const activeRunIds = activeRunIdsForIssue(child.id);
    for (const runId of activeRunIds) {
      await request(token, "POST", `/heartbeat-runs/${runId}/cancel`, {});
    }
    if (child.executionRunId || activeRunIds.length > 0) {
      await request(token, "POST", `/issues/${child.id}/admin/force-release`);
    }
    await request(token, "POST", `/agents/${child.assigneeAgentId}/runtime-state/reset-session`, {
      taskKey: child.id,
    });
    const marker = "## trendIngestionResult";
    const markerIndex = child.description.indexOf(marker);
    const baseDescription = (markerIndex >= 0
      ? child.description.slice(0, markerIndex)
      : child.description).trimEnd();
    const pendingResult = {
      finalDisposition: pendingDisposition,
      acceptedSemanticCandidates: [],
      acceptedSemanticCandidateCount: 0,
      createdSearchDemandCaseIds: [],
      eligibleReadyTopicCountAfter: 1,
      primaryAudienceSegmentId: "relationships",
      segmentEligibleTopicCountAfter: 0,
      remainingUnusedClusters: [
        "relationships:healthy-digital-communication",
        "relationships:digital-dating-signals",
      ],
      validationWave: "3-editorial-policy-correction",
      policyHash: POLICY_HASH,
      layerValidationMatrix: CANDIDATES.map((candidate) => ({
        ...candidate,
        previousDecision: "park",
        previousReason: "no_entity_anchor",
        correctionReason: "direct_entity_anchor_is_not_required_for_audience_editorial_lane",
      })),
    };
    const description = [
      baseDescription,
      "",
      marker,
      "```json",
      JSON.stringify(pendingResult, null, 2),
      "```",
    ].join("\n");

    await request(token, "PATCH", `/issues/${child.id}`, {
      status: "todo",
      blockedByIssueIds: [],
      description,
      comment: [
        "## Resume after audience-interest editorial lane correction",
        "",
        `Project policy \`${POLICY_HASH}\`, search-demand v7 and trend-topic v11 are live.`,
        "The previous park decisions are invalid because `no_entity_anchor` was used as a terminal reason even though audience fit and topic-domain match were high.",
        "",
        "Re-evaluate only the five existing phrases from this issue. Reuse the stored trend report and provider cache; do not generate a new trend report and do not invent replacement phrases.",
        "Start new Semantic Core layer runs after this final policy registration. Runs timestamped `212001`, `212225`, or `212529` predate the final editorial-bridge policy and are evidence history only, not the completion result.",
        "A prior interrupted session created AST-994 under the previous policy hash. Reuse or reconcile it only after the new-hash validation confirms the canonical cluster; never create a duplicate ingestion issue.",
        "",
        "Acceptance requirements:",
        "- current audience trend evidence and likely Astrogen audience fit",
        "- query-shaped demand; unavailable provider volume is not zero volume",
        "- a defensible non-clinical editorial perspective with safety sources where needed",
        "- a real SERP/information gap plus CMS coverage and cannibalization review",
        "- useful internal links that serve the reader; product mention is optional body context only",
        "- no Astrogen product, service or modality name in the topic, primary query, title, H1, slug or cluster key",
        "",
        "Clustering and quota:",
        "- these five phrases represent at most two reader-intent clusters, not five topics",
        "- accepted phrases in one cluster become supporting queries of one native search-demand opportunity",
        "- set `portfolioLane=audience_interest_editorial` where the topic relies on audience interest rather than direct product demand",
        "- this lane targets two and is capped at four delivered articles per Europe/Kiev calendar month, with at most one per daily allocator batch",
        "",
        "Route accepted cluster evidence to SEO Blog Content Strategist for canonical ingestion. Do not create topic or article cases directly. Replace the pending `trendIngestionResult` with final dispositions and real native case IDs before completion.",
      ].join("\n"),
    });

    await request(token, "PATCH", `/issues/${parent.id}`, {
      status: "blocked",
      blockedByIssueIds: [child.id],
      comment: [
        "The existing relationships evidence is being re-evaluated under the corrected audience-interest editorial policy.",
        "",
        "AST-923 is the only live child. Do not create another trend report or validation wave while it is active. Resume portfolio orchestration from its cluster-level result.",
      ].join("\n"),
    });

    process.stdout.write(`${JSON.stringify({
      ok: true,
      backup: {
        backupDir: backup.backupDir ?? null,
        sizeBytes: backup.sizeBytes ?? null,
        finishedAt: backup.finishedAt ?? null,
      },
      parent: { issue: parent.identifier, status: "blocked", blockedBy: child.identifier },
      child: { issue: child.identifier, status: "todo" },
      candidatePhraseCount: CANDIDATES.length,
      maximumIntentClusterCount: 2,
      newTrendReportForbidden: true,
      cancelledRunIds: activeRunIds,
      taskSessionReset: true,
    }, null, 2)}\n`);
  } finally {
    psql(`update board_api_keys set revoked_at=now(), last_used_at=now() where id=${quote(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
