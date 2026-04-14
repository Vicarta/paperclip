# DB Reconciliation Worksheet for v2026.403.0 Convergence

> Date: 2026-04-14
> Baseline branch: `codex/upstream-v2026.403.0-convergence`
> Comparison source: `backup/pre-upstream-v2026.403.0-20260414-164914`

## Purpose

Record the first-pass schema and migration-lineage differences between the current Vicarta live model and the upstream `v2026.403.0` target model.

This worksheet is not the final migration runbook. It is the input for that runbook.

## Confirmed Baseline Facts

- upstream baseline branch was created from `v2026.403.0`
- after `pnpm install`, upstream baseline passes local typecheck for:
  - `@paperclipai/shared`
  - `@paperclipai/db`
  - `@paperclipai/server`
  - `@paperclipai/ui`

## Migration Lineage Divergence

### Vicarta-only migration slots

The pre-convergence branch contains custom migrations in slots that upstream already uses for different schema changes:

- `0030_project_human_facing_language.sql`
- `0031_adapter_company_settings.sql`
- `0032_cost_events_usd.sql`

### Upstream target migration range

Upstream `v2026.403.0` contains canonical migrations through:

- `0048_flashy_marrow.sql`

### Implication

We must **not** try to preserve the old Vicarta migration numbering as part of the converged branch.

Required approach:

- treat upstream migration journal as canonical target lineage
- handle Vicarta-only schema/data state through explicit reconciliation work
- create any new convergence-only migrations at the next safe number after the upstream target range

## Schema Delta Summary

### `companies`

Vicarta old model:

- `budget_monthly_usd`
- `spent_monthly_usd`

Upstream target model:

- `pause_reason`
- `paused_at`
- `budget_monthly_cents`
- `spent_monthly_cents`
- feedback sharing consent fields

Required reconciliation:

- convert live budget/spend values from USD float to upstream cents integer
- preserve company budget meaning during conversion
- accept upstream pause/feedback columns as canonical

Open question:

- whether any live reports depend on exact historic float precision beyond cent-level rounding

### `projects`

Vicarta old model:

- `human_facing_language`

Upstream target model:

- `pause_reason`
- `paused_at`
- no `human_facing_language`

Accepted direction:

- do not carry `human_facing_language` into the first convergence wave
- use upstream project model as canonical baseline

Follow-up possibility:

- if language policy is still needed later, prefer artifact/skill/config routes over core schema reintroduction

### `cost_events`

Vicarta old model:

- `cost_usd`
- no `heartbeat_run_id`
- no `biller`
- no `billing_type`
- no `cached_input_tokens`

Upstream target model:

- `heartbeat_run_id`
- `biller`
- `billing_type`
- `cached_input_tokens`
- `cost_cents`

Required reconciliation:

- derive `cost_cents` from historic `cost_usd`
- define backfill policy for:
  - `biller`
  - `billing_type`
  - `cached_input_tokens`
  - `heartbeat_run_id`

Default backfill direction:

- `cost_cents = round(cost_usd * 100)`
- `biller = provider` when no better source exists, otherwise `"unknown"` if required by exact semantics
- `billing_type = "unknown"` for legacy rows unless source attribution can be proven
- `cached_input_tokens = 0` for legacy rows
- `heartbeat_run_id = null` for legacy rows that cannot be joined safely

Critical caution:

- legacy cost rows must remain queryable after migration even if they cannot be enriched to full upstream fidelity

### `adapter_company_settings`

Vicarta old model includes:

- dedicated `adapter_company_settings` table

Upstream target model:

- no equivalent table in `v2026.403.0`

Accepted direction:

- this table is still a likely must-have because direct external OpenRouter configuration depends on it
- do not try to reuse the old `0031_*` migration slot

Required approach:

- if retained, add it back as a new post-`0048` migration on the convergence branch
- migrate live data forward from the existing table state rather than preserving old numbering

## First-Pass Reconciliation Decisions

### Keep for first convergence wave

- live data meaning for company budgets/spend
- live cost history
- OpenRouter company settings data, if present in live DB

### Drop for first convergence wave

- project `human_facing_language` core schema extension
- old USD-first storage contract as the canonical DB model

### Re-evaluate after baseline validation

- whether legacy governance logic needs additional persistence fields beyond upstream

## Immediate Technical Tasks

1. inspect live DB contents for the impacted tables:
   - `companies`
   - `projects`
   - `cost_events`
   - `adapter_company_settings`
2. quantify row counts and nullability assumptions before writing any migration
3. draft a convergence migration plan for:
   - budget conversion
   - cost event backfill
   - adapter settings table recreation
4. define a staging rehearsal procedure against a copy of the live database

## Blockers Before Live Migration

- row-level understanding of current production data
- agreed backfill semantics for legacy `cost_events`
- explicit decision on whether `adapter_company_settings` is recreated immediately in the convergence branch
- tested rollback path for the DB migration itself
