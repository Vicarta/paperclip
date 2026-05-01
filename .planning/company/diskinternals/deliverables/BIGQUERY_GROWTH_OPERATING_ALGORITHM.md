# BigQuery-First Growth Operating Algorithm

## Status

This is the corrected canonical operating algorithm for DiskInternals growth monitoring, prioritization, experimentation, and follow-up.

It replaces the earlier MCP-first assumption for GA4/GSC data. DiskInternals cannot connect agents directly to Google Analytics or Google Search Console. GA4 and GSC data must be consumed through BigQuery exports and BigQuery-owned company data marts.

## Corrected Assumptions

- BigQuery is the company data source of truth for DiskInternals growth operations.
- Paperclip agents must not connect directly to GA4, GSC, or arbitrary BigQuery SQL.
- A Paperclip BigQuery Growth Data plugin should expose stable, allowlisted report tools to agents.
- DiskInternals website code is not available to Paperclip agents. Approved website changes should be handed off as Perfex CRM tasks for human implementation.
- The `bq` CLI is useful for ops, bootstrap, migrations, backfills, smoke tests, and manual debugging, but not as the primary runtime interface for agents.
- Sitemap, URL registry, crawl/page snapshots, scoring marts, experiment history, and follow-up measurements should also live in BigQuery.
- `Thank You` pages are excluded from growth scoring and backlog prioritization. They may be retained only as debug/QA signals for download-flow integrity.
- `CMO` owns backlog approval and strategic priority, but should not classify every opportunity manually. A dedicated Growth Opportunity Strategist lane should classify scored opportunities into action types.
- `CRO Funnel Experiment Agent` works in parallel with SEO and localization lanes, but only from scored and routed candidates.
- Localization is an experiment lane gated by country/language demand, GSC signal, product priority, and funnel signal. It is not bulk translation.

## Architecture

```text
GA4 export + GSC export
        |
        v
BigQuery raw tables
        |
        v
URL normalization + product mapping + sitemap inventory
        |
        v
Rate-limited crawl/page snapshot worker
        |
        v
BigQuery facts and marts
        |
        v
Paperclip BigQuery Growth Data plugin
        |
        v
DATA / SEO / Growth Opportunity / CRO / Localization / CMO agents
        |
        v
Approved backlog -> Perfex CRM human tasks/content/CRO/localization/indexing work
        |
        v
7/14/28 day follow-up back into BigQuery
```

Paperclip orchestrates the workflow. BigQuery stores state and facts. The plugin mediates safe access. Workers perform scheduled ingestion and crawl jobs. Agents consume stable reports and create decisions, issues, implementation-ready task payloads, and approval requests.

## BigQuery Dataset Model

Recommended dataset: `diskinternals_growth`.

### Raw Tables

```text
raw_ga4_events_*
raw_gsc_url_query_*
raw_sitemap_snapshots
raw_crawl_fetches
raw_change_events
```

Raw tables preserve original export or fetch data with minimal transformation.

### Dimension And Registry Tables

```text
dim_product
dim_url
url_identity_map
url_product_map
url_localization_map
```

`dim_url` is the canonical URL inventory. Every GA4 row, GSC row, sitemap URL, crawl result, and content-change record should resolve to a stable `url_id` when possible.

### Fact Tables

```text
fact_ga4_url_day
fact_gsc_url_query_day
fact_product_day
fact_crawl_page_snapshot
fact_internal_link_snapshot
fact_content_change
fact_experiment_event
fact_followup_measurement
```

Fact tables are date-partitioned and should use normalized URL identity, product identity, language, country, and device fields where applicable.

### Mart Tables

```text
mart_product_priority
mart_url_growth_opportunity
mart_query_url_opportunity
mart_cro_experiment_candidate
mart_localization_candidate
mart_internal_link_candidate
mart_indexing_candidate
mart_post_change_followup
```

Marts are the primary input to agent-facing plugin tools.

## URL Identity And Normalization

Every URL pipeline must keep both raw and normalized values.

Minimum fields:

```text
url_id
raw_url
normalized_url
canonical_url
final_url_after_redirect
google_canonical_url
host
path
query_parameters_kept
query_parameters_removed
language
country_target
page_type
product_id
product_family
indexable_status
sitemap_present
last_seen_in_sitemap_at
last_crawled_at
last_meaningful_change_at
```

Normalization rules:

