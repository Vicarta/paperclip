---
title: Upstream v2026.403.0 DB Convergence Runbook
summary: Staging-first database reconciliation procedure for moving Vicarta live data onto the upstream v2026.403.0 schema model
---

## Purpose

This runbook defines the execution order for database reconciliation during the `v2026.403.0` convergence wave.

It is intentionally conservative:

- no live mutation before staging rehearsal succeeds
- no migration is considered safe until backup, probe, and rollback steps are documented
- no legacy Vicarta schema is preserved automatically just because it already exists

Critical finding:

- upstream migration-history reconciliation is not enough on its own for the Vicarta fork
- a one-time preflight schema bridge is required before `pnpm db:migrate`

## Scope

This runbook covers the schema/data reconciliation needed for:

- `companies`
- `projects`
- `cost_events`
- `adapter_company_settings`
- migration journal divergence between the pre-convergence Vicarta branch and upstream `v2026.403.0`

## Preconditions

Before running any DB-changing action:

1. The code branch must already be based on upstream `v2026.403.0`.
2. The upstream baseline must pass local typecheck.
3. The DB reconciliation worksheet must be up to date.
4. A staging database cloned from live must be available.
5. Direct database access for migrations must use a direct Postgres connection, not a pooled connection.

Reference docs:

- [Database deployment guide](/Users/savitsky/CodexProjects/paper-clip/local-paperclip/docs/deploy/database.md)
- [DB reconciliation worksheet](/Users/savitsky/CodexProjects/paper-clip/local-paperclip/doc/plans/2026-04-14-db-reconciliation-worksheet.md)

## Target Schema Policy

Canonical target is the upstream `v2026.403.0` DB model.

Accepted policy decisions:

- budgets/spend move to upstream cents model
- legacy Vicarta USD-first storage is not preserved as canonical schema
- `projects.human_facing_language` is not carried into the first convergence wave
- `adapter_company_settings` may return only as a new post-`0048` extension if still required
- extra Vicarta-only tables/columns may remain present during the bridge, but upstream core columns must exist under upstream names before migrations run

## Phase A. Read-Only Fact Collection

Run these steps first against **staging clone** and later repeat them against live immediately before migration.

### A1. Confirm migration status

```sh
DATABASE_URL='postgres://…' pnpm --filter @paperclipai/db exec tsx src/migration-status.ts --json
```

Capture:

- migration source
- pending migrations
- whether the DB already differs from expected baseline

### A2. Take a verified backup

```sh
DATABASE_URL='postgres://…' pnpm db:backup
```

Record:

- backup file path
- backup size
- timestamp

Do not proceed unless backup completed successfully.

### A3. Record table-level fact probes

Use `psql` against the direct connection:

```sh
psql "$DATABASE_URL"
```

Run:

```sql
SELECT COUNT(*) AS companies_count FROM companies;
SELECT COUNT(*) AS projects_count FROM projects;
SELECT COUNT(*) AS cost_events_count FROM cost_events;

SELECT
  COUNT(*) FILTER (WHERE budget_monthly_usd IS NOT NULL) AS companies_with_budget_usd,
  COUNT(*) FILTER (WHERE spent_monthly_usd IS NOT NULL) AS companies_with_spend_usd
FROM companies;

SELECT
  COUNT(*) FILTER (WHERE human_facing_language IS NOT NULL) AS projects_with_human_language
FROM projects;

SELECT
  COUNT(*) FILTER (WHERE cost_usd IS NOT NULL) AS cost_rows_with_usd,
  MIN(cost_usd) AS min_cost_usd,
  MAX(cost_usd) AS max_cost_usd
FROM cost_events;

SELECT provider, COUNT(*) AS rows
FROM cost_events
GROUP BY provider
ORDER BY rows DESC;
```

If `adapter_company_settings` exists:

```sql
SELECT COUNT(*) AS adapter_company_settings_count
FROM adapter_company_settings;

SELECT adapter_type, COUNT(*) AS rows
FROM adapter_company_settings
GROUP BY adapter_type
ORDER BY rows DESC;
```

