-- Preflight schema bridge for upgrading a Vicarta USD-first database onto the
-- upstream v2026.403.0 schema/migration line.
--
-- Purpose:
-- - restore upstream core column names/types before running pnpm db:migrate
-- - leave extra Vicarta-only fields/tables in place for later re-evaluation
--
-- Safe usage:
-- - run only after a fresh database backup
-- - rehearse on staging first
-- - intended to be idempotent when rerun against the same database

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cost_events'
      AND column_name = 'cost_usd'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cost_events'
      AND column_name = 'cost_cents'
  ) THEN
    ALTER TABLE "cost_events" RENAME COLUMN "cost_usd" TO "cost_cents";
    ALTER TABLE "cost_events"
      ALTER COLUMN "cost_cents" TYPE integer
      USING round("cost_cents" * 100.0)::integer;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'companies'
      AND column_name = 'budget_monthly_usd'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'companies'
      AND column_name = 'budget_monthly_cents'
  ) THEN
    ALTER TABLE "companies" RENAME COLUMN "budget_monthly_usd" TO "budget_monthly_cents";
    ALTER TABLE "companies"
      ALTER COLUMN "budget_monthly_cents" TYPE integer
      USING round("budget_monthly_cents" * 100.0)::integer;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'companies'
      AND column_name = 'spent_monthly_usd'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'companies'
      AND column_name = 'spent_monthly_cents'
  ) THEN
    ALTER TABLE "companies" RENAME COLUMN "spent_monthly_usd" TO "spent_monthly_cents";
    ALTER TABLE "companies"
      ALTER COLUMN "spent_monthly_cents" TYPE integer
      USING round("spent_monthly_cents" * 100.0)::integer;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agents'
      AND column_name = 'budget_monthly_usd'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agents'
      AND column_name = 'budget_monthly_cents'
  ) THEN
    ALTER TABLE "agents" RENAME COLUMN "budget_monthly_usd" TO "budget_monthly_cents";
    ALTER TABLE "agents"
      ALTER COLUMN "budget_monthly_cents" TYPE integer
      USING round("budget_monthly_cents" * 100.0)::integer;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agents'
      AND column_name = 'spent_monthly_usd'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agents'
      AND column_name = 'spent_monthly_cents'
  ) THEN
    ALTER TABLE "agents" RENAME COLUMN "spent_monthly_usd" TO "spent_monthly_cents";
    ALTER TABLE "agents"
      ALTER COLUMN "spent_monthly_cents" TYPE integer
      USING round("spent_monthly_cents" * 100.0)::integer;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agent_runtime_state'
      AND column_name = 'total_cost_usd'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agent_runtime_state'
      AND column_name = 'total_cost_cents'
  ) THEN
    ALTER TABLE "agent_runtime_state" RENAME COLUMN "total_cost_usd" TO "total_cost_cents";
    ALTER TABLE "agent_runtime_state"
      ALTER COLUMN "total_cost_cents" TYPE bigint
      USING round("total_cost_cents" * 100.0)::bigint;
  END IF;
END $$;

COMMIT;
