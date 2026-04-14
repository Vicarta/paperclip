-- Verification probes after applying the preflight schema bridge and/or upstream migrations.
-- Run with:
--   psql "$DATABASE_URL" -f docs/deploy/sql/upstream-v2026-403-0-post-bridge-verification.sql

\echo '=== upstream core columns now present ==='
SELECT budget_monthly_cents, spent_monthly_cents FROM companies LIMIT 5;
SELECT budget_monthly_cents, spent_monthly_cents FROM agents LIMIT 5;
SELECT total_cost_cents FROM agent_runtime_state LIMIT 5;
SELECT cost_cents FROM cost_events LIMIT 5;

\echo '=== legacy usd columns should be absent after bridge ==='
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'budget_monthly_usd'
) AS companies_budget_usd_still_exists;

SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'agents' AND column_name = 'budget_monthly_usd'
) AS agents_budget_usd_still_exists;

SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'agent_runtime_state' AND column_name = 'total_cost_usd'
) AS runtime_total_cost_usd_still_exists;

SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'cost_events' AND column_name = 'cost_usd'
) AS cost_events_cost_usd_still_exists;

\echo '=== nullability sanity ==='
SELECT COUNT(*) AS companies_missing_cents
FROM companies
WHERE budget_monthly_cents IS NULL OR spent_monthly_cents IS NULL;

SELECT COUNT(*) AS agents_missing_cents
FROM agents
WHERE budget_monthly_cents IS NULL OR spent_monthly_cents IS NULL;

SELECT COUNT(*) AS runtime_missing_total_cost_cents
FROM agent_runtime_state
WHERE total_cost_cents IS NULL;

SELECT COUNT(*) AS cost_events_missing_cost_cents
FROM cost_events
WHERE cost_cents IS NULL;
