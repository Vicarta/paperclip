# Requirements: DiskInternals Paperclip Growth OS

**Defined:** 2026-04-29
**Core Value:** Every Paperclip action should turn trustworthy product, URL, and funnel data into measurable growth work for visitors, trial downloads, order-page visits, and license purchases.

## v1 Requirements

### Governance

- [x] **GOV-01**: Every Paperclip API action explicitly targets DiskInternals company ID `969d66ff-d77e-4dbf-8759-1a17c2bb17c2`.
- [x] **GOV-02**: Planning, issue descriptions, comments, and links use the `DIS` prefix and never rely on the Astrogen default context.
- [x] **GOV-03**: Publication, tracking changes, and production experiments require approval even when agents prepare implementation-ready briefs or Perfex CRM task payloads.
- [x] **GOV-04**: Specialist agents remain wake-on-demand unless a routine is explicitly approved.
- [x] **GOV-05**: DiskInternals agents must follow the shared agency-core governance contract at `.planning/agency-core/governance/AGENT_EXECUTION_GOVERNANCE.md`.

### Agent Operating Model

- [x] **AGT-01**: `CMO` is documented as the acting Growth PM under `CEO`.
- [x] **AGT-02**: All 25 existing DiskInternals agents have a target role: keep, repurpose, merge, hold, or create replacement.
- [x] **AGT-03**: SEO owns blog strategy, blog briefs, article writing, validation, semantic core, and search performance work.
- [x] **AGT-04**: MKT blog-prefixed roles are either renamed/repurposed away from blog ownership or held until reassignment.
- [x] **AGT-05**: SOC is defined as the future owner for social content planning; no existing MKT blog role should silently own SOC work.
- [x] **AGT-06**: Missing specialist roles are proposed with reporting line, responsibility, and reuse/creation recommendation.
- [x] **AGT-07**: A Growth Opportunity Strategist lane classifies scored BigQuery opportunities into SEO, CRO, localization, internal-linking, indexing, data-quality, or parked actions before CMO approval.

### Semantic Core MCP

- [x] **SEO-MCP-01**: Semantic-core generation must use the Paperclip Semantic Core MCP plugin, not direct raw MCP access or desktop-local connectors.
- [x] **SEO-MCP-02**: Production semantic-core runs cover `core_product_intent`, `adjacent_use_case_intent`, `audience_need_intent`, and `audience_interest_intent` unless the task is explicitly marked as smoke/budget-sensitive.
- [x] **SEO-MCP-03**: Production semantic-core runs enable competitor SERP expansion with content parsing through `semantic_expansion.serp_competitor_expansion.enable_content_parsing=true`; quick/smoke/budget-sensitive runs can keep content parsing disabled.
- [x] **SEO-MCP-04**: Semantic-core imports preserve `recall_ledger`, `serp_competitor_candidates`, `competitor_expansion_debug`, `serp_result_classification_reason`, and `competitor_expansion_endpoint` when MCP returns them.
- [x] **SEO-MCP-05**: Parsed competitor content terms are never treated as accepted keywords unless the MCP output passes normal status, owner-fit, and `layer_membership` gates.
- [x] **SEO-MCP-06**: Production live runs use project-scoped provider cache with `provider_cache.mode=read_write` and `provider_cache_mode=read_write` unless a task explicitly requests `read_only`, `refresh`, or `bypass`.
- [x] **SEO-MCP-07**: Agents must call `get_run_costs` after each live Semantic Core run and before initiating additional live provider runs.
- [x] **SEO-MCP-08**: Keyword, review, cluster, and SERP result reads must be paginated; agents must not request thousands of rows in one MCP call.
- [x] **SEO-MCP-09**: Agents use MCP server-side `project_id`, `run_id`, and `job_id`; they must not pass local filesystem paths to the remote MCP server.
- [x] **SEO-MCP-10**: MCP outputs are generation and evidence artifacts only. Content plans, page briefs, Perfex tasks, and monitoring targets are downstream Paperclip workflows, not MCP responsibilities.
- [x] **SEO-MCP-11**: Semantic-core layer decisions are policy-driven. Agents must not hardcode site-specific lexical allow/deny rules, must configure niche terms through project inputs/entity packs/`semantic_expansion`, must route high-demand conflicts to review instead of silent loss, and must inspect `decision_trace` when explaining accepted/review/parked/rejected keywords.

### Data Contracts And Attribution

- [x] **DATA-01**: BigQuery-backed report/plugin contracts are defined for GA4 funnel, product proxy, GSC opportunities, URL inventory, crawl/page state, site search, popup performance, landing-page-to-purchase paths, and changed URLs.
- [x] **DATA-02**: Agents consume normalized BigQuery plugin reports instead of raw credentials, direct GA4/GSC access, arbitrary SQL, or ad hoc funnel calculations.
- [x] **ATTR-01**: GA4 parameter QA is specified for `file_download`, `visit_order_page`, `purchase`, popup events, and `view_search_results`; `thank_you_page` is QA/debug-only and excluded from growth scoring.
- [x] **ATTR-02**: Ecommerce product attribution fix is captured as a CTO-owned execution stream.
- [x] **ATTR-03**: Until ecommerce attribution is fixed, product scoring uses URL, filename/download, order-page, and GSC proxy signals; Thank You pages remain QA/debug-only.

