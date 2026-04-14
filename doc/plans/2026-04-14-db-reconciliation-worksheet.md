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
- current AST deployment evidence does not point to a separately managed external Postgres URL for live checks
- current operational path for live DB inspection is:
  - open AST dashboard first
  - `ssh paperclip@ubuntu-oc.tailbd4e1c.ts.net`
  - `sudo docker exec -i paperclip-db-1 psql -U paperclip -d paperclip ...`
- this docker-exec path must be treated as the canonical live verification route unless deployment docs are updated

## Live AST Probe Snapshot

Captured on 2026-04-14 through the canonical server path:

- `companies_count = 1`
- `projects_count = 1`
- `agents_count = 26`
- `agent_runtime_state_count = 26`
- `cost_events_count = 8552`
- `companies_with_budget_usd = 1`
- `agents_with_budget_usd = 26`
- `runtime_rows_with_total_cost_usd = 26`
- `cost_rows_with_usd = 8552`
- `min_cost_usd = 0`
- `max_cost_usd = 0.245913`
- `high_precision_company_budget_rows = 1`
- `high_precision_agent_budget_rows = 1`
- `high_precision_cost_rows = 237`
- `has_projects_human_facing_language = true`
- `has_adapter_company_settings = true`
- `adapter_company_settings` distribution:
  - `openrouter = 1`
- `cost_events` provider distribution:
  - `openai = 8281`
  - `openrouter = 253`
  - `dataforseo.com = 18`

Implications:

- the live database is still firmly on the Vicarta USD-first model
- cent conversion cannot assume two-decimal precision only; at least `237` cost rows exceed cent precision and will be rounded during bridge conversion
- adapter-company settings state is small and low-risk to carry forward if still required

## Rehearsal And Live Cutover Outcome

Validated on 2026-04-14:

- a rehearsal clone restored from live backup succeeded with:
  - preflight schema bridge
  - upstream `pnpm db:migrate`
  - compose-based smoke boot
- production live cutover then succeeded with the same order:
  - fresh `pg_dump -Fc` backup
  - preflight schema bridge
  - upstream `pnpm db:migrate`
  - app recreate on image `sha256:2c9cd7f3592b98613278378dc1aeb68cf1096fc35c15decadd9a0fe02e3d5fd2`

Confirmed live post-cutover facts:

- `companies` now exposes:
  - `budget_monthly_cents`
  - `spent_monthly_cents`
- legacy company USD columns are no longer present in the live schema
- `drizzle.__drizzle_migrations` contains `52` rows after convergence
- live app health now reports the upstream-style payload including `version: "0.3.1"`

Operational finding:

- provider plugins that were historically installed from `packages/plugins/examples/*`
  cannot be left on those symlinked paths when runtime starts workers through
  `package_path`
- the converged live DB required `plugins.package_path` normalization to:
  - `/app/packages/plugins/plugin-exa-agent-tools`
  - `/app/packages/plugins/plugin-serper-agent-tools`
  - `/app/packages/plugins/plugin-dataforseo-agent-tools`
  - `/app/packages/plugins/plugin-bright-data-agent-tools`

Why:

- the plugin SDK worker bootstrap compares the runtime entrypoint against
  `process.argv[1]`
- if `package_path` points at a symlinked `examples/*` path, the comparison can
  fail because the module URL resolves to the real package path
- normalizing `package_path` to the canonical non-symlink package directory made
  compose-based smoke and live plugin activation succeed with `5/5` plugins loaded

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
- use a one-time preflight schema bridge to restore upstream core column names/types before `pnpm db:migrate`
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

## Migration-Engine Finding

Upstream already contains migration-history reconciliation logic in `packages/db/src/client.ts`, but that logic only auto-repairs journal history when the pending migration SQL is already represented in the schema.

That is not enough for the Vicarta fork.

Why:

- our old `0032_cost_events_usd.sql` renamed upstream core columns away from the names later upstream migrations expect
- upstream `0032_pretty_doctor_octopus.sql` reads `budget_monthly_cents`
- Vicarta live schema after the old USD migration instead exposes `budget_monthly_usd`

So the first blocker is not journal divergence. The first blocker is schema incompatibility with upstream pending migrations.

Accepted implication:

- do not rely on `pnpm db:migrate` alone to bridge the Vicarta USD-first schema
- run a preflight schema bridge first
- only then let upstream `0030-0048` execute

### `adapter_company_settings`

Vicarta old model includes:

- dedicated `adapter_company_settings` table

Upstream target model:

- no equivalent table in `v2026.403.0`

Accepted direction:

- current minimal upstream-first OpenRouter adapter does not hard-depend on this table for runtime startup
- however, the live AST database still contains one `openrouter` row, so preserving operator-configured adapter settings remains an explicit convergence decision
- do not try to reuse the old `0031_*` migration slot

Required approach:

- if retained, add it back as a new post-`0048` migration on the convergence branch or migrate its payload into a new upstream-compatible settings surface
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
3. draft and rehearse a preflight schema bridge for:
   - `cost_events.cost_usd -> cost_cents`
   - `companies.*_usd -> *_cents`
   - `agents.*_usd -> *_cents`
   - `agent_runtime_state.total_cost_usd -> total_cost_cents`
4. draft a post-`0048` convergence plan only for still-required retained extensions such as `adapter_company_settings`
5. define a staging rehearsal procedure against a copy of the live database
6. when performing live fact probes for the AST deployment, use the documented server path:
   - `ssh paperclip@ubuntu-oc.tailbd4e1c.ts.net`
   - `sudo docker exec -i paperclip-db-1 psql -U paperclip -d paperclip -f ...`

## Blockers Before Live Migration

- row-level understanding of current production data
- agreed rounding/backfill semantics for restoring legacy USD-first columns to upstream cents columns
- explicit decision on whether `adapter_company_settings` is recreated immediately in the convergence branch
- tested rollback path for the DB migration itself
