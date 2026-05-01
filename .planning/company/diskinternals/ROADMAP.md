# Roadmap: DiskInternals Paperclip Growth OS

## Overview

This roadmap turns the DiskInternals Paperclip company into a controlled growth operating system. It starts with guardrails and agent role cleanup, then establishes BigQuery-first data contracts, URL inventory/normalization, product and URL scoring, pilot backlog generation, PR/approval workflows, operating routines, BigQuery-backed growth automation, and readiness for guided selector, localization, and AI assistant work.

The roadmap is phase-based, not day-based. Execution can run automatically through Paperclip routines and GSD phases, but production publication and tracking changes remain approval-gated.

## Phases

**Phase Numbering:**
- Integer phases are planned launch work.
- Decimal phases are urgent insertions.
- Phases execute in numeric order.

- [ ] **Phase 1: Company Guardrails And Agent Architecture** - Lock DiskInternals context and normalize the full agent operating model.
- [ ] **Phase 2: Data Contracts And Attribution** - Define BigQuery-backed reports, plugin access, and attribution QA before scaling agent work.
- [ ] **Phase 3: Product, URL, And Scoring Foundation** - Build product/URL mapping and scoring models, including Linux Writer.
- [ ] **Phase 4: Pilot Backlog System** - Generate controlled RAID, VMFS, Linux Reader/Linux Writer, and checkout-flow work.
- [ ] **Phase 5: Production PR And Approval Workflow** - Convert agent output into patches/PRs with QA and indexing controls.
- [ ] **Phase 6: Automated Operating Routines** - Configure recurring growth operations without idle specialist budget burn.
- [ ] **Phase 7: BigQuery Growth Automation And Portfolio Expansion** - Automate BigQuery marts, crawler-backed URL state, and expansion beyond the pilot when scores support it.
- [ ] **Phase 8: Guided Selector, Localization, And Assistant Readiness** - Stage selector, localization, and AI assistant work behind guardrails.
- [x] **Phase 9: Winning Structure MCP Adapter** - Add the Paperclip adapter for SERP-based Winning Structure recommendations.
- [x] **Phase 10: Semantic Core MCP Adapter** - Add the Paperclip adapter for semantic-core generation runs and Paperclip import validation.

## Phase Details

### Phase 1: Company Guardrails And Agent Architecture
**Goal**: DiskInternals has a safe company-specific operating model, with `CMO` acting as Growth PM and every current agent assigned a clean role.
**Depends on**: Nothing
**Requirements**: GOV-01, GOV-02, GOV-03, GOV-04, AGT-01, AGT-02, AGT-03, AGT-04, AGT-05, AGT-06
**Success Criteria**:
  1. All Paperclip actions have a written DiskInternals company-ID guardrail.
  2. `CMO` has an approved Growth PM responsibility definition.
  3. All 25 existing agents have keep/repurpose/hold recommendations.
  4. SEO, MKT, ADS, OPS, CTO, and future SOC ownership boundaries are unambiguous.
  5. Missing specialist agent proposals are ready for approval without creating duplicates.
**Plans**: 3 plans

Plans:
- [ ] 01-01: Paperclip company guardrails and context-safety checklist
- [ ] 01-02: Existing agent audit and role normalization plan
- [ ] 01-03: Missing specialist agent proposal package

### Phase 2: Data Contracts And Attribution
**Goal**: Agents can use BigQuery-backed GA4/GSC reports safely through Paperclip plugin tools, and attribution fixes are specified before content/CRO scale-up.
**Depends on**: Phase 1
**Requirements**: DATA-01, DATA-02, ATTR-01, ATTR-02, ATTR-03
**Success Criteria**:
  1. BigQuery report/plugin contracts exist with fields, consumers, owners, and cost controls.
  2. GA4 event parameter QA is written for all required events.
  3. Ecommerce product attribution fix is defined as a CTO-owned stream.
  4. Attribution-limited proxy logic is documented for interim operation.
**Plans**: 3 plans

Plans:
- [ ] 02-01: BigQuery report contracts and Paperclip plugin access for GA4/GSC growth operations
- [ ] 02-02: GA4 parameter QA and ecommerce attribution fix scope
- [ ] 02-03: Interim proxy attribution policy for agents

### Phase 3: Product, URL, And Scoring Foundation
**Goal**: Product and URL mappings support product-level decisions, page-level actions, and Linux Writer launch readiness.
**Depends on**: Phase 2
**Requirements**: MAP-01, MAP-02, SCORE-01, SCORE-02, SCORE-03
**Success Criteria**:
  1. `dim_product` scope includes paid/free product families and upcoming Linux Writer.
  2. `dim_url` scope maps page type, language, product, canonical/hub/article status, and localization.
  3. Product Proxy Score, Product Growth Score, and Page Action Score are defined.
  4. Agents know which score to use before and after ecommerce attribution is fixed.
**Plans**: 3 plans

Plans:
- [ ] 03-01: Product taxonomy and Linux Writer launch placeholder mapping
- [ ] 03-02: URL inventory and page-type mapping specification
- [ ] 03-03: Growth scoring formulas and agent usage rules

### Phase 4: Pilot Backlog System
**Goal**: The confirmed pilot lanes produce controlled issues for SEO refresh, internal linking, CRO, localization tests, and funnel improvements.
**Depends on**: Phase 3
**Requirements**: PILOT-01, PILOT-02, PILOT-03, PILOT-04, PILOT-05, LINK-01, CRO-01, LOC-01
**Success Criteria**:
  1. RAID, VMFS, Linux Reader/Linux Writer, and checkout-flow backlog quotas are enforced.
  2. Existing article refresh is prioritized before net-new article volume.
  3. Internal link candidates connect high-traffic pages to relevant hubs, product pages, download, and order paths.
  4. Popup and CTA experiments are contextual uncertainty reducers.
  5. Localization candidates are gated by country, GSC, product, and funnel signal.
**Plans**: 4 plans

Plans:
- [ ] 04-01: RAID and VMFS pilot backlog generation
- [ ] 04-02: Linux Reader and Linux Writer funnel backlog generation
- [ ] 04-03: Download, Order, Checkout, CTA, and popup experiment backlog
- [ ] 04-04: Internal linking and localization candidate queue

### Phase 5: Production PR And Approval Workflow
**Goal**: Agent work becomes reviewable patches/PRs with quality, compliance, rollout, and indexing discipline.
**Depends on**: Phase 4
**Requirements**: PR-01, PR-02, QA-01, IDX-01, IDX-02
**Success Criteria**:
  1. Agents can prepare PRs with affected URLs, business rationale, expected metrics, and rollback notes.
  2. QA rejects unsafe recovery guarantees, unsupported compatibility, wrong product routing, and unsourced price claims.
  3. Reindexing queues include only meaningful high-value changed URLs.
  4. Release and indexing reports connect PRs to follow-up telemetry.
**Plans**: 3 plans

Plans:
- [ ] 05-01: PR template and patch-preparation workflow for agents
- [ ] 05-02: QA and compliance checklist for recovery/product content
- [ ] 05-03: Changed URL, indexing, and telemetry follow-up process

### Phase 6: Automated Operating Routines
**Goal**: Paperclip runs recurring growth operations through `CEO`, `CMO`, and `CTO` without waking every specialist unnecessarily.
**Depends on**: Phase 5
**Requirements**: OPS-01, OPS-02, OPS-03
**Success Criteria**:
  1. Operating loop covers data review, sprint planning, production/QA, release/indexing, and reporting.
  2. Routine plan keeps specialist agents wake-on-demand by default.
  3. `CEO` receives concise growth reports tied to downloads, order visits, purchases, PRs, and URLs.
  4. Manual approval points are explicit before routines are activated.
**Plans**: 3 plans

Plans:
- [ ] 06-01: CMO weekly growth backlog routine specification
- [ ] 06-02: CTO data QA and attribution routine specification
- [ ] 06-03: CEO reporting and approval handoff routine specification

### Phase 7: BigQuery Growth Automation And Portfolio Expansion
**Goal**: BigQuery-first growth marts, URL state, and follow-up measurements are automated, then product scope expands beyond the pilot when scores support it.
**Depends on**: Phase 6
**Requirements**: BQ-01, BQ-02, BQ-03
**Success Criteria**:
  1. BigQuery is documented as the operational source of truth for GA4/GSC-derived data.
  2. Growth marts/views are specified for product funnel, URL opportunities, GSC refresh, crawl/page state, popup, localization, content changes, and final opportunity ranking.
  3. Agent data contracts use Paperclip plugin tools over allowlisted BigQuery reports.
  4. Portfolio expansion criteria cover Partition Recovery, NTFS Recovery, Linux Recovery, database products, and Office/Mail products when score supports them.