### Product, URL, And Scoring Foundation

- [x] **MAP-01**: `dim_product` scope covers all DiskInternals products, including upcoming Linux Writer with launch status.
- [x] **MAP-02**: `dim_url` scope maps primary URLs, language, page type, product, canonical/hub/article status, and localized URLs where known.
- [x] **SCORE-01**: Product Proxy Score is defined for attribution-limited operation.
- [x] **SCORE-02**: Product Growth Score is defined for post-attribution operation.
- [x] **SCORE-03**: Page Action Score is defined for URL-level refresh, linking, CRO, localization, and indexing decisions.

### Pilot Backlog System

- [x] **PILOT-01**: Pilot backlog allocation is fixed at RAID 35%, VMFS 25%, Linux Reader/Linux Writer funnel 25%, Download/Order/Checkout flow 15%.
- [x] **PILOT-02**: RAID backlog covers product page, RAID articles, CTA blocks, internal links, popup scenarios, and reindexing candidates.
- [x] **PILOT-03**: VMFS backlog covers product page, VMFS articles, datastore/VMDK messaging, internal links, popup scenarios, and reindexing candidates.
- [x] **PILOT-04**: Linux Reader/Linux Writer backlog distinguishes read/write utility intent from recovery intent and routes each to the correct product path.
- [x] **PILOT-05**: Download, Order, and Checkout backlog includes safety messaging, next steps, product discovery, and order-page intent tracking; Thank You pages are excluded from scoring/backlog except QA/debug checks.
- [x] **LINK-01**: Internal linking queue identifies high-traffic weak-link pages, product pages needing support links, orphan/near-orphan pages, and pages with GSC signal but weak conversion.
- [x] **CRO-01**: Popup and CTA experiments are scenario-based uncertainty reducers, not generic sale popups.
- [x] **LOC-01**: Localization queue requires country demand, GSC signal, product/funnel signal, and product priority.

### Production, QA, Indexing, And Human Implementation

- [x] **PR-01**: Agents can prepare implementation-ready artifacts for website/content/tracking work. For DiskInternals these artifacts target Perfex CRM human tasks, not website repository PRs.
- [x] **PR-02**: Implementation outputs include business context, affected URLs, exact requested changes, expected metrics, rollback notes, and approval checklist.
- [x] **QA-01**: QA checks reject fake recovery guarantees, unsupported compatibility claims, price/discount claims without source, cannibalization, and wrong product recommendations.
- [x] **IDX-01**: Indexing queue prioritizes product pages, hubs, high-value refreshed pages, GSC opportunity pages, and meaningful title/H1/core content/CTA/link changes.
- [x] **IDX-02**: Low-value text edits and bulk template changes are excluded from manual reindexing.

### Operating Loops

- [x] **OPS-01**: Weekly operating loop is defined without day-count launch milestones: data review, sprint planning, production/QA, release/indexing/report.
- [x] **OPS-02**: Routine plan keeps scheduled heartbeats limited to `CEO`, `CMO`, and `CTO` unless a specialist routine is approved.
- [x] **OPS-03**: Reports sent to `CEO` focus on downloads, order-page visits, purchases, product priority, and completed PR/URL outcomes.

### BigQuery Transition

- [x] **BQ-01**: BigQuery is treated as the current operational source of truth for GA4/GSC-derived DiskInternals growth data.
- [x] **BQ-02**: BigQuery marts/views are specified for product funnel, URL inventory, URL normalization, crawl/page state, GSC refresh, popup performance, localization, content changes, and final growth opportunities.
- [x] **BQ-03**: Paperclip agent data flow uses allowlisted BigQuery Growth Data plugin tools, with `bq` CLI reserved for ops/bootstrap/backfill/debug.

### Selector, Localization, And Assistant Readiness

- [x] **SEL-01**: Guided product selector is planned before AI assistant.
- [x] **SEL-02**: Selector scenarios cover RAID failure, VMFS datastore issues, Linux/Mac disk read/write needs, deleted/formatted partition, database file issue, and office/mail file issue.
- [x] **AI-01**: AI assistant is explicitly deferred until product knowledge base, logs, events, support routing, no-guarantee policy, and approved safety messages exist.
- [x] **LOC-02**: Mexico/Spanish, France/French, Germany/German, and China investigation are handled by signal, not broad translation volume.

## v2 Requirements

### Social

- **SOC-01**: Create SOC agent lane for social content plan, social publishing calendar, and social creative validation.
- **SOC-02**: Migrate any future social content tasks away from MKT blog-prefixed roles.

### Assistant

- **AIA-01**: Launch AI assistant on a constrained set of pages only after selector telemetry and safety guardrails prove stable.
- **AIA-02**: Assistant events include open, scenario selected, product recommended, download click, and support ticket click.

### BigQuery Automation