- Normalize protocol and host according to the site's canonical policy.
- Normalize `www` / non-`www` according to canonical policy.
- Remove tracking and click identifiers such as `utm_*`, `gclid`, `fbclid`, fragments, and session noise.
- Normalize trailing slash only after checking site canonical behavior.
- Normalize `/index.html` only if the site canonicalizes it that way.
- Preserve meaningful query parameters where they define a real page state.
- Store redirects separately instead of overwriting raw URLs.
- Keep localized variants linked but not merged unless they are true canonicals.

Do not compare raw GA4 page locations, GSC URLs, sitemap URLs, and crawler URLs directly. Compare them through `url_id` / `normalized_url`.

## Sitemap Inventory

The sitemap sync process should:

- fetch sitemap index files and nested sitemaps;
- parse URL, `lastmod`, language alternates when present, and sitemap source;
- upsert URLs into `dim_url`;
- mark missing URLs as `not_seen_in_latest_sitemap` instead of deleting them immediately;
- keep historical sitemap snapshots;
- detect URLs in GSC/GA4 that are missing from sitemap;
- detect sitemap URLs that return non-200, redirect, `noindex`, canonical-to-other, or blocked states.

Sitemap sync is metadata work. It should not trigger a full page fetch for every URL immediately.

## Crawl And Page Snapshot Worker

Agents must not crawl thousands of pages directly. They should schedule crawl jobs through the Paperclip plugin. The plugin or worker runs the queue with rate limits and writes results to BigQuery.

### Crawl Queue Tables

```text
crawl_jobs
crawl_job_items
```

`crawl_job_items` should include:

```text
job_id
url_id
target_url
priority
reason
status
next_fetch_at
attempt_count
last_attempt_at
last_http_status
error_code
response_bytes
etag
last_modified
content_hash
canonical_detected
robots_allowed
noindex_detected
```

### Initial Rate Limit Policy

Start conservatively:

```text
max_concurrent_requests_per_host: 2
min_delay_between_requests_per_host: 2 seconds
max_pages_per_job: 200-500
daily_page_fetch_budget: configurable by CTO
retry_backoff: exponential with jitter
max_attempts_per_url: 3
fetch_assets: false by default
max_html_bytes_to_store: capped
```

Full inventory refreshes should be spread over multiple days. Priority crawls should be separate from full crawls.

### Priority Bands

```text
P0: changed URLs, product pages, checkout/order path pages, high-impact fixes
P1: high-opportunity GSC URLs and strategic product pages
P2: hubs, important articles, localization candidates
P3: long-tail articles with weak or stale signals
P4: low-value/no-signal URLs, sitemap presence only unless promoted
```

Suggested refresh:

- P0: after release, then 7/14/28 day follow-up.
- P1: weekly or after meaningful data movement.
- P2: monthly or when selected for experiment.
- P3/P4: low-frequency inventory checks only.

### Crawl Safety

- Respect robots.txt allow/disallow rules.
- Do not impersonate Googlebot.
- Identify the crawler clearly in the user agent.
- Honor HTTP `429`, `503`, and `Retry-After`.
- Back off on elevated 5xx/timeout rates.
- Do not fetch images, JS, CSS, downloads, installers, archives, or binaries by default.
- Do not crawl order/payment flows unless explicitly approved.
- Do not let one job monopolize the whole crawl budget.

Google's robots documentation is useful as a reference for how crawlers should respect robots rules, but DiskInternals crawler limits must be owned by our worker configuration rather than guessed from Google's behavior.

## BigQuery Access And Cost Controls

The Paperclip plugin should use BigQuery APIs/client libraries with a service account and server-side secrets. Agents should receive typed reports, not credentials or SQL access.

Required controls:

- allowlisted report tools;
- parameter validation;
- partition filters required for fact queries;
- clustering by `normalized_url`, `product_id`, `country`, `language`, and `date` where useful;
- `maximumBytesBilled` on ad hoc/report queries;
- dry-run support for new query templates;
- result limits and pagination;
- cached snapshots for expensive reports;
- query/job provenance in Paperclip issue comments or artifacts;
- cost and bytes-scanned metadata returned to agents;
- no `SELECT *` in production reports;
- no arbitrary SQL from agents.

The `bq` CLI should be kept for:

