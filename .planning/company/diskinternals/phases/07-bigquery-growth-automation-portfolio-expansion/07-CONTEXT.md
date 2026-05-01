# Phase 7: BigQuery Growth Automation And Portfolio Expansion - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning
**Source:** Operator decisions and `deliverables/BIGQUERY_GROWTH_OPERATING_ALGORITHM.md`

<domain>
## Phase Boundary

Phase 7 implements the BigQuery-first growth data platform for DiskInternals:

- BigQuery dataset/table/view contracts and ops scripts.
- Paperclip plugin for allowlisted BigQuery growth reports.
- Sitemap-driven URL inventory, URL normalization, and product mapping.
- Rate-limited crawl/page snapshot worker with BigQuery job state.
- Scoring marts, opportunity routing, localization candidates, and 7/14/28 day follow-up.

This phase does not publish website changes, launch CRO experiments, or broadly localize content. It creates the data and orchestration substrate for those later child issues.
</domain>

<decisions>
## Implementation Decisions

### Data Source
- BigQuery is the source of truth for DiskInternals GA4/GSC-derived growth data.
- Direct GA4/GSC access is not available to agents.
- DiskInternals company database tables for this growth system live in BigQuery.

### Agent Access
- Agents must consume stable Paperclip plugin tools, not raw credentials, direct BigQuery access, arbitrary SQL, or `bq` CLI.
- The `bq` CLI is for ops/bootstrap/migrations/backfills/smoke checks/debug only.
- Plugin tools must return provenance: source tables/views, date range, row counts, bytes processed/cached state, known limitations, and stable IDs.

### URL And Crawl
- Sitemap inventory is required before comparing GA4, GSC, crawl, and change data.
- URL comparison must use a normalized URL identity / `url_id`, not raw URL strings.
- Page fetching must be rate-limited and spread over time; agents must not crawl thousands of pages directly.
- Start crawler defaults conservatively: `max_concurrent_requests_per_host = 2`, `min_delay_between_requests_per_host = 2 seconds`, `max_pages_per_job = 200-500`.

### Scoring And Routing
- `Thank You` pages are QA/debug-only and excluded from scoring/backlog prioritization.
- `CMO` approves backlog and product priorities but should not classify every opportunity manually.
- A Growth Opportunity Strategist lane classifies scored opportunities into SEO, CRO, localization, internal linking, indexing, data-quality, or parked actions before CMO approval.
- `CRO Funnel Experiment Agent` works in parallel only from scored/routed candidates.
- Localization is an experiment lane gated by country/language demand, GSC signal, product priority, funnel signal, and feasibility.

### Security And Cost
- BigQuery service account credentials stay server-side in Paperclip secrets/config.
- Report queries must require bounded date ranges/partition filters and cost limits such as `maximumBytesBilled`.
- Plugin and worker jobs must expose cost/bytes/failure metadata for observability.
</decisions>

<specifics>
## Specific Inputs

- Canonical algorithm: `deliverables/BIGQUERY_GROWTH_OPERATING_ALGORITHM.md`
- BigQuery platform doc: `deliverables/BIGQUERY_TRANSITION.md`
- Data contracts: `deliverables/DATA_CONTRACTS.md`
- Product/URL scoring: `deliverables/PRODUCT_URL_SCORING.md`
- Operating routines: `deliverables/OPERATING_ROUTINES.md`
- Guardrails: `deliverables/PAPERCLIP_GUARDRAILS.md`
</specifics>

<deferred>
## Deferred Ideas

- Direct production publication.
- Direct GA4/GSC agent integration.
- Arbitrary SQL execution by agents.
- Full-site immediate crawling.
- Broad localization rollout.
- AI assistant launch.
</deferred>

---

*Phase: 07-bigquery-growth-automation-portfolio-expansion*
*Context gathered: 2026-05-01*