**Plans**: 3 plans

Plans:
- [ ] 07-01: BigQuery mart/view and URL-state specification
- [ ] 07-02: BigQuery Growth Data plugin and crawler job contract
- [ ] 07-03: Portfolio expansion scoring and backlog rules

### Phase 8: Guided Selector, Localization, And Assistant Readiness
**Goal**: Later-stage growth surfaces are staged safely: guided product selector first, localization by signal, AI assistant only after guardrails.
**Depends on**: Phase 7
**Requirements**: SEL-01, SEL-02, AI-01, LOC-02
**Success Criteria**:
  1. Guided selector scenarios map user problems to the correct product and safety warning.
  2. Linux Reader/Linux Writer utility intent is separated from recovery intent.
  3. Mexico/Spanish, France/French, Germany/German, and China investigation are prioritized by signal.
  4. AI assistant launch criteria include knowledge base, logs, telemetry, support routing, no-guarantee policy, and approved safety messages.
**Plans**: 3 plans

Plans:
- [ ] 08-01: Guided product selector scenario and telemetry specification
- [ ] 08-02: Signal-gated localization operating plan
- [ ] 08-03: AI assistant readiness checklist and deferred launch guardrails

### Phase 9: Winning Structure MCP Adapter
**Goal**: Paperclip agents can call the Winning Structure MCP server through a server-side adapter that keeps endpoint credentials private and returns recommendation/provenance artifacts for review.

### Phase 10: Semantic Core MCP Adapter
**Goal**: Paperclip agents can call the Semantic Core MCP server through a server-side adapter that keeps endpoint credentials private, orchestrates semantic layers, validates `paperclip_import.v1`, and stores operational import state for follow-up SEO work.
**Depends on**: Phase 9
**Requirements**: SEO-MCP-01, SEO-MCP-02, SEO-MCP-03, SEO-MCP-04
**Success Criteria**:
  1. MCP endpoint and bearer token are configured only in backend plugin settings/secrets.
  2. Agents can register projects, run semantic layers, poll jobs, and prepare Paperclip import payloads.
  3. Import payloads are rejected unless `schema_version = paperclip_import.v1` and required artifact arrays exist.
  4. Cost telemetry and run/job/import IDs are preserved in plugin-owned operational state.
**Plans**: 1 plan

Plans:
- [ ] 10-01: Semantic Core MCP plugin, validation, smoke test, and private endpoint allowlist
**Depends on**: Phase 2
**Requirements**: DATA-01, PR-01, QA-01
**Success Criteria**:
  1. A bundled Paperclip plugin exposes `validate_task_input`, `start_winning_structure_run`, `get_run_status`, and `get_run_result` through agent tools.
  2. MCP endpoint and bearer token are stored only in plugin config/secrets, not in prompts, code, or UI output.
  3. The plugin preserves v1 contract fields including opaque namespace keys, idempotency/input hash, cache policy, cost, artifacts, and cache summary.
  4. Unit tests cover tool allowlisting, secret resolution, and MCP result normalization.
  5. Live smoke is ready to run once endpoint/auth/test input are provided.
**Plans**: 1 plan

Plans:
- [ ] 09-01: Winning Structure MCP plugin adapter MVP

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Company Guardrails And Agent Architecture | 3/3 | Complete | 2026-04-29 |
| 2. Data Contracts And Attribution | 1/3 | In progress | - |
| 3. Product, URL, And Scoring Foundation | 0/3 | Not started | - |
| 4. Pilot Backlog System | 0/4 | Not started | - |
| 5. Production PR And Approval Workflow | 0/3 | Not started | - |
| 6. Automated Operating Routines | 3/3 | Complete | 2026-04-29 |
| 7. BigQuery Growth Automation And Portfolio Expansion | 0/3 | Not started | - |
| 8. Guided Selector, Localization, And Assistant Readiness | 0/3 | Not started | - |
| 9. Winning Structure MCP Adapter | 1/1 | Implemented, waiting live smoke inputs | 2026-04-29 |
