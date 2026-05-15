---
phase: 7
plan: "07-01"
title: "BigQuery Schema, Views, And Ops Scripts"
wave: 1
depends_on: []
requirements: ["BQ-01", "BQ-02", "BQ-03"]
files_modified:
  - "ops/bigquery/diskinternals/README.md"
  - "ops/bigquery/diskinternals/schema/*.sql"
  - "ops/bigquery/diskinternals/views/*.sql"
  - "ops/bigquery/diskinternals/scripts/*.sh"
  - ".planning/company/diskinternals/deliverables/BIGQUERY_TRANSITION.md"
autonomous: true
user_setup:
  - "GCP project id, dataset location, and service account/ADC method must be provided before live smoke."
---

# 07-01: BigQuery Schema, Views, And Ops Scripts

## Objective

Create the repeatable BigQuery foundation for DiskInternals growth data so later plugin and agent work has stable tables/views, migration scripts, and smoke checks.

<must_haves>
<artifacts>
- BigQuery dataset/table/view SQL for `diskinternals_growth`.
- Ops scripts using `bq` CLI for setup, validation, dry runs, and smoke queries.
- Documentation of required IAM, dataset location, cost controls, and operator inputs.
</artifacts>
<key_links>
- SQL schema must match `BIGQUERY_GROWTH_OPERATING_ALGORITHM.md`.
- View names must match the planned plugin tool contracts in plan `07-02`.
- Ops scripts must be runnable without exposing credentials in repo files.
</key_links>
</must_haves>

<tasks>
<task id="1" type="auto">
<files>
ops/bigquery/diskinternals/README.md
ops/bigquery/diskinternals/schema/001_core_tables.sql
ops/bigquery/diskinternals/schema/002_job_state_tables.sql
</files>
<action>
Create BigQuery SQL definitions for raw/import tables, URL/product dimensions, crawl job state, facts, and marts listed in the canonical algorithm. Use date partitioning and clustering where useful for GA4/GSC facts, crawl snapshots, and follow-up measurements. Document required IAM roles, dataset location input, and that secrets/service account credentials are never committed.
</action>
<verify>
<automated>cd /path/to/paper-clip && test -f ops/bigquery/diskinternals/schema/001_core_tables.sql && test -f ops/bigquery/diskinternals/schema/002_job_state_tables.sql</automated>
</verify>
<done>
Schema files cover URL identity, product mapping, sitemap snapshots, crawl jobs/items, GA4/GSC facts, scoring marts, experiment decisions, and follow-up measurements.
</done>
</task>

<task id="2" type="auto">
<files>
ops/bigquery/diskinternals/views/010_growth_reports.sql
ops/bigquery/diskinternals/views/020_opportunity_marts.sql
ops/bigquery/diskinternals/scripts/apply.sh
ops/bigquery/diskinternals/scripts/smoke.sh
</files>
<action>
Create view SQL and shell scripts that use `bq` for ops-only setup and smoke tests. Scripts must accept project/dataset/location via flags or env vars, support dry-run where possible, and fail closed when inputs are missing. Include smoke queries for row counts, required columns, date partition filters, and sample report views.
</action>
<verify>
<automated>cd /path/to/paper-clip && bash -n ops/bigquery/diskinternals/scripts/apply.sh && bash -n ops/bigquery/diskinternals/scripts/smoke.sh</automated>
</verify>
<done>
Operators can bootstrap and validate BigQuery schema with `bq` without agents using CLI or raw SQL at runtime.
</done>
</task>

<task id="3" type="auto">
<files>
.planning/company/diskinternals/deliverables/BIGQUERY_TRANSITION.md
.planning/company/diskinternals/deliverables/DATA_CONTRACTS.md
</files>
<action>
Update the planning docs with the actual table/view names, required environment variables, and the exact boundary: `bq` is for ops only; Paperclip runtime uses plugin tools from plan `07-02`.
</action>
<verify>
<automated>cd /path/to/paper-clip && rg -n "diskinternals_growth|bq.*ops|Paperclip plugin" .planning/company/diskinternals/deliverables/BIGQUERY_TRANSITION.md .planning/company/diskinternals/deliverables/DATA_CONTRACTS.md</automated>
</verify>
<done>
Planning docs and ops scripts describe the same BigQuery dataset, tables, views, and runtime boundary.
</done>
</task>
</tasks>
