ALTER TABLE "cost_events" RENAME COLUMN "cost_cents" TO "cost_usd";
--> statement-breakpoint
ALTER TABLE "cost_events"
  ALTER COLUMN "cost_usd" TYPE double precision
  USING ("cost_usd"::double precision / 100.0);
--> statement-breakpoint
ALTER TABLE "companies" RENAME COLUMN "budget_monthly_cents" TO "budget_monthly_usd";
--> statement-breakpoint
ALTER TABLE "companies" RENAME COLUMN "spent_monthly_cents" TO "spent_monthly_usd";
--> statement-breakpoint
ALTER TABLE "companies"
  ALTER COLUMN "budget_monthly_usd" TYPE double precision
  USING ("budget_monthly_usd"::double precision / 100.0);
--> statement-breakpoint
ALTER TABLE "companies"
  ALTER COLUMN "spent_monthly_usd" TYPE double precision
  USING ("spent_monthly_usd"::double precision / 100.0);
--> statement-breakpoint
ALTER TABLE "agents" RENAME COLUMN "budget_monthly_cents" TO "budget_monthly_usd";
--> statement-breakpoint
ALTER TABLE "agents" RENAME COLUMN "spent_monthly_cents" TO "spent_monthly_usd";
--> statement-breakpoint
ALTER TABLE "agents"
  ALTER COLUMN "budget_monthly_usd" TYPE double precision
  USING ("budget_monthly_usd"::double precision / 100.0);
--> statement-breakpoint
ALTER TABLE "agents"
  ALTER COLUMN "spent_monthly_usd" TYPE double precision
  USING ("spent_monthly_usd"::double precision / 100.0);
--> statement-breakpoint
ALTER TABLE "agent_runtime_state" RENAME COLUMN "total_cost_cents" TO "total_cost_usd";
--> statement-breakpoint
ALTER TABLE "agent_runtime_state"
  ALTER COLUMN "total_cost_usd" TYPE double precision
  USING ("total_cost_usd"::double precision / 100.0);
