# Phase 7: BigQuery Growth Automation And Portfolio Expansion - Research

## Planning Findings

- BigQuery should own durable DiskInternals growth state: exports, URL inventory, crawl/page snapshots, scoring marts, opportunity decisions, and follow-up measurements.
- Paperclip should mediate agent access through a plugin with allowlisted report tools, not direct SQL or CLI.
- `bq` CLI is still useful for repeatable ops scripts: dataset/table/view setup, migrations, backfills, dry runs, and smoke checks.
- Crawl/page fetching must be a worker/job concern with strict rate limits and BigQuery job state, not an agent loop.
- BigQuery cost controls must be designed into the plugin: partition filters, `maximumBytesBilled`, dry-run support for new templates, result limits, cached snapshots, and bytes-processed metadata.
- URL identity is the backbone of the system. GA4 page locations, GSC URLs, sitemap URLs, crawler final URLs, and PR/change records cannot be joined safely without `url_id` / `normalized_url`.
- Growth routing should be an explicit lane. CMO should approve priorities, not manually classify thousands of URL/query opportunities.

## Implementation Risks

- BigQuery schema drift if raw export shape changes or the initial dataset location/project differs from assumptions.
- Cost spikes from unbounded date windows or accidental `SELECT *`.
- Duplicate URL identities from protocol, host, trailing slash, query, redirect, canonical, or localized variants.
- Crawl pressure on the website if full inventory fetches are not throttled and split over time.
- Agent misuse if plugin tools expose arbitrary SQL or omit provenance/cost metadata.
- Incorrect backlog if Thank You pages leak into scoring.
- Localization noise if country/language traffic is not gated by product and funnel signals.

## Validation Architecture

Each implementation plan must prove:

- No agent-facing path exposes raw BigQuery credentials or arbitrary SQL.
- BigQuery report tools are bounded by date range, result limit, and cost metadata.
- URL normalization tests cover protocol, host, tracking parameters, fragments, trailing slash, redirects, and localized URL separation.
- Crawl worker tests prove per-host concurrency, delay, retry/backoff, `Retry-After`, and job status transitions.
- Scoring tests prove Thank You pages are excluded and null/zero metrics are not automatic rejection.
- Follow-up reports can connect changed URLs to 7/14/28 day metrics.

## Sources

- `deliverables/BIGQUERY_GROWTH_OPERATING_ALGORITHM.md`
- `deliverables/DATA_CONTRACTS.md`
- `deliverables/BIGQUERY_TRANSITION.md`
- BigQuery `bq` CLI docs: https://docs.cloud.google.com/bigquery/docs/quickstarts/load-data-bq
- BigQuery quotas and limits: https://cloud.google.com/bigquery/quotas
- Google robots.txt interpretation: https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt
