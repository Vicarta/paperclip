# DiskInternals BigQuery Growth Plugin

Paperclip plugin that exposes allowlisted BigQuery-backed growth reports to DiskInternals agents.

The plugin keeps BigQuery credentials and SQL in the backend. Agents can request bounded reports for URL inventory, GSC opportunities, GA4 funnel metrics, product priority, CRO candidates, localization candidates, indexing follow-up, crawl job status, and post-change monitoring.

## Runtime Boundaries

- BigQuery is the source of truth for GA4/GSC-derived data.
- Agents do not receive BigQuery credentials, raw GA4/GSC access, `bq`, or arbitrary SQL execution.
- Crawl work is represented as bounded jobs and queue state. Agents can prepare or inspect jobs, but page fetching must remain rate limited.
- Thank You pages are excluded from scoring and backlog outputs.

## Required Config

- `bigQueryProjectId`
- `bigQueryDatasetId` (defaults to `diskinternals_growth`) for derived growth tables, views, marts, decisions, crawl state, and follow-up measurements
- `ga4ExportDatasetId` (DiskInternals: `analytics_287393097`) for raw GA4 BigQuery export
- `gscExportDatasetId` (DiskInternals: `searchconsole`) for raw GSC BigQuery export
- One credential secret:
  - `bigQueryServiceAccountJsonSecretRef`, preferred
  - or `bigQueryAccessTokenSecretRef`, for short-lived smoke/debug runs

## Verification

```bash
pnpm --filter @paperclipai/plugin-diskinternals-bigquery-growth test
pnpm --filter @paperclipai/plugin-diskinternals-bigquery-growth typecheck
pnpm --filter @paperclipai/plugin-diskinternals-bigquery-growth build
```
