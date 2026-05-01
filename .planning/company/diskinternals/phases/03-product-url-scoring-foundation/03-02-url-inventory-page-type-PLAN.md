---
phase: 3
plan: "03-02"
title: "URL Inventory And Page-Type Mapping"
wave: 1
depends_on: ["03-01"]
requirements: ["MAP-02"]
files_modified:
  - ".planning/company/diskinternals/deliverables/PRODUCT_URL_SCORING.md"
  - "local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/src/url-normalization.ts"
  - "local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/src/product-mapping.ts"
autonomous: true
---

# 03-02: URL Inventory And Page-Type Mapping

## Objective

Create stable URL identity and page-type fields so sitemap, GA4, GSC, crawl, and change data join through `url_id`.

<tasks>
<task id="1" type="auto">
<action>Normalize URLs, preserve meaningful query parameters, infer page type, and keep localized variants separate.</action>
<done>`dim_url` can represent product, hub, article, download/order, checkout, localized, and debug-only Thank You pages.</done>
</task>
</tasks>