Save results in the migration notes for the exact rehearsal or live run.

### A4. Probe legacy data quality

Run:

```sql
SELECT COUNT(*) AS negative_budget_usd_rows
FROM companies
WHERE budget_monthly_usd < 0 OR spent_monthly_usd < 0;

SELECT COUNT(*) AS negative_cost_usd_rows
FROM cost_events
WHERE cost_usd < 0;

SELECT COUNT(*) AS high_precision_cost_rows
FROM cost_events
WHERE ABS(cost_usd * 100 - ROUND(cost_usd * 100)) > 0.000001;
```

Why this matters:

- negative or unusually precise legacy values may affect cents conversion

Hard stop:

- if these probes reveal unexpected anomalies, pause and update the reconciliation worksheet before any migration script is written

## Phase B. Preflight Schema Bridge Design

This phase produces code, not live actions.

Before upstream migrations are applied, run the idempotent bridge script:

- [preflight schema bridge SQL](/Users/savitsky/CodexProjects/paper-clip/local-paperclip/docs/deploy/sql/upstream-v2026-403-0-preflight-schema-bridge.sql)

Bridge responsibilities:

- restore `cost_events.cost_usd -> cost_cents`
- restore `companies.budget_monthly_usd/spent_monthly_usd -> *_cents`
- restore `agents.budget_monthly_usd/spent_monthly_usd -> *_cents`
- restore `agent_runtime_state.total_cost_usd -> total_cost_cents`

Bridge rules:

- convert dollars back to cents with `round(value * 100.0)`
- do not drop `human_facing_language`
- do not drop `adapter_company_settings`
- do not recreate retained extensions yet

### B1. Why this bridge is required

Without the bridge, upstream pending migrations can fail on the old Vicarta schema.

Example:

- old Vicarta schema after custom `0032` has `companies.budget_monthly_usd`
- upstream `0032_pretty_doctor_octopus.sql` expects `companies.budget_monthly_cents`

So the upstream migration engine cannot safely reconcile this by journal repair alone.

## Phase C. Upstream Migration Application Design

### C1. New migration numbering rule

Any Vicarta-specific convergence migration must be created **after upstream `0048`**.

Do not:

- reuse old `0030–0032` numbers
- attempt to preserve old Vicarta migration journal ordering

### C2. Post-baseline convergence changes

After the preflight bridge and upstream `0030-0048` complete, only these remaining convergence decisions should remain:

1. `projects`
   - decide whether to ignore or drop legacy `human_facing_language`
2. `adapter_company_settings`
   - decide whether it needs a new post-`0048` migration for fresh environments
   - for in-place live upgrades, prefer preserving the existing table and validating compatibility first

### C3. Legacy default policy

Legacy `cost_events` policy after upstream `0031_zippy_magma.sql`:

- `cached_input_tokens = 0`
- `heartbeat_run_id = null`
- `billing_type = 'unknown'`
- `biller = 'unknown'`

These values are expected to be supplied by upstream defaults on existing rows once the bridge restores `cost_cents`.

## Phase D. Staging Rehearsal

Staging rehearsal is mandatory.

### D1. Prepare staging DB clone

- clone live DB into an isolated staging database
- verify the clone is restorable and writable
- point `DATABASE_URL` at the staging clone

### D2. Run backup again on staging

```sh
DATABASE_URL='postgres://…' pnpm db:backup
```

### D3. Run migration status

```sh
DATABASE_URL='postgres://…' pnpm --filter @paperclipai/db exec tsx src/migration-status.ts --json
```

