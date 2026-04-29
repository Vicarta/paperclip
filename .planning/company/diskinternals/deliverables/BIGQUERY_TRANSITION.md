# BigQuery Transition And Portfolio Expansion

## Current Policy

BigQuery export is already working, but operational agent access is deferred until enough data accumulates and access is granted. MCP remains the operational source now.

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

Download -> thank_you -> order -> purchase by product.

### `fact_popup_experiments`

Popup shown/closed/click and downstream funnel outcomes by variant.

### `fact_content_changes`

Paperclip/user changes by URL, PR, issue, date, and change type.

### `mart_growth_opportunities`

Final ranked opportunities for CMO backlog generation.

## Migration Plan

1. Keep MCP report contracts stable.
2. Implement BigQuery views that match or improve those contracts.
3. Validate BigQuery numbers against MCP reports.
4. Switch DATA and SEO Performance agents to BigQuery-first reports.
5. Keep MCP as fallback until BigQuery reliability is proven.

## Portfolio Expansion Candidates

Expand only when scoring supports it:
- Partition Recovery;
- NTFS Recovery;
- Linux Recovery;
- MSSQL/MySQL Recovery;
- Office/Mail products.

Do not expand based on raw traffic alone.
