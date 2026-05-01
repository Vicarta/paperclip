---
phase: 2
plan: "02-01"
title: "BigQuery Report Contracts And Plugin Access"
wave: 1
depends_on: ["01-01", "01-02", "01-03"]
requirements: ["DATA-01", "DATA-02", "BQ-01", "BQ-03"]
files_modified:
  - ".planning/company/diskinternals/deliverables/DATA_CONTRACTS.md"
  - ".planning/company/diskinternals/deliverables/BIGQUERY_GROWTH_OPERATING_ALGORITHM.md"
  - "local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/**"
autonomous: true
---

# 02-01: BigQuery Report Contracts And Plugin Access

## Objective

Make BigQuery the documented and implemented data access path for DiskInternals growth agents, with Paperclip plugin tools as the only runtime interface.

<tasks>
<task id="1" type="auto">
<action>Define report contracts for URL inventory, GA4 funnel, GSC URL/query opportunity, product priority, CRO candidates, localization candidates, indexing candidates, decisions, and follow-up.</action>
<done>Contracts are documented and mapped to allowlisted plugin tools.</done>
</task>
<task id="2" type="auto">
<action>Ensure plugin tools validate bounded filters and return provenance/cost metadata instead of exposing arbitrary SQL or credentials.</action>
<done>Agents can access BigQuery-derived reports only through `paperclip.diskinternals-bigquery-growth`.</done>
</task>
</tasks>
