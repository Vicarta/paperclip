import { and, desc, eq, gte, isNotNull, lt, lte, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { activityLog, agents, companies, costEvents, heartbeatRuns, issues, projects } from "@paperclipai/db";
import { notFound, unprocessable } from "../errors.js";
import { budgetService, type BudgetServiceHooks } from "./budgets.js";

export interface CostDateRange {
  from?: Date;
  to?: Date;
}

const METERED_BILLING_TYPE = "metered_api";
const SUBSCRIPTION_BILLING_TYPES = ["subscription_included", "subscription_overage"] as const;

function currentUtcMonthWindow(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return {
    start: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0)),
  };
}

async function getMonthlySpendTotal(
  db: Db,
  scope: { companyId: string; agentId?: string | null },
) {
  const { start, end } = currentUtcMonthWindow();
  const conditions = [
    eq(costEvents.companyId, scope.companyId),
    gte(costEvents.occurredAt, start),
    lt(costEvents.occurredAt, end),
  ];
  if (scope.agentId) {
    conditions.push(eq(costEvents.agentId, scope.agentId));
  }
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
    })
    .from(costEvents)
    .where(and(...conditions));
  return Number(row?.total ?? 0);
}

export function costService(db: Db, budgetHooks: BudgetServiceHooks = {}) {
  const budgets = budgetService(db, budgetHooks);
  return {
    createEvent: async (companyId: string, data: Omit<typeof costEvents.$inferInsert, "companyId">) => {
      const agent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, data.agentId))
        .then((rows) => rows[0] ?? null);

      if (!agent) throw notFound("Agent not found");
      if (agent.companyId !== companyId) {
        throw unprocessable("Agent does not belong to company");
      }

      const event = await db
        .insert(costEvents)
        .values({
          ...data,
          companyId,
          biller: data.biller ?? data.provider,
          billingType: data.billingType ?? "unknown",
          cachedInputTokens: data.cachedInputTokens ?? 0,
        })
        .returning()
        .then((rows) => rows[0]);

      const [agentMonthSpend, companyMonthSpend] = await Promise.all([
        getMonthlySpendTotal(db, { companyId, agentId: event.agentId }),
        getMonthlySpendTotal(db, { companyId }),
      ]);

      await db
        .update(agents)
        .set({
          spentMonthlyCents: agentMonthSpend,
          updatedAt: new Date(),
        })
        .where(eq(agents.id, event.agentId));

      await db
        .update(companies)
        .set({
          spentMonthlyCents: companyMonthSpend,
          updatedAt: new Date(),
        })
        .where(eq(companies.id, companyId));

      await budgets.evaluateCostEvent(event);

      return event;
    },

    summary: async (companyId: string, range?: CostDateRange) => {
      const company = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .then((rows) => rows[0] ?? null);

      if (!company) throw notFound("Company not found");

      const conditions: ReturnType<typeof eq>[] = [eq(costEvents.companyId, companyId)];
      if (range?.from) conditions.push(gte(costEvents.occurredAt, range.from));
      if (range?.to) conditions.push(lte(costEvents.occurredAt, range.to));

      const [{ total }] = await db
        .select({
          total: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
        })
        .from(costEvents)
        .where(and(...conditions));

      const spendCents = Number(total);
      const utilization =
        company.budgetMonthlyCents > 0
          ? (spendCents / company.budgetMonthlyCents) * 100
          : 0;

      return {
        companyId,
        spendCents,
        budgetCents: company.budgetMonthlyCents,
        utilizationPercent: Number(utilization.toFixed(2)),
      };
    },

    byAgent: async (companyId: string, range?: CostDateRange) => {
      const conditions: ReturnType<typeof eq>[] = [eq(costEvents.companyId, companyId)];
      if (range?.from) conditions.push(gte(costEvents.occurredAt, range.from));
      if (range?.to) conditions.push(lte(costEvents.occurredAt, range.to));

      return db
        .select({
          agentId: costEvents.agentId,
          agentName: agents.name,
          agentStatus: agents.status,
          costCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
          inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
          cachedInputTokens: sql<number>`coalesce(sum(${costEvents.cachedInputTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`,
          apiRunCount:
            sql<number>`count(distinct case when ${costEvents.billingType} = ${METERED_BILLING_TYPE} then ${costEvents.heartbeatRunId} end)::int`,
          subscriptionRunCount:
            sql<number>`count(distinct case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.heartbeatRunId} end)::int`,
          subscriptionCachedInputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.cachedInputTokens} else 0 end), 0)::int`,
          subscriptionInputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.inputTokens} else 0 end), 0)::int`,
          subscriptionOutputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.outputTokens} else 0 end), 0)::int`,
        })
        .from(costEvents)
        .leftJoin(agents, eq(costEvents.agentId, agents.id))
        .where(and(...conditions))
        .groupBy(costEvents.agentId, agents.name, agents.status)
        .orderBy(desc(sql`coalesce(sum(${costEvents.costCents}), 0)::int`));
    },

    byProvider: async (companyId: string, range?: CostDateRange) => {
      const conditions: ReturnType<typeof eq>[] = [eq(costEvents.companyId, companyId)];
      if (range?.from) conditions.push(gte(costEvents.occurredAt, range.from));
      if (range?.to) conditions.push(lte(costEvents.occurredAt, range.to));

      return db
        .select({
          provider: costEvents.provider,
          biller: costEvents.biller,
          billingType: costEvents.billingType,
          model: costEvents.model,
          costCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
          inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
          cachedInputTokens: sql<number>`coalesce(sum(${costEvents.cachedInputTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`,
          apiRunCount:
            sql<number>`count(distinct case when ${costEvents.billingType} = ${METERED_BILLING_TYPE} then ${costEvents.heartbeatRunId} end)::int`,
          subscriptionRunCount:
            sql<number>`count(distinct case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.heartbeatRunId} end)::int`,
          subscriptionCachedInputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.cachedInputTokens} else 0 end), 0)::int`,
          subscriptionInputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.inputTokens} else 0 end), 0)::int`,
          subscriptionOutputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.outputTokens} else 0 end), 0)::int`,
        })
        .from(costEvents)
        .where(and(...conditions))
        .groupBy(costEvents.provider, costEvents.biller, costEvents.billingType, costEvents.model)
        .orderBy(desc(sql`coalesce(sum(${costEvents.costCents}), 0)::int`));
    },

    byBiller: async (companyId: string, range?: CostDateRange) => {
      const conditions: ReturnType<typeof eq>[] = [eq(costEvents.companyId, companyId)];
      if (range?.from) conditions.push(gte(costEvents.occurredAt, range.from));
      if (range?.to) conditions.push(lte(costEvents.occurredAt, range.to));

      return db
        .select({
          biller: costEvents.biller,
          costCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
          inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
          cachedInputTokens: sql<number>`coalesce(sum(${costEvents.cachedInputTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`,
          apiRunCount:
            sql<number>`count(distinct case when ${costEvents.billingType} = ${METERED_BILLING_TYPE} then ${costEvents.heartbeatRunId} end)::int`,
          subscriptionRunCount:
            sql<number>`count(distinct case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.heartbeatRunId} end)::int`,
          subscriptionCachedInputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.cachedInputTokens} else 0 end), 0)::int`,
          subscriptionInputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.inputTokens} else 0 end), 0)::int`,
          subscriptionOutputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.outputTokens} else 0 end), 0)::int`,
          providerCount: sql<number>`count(distinct ${costEvents.provider})::int`,
          modelCount: sql<number>`count(distinct ${costEvents.model})::int`,
        })
        .from(costEvents)
        .where(and(...conditions))
        .groupBy(costEvents.biller)
        .orderBy(desc(sql`coalesce(sum(${costEvents.costCents}), 0)::int`));
    },

    /**
     * aggregates cost_events by provider for each of three rolling windows:
     * last 5 hours, last 24 hours, last 7 days.
     * purely internal consumption data, no external rate-limit sources.
     */
    windowSpend: async (companyId: string) => {
      const windows = [
        { label: "5h", hours: 5 },
        { label: "24h", hours: 24 },
        { label: "7d", hours: 168 },
      ] as const;

      const results = await Promise.all(
        windows.map(async ({ label, hours }) => {
          const since = new Date(Date.now() - hours * 60 * 60 * 1000);
          const rows = await db
            .select({
              provider: costEvents.provider,
              biller: sql<string>`case when count(distinct ${costEvents.biller}) = 1 then min(${costEvents.biller}) else 'mixed' end`,
              costCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
              inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
              cachedInputTokens: sql<number>`coalesce(sum(${costEvents.cachedInputTokens}), 0)::int`,
              outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`,
            })
            .from(costEvents)
            .where(
              and(
                eq(costEvents.companyId, companyId),
                gte(costEvents.occurredAt, since),
              ),
            )
            .groupBy(costEvents.provider)
            .orderBy(desc(sql`coalesce(sum(${costEvents.costCents}), 0)::int`));

          return rows.map((row) => ({
            provider: row.provider,
            biller: row.biller,
            window: label as string,
            windowHours: hours,
            costCents: row.costCents,
            inputTokens: row.inputTokens,
            cachedInputTokens: row.cachedInputTokens,
            outputTokens: row.outputTokens,
          }));
        }),
      );

      return results.flat();
    },

    byAgentModel: async (companyId: string, range?: CostDateRange) => {
      const conditions: ReturnType<typeof eq>[] = [eq(costEvents.companyId, companyId)];
      if (range?.from) conditions.push(gte(costEvents.occurredAt, range.from));
      if (range?.to) conditions.push(lte(costEvents.occurredAt, range.to));

      // single query: group by agent + provider + model.
      // the (companyId, agentId, occurredAt) composite index covers this well.
      // order by provider + model for stable db-level ordering; cost-desc sort
      // within each agent's sub-rows is done client-side in the ui memo.
      return db
        .select({
          agentId: costEvents.agentId,
          agentName: agents.name,
          provider: costEvents.provider,
          biller: costEvents.biller,
          billingType: costEvents.billingType,
          model: costEvents.model,
          costCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
          inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
          cachedInputTokens: sql<number>`coalesce(sum(${costEvents.cachedInputTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`,
        })
        .from(costEvents)
        .leftJoin(agents, eq(costEvents.agentId, agents.id))
        .where(and(...conditions))
        .groupBy(
          costEvents.agentId,
          agents.name,
          costEvents.provider,
          costEvents.biller,
          costEvents.billingType,
          costEvents.model,
        )
        .orderBy(costEvents.provider, costEvents.biller, costEvents.billingType, costEvents.model);
    },

    byProject: async (companyId: string, range?: CostDateRange) => {
      const issueIdAsText = sql<string>`${issues.id}::text`;
      const runProjectLinks = db
        .selectDistinctOn([activityLog.runId, issues.projectId], {
          runId: activityLog.runId,
          projectId: issues.projectId,
        })
        .from(activityLog)
        .innerJoin(
          issues,
          and(
            eq(activityLog.entityType, "issue"),
            eq(activityLog.entityId, issueIdAsText),
          ),
        )
        .where(
          and(
            eq(activityLog.companyId, companyId),
            eq(issues.companyId, companyId),
            isNotNull(activityLog.runId),
            isNotNull(issues.projectId),
          ),
        )
        .orderBy(activityLog.runId, issues.projectId, desc(activityLog.createdAt))
        .as("run_project_links");

      const effectiveProjectId = sql<string | null>`coalesce(${costEvents.projectId}, ${runProjectLinks.projectId})`;
      const conditions: ReturnType<typeof eq>[] = [eq(costEvents.companyId, companyId)];
      if (range?.from) conditions.push(gte(costEvents.occurredAt, range.from));
      if (range?.to) conditions.push(lte(costEvents.occurredAt, range.to));

      const costCentsExpr = sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`;

      return db
        .select({
          projectId: effectiveProjectId,
          projectName: projects.name,
          costCents: costCentsExpr,
          inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
          cachedInputTokens: sql<number>`coalesce(sum(${costEvents.cachedInputTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`,
        })
        .from(costEvents)
        .leftJoin(runProjectLinks, eq(costEvents.heartbeatRunId, runProjectLinks.runId))
        .innerJoin(projects, sql`${projects.id} = ${effectiveProjectId}`)
        .where(and(...conditions, sql`${effectiveProjectId} is not null`))
        .groupBy(effectiveProjectId, projects.name)
        .orderBy(desc(costCentsExpr));
    },

    efficiency: async (companyId: string, range?: CostDateRange) => {
      const costConditions = [eq(costEvents.companyId, companyId)];
      if (range?.from) costConditions.push(gte(costEvents.occurredAt, range.from));
      if (range?.to) costConditions.push(lte(costEvents.occurredAt, range.to));

      const issueConditions = [
        eq(issues.companyId, companyId),
        eq(issues.status, "done"),
        isNotNull(issues.completedAt),
      ];
      if (range?.from) issueConditions.push(gte(issues.completedAt, range.from));
      if (range?.to) issueConditions.push(lte(issues.completedAt, range.to));

      const tokenExpr = sql<number>`(${costEvents.inputTokens} + ${costEvents.cachedInputTokens} + ${costEvents.outputTokens})`;
      const noIssueContextExpr = sql`coalesce(${heartbeatRuns.contextSnapshot}->>'issueId', ${heartbeatRuns.contextSnapshot}->>'taskId') is null`;
      const articleIssueExpr = sql`(
        coalesce(${issues.billingCode}, '') ilike '%article%'
        or coalesce(${issues.billingCode}, '') ilike '%blog%'
        or ${issues.title} ilike '%article%'
        or ${issues.title} ilike '%blog%'
        or ${issues.title} ilike '%стат%'
        or ${issues.title} ilike '%чернет%'
      )`;
      const highInputThreshold = 100_000;

      const [tokenRow] = await db
        .select({
          totalTokens: sql<number>`coalesce(sum(${tokenExpr}), 0)::bigint`,
          idleTokens: sql<number>`coalesce(sum(case when ${costEvents.issueId} is null and ${noIssueContextExpr} then ${tokenExpr} else 0 end), 0)::bigint`,
          noIssueTimerTokens: sql<number>`coalesce(sum(case when ${heartbeatRuns.invocationSource} = 'timer' and ${costEvents.issueId} is null and ${noIssueContextExpr} then ${tokenExpr} else 0 end), 0)::bigint`,
          tokensLostToFailedRuns: sql<number>`coalesce(sum(case when ${heartbeatRuns.status} in ('failed', 'timed_out', 'cancelled') then ${tokenExpr} else 0 end), 0)::bigint`,
          managerCoordinationTokens: sql<number>`coalesce(sum(case when (
            ${agents.role} ilike '%manager%'
            or ${agents.role} ilike '%chief%'
            or ${agents.name} ilike '%CEO%'
            or ${agents.name} ilike '%CMO%'
            or ${agents.name} ilike '%CTO%'
            or ${agents.name} ilike '%Chief%'
          ) then ${tokenExpr} else 0 end), 0)::bigint`,
          reworkArticleTokens: sql<number>`coalesce(sum(case when ${articleIssueExpr} and ${heartbeatRuns.status} in ('failed', 'timed_out', 'cancelled') then ${tokenExpr} else 0 end), 0)::bigint`,
          zeroOutputHighInputRuns: sql<number>`count(distinct case when ${costEvents.outputTokens} = 0 and (${costEvents.inputTokens} + ${costEvents.cachedInputTokens}) >= ${highInputThreshold} then ${costEvents.heartbeatRunId} end)::int`,
          totalCostCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
        })
        .from(costEvents)
        .leftJoin(heartbeatRuns, eq(costEvents.heartbeatRunId, heartbeatRuns.id))
        .leftJoin(issues, eq(costEvents.issueId, issues.id))
        .leftJoin(agents, eq(costEvents.agentId, agents.id))
        .where(and(...costConditions));

      const [issueRow] = await db
        .select({
          doneIssueCount: sql<number>`count(distinct ${issues.id})::int`,
          deliveredArticleIssueCount: sql<number>`count(distinct case when ${articleIssueExpr} then ${issues.id} end)::int`,
        })
        .from(issues)
        .where(and(...issueConditions));

      const topWasteRuns = await db
        .select({
          runId: costEvents.heartbeatRunId,
          agentId: costEvents.agentId,
          agentName: agents.name,
          issueId: costEvents.issueId,
          issueTitle: issues.title,
          invocationSource: heartbeatRuns.invocationSource,
          runStatus: heartbeatRuns.status,
          errorCode: heartbeatRuns.errorCode,
          tokens: sql<number>`coalesce(sum(${tokenExpr}), 0)::bigint`,
          costCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
          reason: sql<string>`case
            when ${heartbeatRuns.invocationSource} = 'timer' and ${costEvents.issueId} is null and bool_or(${noIssueContextExpr}) then 'no_issue_timer_tokens'
            when ${costEvents.issueId} is null and bool_or(${noIssueContextExpr}) then 'idle_tokens'
            when ${heartbeatRuns.status} in ('failed', 'timed_out', 'cancelled') then 'tokens_lost_to_failed_runs'
            when max(${costEvents.outputTokens}) = 0 and sum(${costEvents.inputTokens} + ${costEvents.cachedInputTokens}) >= ${highInputThreshold} then 'zero_output_high_input_run'
            else 'other'
          end`,
        })
        .from(costEvents)
        .leftJoin(heartbeatRuns, eq(costEvents.heartbeatRunId, heartbeatRuns.id))
        .leftJoin(issues, eq(costEvents.issueId, issues.id))
        .leftJoin(agents, eq(costEvents.agentId, agents.id))
        .where(
          and(
            ...costConditions,
            sql`(
              (${heartbeatRuns.invocationSource} = 'timer' and ${costEvents.issueId} is null and ${noIssueContextExpr})
              or (${costEvents.issueId} is null and ${noIssueContextExpr})
              or ${heartbeatRuns.status} in ('failed', 'timed_out', 'cancelled')
              or (${costEvents.outputTokens} = 0 and (${costEvents.inputTokens} + ${costEvents.cachedInputTokens}) >= ${highInputThreshold})
            )`,
          ),
        )
        .groupBy(
          costEvents.heartbeatRunId,
          costEvents.agentId,
          agents.name,
          costEvents.issueId,
          issues.title,
          heartbeatRuns.invocationSource,
          heartbeatRuns.status,
          heartbeatRuns.errorCode,
        )
        .orderBy(desc(sql`coalesce(sum(${tokenExpr}), 0)::bigint`))
        .limit(20);

      const totalTokens = Number(tokenRow?.totalTokens ?? 0);
      const doneIssueCount = Number(issueRow?.doneIssueCount ?? 0);
      const deliveredArticleIssueCount = Number(issueRow?.deliveredArticleIssueCount ?? 0);
      const reworkArticleTokens = Number(tokenRow?.reworkArticleTokens ?? 0);

      return {
        companyId,
        range: {
          from: range?.from?.toISOString() ?? null,
          to: range?.to?.toISOString() ?? null,
        },
        totals: {
          tokens: totalTokens,
          costCents: Number(tokenRow?.totalCostCents ?? 0),
          doneIssueCount,
          deliveredArticleIssueCount,
        },
        kpis: {
          tokensPerDoneIssue: doneIssueCount > 0 ? Math.round(totalTokens / doneIssueCount) : null,
          tokensPerDeliveredArticle: deliveredArticleIssueCount > 0 ? Math.round(totalTokens / deliveredArticleIssueCount) : null,
          idleTokens: Number(tokenRow?.idleTokens ?? 0),
          noIssueTimerTokens: Number(tokenRow?.noIssueTimerTokens ?? 0),
          zeroOutputHighInputRuns: Number(tokenRow?.zeroOutputHighInputRuns ?? 0),
          managerCoordinationTokens: Number(tokenRow?.managerCoordinationTokens ?? 0),
          reworkTokensPerArticle: deliveredArticleIssueCount > 0 ? Math.round(reworkArticleTokens / deliveredArticleIssueCount) : null,
          tokensLostToFailedRuns: Number(tokenRow?.tokensLostToFailedRuns ?? 0),
          highInputZeroOutputThresholdTokens: highInputThreshold,
        },
        topWasteRuns,
        notes: [
          "tokensPerDeliveredArticle is best-effort and uses completed issue title/billing-code article/blog matching.",
          "idle/no-issue/timer/failed-run KPIs are based on cost_events joined to heartbeat_runs.",
        ],
      };
    },
  };
}
