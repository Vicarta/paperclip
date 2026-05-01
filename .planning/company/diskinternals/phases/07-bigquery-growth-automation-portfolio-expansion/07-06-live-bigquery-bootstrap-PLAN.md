---
phase: 7
plan: "07-06"
title: "Live BigQuery Bootstrap And Plugin Secret Wiring"
wave: 3
depends_on: ["07-01", "07-02"]
requirements: ["BQ-01", "BQ-02", "BQ-03"]
files_modified:
  - ".planning/company/diskinternals/phases/07-bigquery-growth-automation-portfolio-expansion/07-06-live-bigquery-bootstrap-PLAN.md"
  - ".planning/company/diskinternals/ROADMAP.md"
  - ".planning/company/diskinternals/STATE.md"
  - ".planning/company/diskinternals/EXECUTION_LOG.md"
autonomous: false
user_setup:
  - "Operator-provided BigQuery service account JSON must stay outside Git and be loaded into Paperclip encrypted secrets only."
  - "Use DiskInternals company ID 969d66ff-d77e-4dbf-8759-1a17c2bb17c2 only."
---

# 07-06: Live BigQuery Bootstrap And Plugin Secret Wiring

## Objective

Finish the operational live bootstrap for DiskInternals BigQuery growth automation: apply the derived dataset schema/views, store the BigQuery credential as a Paperclip encrypted company secret, wire the live plugin config to that secret, and smoke-check the resulting BigQuery surface.

<must_haves>
<artifacts>
- Live BigQuery dataset `dre-di.diskinternals_growth` contains the growth schema and report/mart views from `07-01`.
- Live Paperclip plugin `paperclip.diskinternals-bigquery-growth` has project, raw export datasets, derived dataset, location, and credential secret reference configured.
- The service account JSON is never committed, printed, or stored in plaintext in planning docs.
- Smoke checks prove the expected tables/views are present and queryable.
</artifacts>
<key_links>
- `07-01` defines SQL schema/views and ops scripts.
- `07-02` defines the Paperclip plugin and secret-backed credential contract.
- Runtime agent access must remain through Paperclip plugin capabilities, not direct BigQuery SQL.
</key_links>
</must_haves>

<tasks>
<task id="1" type="manual-ops">
<files>
ops/bigquery/diskinternals/schema/*.sql
ops/bigquery/diskinternals/views/*.sql
</files>
<action>
Apply all schema and view SQL to `dre-di.diskinternals_growth`, using the operator-provided service account from outside the repository. If local `bq` is unavailable, use the BigQuery REST API with short-lived OAuth tokens derived from the service account.
</action>
<verify>
<automated>Query `dre-di.diskinternals_growth.INFORMATION_SCHEMA.TABLES` and verify the expected base tables and views exist.</automated>
</verify>
<done>
The live derived dataset exists and exposes the expected BigQuery growth tables/views.
</done>
</task>

<task id="2" type="manual-ops">
<files>
local-paperclip/packages/plugins/plugin-diskinternals-bigquery-growth/src/config.ts
</files>
<action>
Create or update a DiskInternals company encrypted secret for the BigQuery service account JSON, then set the live plugin config to reference that secret together with:
`bigQueryProjectId = dre-di`,
`bigQueryDatasetId = diskinternals_growth`,
`ga4ExportDatasetId = analytics_287393097`,
`gscExportDatasetId = searchconsole`,
`bigQueryLocation = US`.
</action>
<verify>
<manual>Confirm the Paperclip database stores only encrypted secret material and the plugin config stores only the secret reference, not the credential JSON.</manual>
</verify>
<done>
The live plugin has the correct DiskInternals BigQuery config and no plaintext credential material in plugin config.
</done>
</task>

<task id="3" type="manual-ops">
<files>
ops/bigquery/diskinternals/scripts/smoke.sh
</files>
<action>
Run live smoke queries against `report_site_url_inventory` and `mart_growth_opportunities`, and verify the live plugin registry still exposes `paperclip.diskinternals-bigquery-growth` after configuration.
</action>
<verify>
<automated>Dry-run or low-limit BigQuery queries succeed for the report and mart views.</automated>
</verify>
<done>
Live BigQuery and Paperclip plugin configuration are ready for later sitemap/import/crawl/funnel population work.
</done>
</task>
</tasks>
