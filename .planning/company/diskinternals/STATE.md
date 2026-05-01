# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-29)

**Core value:** Every Paperclip action should turn trustworthy product, URL, and funnel data into measurable growth work for visitors, trial downloads, order-page visits, and license purchases.
**Current focus:** Phase 1-10 Growth OS readiness complete; next work is Phase 11 Perfex CRM human implementation handoff so approved growth actions become tasks for people.

## Current Position

Phase: 11 planning
Plan: Perfex CRM human implementation handoff
Status: Planned
Last activity: 2026-05-01 - Corrected production implementation model from website PRs to Perfex CRM human tasks

Progress: [#########-] 90%

## Performance Metrics

**Velocity:**
- Total plans completed: 30
- Average duration: n/a
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: none
- Trend: n/a

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- `CMO` acts as Growth PM; no separate Growth PM agent.
- Create the plan for all agents now before execution.
- BigQuery export is the operational source of truth for GA4/GSC-derived DiskInternals data.
- Direct GA4/GSC access is not available to agents; access must go through BigQuery-backed Paperclip plugin tools.
- DiskInternals website code is not available to Paperclip agents. Website changes are implemented manually by people through Perfex CRM tasks.
- Agents may prepare implementation-ready briefs and Perfex CRM task payloads; production remains approval-gated.
- Pilot focus is confirmed: RAID, VMFS, Linux Reader/Linux Writer funnel, Download/Order/Checkout. Thank You pages are QA/debug-only and excluded from scoring/backlog.
- Blog work belongs to SEO; SOC is the future social content lane.
- Plans should not use fixed day counts.
- Phase 1 completed in Paperclip as `DIS-15`; Phase 2 is active as `DIS-16`.
- Specialist agents were approved and remain wake-on-demand.
- Active manager routines were created for CMO, CTO, and CEO.
- Paperclip manager flow created `DIS-48` for canonical DiskInternals company/product reference.
- `DIS-28` interim proxy attribution policy completed by DATA Growth Analytics Agent.

### Operational Notes

- `DIS-48` completed by Paperclip manager flow: canonical DiskInternals company and product reference layer.
- Phase 9 Winning Structure MCP adapter is deployed live, configured with encrypted token secret, and smoke-tested through Paperclip plugin tools.
- Phase 10 Semantic Core MCP adapter is deployed live, configured with encrypted token secret, and smoke-tested through Paperclip plugin tools.
- Follow-up: audit and, if needed, update live DiskInternals SEO Performance Analyst and SEO Internal Linking Indexation Agent contracts for explicit SEO/MCP lane separation language. Do this as a separate live-agent contract change, not as part of the planning-only governance overlay.
- Phase 1-10 readiness plans are complete. Phase 7 live BigQuery now has initial sitemap URL inventory, GA4/GSC fact ingestion, opportunity marts, and crawl smoke snapshots.
- Phase 11 is planned to add a Perfex CRM MCP plugin so approved Paperclip opportunities become human implementation tasks.

### Guardrails

- DiskInternals follows the shared agency-core execution governance contract: `.planning/agency-core/governance/AGENT_EXECUTION_GOVERNANCE.md`.
- Open agent tasks must not hang silently. `in_progress` work needs run, wakeup, recovery, or fresh continuation evidence.
- Blocked work must state the blocker owner, the unblock condition, and the resume path.
- Parent/child work must use explicit handoff: completing a child issue does not automatically complete the parent coordination issue.
- Plugins and MCP-backed tools must be used only through Paperclip's live plugin registry and agent capabilities; desktop-local connectors or raw external MCP assumptions are not valid inside Paperclip.
- SEO/MCP work should stay split into child lanes for generation, validation, review/routing, implementation, and monitoring unless the manager marks the issue as a small smoke test.

### Roadmap Evolution

- Phase 9 added: Winning Structure MCP Adapter.
- Phase 9 implementation completed locally and live on 2026-04-29; Docker build now includes the plugin and live registry has the tools enabled.
- Phase 10 added and completed: Semantic Core MCP Adapter. It bridges Paperclip to the private semantic-core MCP server, validates `paperclip_import.v1`, and stores import candidates in plugin state/entities until native SEO semantic tables are implemented.
- BigQuery-first growth operations algorithm added: `deliverables/BIGQUERY_GROWTH_OPERATING_ALGORITHM.md`.
- Phase 7 planned as BigQuery Growth Automation with six executable GSD plans in `phases/07-bigquery-growth-automation-portfolio-expansion/`.
- Plan `07-06` covers the live operational bootstrap: applying `dre-di.diskinternals_growth` schema/views, storing the BigQuery service account as a Paperclip encrypted company secret, wiring the live plugin config, and smoke-checking the resulting surface.
- Plan `07-06` completed live: `dre-di.diskinternals_growth` has the schema/views, the service account is stored as Paperclip encrypted company secret `DISK_INTERNALS_BIGQUERY_SERVICE_ACCOUNT_JSON`, and `paperclip.diskinternals-bigquery-growth` is configured with the secret reference.
- Missing Phase 2-5 and Phase 8 GSD plan files were created so every roadmap plan has a physical execution plan.
- Phase 7 BigQuery Growth plugin was hardened with sitemap index handling, GA4/GSC ingestion tools, bounded due-crawl execution, product/page classification, and additional tests.
- Live BigQuery initial data load completed: `dim_url`, `raw_sitemap_snapshots`, `fact_ga4_url_day`, `fact_gsc_url_query_day`, `mart_growth_opportunities`, and `fact_crawl_page_snapshot` now contain initial operational data.

### Blockers/Concerns

- Website repository/access is not expected for DiskInternals. Production implementation should route through Perfex CRM human tasks instead of website PRs.
- Phase 11 plugin work is required before Paperclip can automatically create and monitor Perfex tasks.
- Linux Writer is upcoming, so product/URL/event mapping may start with placeholder fields.
- Winning Structure MCP smoke returned `human_review_required: true` with low confidence for the sample `convert vhd to vmdk` run, so downstream automation must keep human/editorial review before using the recommendation.
- Semantic Core MCP live server now exposes a dedicated `get_review_queue` tool; Paperclip wrapper smoke returned 200 with a valid paginated queue response.

## Session Continuity

Last session: 2026-04-29
Stopped at: Phase 2 Paperclip tasks active; `DIS-28` complete; `DIS-16`, `DIS-26`, `DIS-48`, and `DIS-14` in progress.
Resume file: None