- **BQA-01**: Automate BigQuery growth marts as the primary source of truth for weekly backlog generation.
- **BQA-02**: Add content-change telemetry to connect Paperclip/Perfex implementation tasks to post-release search and funnel outcomes.

### Perfex CRM Handoff

- **PERFEX-01**: Create a Paperclip plugin adapter for the Perfex CRM MCP endpoint using Streamable HTTP at `https://pxmc.aibizmate.com/mcp`.
- **PERFEX-02**: Store the MCP bearer token only as a Paperclip secret and pass it as `Authorization: Bearer <MCP_TOKEN>` from server-side plugin code.
- **PERFEX-03**: Do not require or expose any Perfex Bridge Shared Secret; Perfex authorization and acting user are controlled server-side by the MCP service.
- **PERFEX-04**: Agents can create/update/read implementation tasks in Perfex CRM with affected URLs, exact requested changes, source data, QA checklist, owner, due/priority if available, and Paperclip issue link.
- **PERFEX-05**: Perfex task IDs and status changes are recorded back into Paperclip/BigQuery follow-up state so completed human work can trigger indexing and 7/14/28 day measurements.

### Operator Documentation And Notifications

- **DOC-01**: Maintain a DiskInternals-specific human usage guide that explains Paperclip from business tasks to configured workflows, agent roles, plugins, approvals, Perfex handoff, and result review.
- **NOTIF-01**: Telegram issue completion notifications must explain `Що зроблено` in human language. Generic one-line fallbacks are not acceptable; the resolver must use available issue evidence and enforce a 150-250 word quality gate when the source summary is too short or agent-facing.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Separate Growth PM agent | `CMO` will own Growth PM responsibilities. |
| Mass article generation | Product attribution and page scoring must come first. |
| Autonomous production publishing | Approval governance is required for website and tracking changes. |
| Website repository PRs as the default implementation path | DiskInternals website source is not available to Paperclip; human implementation must flow through Perfex CRM. |
| Broad social content operations | SOC lane is future scope and should not be mixed with SEO blog work. |
| Blanket localization | Localization must be gated by business signal. |
| Immediate AI assistant | Selector, safety policy, telemetry, and support routing come first. |
| Bulk manual reindexing | Only meaningful high-value changed URLs should be submitted. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| GOV-01 | Phase 1 | Complete |
| GOV-02 | Phase 1 | Complete |
| GOV-03 | Phase 1 | Complete |
| GOV-04 | Phase 1 | Complete |
| GOV-05 | Phase 1 | Complete |
| AGT-01 | Phase 1 | Complete |
| AGT-02 | Phase 1 | Complete |
| AGT-03 | Phase 1 | Complete |
| AGT-04 | Phase 1 | Complete |
| AGT-05 | Phase 1 | Complete |
| AGT-06 | Phase 1 | Complete |
| AGT-07 | Phase 7 | Complete |
| DATA-01 | Phase 2 | Complete |
| DATA-02 | Phase 2 | Complete |
| ATTR-01 | Phase 2 | Complete |
| ATTR-02 | Phase 2 | Complete |
| ATTR-03 | Phase 2 | Complete |
| MAP-01 | Phase 3 | Complete |
| MAP-02 | Phase 3 | Complete |
| SCORE-01 | Phase 3 | Complete |
| SCORE-02 | Phase 3 | Complete |
| SCORE-03 | Phase 3 | Complete |
| PILOT-01 | Phase 4 | Complete |
| PILOT-02 | Phase 4 | Complete |
| PILOT-03 | Phase 4 | Complete |
| PILOT-04 | Phase 4 | Complete |
| PILOT-05 | Phase 4 | Complete |
| LINK-01 | Phase 4 | Complete |
| CRO-01 | Phase 4 | Complete |
| LOC-01 | Phase 4 | Complete |
| PR-01 | Phase 5 | Complete |
| PR-02 | Phase 5 | Complete |
| QA-01 | Phase 5 | Complete |
| IDX-01 | Phase 5 | Complete |
| IDX-02 | Phase 5 | Complete |
| OPS-01 | Phase 6 | Complete |
| OPS-02 | Phase 6 | Complete |
| OPS-03 | Phase 6 | Complete |
| BQ-01 | Phase 7 | Complete |
| BQ-02 | Phase 7 | Complete |
| BQ-03 | Phase 7 | Complete |
| SEL-01 | Phase 8 | Complete |
| SEL-02 | Phase 8 | Complete |
| AI-01 | Phase 8 | Complete |
| LOC-02 | Phase 8 | Complete |
| PERFEX-01 | Phase 11 | Complete |
| PERFEX-02 | Phase 11 | Complete |
| PERFEX-03 | Phase 11 | Complete |
| PERFEX-04 | Phase 11 | In Progress |
| PERFEX-05 | Phase 11 | In Progress |
| DOC-01 | Phase 12 | Complete |
| NOTIF-01 | Phase 12 | Complete |

**Coverage:**
- v1 requirements: 45 total
- v2 requirements: 11 total
- Mapped to phases: 56
- Unmapped: 0

---
*Requirements defined: 2026-04-29*
*Last updated: 2026-05-01 after Perfex CRM human implementation handoff correction*
