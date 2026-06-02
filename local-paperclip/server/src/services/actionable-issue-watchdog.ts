import { and, asc, eq, inArray, isNotNull, isNull, lt, not, or, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agentWakeupRequests, agents, heartbeatRuns, issues } from "@paperclipai/db";
import { logger } from "../middleware/logger.js";

type WakeupTriggerDetail = "manual" | "ping" | "callback" | "system";
type WakeupSource = "timer" | "assignment" | "on_demand" | "automation";

const ACTIONABLE_ISSUE_STATUSES = ["todo", "in_progress"];
const ACTIVE_WAKEUP_STATUSES = ["queued", "claimed"];
const ACTIVE_RUN_STATUSES = ["queued", "running"];
const NON_INVOKABLE_AGENT_STATUSES = ["paused", "terminated", "pending_approval"];

const DEFAULT_STALE_THRESHOLD_MS = 5 * 60 * 1000;
const DEFAULT_BATCH_LIMIT = 50;
const DEFAULT_MAX_WAKEUPS_PER_AGENT = 1;

export interface ActionableIssueWatchdogWakeupDeps {
  wakeup: (
    agentId: string,
    opts: {
      source?: WakeupSource;
      triggerDetail?: WakeupTriggerDetail;
      reason?: string | null;
      payload?: Record<string, unknown> | null;
      requestedByActorType?: "user" | "agent" | "system";
      requestedByActorId?: string | null;
      contextSnapshot?: Record<string, unknown>;
      idempotencyKey?: string | null;
    },
  ) => Promise<unknown>;
}

export interface ActionableIssueWatchdogTickOptions {
  now?: Date;
  staleThresholdMs?: number;
  batchLimit?: number;
  maxWakeupsPerAgent?: number;
}

export interface ActionableIssueWatchdogTickResult {
  checked: number;
  queued: number;
  skipped: number;
  failed: number;
}

export function actionableIssueWatchdogService(
  db: Db,
  heartbeat: ActionableIssueWatchdogWakeupDeps,
) {
  async function hasActiveIssueWakeup(issueId: string, companyId: string, agentId: string) {
    const wakeup = await db
      .select({ id: agentWakeupRequests.id })
      .from(agentWakeupRequests)
      .where(
        and(
          eq(agentWakeupRequests.companyId, companyId),
          eq(agentWakeupRequests.agentId, agentId),
          inArray(agentWakeupRequests.status, ACTIVE_WAKEUP_STATUSES),
          sql`${agentWakeupRequests.payload} ->> 'issueId' = ${issueId}`,
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);

    return Boolean(wakeup);
  }

  async function hasActiveIssueRun(issueId: string, companyId: string) {
    const run = await db
      .select({ id: heartbeatRuns.id })
      .from(heartbeatRuns)
      .leftJoin(issues, eq(issues.executionRunId, heartbeatRuns.id))
      .where(
        and(
          eq(heartbeatRuns.companyId, companyId),
          inArray(heartbeatRuns.status, ACTIVE_RUN_STATUSES),
          or(sql`${heartbeatRuns.contextSnapshot} ->> 'issueId' = ${issueId}`, eq(issues.id, issueId)),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);

    return Boolean(run);
  }

  return {
    tick: async (opts: ActionableIssueWatchdogTickOptions = {}): Promise<ActionableIssueWatchdogTickResult> => {
      const now = opts.now ?? new Date();
      const staleThresholdMs = opts.staleThresholdMs ?? DEFAULT_STALE_THRESHOLD_MS;
      const batchLimit = Math.max(1, Math.min(opts.batchLimit ?? DEFAULT_BATCH_LIMIT, 500));
      const maxWakeupsPerAgent = Math.max(1, Math.min(opts.maxWakeupsPerAgent ?? DEFAULT_MAX_WAKEUPS_PER_AGENT, 25));
      const staleBefore = new Date(now.getTime() - staleThresholdMs);

      const candidates = await db
        .select({
          id: issues.id,
          companyId: issues.companyId,
          identifier: issues.identifier,
          status: issues.status,
          priority: issues.priority,
          updatedAt: issues.updatedAt,
          assigneeAgentId: issues.assigneeAgentId,
        })
        .from(issues)
        .innerJoin(agents, eq(issues.assigneeAgentId, agents.id))
        .where(
          and(
            inArray(issues.status, ACTIONABLE_ISSUE_STATUSES),
            isNotNull(issues.assigneeAgentId),
            isNull(issues.hiddenAt),
            lt(issues.updatedAt, staleBefore),
            eq(agents.companyId, issues.companyId),
            not(inArray(agents.status, NON_INVOKABLE_AGENT_STATUSES)),
          ),
        )
        .orderBy(
          asc(issues.updatedAt),
          sql`case ${issues.priority}
            when 'urgent' then 0
            when 'high' then 1
            when 'medium' then 2
            when 'low' then 3
            else 4
          end`,
        )
        .limit(batchLimit);

      let queued = 0;
      let skipped = 0;
      let failed = 0;
      const queuedByAgent = new Map<string, number>();

      for (const issue of candidates) {
        if (!issue.assigneeAgentId) {
          skipped += 1;
          continue;
        }

        const agentQueuedCount = queuedByAgent.get(issue.assigneeAgentId) ?? 0;
        if (agentQueuedCount >= maxWakeupsPerAgent) {
          skipped += 1;
          continue;
        }

        const [activeWakeup, activeRun] = await Promise.all([
          hasActiveIssueWakeup(issue.id, issue.companyId, issue.assigneeAgentId),
          hasActiveIssueRun(issue.id, issue.companyId),
        ]);

        if (activeWakeup || activeRun) {
          skipped += 1;
          continue;
        }

        try {
          const wakeup = await heartbeat.wakeup(issue.assigneeAgentId, {
            source: "assignment",
            triggerDetail: "system",
            reason: "stale_actionable_issue",
            payload: {
              issueId: issue.id,
              issueIdentifier: issue.identifier,
              mutation: "watchdog",
            },
            requestedByActorType: "system",
            requestedByActorId: null,
            contextSnapshot: {
              issueId: issue.id,
              source: "actionable_issue_watchdog",
              wakeReason: "stale_actionable_issue",
            },
            idempotencyKey: `stale-actionable:${issue.id}:${issue.assigneeAgentId}:${issue.status}`,
          });

          if (wakeup) {
            queued += 1;
            queuedByAgent.set(issue.assigneeAgentId, agentQueuedCount + 1);
          } else {
            skipped += 1;
          }
        } catch (err) {
          failed += 1;
          logger.warn(
            { err, issueId: issue.id, issueIdentifier: issue.identifier },
            "failed to wake stale actionable issue assignee",
          );
        }
      }

      return {
        checked: candidates.length,
        queued,
        skipped,
        failed,
      };
    },
  };
}
