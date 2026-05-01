---
phase: 3
plan: "03-03"
title: "Growth Scoring Formulas And Agent Usage Rules"
wave: 1
depends_on: ["03-01", "03-02"]
requirements: ["SCORE-01", "SCORE-02", "SCORE-03"]
files_modified:
  - ".planning/company/diskinternals/deliverables/PRODUCT_URL_SCORING.md"
  - "local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/src/scoring.ts"
autonomous: true
---

# 03-03: Growth Scoring Formulas And Agent Usage Rules

## Objective

Define Product Proxy Score, Product Growth Score, and Page Action Score with clear usage boundaries before/after attribution repair.

<tasks>
<task id="1" type="auto">
<action>Implement deterministic scoring helpers and BigQuery marts that exclude Thank You pages and preserve unknown/null signal semantics.</action>
<done>CMO and Growth Opportunity Strategist receive scored opportunities rather than raw data dumps.</done>
</task>
</tasks>
