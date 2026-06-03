# GSC Bing GA4 MCP Agent Tools

Thin Paperclip adapter for the private Astrogen analytics MCP server.

## Purpose

This plugin lets Paperclip agents call backend-allowlisted MCP tools for Google Search Console, Bing, GA4, and PageSpeed without exposing endpoint credentials to agents, prompts, issue comments, or source code.

Default endpoint:

```text
http://172.21.0.1:3002/mcp
```

Default allowed GSC site:

```text
sc-domain:astrogen.com.ua
```

## Security Model

- The bearer token is stored only as a Paperclip server-side secret reference.
- The plugin backend injects `Authorization: Bearer <token>` into MCP requests.
- Agents cannot pass or override the endpoint URL or bearer token.
- Tool calls are limited by backend plugin config.
- The default tool allowlist contains only currently verified MCP tools.
- Calls with a mismatched `siteUrl`, `site_url`, or `site` are rejected before reaching MCP.
- Calls with `inspectionUrl` or batch `urls` outside the configured site are rejected before reaching MCP.
- Site-scoped GSC tools receive the configured `allowedSiteUrl` automatically when the caller does not provide it.

Verified default MCP tools are read-only analytics, diagnostics, and intelligence tools:

- `sites_list`
- `analytics_query`
- `analytics_top_queries`
- `analytics_trends`
- `analytics_anomalies`
- `analytics_drop_attribution`
- `analytics_time_series`
- `analytics_compare_periods`
- `seo_brand_vs_nonbrand`
- `seo_low_hanging_fruit`
- `seo_striking_distance`
- `seo_low_ctr_opportunities`
- `seo_cannibalization`
- `seo_lost_queries`
- `seo_primitive_ranking_bucket`
- `seo_primitive_traffic_delta`
- `seo_primitive_is_brand`
- `seo_primitive_is_cannibalized`
- `sites_health_check`
- `inspection_inspect`
- `inspection_batch_inspect`
- `inspection_batch_job_start`
- `inspection_batch_job_status`
- `inspection_batch_job_results`
- `inspection_batch_job_cancel`
- `inspection_cache_stats`
- `sitemaps_list`
- `pagespeed_analyze`
- `schema_validate`
- `bing_sites_list`
- `bing_analytics_query`
- `bing_opportunity_finder`
- `bing_seo_recommendations`
- `bing_url_info`
- `bing_crawl_issues`
- `bing_analytics_detect_anomalies`
- `bing_analytics_time_series`
- `bing_seo_lost_queries`
- `bing_brand_analysis`
- `bing_sitemaps_list`
- `analytics_page_performance`
- `analytics_traffic_sources`
- `analytics_organic_landing_pages`
- `analytics_content_performance`
- `analytics_conversion_funnel`
- `analytics_user_behavior`
- `analytics_audience_segments`
- `analytics_realtime`
- `analytics_ecommerce`
- `analytics_pagespeed_correlation`
- `page_analysis`
- `opportunity_matrix`

Mutating tools such as `sites_add`, `sites_delete`, `sitemaps_submit`, `bing_index_now`, and `bing_sitemaps_submit` are intentionally not in the default allowlist.

## Configuration

Plugin config fields:

- `gscBingGa4McpTokenSecretRef`: Paperclip secret ID that stores the Astrogen tenant token.
- `gscBingGa4McpUrl`: private MCP Streamable HTTP endpoint.
- `allowedSiteUrl`: GSC site allowlist.
- `allowedMcpToolNamesCsv`: optional comma-separated backend tool allowlist. Empty means verified defaults only.
- `requestTimeoutMs`: timeout for one MCP connect/call cycle. Default is
  `120000`. The MCP server also applies Google API timeout guards; do not use
  this as a reason to send large URL Inspection lists through sync batch calls.

## Streamable HTTP Session Lifecycle

The adapter opens a short-lived MCP Streamable HTTP session for each Paperclip
tool call-cycle:

1. `initialize`
2. `notifications/initialized`
3. one MCP tool/list call
4. `DELETE /mcp` with the returned `mcp-session-id`

Do not hold MCP sessions between Paperclip heartbeats, runs, or separate tool
calls. If MCP returns `503 too many active MCP sessions`, treat it as evidence
that a client path is not closing sessions or too many call-cycles are running
concurrently.

MCP operational limits as of the current Astrogen endpoint:

- Session TTL: 5 minutes.
- Max concurrent sessions: 50.
- Google API timeout guard: 110 seconds.
- URL Inspection async job chunk size: 5.

## Tool Surface

Paperclip tools:

- `list-tools`: list backend-allowlisted MCP tools currently exposed by the server.
- `call-tool`: call one backend-allowlisted MCP tool by name.
- `sites-list`: wrapper for `sites_list`.
- `analytics-top-queries`: wrapper for `analytics_top_queries`.
- `analytics-query`: wrapper for `analytics_query`.
- `seo-low-ctr-opportunities`: wrapper for `seo_low_ctr_opportunities`.
- `inspection-inspect`: wrapper for `inspection_inspect`.
- `inspection-batch-inspect`: wrapper for `inspection_batch_inspect`; use only
  for small smoke/sync checks.
- `inspection-batch-job-start`: wrapper for `inspection_batch_job_start`.
- `inspection-batch-job-status`: wrapper for `inspection_batch_job_status`.
- `inspection-batch-job-results`: wrapper for `inspection_batch_job_results`;
  always use pagination, for example `{ "jobId": "...", "offset": 0, "limit": 100 }`.
- `inspection-batch-job-cancel`: wrapper for `inspection_batch_job_cancel`.
- `inspection-cache-stats`: wrapper for `inspection_cache_stats`.
- `sitemaps-list`: wrapper for `sitemaps_list`.
- `pagespeed-analyze`: wrapper for `pagespeed_analyze`.

## Live Docker Networking Note

On the live Paperclip host, the MCP endpoint is reached from the Paperclip app container through the existing narrow bridge proxy:

```text
Paperclip app container -> http://172.21.0.1:3002/mcp -> 100.98.5.50:3002
```

Operational constraints:

- The backend SSRF guard remains enabled for plugins by default.
- `paperclip.gsc-bing-ga4-mcp-agent-tools` has a hardcoded allowlist for exactly `100.98.5.50:3002` and `172.21.0.1:3002`.
- Do not add broader private-network access without a new explicit review.

## Agent Handoff

Use GSC/Bing/GA4 MCP as a short-lived provider adapter only. Open a Streamable
HTTP session, call the needed tool, then terminate the session with `DELETE
/mcp`. For large URL Inspection runs, use async job tools instead of sync batch.
Read job results with pagination and store snapshots/decisions in Paperclip
PostgreSQL, not in MCP.

Manual token setup:

```text
Use a local operator-only secret file outside this repository, then store the value in Paperclip Secrets.
```

Do not commit this token or paste it into prompts/issues.
