ALTER TABLE "cost_events" ADD COLUMN IF NOT EXISTS "amount_micros" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_events" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_events" ADD COLUMN IF NOT EXISTS "service" text;--> statement-breakpoint
ALTER TABLE "cost_events" ADD COLUMN IF NOT EXISTS "operation" text;--> statement-breakpoint
ALTER TABLE "cost_events" ADD COLUMN IF NOT EXISTS "tool_name" text;--> statement-breakpoint
ALTER TABLE "cost_events" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'succeeded' NOT NULL;--> statement-breakpoint
UPDATE "cost_events"
SET "amount_micros" = greatest(0, "cost_cents")::bigint * 10000
WHERE "amount_micros" = 0 AND "cost_cents" > 0;--> statement-breakpoint
ALTER TABLE "cost_events" DROP CONSTRAINT IF EXISTS "cost_events_heartbeat_run_id_heartbeat_runs_id_fk";--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_heartbeat_run_id_heartbeat_runs_id_fk"
  FOREIGN KEY ("heartbeat_run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_events" DROP CONSTRAINT IF EXISTS "finance_events_heartbeat_run_id_heartbeat_runs_id_fk";--> statement-breakpoint
ALTER TABLE "finance_events" ADD CONSTRAINT "finance_events_heartbeat_run_id_heartbeat_runs_id_fk"
  FOREIGN KEY ("heartbeat_run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cost_monthly_rollups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "month_start" timestamp with time zone NOT NULL,
  "agent_id" uuid,
  "issue_id" uuid,
  "project_id" uuid,
  "goal_id" uuid,
  "billing_code" text,
  "provider" text NOT NULL,
  "biller" text NOT NULL,
  "billing_type" text NOT NULL,
  "model" text NOT NULL,
  "service" text,
  "operation" text,
  "currency" text DEFAULT 'USD' NOT NULL,
  "event_count" integer DEFAULT 0 NOT NULL,
  "input_tokens" bigint DEFAULT 0 NOT NULL,
  "cached_input_tokens" bigint DEFAULT 0 NOT NULL,
  "output_tokens" bigint DEFAULT 0 NOT NULL,
  "cost_cents" bigint DEFAULT 0 NOT NULL,
  "amount_micros" bigint DEFAULT 0 NOT NULL,
  "rebuilt_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "cost_monthly_rollups" DROP CONSTRAINT IF EXISTS "cost_monthly_rollups_company_id_companies_id_fk";--> statement-breakpoint
ALTER TABLE "cost_monthly_rollups" ADD CONSTRAINT "cost_monthly_rollups_company_id_companies_id_fk"
  FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_monthly_rollups" DROP CONSTRAINT IF EXISTS "cost_monthly_rollups_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "cost_monthly_rollups" ADD CONSTRAINT "cost_monthly_rollups_agent_id_agents_id_fk"
  FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_monthly_rollups" DROP CONSTRAINT IF EXISTS "cost_monthly_rollups_issue_id_issues_id_fk";--> statement-breakpoint
ALTER TABLE "cost_monthly_rollups" ADD CONSTRAINT "cost_monthly_rollups_issue_id_issues_id_fk"
  FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_monthly_rollups" DROP CONSTRAINT IF EXISTS "cost_monthly_rollups_project_id_projects_id_fk";--> statement-breakpoint
ALTER TABLE "cost_monthly_rollups" ADD CONSTRAINT "cost_monthly_rollups_project_id_projects_id_fk"
  FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_monthly_rollups" DROP CONSTRAINT IF EXISTS "cost_monthly_rollups_goal_id_goals_id_fk";--> statement-breakpoint
ALTER TABLE "cost_monthly_rollups" ADD CONSTRAINT "cost_monthly_rollups_goal_id_goals_id_fk"
  FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_events_company_service_occurred_idx" ON "cost_events" USING btree ("company_id","service","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_monthly_rollups_company_month_idx" ON "cost_monthly_rollups" USING btree ("company_id","month_start");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cost_monthly_rollups_company_provider_month_idx" ON "cost_monthly_rollups" USING btree ("company_id","provider","month_start");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cost_monthly_rollups_dimension_uq" ON "cost_monthly_rollups" (
  "company_id",
  "month_start",
  coalesce("agent_id", '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce("issue_id", '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce("project_id", '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce("goal_id", '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce("billing_code", ''),
  "provider",
  "biller",
  "billing_type",
  "model",
  coalesce("service", ''),
  coalesce("operation", ''),
  "currency"
);
