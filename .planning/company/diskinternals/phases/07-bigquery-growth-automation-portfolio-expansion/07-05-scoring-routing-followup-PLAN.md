---
phase: 7
plan: "07-05"
title: "Scoring Marts, Opportunity Routing, Localization, And Follow-Up"
wave: 4
depends_on: ["07-01", "07-02", "07-03", "07-04"]
requirements: ["BQ-01", "BQ-02", "BQ-03", "AGT-07"]
files_modified:
  - "ops/bigquery/diskinternals/views/020_opportunity_marts.sql"
  - "local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/src/scoring.ts"
  - "local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/src/opportunity-decisions.ts"
  - ".planning/company/diskinternals/deliverables/AGENT_OPERATING_MODEL.md"
autonomous: true
---

# 07-05: Scoring Marts, Opportunity Routing, Localization, And Follow-Up

## Objective

Turn BigQuery facts into ranked opportunities, route them through a Growth Opportunity Strategist lane, and close the loop with 7/14/28 day follow-up metrics.

<must_haves>
<artifacts>
- Product, URL, CRO, localization, internal-linking, indexing, and follow-up marts.
- Scoring functions/tests that exclude Thank You pages and preserve null/zero metric semantics.
- Growth Opportunity Strategist lane documented and ready for live agent creation or repurposing.
</artifacts>
<key_links>
- Scoring consumes BigQuery facts and crawl snapshots from plans `07-01` through `07-04`.
- Plugin tools from `07-02` expose the opportunity queue and decision recording.
- CMO receives routed backlog candidates, not raw thousands of URLs.
</key_links>
</must_haves>

<tasks>
<task id="1" type="auto">
<files>
ops/bigquery/diskinternals/views/020_opportunity_marts.sql
local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/src/scoring.ts
local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/tests/scoring.test.ts
</files>
<action>
Implement scoring marts and matching TypeScript helpers for Product Proxy Score, Product Growth Score, Page Action Score, Localization Opportunity Score, CRO candidates, internal-link candidates, indexing candidates, and follow-up candidates. Exclude Thank You pages from all scoring. Treat null/zero metrics as unknown/no measured signal rather than automatic rejection.
</action>
<verify>
<automated>cd /Users/savitsky/CodexProjects/paper-clip/local-paperclip && pnpm --filter @paperclipai/plugin-diskinternals-bigquery-growth test -- scoring</automated>
</verify>
<done>
Scoring produces deterministic opportunity rows with score components, evidence summaries, and no Thank You scoring contribution.
</done>
</task>

<task id="2" type="auto">
<files>
local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/src/opportunity-decisions.ts
local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/src/tools.ts
local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/tests/opportunity-decisions.test.ts
.planning/company/diskinternals/deliverables/AGENT_OPERATING_MODEL.md
</files>
<action>
Implement `record_opportunity_decision` and document the Growth Opportunity Strategist lane. Supported action types: `seo_refresh`, `new_page_or_article`, `internal_linking`, `cro_experiment`, `localization_experiment`, `product_page_update`, `indexing_followup`, `tracking_or_data_quality_issue`, and `park_no_action`. Decisions must record owner lane, reason, confidence, source opportunity IDs, and parent Paperclip issue ID when available.
</action>
<verify>
<automated>cd /Users/savitsky/CodexProjects/paper-clip/local-paperclip && pnpm --filter @paperclipai/plugin-diskinternals-bigquery-growth test -- opportunity-decisions</automated>
</verify>
<done>
Opportunities can be routed before CMO approval and are auditable back to BigQuery rows and Paperclip issues.
</done>
</task>

<task id="3" type="auto">
<files>
local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/src/followup.ts
local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/tests/followup.test.ts
.planning/company/diskinternals/deliverables/OPERATING_ROUTINES.md
</files>
<action>
Implement `get_post_change_followup` logic for 7/14/28 day checks. Join changed URLs to GSC, GA4, downloads, order visits, purchases when attributed, crawl/indexability state, and opportunity decisions. Flag invalid follow-up windows when the page changed again during the measurement period.
</action>
<verify>
<automated>cd /Users/savitsky/CodexProjects/paper-clip/local-paperclip && pnpm --filter @paperclipai/plugin-diskinternals-bigquery-growth test -- followup</automated>
</verify>
<done>
Released changes can be evaluated through BigQuery and fed back into future scoring/backlog decisions.
</done>
</task>
</tasks>
