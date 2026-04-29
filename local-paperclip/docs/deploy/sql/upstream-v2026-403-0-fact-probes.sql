-- Read-only fact probes for a Vicarta database before upstream v2026.403.0 convergence.
-- Run with:
--   psql "$DATABASE_URL" -f docs/deploy/sql/upstream-v2026-403-0-fact-probes.sql

\echo '=== row counts ==='
SELECT COUNT(*) AS companies_count FROM companies;
SELECT COUNT(*) AS projects_count FROM projects;
SELECT COUNT(*) AS agents_count FROM agents;
SELECT COUNT(*) AS agent_runtime_state_count FROM agent_runtime_state;
SELECT COUNT(*) AS cost_events_count FROM cost_events;

\echo '=== legacy usd schema presence ==='
SELECT
  COUNT(*) FILTER (WHERE budget_monthly_usd IS NOT NULL) AS companies_with_budget_usd,
  COUNT(*) FILTER (WHERE spent_monthly_usd IS NOT NULL) AS companies_with_spend_usd
FROM companies;

SELECT
  COUNT(*) FILTER (WHERE budget_monthly_usd IS NOT NULL) AS agents_with_budget_usd,
  COUNT(*) FILTER (WHERE spent_monthly_usd IS NOT NULL) AS agents_with_spend_usd
FROM agents;

SELECT
  COUNT(*) FILTER (WHERE total_cost_usd IS NOT NULL) AS runtime_rows_with_total_cost_usd
FROM agent_runtime_state;

SELECT
  COUNT(*) FILTER (WHERE cost_usd IS NOT NULL) AS cost_rows_with_usd,
  MIN(cost_usd) AS min_cost_usd,
  MAX(cost_usd) AS max_cost_usd
FROM cost_events;

\echo '=== optional vicarta extensions ==='
SELECT
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'human_facing_language'
  ) AS has_projects_human_facing_language;

SELECT
  EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'adapter_company_settings'
  ) AS has_adapter_company_settings;

\echo '=== legacy quality probes ==='
SELECT COUNT(*) AS negative_budget_usd_rows
FROM companies
WHERE budget_monthly_usd < 0 OR spent_monthly_usd < 0;

SELECT COUNT(*) AS negative_agent_budget_usd_rows
FROM agents
WHERE budget_monthly_usd < 0 OR spent_monthly_usd < 0;

SELECT COUNT(*) AS negative_cost_usd_rows
FROM cost_events
WHERE cost_usd < 0;

SELECT COUNT(*) AS high_precision_company_budget_rows
FROM companies
WHERE ABS(budget_monthly_usd * 100 - ROUND(budget_monthly_usd * 100)) > 0.000001
   OR ABS(spent_monthly_usd * 100 - ROUND(spent_monthly_usd * 100)) > 0.000001;

SELECT COUNT(*) AS high_precision_agent_budget_rows
FROM agents
WHERE ABS(budget_monthly_usd * 100 - ROUND(budget_monthly_usd * 100)) > 0.000001
   OR ABS(spent_monthly_usd * 100 - ROUND(spent_monthly_usd * 100)) > 0.000001;

SELECT COUNT(*) AS high_precision_cost_rows
FROM cost_events
WHERE ABS(cost_usd * 100 - ROUND(cost_usd * 100)) > 0.000001;

\echo '=== provider distribution ==='
SELECT provider, COUNT(*) AS rows
FROM cost_events
GROUP BY provider
ORDER BY rows DESC, provider ASC;

\echo '=== adapter settings distribution (if table exists) ==='
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'adapter_company_settings'
  ) THEN
    RAISE NOTICE 'adapter_company_settings exists; run the grouped counts query below manually:';
    RAISE NOTICE 'SELECT adapter_type, COUNT(*) AS rows FROM adapter_company_settings GROUP BY adapter_type ORDER BY rows DESC;';
  ELSE
    RAISE NOTICE 'adapter_company_settings does not exist';
  END IF;
END $$;
