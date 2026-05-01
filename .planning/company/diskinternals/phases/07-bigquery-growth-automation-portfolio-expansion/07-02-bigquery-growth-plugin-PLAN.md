---
phase: 7
plan: "07-02"
title: "BigQuery Growth Data Paperclip Plugin"
wave: 2
depends_on: ["07-01"]
requirements: ["BQ-01", "BQ-02", "BQ-03"]
files_modified:
  - "local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/**"
  - "local-paperclip/package.json"
  - "local-paperclip/pnpm-lock.yaml"
  - "local-paperclip/server/src/**"
autonomous: true
user_setup:
  - "Paperclip secret/service account configuration must be provided before live BigQuery smoke."
---

# 07-02: BigQuery Growth Data Paperclip Plugin

## Objective

Expose DiskInternals BigQuery growth data to Paperclip agents through allowlisted plugin tools with stable contracts, cost controls, provenance, and no arbitrary SQL access.

<must_haves>
<artifacts>
- Bundled Paperclip plugin `paperclip.diskinternals-bigquery-growth`.
- Agent tools matching the canonical algorithm tool surface.
- Backend-only secret/config handling for BigQuery project, dataset, and credentials.
- Unit tests for allowlisted queries, parameter validation, cost metadata, and error handling.
</artifacts>
<key_links>
- Plugin report contracts consume views from `07-01`.
- Plugin tools become the only runtime access path for DiskInternals agents.
- Query provenance and known limitations must be returned to agents for task comments/artifacts.
</key_links>
</must_haves>

<tasks>
<task id="1" type="auto">
<files>
local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/package.json
local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/src/index.ts
local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/src/config.ts
local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/src/bigquery-client.ts
</files>
<action>
Scaffold the plugin using existing Paperclip plugin patterns. Add backend-only config for project id, dataset id, location, credential secret reference, default date window, default row limit, and maximum bytes billed. Implement a BigQuery client wrapper that supports dry-run/query metadata and refuses arbitrary SQL from tool inputs.
</action>
<verify>
<automated>cd /Users/savitsky/CodexProjects/paper-clip/local-paperclip && pnpm --filter @paperclipai/plugin-diskinternals-bigquery-growth typecheck</automated>
</verify>
<done>
Plugin package compiles and can resolve config without storing credentials in source, prompts, logs, or UI output.
</done>
</task>

<task id="2" type="auto">
<files>
local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/src/tools.ts
local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/src/report-contracts.ts
local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/tests/tools.test.ts
</files>
<action>
Implement allowlisted agent tools: `get_schema_status`, `get_site_url_inventory`, `get_product_funnel_metrics`, `get_gsc_url_query_opportunities`, `get_url_growth_opportunity_queue`, `get_product_priority_scores`, `get_cro_experiment_candidates`, `get_localization_candidates`, `get_internal_link_candidates`, `get_indexing_candidates`, `record_opportunity_decision`, `get_post_change_followup`, and `get_query_cost_summary`. Each tool must validate date range, row limit, product/url filters, and return source tables/views, row counts, bytes processed or cached result indicator, known limitations, and stable IDs.
</action>
<verify>
<automated>cd /Users/savitsky/CodexProjects/paper-clip/local-paperclip && pnpm --filter @paperclipai/plugin-diskinternals-bigquery-growth test</automated>
</verify>
<done>
All planned report tools exist, reject invalid/unbounded requests, and return provenance/cost metadata.
</done>
</task>

<task id="3" type="auto">
<files>
local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/src/index.ts
local-paperclip/server/src/__tests__/plugin-private-http-allowlist.test.ts
local-paperclip/package.json
local-paperclip/pnpm-lock.yaml
</files>
<action>
Wire the plugin into the Paperclip workspace build/registry using existing bundled plugin conventions. Add tests or update existing plugin registration coverage so the plugin can be discovered by DiskInternals agents through `/api/agents/me/plugin-tools`.
</action>
<verify>
<automated>cd /Users/savitsky/CodexProjects/paper-clip/local-paperclip && pnpm --filter @paperclipai/plugin-diskinternals-bigquery-growth build && pnpm --filter @paperclipai/server typecheck</automated>
</verify>
<done>
Plugin is buildable, registered, and discoverable through Paperclip plugin capabilities without live BigQuery credentials.
</done>
</task>
</tasks>
