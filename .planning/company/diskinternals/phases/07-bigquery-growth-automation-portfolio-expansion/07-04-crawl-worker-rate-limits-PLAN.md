---
phase: 7
plan: "07-04"
title: "Rate-Limited Crawl And Page Snapshot Worker"
wave: 3
depends_on: ["07-01", "07-02", "07-03"]
requirements: ["BQ-01", "BQ-02", "BQ-03"]
files_modified:
  - "local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/src/crawl-worker.ts"
  - "local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/src/crawl-queue.ts"
  - "local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/tests/crawl-worker.test.ts"
  - "local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/tests/crawl-queue.test.ts"
autonomous: true
---

# 07-04: Rate-Limited Crawl And Page Snapshot Worker

## Objective

Implement controlled page metadata refresh for thousands of DiskInternals URLs without agents directly crawling pages or overloading the site.

<must_haves>
<artifacts>
- BigQuery-backed crawl job and job-item state transitions.
- Worker that enforces conservative per-host concurrency, delays, retries, robots handling, and fetch budgets.
- Agent tools for scheduling crawl batches and checking job status.
</artifacts>
<key_links>
- Crawl queue consumes URL inventory from `07-03`.
- Crawl snapshots write to BigQuery tables from `07-01`.
- Plugin tools from `07-02` expose only job scheduling/status, not arbitrary fetching.
</key_links>
</must_haves>

<tasks>
<task id="1" type="auto">
<files>
local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/src/crawl-queue.ts
local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/src/tools.ts
local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/tests/crawl-queue.test.ts
</files>
<action>
Implement `schedule_crawl_batch` and `get_crawl_job_status`. Scheduling must accept priority band, reason, URL/product filters, max items, and desired window. It must write BigQuery job state with `next_fetch_at`, `status`, `attempt_count`, and per-item priority. Reject unbounded full-site jobs unless explicitly marked and limited by job size.
</action>
<verify>
<automated>cd /Users/savitsky/CodexProjects/paper-clip/local-paperclip && pnpm --filter @paperclipai/plugin-diskinternals-bigquery-growth test -- crawl-queue</automated>
</verify>
<done>
Agents can schedule bounded crawl jobs and receive status/provenance without fetching pages themselves.
</done>
</task>

<task id="2" type="auto">
<files>
local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/src/crawl-worker.ts
local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/src/robots.ts
local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/tests/crawl-worker.test.ts
</files>
<action>
Implement the worker loop with initial defaults: `max_concurrent_requests_per_host = 2`, `min_delay_between_requests_per_host = 2 seconds`, `max_pages_per_job = 200-500`, exponential backoff with jitter, max 3 attempts, no asset/binary fetching by default, response-size cap, robots allow/disallow checks, and `429/503/Retry-After` handling. Do not impersonate Googlebot.
</action>
<verify>
<automated>cd /Users/savitsky/CodexProjects/paper-clip/local-paperclip && pnpm --filter @paperclipai/plugin-diskinternals-bigquery-growth test -- crawl-worker</automated>
</verify>
<done>
Tests prove concurrency/delay/backoff/robots/Retry-After behavior and job-item transitions.
</done>
</task>

<task id="3" type="auto">
<files>
local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/src/page-snapshot.ts
local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/tests/page-snapshot.test.ts
.planning/company/diskinternals/deliverables/BIGQUERY_GROWTH_OPERATING_ALGORITHM.md
</files>
<action>
Extract and store safe page metadata: HTTP status, final URL, canonical, noindex, title, H1, content hash, response bytes, fetch timestamp, and error code. Document which data is intentionally not fetched or stored. Avoid storing full HTML unless a bounded debug mode is explicitly approved.
</action>
<verify>
<automated>cd /Users/savitsky/CodexProjects/paper-clip/local-paperclip && pnpm --filter @paperclipai/plugin-diskinternals-bigquery-growth test -- page-snapshot</automated>
</verify>
<done>
Crawl snapshots provide enough metadata for indexing/refresh decisions without creating large HTML storage or crawl pressure.
</done>
</task>
</tasks>
