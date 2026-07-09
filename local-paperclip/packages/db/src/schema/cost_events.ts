import { pgTable, uuid, text, timestamp, integer, index, bigint, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { issues } from "./issues.js";
import { projects } from "./projects.js";
import { goals } from "./goals.js";
import { heartbeatRuns } from "./heartbeat_runs.js";

export const costEvents = pgTable(
  "cost_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    issueId: uuid("issue_id").references(() => issues.id),
    projectId: uuid("project_id").references(() => projects.id),
    goalId: uuid("goal_id").references(() => goals.id),
    heartbeatRunId: uuid("heartbeat_run_id").references(() => heartbeatRuns.id, { onDelete: "set null" }),
    billingCode: text("billing_code"),
    provider: text("provider").notNull(),
    biller: text("biller").notNull().default("unknown"),
    billingType: text("billing_type").notNull().default("unknown"),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    cachedInputTokens: integer("cached_input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costCents: integer("cost_cents").notNull(),
    amountMicros: bigint("amount_micros", { mode: "number" }).notNull().default(0),
    currency: text("currency").notNull().default("USD"),
    service: text("service"),
    operation: text("operation"),
    toolName: text("tool_name"),
    status: text("status").notNull().default("succeeded"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyOccurredIdx: index("cost_events_company_occurred_idx").on(table.companyId, table.occurredAt),
    companyAgentOccurredIdx: index("cost_events_company_agent_occurred_idx").on(
      table.companyId,
      table.agentId,
      table.occurredAt,
    ),
    companyProviderOccurredIdx: index("cost_events_company_provider_occurred_idx").on(
      table.companyId,
      table.provider,
      table.occurredAt,
    ),
    companyBillerOccurredIdx: index("cost_events_company_biller_occurred_idx").on(
      table.companyId,
      table.biller,
      table.occurredAt,
    ),
    companyHeartbeatRunIdx: index("cost_events_company_heartbeat_run_idx").on(
      table.companyId,
      table.heartbeatRunId,
    ),
    companyServiceOccurredIdx: index("cost_events_company_service_occurred_idx").on(
      table.companyId,
      table.service,
      table.occurredAt,
    ),
  }),
);

export const costMonthlyRollups = pgTable(
  "cost_monthly_rollups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    monthStart: timestamp("month_start", { withTimezone: true }).notNull(),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    issueId: uuid("issue_id").references(() => issues.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    billingCode: text("billing_code"),
    provider: text("provider").notNull(),
    biller: text("biller").notNull(),
    billingType: text("billing_type").notNull(),
    model: text("model").notNull(),
    service: text("service"),
    operation: text("operation"),
    currency: text("currency").notNull().default("USD"),
    eventCount: integer("event_count").notNull().default(0),
    inputTokens: bigint("input_tokens", { mode: "number" }).notNull().default(0),
    cachedInputTokens: bigint("cached_input_tokens", { mode: "number" }).notNull().default(0),
    outputTokens: bigint("output_tokens", { mode: "number" }).notNull().default(0),
    costCents: bigint("cost_cents", { mode: "number" }).notNull().default(0),
    amountMicros: bigint("amount_micros", { mode: "number" }).notNull().default(0),
    rebuiltAt: timestamp("rebuilt_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyMonthIdx: index("cost_monthly_rollups_company_month_idx").on(table.companyId, table.monthStart),
    companyProviderMonthIdx: index("cost_monthly_rollups_company_provider_month_idx").on(
      table.companyId,
      table.provider,
      table.monthStart,
    ),
    uniq: uniqueIndex("cost_monthly_rollups_dimension_uq").on(
      table.companyId,
      table.monthStart,
      table.agentId,
      table.issueId,
      table.projectId,
      table.goalId,
      table.billingCode,
      table.provider,
      table.biller,
      table.billingType,
      table.model,
      table.service,
      table.operation,
      table.currency,
    ),
  }),
);