### D4. Apply preflight schema bridge

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/deploy/sql/upstream-v2026-403-0-preflight-schema-bridge.sql
```

Immediately verify the bridge:

```sql
SELECT budget_monthly_cents, spent_monthly_cents FROM companies LIMIT 5;
SELECT budget_monthly_cents, spent_monthly_cents FROM agents LIMIT 5;
SELECT cost_cents FROM cost_events LIMIT 5;
SELECT total_cost_cents FROM agent_runtime_state LIMIT 5;
```

### D5. Apply migrations

```sh
DATABASE_URL='postgres://…' pnpm db:migrate
```

### D6. Re-run migration status

```sh
DATABASE_URL='postgres://…' pnpm --filter @paperclipai/db exec tsx src/migration-status.ts --json
```

Expected result:

- status is `upToDate`

### D7. Post-migration verification probes

Run:

```sql
SELECT
  budget_monthly_cents,
  spent_monthly_cents,
  pause_reason,
  paused_at
FROM companies
LIMIT 10;

SELECT
  cost_cents,
  cached_input_tokens,
  biller,
  billing_type,
  heartbeat_run_id
FROM cost_events
LIMIT 20;
```

Also verify:

```sql
SELECT COUNT(*) FROM cost_events WHERE cost_cents IS NULL;
SELECT COUNT(*) FROM companies WHERE budget_monthly_cents IS NULL OR spent_monthly_cents IS NULL;
```

If `adapter_company_settings` was recreated:

```sql
SELECT COUNT(*) FROM adapter_company_settings;
```

### D8. Application smoke on staging

After staging DB migration, run app-level checks against the same staging database:

```sh
pnpm --filter @paperclipai/shared typecheck
pnpm --filter @paperclipai/db typecheck
pnpm --filter @paperclipai/server typecheck
pnpm --filter @paperclipai/ui typecheck
```

Then run targeted runtime smoke:

- health endpoint
- costs page loads
- direct OpenRouter settings read/write if retained
- issue document create/update smoke
- at least one manager lane and one issue-bound lane

## Phase E. Live Migration

Live migration is allowed only if staging rehearsal succeeded end-to-end.

### E1. Freeze window

Before touching live:

- announce maintenance window
- pause non-essential agent execution
- ensure no conflicting deploy is in progress

### E2. Repeat live fact collection

Repeat all read-only probes from Phase A against live immediately before backup.

This confirms:

- row counts did not materially shift since staging clone
- no new anomaly appeared

### E3. Live backup

```sh
DATABASE_URL='postgres://…' pnpm db:backup
```

Record the exact backup artifact.

### E4. Apply preflight schema bridge

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/deploy/sql/upstream-v2026-403-0-preflight-schema-bridge.sql
```

### E5. Apply migrations

```sh
DATABASE_URL='postgres://…' pnpm db:migrate
```

### E6. Verify migration status

```sh
DATABASE_URL='postgres://…' pnpm --filter @paperclipai/db exec tsx src/migration-status.ts --json
```

### E7. Live smoke

Minimum required smoke:

- `/api/health`
- login and open board
- costs page renders
- required adapters/plugins register
- issue document update works
- at least one OpenRouter smoke run

## Rollback Rules

Rollback is required if any of the following happen:

- migration command exits non-zero
- preflight bridge leaves required upstream core columns missing or incorrectly typed
- migration status is not `upToDate` afterward
- post-migration probes show nulls in required upstream fields
- app cannot boot against migrated schema
- issue document writes or required adapter configuration flows are broken

Rollback method:

1. stop app writes
2. restore DB from the backup created in the same maintenance window
3. verify restored DB opens correctly
4. document exact failure before attempting another migration

Do not attempt ad-hoc hotfix SQL directly on live unless the failure analysis explicitly requires it and the rollback path is preserved.

## Deliverables Before Moving to Feature Re-Port

The DB phase is complete only when all of the following are true:

- staging rehearsal succeeded
- live migration succeeded or is demonstrably ready
- upstream schema is the canonical live model
- legacy USD-first storage is no longer the core contract
- any retained extension table is recreated in post-`0048` migration space

## Next Phase Trigger

Only after this runbook is satisfied should the convergence branch move to:

- direct external `openrouter` adapter re-port
- provider plugin re-port
- issue-document compatibility validation