- creating datasets/tables/views;
- applying SQL migrations;
- loading initial sitemap or historical CSV/JSON snapshots;
- running smoke tests;
- debugging operator-approved queries.

Runtime agent work should go through the Paperclip plugin.

## Paperclip Plugin Tool Surface

Recommended plugin: `paperclip.diskinternals-bigquery-growth`.

Minimum tools:

```text
get_schema_status
sync_sitemap_snapshot
get_site_url_inventory
normalize_url_inventory
schedule_crawl_batch
get_crawl_job_status
get_product_funnel_metrics
get_gsc_url_query_opportunities
get_url_growth_opportunity_queue
get_product_priority_scores
get_cro_experiment_candidates
get_localization_candidates
get_internal_link_candidates
get_indexing_candidates
record_opportunity_decision
record_experiment_decision
get_post_change_followup
get_query_cost_summary
```

Each tool should return:

- input parameters;
- source tables/views;
- date ranges;
- row counts;
- bytes processed or cached-result indicator;
- known limitations;
- stable IDs for URLs, products, opportunities, and jobs.

## Scoring

### Product Proxy Score

Use before reliable product-level purchase attribution exists.

```text
Product Proxy Score =
30% product/page URL traffic
+ 25% file_download mapped by URL or filename
+ 20% visit_order_page mapped by source URL/product page
+ 15% GSC opportunity
+ 10% strategic priority from CEO/CMO
```

### Product Growth Score

Use after product-level purchase/revenue attribution is reliable.

```text
Product Growth Score =
35% purchase / revenue
+ 20% visit_order_page
+ 20% file_download
+ 15% GSC opportunity
+ 5% localization opportunity
+ 5% content feasibility
```

### Page Action Score

Use for URL-level action ranking.

```text
Page Action Score =
25% GSC impressions with position 4-20
+ 20% organic clicks
+ 20% assisted downloads/order visits
+ 15% product strategic priority
+ 10% internal linking potential
+ 10% freshness / SERP gap
```

### Localization Opportunity Score

Use for localization experiments.

```text
Localization Opportunity Score =
30% country/language search demand
+ 25% GSC country/query signal
+ 20% product priority
+ 15% funnel signal from related English or localized URLs
+ 10% localization feasibility and SERP gap
```

`Thank You` page traffic must not contribute to these scores. It can appear only in QA/debug reports.

## Opportunity Routing

CMO should not classify every scored URL manually. Create a dedicated Growth Opportunity Strategist lane or repurpose a suitable existing strategist for this function.

The strategist converts scored opportunities into action types:

```text
seo_refresh
new_page_or_article
internal_linking
cro_experiment
localization_experiment
product_page_update
indexing_followup
tracking_or_data_quality_issue
park_no_action
```

CMO owns:

- product priority;
- backlog approval;
- approval gates;
- conflict resolution;
- CEO summary.

CMO does not need to manually inspect every URL in the queue.

## Agent Operating Model

| Agent / Lane | Responsibility |
|---|---|
| DATA Growth Analytics Agent | BigQuery report contracts, score inputs, data QA, mart sanity checks |
| CTO | BigQuery schema, plugin, crawler/rate limits, tracking QA, service account/security |
| Growth Opportunity Strategist | Classify scored opportunities into action lanes |
| CMO | Approve backlog, product priority, scope, and escalations |
| SEO Performance Analyst | Search opportunity interpretation and post-change search follow-up |
| SEO Semantic Core Strategist / Validator | Semantic core generation and validation for selected products/pages |
| SEO Internal Linking Indexation Agent | Internal link queues and indexing candidate policy |
| CRO Funnel Experiment Agent | CTA, popup, product routing, download/order transition experiments |
| MKT Localization Opportunity Agent | Localization experiment candidates and country/language validation |
| QA Recovery Compliance Agent | Recovery claims, compatibility, product routing, safety review |
| OPS Observability Agent | Stuck tasks, plugin failures, crawl job health, budget/cost observability |

CRO, SEO, and localization can run in parallel only when they are working from the same approved opportunity queue and have clear child issues.

## Operating Cycle

