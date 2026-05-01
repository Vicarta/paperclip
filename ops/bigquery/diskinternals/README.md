# DiskInternals BigQuery Growth Dataset

This folder contains ops-only BigQuery setup for the DiskInternals growth data platform.

Runtime Paperclip agents must not run `bq`, write arbitrary SQL, or receive BigQuery credentials. Agents use the `paperclip.diskinternals-bigquery-growth` plugin, which exposes allowlisted report tools with bounded date windows, row limits, and query provenance.

## Required Inputs

Set these environment variables or pass matching flags to the scripts:

```sh
GCP_PROJECT_ID=<project-id>
BQ_DATASET=diskinternals_growth
BQ_GA4_EXPORT_DATASET=analytics_287393097
BQ_GSC_EXPORT_DATASET=searchconsole
BQ_LOCATION=US
```

For the current DiskInternals instance:

- `GCP_PROJECT_ID=dre-di`
- raw GA4 export dataset: `analytics_287393097`
- raw GSC export dataset: `searchconsole`
- derived growth dataset: `diskinternals_growth` unless the operator explicitly chooses another dataset

Authentication is handled by the operator through `gcloud auth application-default login`, workload identity, or another approved BigQuery authentication path. Do not commit service account JSON files or access tokens.

## Files

- `schema/001_core_tables.sql` - product, URL, raw import, fact, mart, and decision tables.
- `schema/002_job_state_tables.sql` - crawl job and job item tables.
- `views/010_growth_reports.sql` - agent-facing report views.
- `views/020_opportunity_marts.sql` - scoring/opportunity views.
- `scripts/apply.sh` - creates dataset and applies SQL files through `bq`.
- `scripts/smoke.sh` - runs non-destructive smoke checks.

## Usage

```sh
cd /Users/savitsky/CodexProjects/paper-clip
GCP_PROJECT_ID=dre-di BQ_DATASET=diskinternals_growth BQ_LOCATION=US \
  ops/bigquery/diskinternals/scripts/apply.sh

GCP_PROJECT_ID=dre-di BQ_DATASET=diskinternals_growth BQ_LOCATION=US \
  ops/bigquery/diskinternals/scripts/smoke.sh
```

## Runtime Boundary

- `bq` CLI: ops/bootstrap/migration/backfill/debug only.
- Paperclip plugin: runtime access for agents.
- BigQuery credentials: server-side only.
- Thank You pages: QA/debug only, excluded from scoring/backlog.
