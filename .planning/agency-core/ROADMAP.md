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
- [x] **Phase 11: SEO Indexing Snapshots And Page Findings** - Extend the existing `seo_ops` model with durable GSC URL Inspection snapshots and generic deduplicated page findings, reusing `pages`, `project_pages`, and `discovery_runs` instead of creating a parallel page registry.
- [x] **Phase 12: CrawlObserver SEO Crawl Adapter** - Add a reusable Paperclip plugin adapter for the Tailnet-only CrawlObserver REST API so agents can start controlled crawls, inspect session/page/link/SEO crawl evidence, and feed Paperclip-owned SEO workflows without exposing API keys or making crawl-derived decisions inside the adapter.
- [x] **Phase 13: Paperclip v2026.529.0 Upgrade And Future-Proof Update Structure** - Move the production Paperclip source baseline to upstream `v2026.529.0` without losing local functionality, reconcile production/Git drift, preserve Astrogen/DiskInternals plugins and operating contracts, and introduce a repeatable vendor-plus-overlay update structure for future releases.
- [x] **Phase 14: SEO Report Channels And CrawlObserver Finding Policy** - Split weekly SEO reporting by channel so Telegram carries only short owner digests and email carries detailed reports; add deterministic CrawlObserver finding routing policy for automatic CMS SEO tasks, configured thresholds, cooldowns, and ignored-noise classes.
- [x] **Phase 15: Paperclip Document Annotations And Secret Config Rollout** - Adopt the useful `v2026.529.0` collaboration/config features in Agency Core contracts: issue documents for reviewable decisions and reports, inline annotation expectations, document locking after acceptance, and secret-ref based plugin settings compatible with SecretBindingPicker-style configuration.

## Current Next Step

Next reusable step: roll the document-backed review/decision and secret-ref configuration rules into other company contract repos, starting with DiskInternals only after checking its current artifact and notification conventions.
