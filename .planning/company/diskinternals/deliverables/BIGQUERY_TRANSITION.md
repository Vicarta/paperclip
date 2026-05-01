# BigQuery Growth Data Platform And Portfolio Expansion

## Current Policy

BigQuery export is already working and is the operational source of truth for DiskInternals GA4/GSC-derived growth data. Direct GA4/GSC access is not available to agents.

Runtime access must be provided through a BigQuery-backed Paperclip plugin with allowlisted reports, cost controls, URL normalization, and crawl/job provenance.

## Target Marts / Views

### `dim_product`

Canonical product table including paid/free, family, main URL, localized URLs, and launch status.

### `dim_url`

Canonical URL table with language, page type, product mapping, canonical/hub/article/download/checkout flags.

### `fact_ga4_events_daily`

Normalized GA4 events after parameter enrichment and QA.

### `fact_gsc_queries_daily`

Query x URL x country x device search data.

### `fact_funnel_by_product_daily`

Download -> order -> purchase by product. Thank You pages are QA/debug-only and excluded from scoring.

### `fact_crawl_page_snapshot`

Rate-limited crawler output: HTTP status, robots/noindex, canonical, title/H1, content hash, response size, fetch timestamp, and crawl job provenance.

### `fact_url_identity`

Raw URL, normalized URL, canonical URL, redirect target, Google canonical when available, and URL join keys used to connect GA4, GSC, sitemap, crawl, and change data.

### `fact_popup_experiments`

Popup shown/closed/click and downstream funnel outcomes by variant.

### `fact_content_changes`

Paperclip/user changes by URL, PR, issue, date, and change type.

### `mart_growth_opportunities`

Final ranked opportunities for CMO backlog generation.

## Implementation Plan

1. Define BigQuery dataset, table, and view contracts.
2. Add `bq` CLI ops scripts for setup, migrations, backfills, and smoke checks.
3. Build a BigQuery Growth Data Paperclip plugin with allowlisted tools.
4. Build sitemap-driven URL inventory and normalization.
5. Add rate-limited crawl/page snapshot worker with BigQuery queue/state.
6. Implement scoring marts and opportunity queues.
7. Route opportunities through a Growth Opportunity Strategist lane before CMO approval.
8. Track post-change 7/14/28 day follow-up metrics.

## Portfolio Expansion Candidates

Expand only when scoring supports it:
- Partition Recovery;
- NTFS Recovery;
- Linux Recovery;
- MSSQL/MySQL Recovery;
- Office/Mail products.

Do not expand based on raw traffic alone.
