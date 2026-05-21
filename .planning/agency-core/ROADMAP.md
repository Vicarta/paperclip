# Roadmap: Agency Core

## Overview

Agency Core contains reusable Paperclip operating-system assets that should work across client companies without Astrogen- or DiskInternals-specific assumptions.

## Phases

- [x] **Phase 1: Agent Execution Governance** - Define shared rules for parent/child issues, blockers, execution state, plugin usage, and human-facing updates.
- [x] **Phase 2: SEO Ops Postgres Schema** - Design and implement the shared `seo_ops` Postgres schema for SEO Performance Loop state, including page discovery, GSC query evidence, semantic-core membership, keyword targets, Serper-backed rank tracking policy/observations, AI visibility, and new-page opportunities.
- [x] **Phase 3: Runtime Silent-Noop Recovery And Telegram Operational Alerts** - Fail agent assignment runs that exit successfully without issue-side effects, notify humans in Telegram, and include agent attribution in human notifications.
- [x] **Phase 4: SEO Ops Operational Memory And Decision Windows** - Refine the SEO Ops schema and plugin workflow around page-level SERP targets, append-only Serper evidence, page action history, decision windows, and minimal GSC/GA4 decision digests without duplicating provider warehouses.
- [ ] **Phase 5: Client Portal Foundation** - Create a separate client-facing portal with Resend email-code auth, hash-only code/session storage, Ukrainian-first localization, dashboard pages based on the dashboard reference, and sanitized Semantic Core/keyword/page/content-plan views that do not expose Paperclip internals. Implementation ownership is now `/path/to/paperclip-cs-portal`; public Nginx/Let's Encrypt activation should be done from that project only.
- [x] **Phase 6: Semantic Core Client Review Completion Trigger** - Turn completed client-visible semantic-core portal decisions into an internal Paperclip completion state, immutable next-layer seed snapshot, and agent wakeup path without depending on hidden/internal review rows.
- [ ] **Phase 7: Client Portal Semantic Core Lifecycle** - Split semantic-core portal behavior into a complete living keyword inventory and a narrow current decision queue; deduplicate keywords across layers, show previously accepted keywords under accepted filters, support audited human add/remove/status changes, and prepare regular GSC-driven candidate suggestions.
- [x] **Phase 8: Semantic Core Agent Traffic Strategy Contracts** - Update reusable Paperclip agent contracts so semantic-core agents pass company-specific traffic strategy and layer policies to MCP, validate broad top-of-funnel traffic correctly, and keep CTO/manager/reviewer responsibilities separated.
- [x] **Phase 9: Provider Cost Accounting Ledger** - Make paid external provider usage auditable across shared Paperclip plugins: Serper, Exa, Bright Data, DataForSEO, Semantic Core MCP, and adapter-reported LLM costs should write canonical `cost_events` or documented zero-cost/subscription entries with tests and production smoke.
- [x] **Phase 10: Fast Blog Article Production Loop** - Removed the hourly manager gap for article lanes: live CMO heartbeat is 10 minutes, child status changes wake parent managers immediately, and Telegram CMS draft-ready messages now include the direct draft URL/button instead of a generic completion.

## Current Next Step

Next reusable step: cut the Phase 10 source changes into the production image/plugin bundle, then smoke one article lane to measure accepted brief -> draft -> CMS draft -> Telegram URL delivery time.