1. BigQuery ingestion updates GA4 and GSC export-derived tables.
2. Sitemap sync updates `dim_url` and URL presence state.
3. URL normalization resolves raw URLs to `url_id`.
4. Crawl jobs refresh page metadata in priority batches.
5. BigQuery marts compute product, URL, CRO, localization, internal-link, and indexing candidates.
6. Growth Opportunity Strategist classifies top opportunities into action lanes.
7. CMO approves the backlog and delegates child issues.
8. Specialist agents produce briefs, Perfex task payloads, linking queues, CRO variants, localization proposals, or indexing candidates.
9. QA reviews recovery claims, product routing, unsupported compatibility, and safety messaging.
10. Human approval gates production, tracking, checkout/order flow, popup launches, broad localization, and manual indexing batches.
11. Human-implemented changes are recorded in `fact_content_change` with Perfex task references when available.
12. Follow-up metrics are checked at 7, 14, and 28 days.
13. Results update opportunity scores and future backlog.

## Indexing Policy

Manual indexing should be limited to meaningful changes:

- product pages;
- hubs;
- high-value refreshed pages;
- GSC opportunity pages;
- pages with changed title, H1, core content, CTA, product routing, or internal links.

Do not submit:

- tiny text edits;
- bulk template-only changes;
- low-value pages without evidence;
- unchanged pages;
- pages blocked by robots/noindex/canonical-to-other.

## Edge Cases

### URL And Canonicalization

- GSC URL exists but is absent from sitemap.
- Sitemap URL exists but returns 301/302, 404, 410, 5xx, or soft-404 content.
- GA4 page location includes tracking parameters or fragments.
- Canonical URL points to another language or product route.
- Multiple raw URLs collapse to one normalized URL.
- One page legitimately supports multiple product intents.
- Localized pages use inconsistent slugs or hreflang.
- Order/download domains differ from the main site domain.

### Data Quality

- GA4 events are missing expected parameters.
- Download filename cannot be mapped to product.
- Purchase attribution is incomplete or delayed.
- GSC rows have query privacy aggregation gaps.
- Zero/null metrics mean unknown or no measured signal, not automatic rejection.
- Date windows differ between GA4, GSC, crawl, and change data.
- A page was changed inside the follow-up window and invalidates attribution.

### Crawl

- robots.txt temporarily unavailable.
- `Retry-After` requests a delay longer than the current job window.
- Server starts returning elevated 5xx or timeouts.
- HTML is too large.
- Page requires JavaScript rendering.
- Page is blocked by geo, cookies, WAF, or anti-bot rules.
- Content hash changes because of dynamic blocks, not meaningful content.

### Product And Intent

- Linux Reader read/view intent is confused with Linux Writer write/edit intent.
- Linux Writer utility intent is confused with recovery intent.
- VMFS/VMDK Mac semantic demand exists before the product/page exists.
- Recovery content implies guaranteed recovery or unsafe advice.
- Freeware traffic creates downloads but not purchase intent.

### Localization

- Country demand exists but product/funnel signal is weak.
- Localized SERP intent differs from English SERP intent.
- Translation would cannibalize the English canonical or wrong localized page.
- Country/language signal is strong but support/sales readiness is absent.

## Observability And Failure Handling

Every scheduled or agent-triggered job should have:

- owner;
- status;
- job id;
- start/end time;
- source tables;
- row counts;
- cost/bytes metadata;
- failure reason;
- retry state;
- next action.

No silent hanging tasks:

- crawl jobs stuck in `running` need timeout and recovery;
- BigQuery jobs with quota or cost errors must become explicit blockers;
- plugin failures must include the failed tool and unblock condition;
- child issue completion must hand off to the parent issue.

## Implementation Order

1. Define BigQuery dataset, table, and view contracts.
2. Add ops scripts using `bq` CLI for setup, migration, backfill, and smoke checks.
3. Build Paperclip BigQuery Growth Data plugin with allowlisted tools.
4. Build URL inventory from sitemap into BigQuery.
5. Implement URL normalization and product mapping.
6. Implement rate-limited crawl/page snapshot worker.
7. Create scoring marts and opportunity queue.
8. Add Growth Opportunity Strategist lane.
9. Wire SEO/CRO/localization/indexing child workflows.
10. Add follow-up measurement at 7/14/28 days.

## References

- BigQuery `bq` CLI: https://docs.cloud.google.com/bigquery/docs/quickstarts/load-data-bq
- BigQuery quotas and limits: https://cloud.google.com/bigquery/quotas
- Google robots.txt interpretation: https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt
- Googlebot crawling behavior reference: https://developers.google.com/search/docs/crawling-indexing/googlebot
