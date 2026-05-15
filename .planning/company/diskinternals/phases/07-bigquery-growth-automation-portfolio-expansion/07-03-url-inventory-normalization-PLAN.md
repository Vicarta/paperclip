---
phase: 7
plan: "07-03"
title: "Sitemap URL Inventory, Normalization, And Product Mapping"
wave: 2
depends_on: ["07-01"]
requirements: ["BQ-01", "BQ-02", "BQ-03"]
files_modified:
  - "local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/src/url-normalization.ts"
  - "local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/src/sitemap-sync.ts"
  - "local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/tests/url-normalization.test.ts"
  - "local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/tests/sitemap-sync.test.ts"
autonomous: true
---

# 07-03: Sitemap URL Inventory, Normalization, And Product Mapping

## Objective

Build the URL identity layer that lets GA4, GSC, sitemap, crawl, product, and change data join safely through `url_id` / `normalized_url`.

<must_haves>
<artifacts>
- Deterministic URL normalization library.
- Sitemap sync tool/workflow that updates BigQuery URL inventory without full-page crawling.
- Product mapping hooks for DiskInternals product families, including Linux Reader/Linux Writer distinctions.
</artifacts>
<key_links>
- URL inventory writes to tables from `07-01`.
- Plugin tools from `07-02` use the same URL identity rules.
- Crawl worker in `07-04` consumes URL inventory rather than discovering arbitrary pages.
</key_links>
</must_haves>

<tasks>
<task id="1" type="auto">
<files>
local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/src/url-normalization.ts
local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/tests/url-normalization.test.ts
</files>
<action>
Implement URL normalization for DiskInternals: canonical protocol/host policy, `www` handling, tracking parameter removal, fragment removal, trailing slash policy, `/index.html` policy, redirect/final URL preservation fields, localized URL separation, and meaningful query-parameter preservation. Tests must cover GA4 page URLs, GSC URLs, sitemap URLs, redirects, tracking noise, and localized paths.
</action>
<verify>
<automated>cd /path/to/paper-clip/local-paperclip && pnpm --filter @paperclipai/plugin-diskinternals-bigquery-growth test -- url-normalization</automated>
</verify>
<done>
Normalization produces stable `normalized_url`/`url_id` candidates and never merges localized or meaningfully parameterized pages incorrectly.
</done>
</task>

<task id="2" type="auto">
<files>
local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/src/sitemap-sync.ts
local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/src/tools.ts
local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/tests/sitemap-sync.test.ts
</files>
<action>
Implement `sync_sitemap_snapshot` and `normalize_url_inventory` tool logic. Fetch sitemap index/nested sitemap XML, parse URLs and `lastmod`, upsert into BigQuery inventory, mark URLs missing from latest sitemap without immediate deletion, and report counts for added/updated/missing/invalid URLs. Do not fetch page HTML as part of sitemap sync.
</action>
<verify>
<automated>cd /path/to/paper-clip/local-paperclip && pnpm --filter @paperclipai/plugin-diskinternals-bigquery-growth test -- sitemap-sync</automated>
</verify>
<done>
Sitemap sync creates URL inventory snapshots and returns a safe summary suitable for Paperclip issue comments.
</done>
</task>

<task id="3" type="auto">
<files>
local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/src/product-mapping.ts
local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/tests/product-mapping.test.ts
.planning/company/diskinternals/deliverables/PRODUCT_URL_SCORING.md
</files>
<action>
Add product mapping rules that connect URL paths/download filenames/product routes to DiskInternals product families. Preserve ambiguity fields when one page supports multiple intents. Include Linux Reader read/view, Linux Writer write/edit, and recovery intent separation.
</action>
<verify>
<automated>cd /path/to/paper-clip/local-paperclip && pnpm --filter @paperclipai/plugin-diskinternals-bigquery-growth test -- product-mapping</automated>
</verify>
<done>
Product mapping can classify core pilot pages and explicitly flags ambiguous or missing product binding.
</done>
</task>
</tasks>
