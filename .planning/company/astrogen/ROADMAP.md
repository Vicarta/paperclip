# Roadmap: Astrogen Growth Operating System

## Overview

This roadmap keeps Astrogen work separate from other client companies while reusing agency-core Paperclip agents and shared plugins.

Current Astrogen focus is organic growth through:

- Ukrainian semantic-core generation and lifecycle management;
- client-safe semantic-core review in the portal;
- traffic-first SEO blog planning;
- paced article waves instead of one-time mass page creation;
- GSC/rank/SERP feedback into future waves.

Human-facing Astrogen communication remains Ukrainian and should not expose internal MCP, Paperclip, or agent implementation details.

## Current Operating State

- Layer 1 client review is complete.
- Layer 2 client review is complete.
- Layer 3 has been regenerated/imported after the MCP contract update, reviewed in the client portal, validated, and converted into the first small blog content wave.
- Owner approved all three proposed Wave 1 article topics on [AST-705](/AST/issues/AST-705).
- Wave 1 article production is through editor-ready delivery: Stage 55 briefs, Stage 59 recovery drafts, Stage 61 validation, Stage 64 markdown/HTML packaging, and Stage 65 hero images are complete. Delivery issue [AST-791](/AST/issues/AST-791) attached all three markdown files, HTML files, and hero images, then sent them to Telegram for owner editorial review. Text artifacts were not regenerated during the image recovery.
- Initial Astrogen blog page registry is seeded in live Postgres `seo_ops` from `https://astrogen.com.ua/sitemap.xml`: 40 blog-related URLs, including 35 article pages enriched with title/meta/content snapshots from the public site data source.
- Known bad diagnostic rows such as `gemini ai` and `gemini google` were removed from client-visible review groups and inventory.
- Paperclip server update planning is now required before relying on automated weekly release checks:
  - live `/api/health` reports `version=0.3.1`;
  - latest GitHub release observed on 2026-05-14 is `v2026.513.0`;
  - live deployment lacks deterministic release provenance, tracked by `[AST-726](/AST/issues/AST-726)`.
- Phase 15 attempted the update and rolled app runtime back after proving the current live plugin ecosystem is not compatible with the newer upstream runtime as-is. Phase 16 is now the required compatibility gate before another production deploy attempt.
- Phase 16 compatibility gate is complete and promoted to production. Phase 17 first pass is now live as `paperclip-app:v2026.513.0-phase17.1`, all 12 live plugins boot, and Astrogen portal semantic-core endpoints returned 200 after the Phase 17 smoke. CTO release-check [AST-729](/AST/issues/AST-729) confirmed there is no newer GitHub release. Agent-local API URL mismatch [AST-730](/AST/issues/AST-730) is fixed with `PAPERCLIP_AGENT_API_URL=http://127.0.0.1:3100`.
- Telegram issue lifecycle notifications now have one canonical path: the Telegram plugin. The previous server-side issue-done sender is disabled, the old daily digest job is removed, and completion messages use the Astrogen HIA style rule: short Ukrainian text, no long technical explanation in chat, and no repeated long caption when an attachment is sent.
- Phase 22 is live on production through the source-controlled Telegram plugin package: `notification-contract` supports `delivery_groups`, plugin SDK exposes gated issue attachment reads, and `paperclip-plugin-telegram@0.3.1-paperclip.2` sends grouped issue attachments as Telegram documents with idempotency, audit comments, and structured proof ledger events. The production registry now points to the built server-side package and [AST-827](/AST/issues/AST-827) has Telegram message proof `628`. The completion-noise suppression policy is active in the installed bundle.
- Phase 18 added `ops/paperclip-production/` as the sanitized Git source of truth for production compose shape, plugin/job/secret-reference manifests, and live drift export. Plaintext secrets and generated live exports remain excluded from Git.
- Phase 23 added the blog layout layer: validated articles now move through layout editing and layout/schema validation before Payload CMS draft delivery. Payload CMS blog text must use `articleContent.v1`, not raw Lexical, markdown, or arbitrary HTML. The Chinese horoscope draft update is complete and accepted on [AST-821](/AST/issues/AST-821).
- Phase 24 is live to stop non-functional LLM timer heartbeats. The 2026-05-21 23:00 to 2026-05-22 10:00 Europe/Kiev audit showed 84 Astrogen `timer/system` LLM runs and 26.5M input tokens from CEO/CMO/CTO timer heartbeats. Astrogen is now event-driven by default: live config has zero active timer-enabled Astrogen agents, 29 wake-on-demand agents, and 29 agents with `heartbeat.skipIfNoActionableWork=true`. Production runs `paperclip-app:v2026.513.10-heartbeat-cost-20260522`, health is OK, and 13 plugins load successfully.
- Phase 26 defines the first compact weekly Astrogen blog/SEO Telegram report. It compares the latest complete week with the previous week and includes publishing, GSC visibility, GA4 engagement, indexing status when reliably available, highlights, risks, and next actions. Detailed page/query/cluster analytics are deferred to a future dashboard. Telegram delivery for this report now uses `notification-contract` `message_only` mode so the owner receives the report text itself instead of a generic issue-completion summary.

## Completed

- [x] **Phase 9: Semantic Core Review GUI** - Replaced Excel review with a database-backed Paperclip semantic-core review API/UI, audit trail, policy guardrails, and MCP import support.
- [x] **Phase 10: Human-Usable Semantic Core Review** - Made internal review usable by humans: stage context, accepted-core vs decision queue, Ukrainian labels, resizable/sortable columns, dark mode, and human connection assessment.
- [x] **Phase 12: Live Semantic Core Portal Pilot** - Implemented the living semantic-core portal lifecycle for Astrogen V1: complete inventory, separate current review queue, cross-layer deduplication, accepted-key visibility, manual add/remove/restore, and client-safe Paperclip API.
- [x] **Phase 13: Traffic-First Semantic Core Agent Settings** - Updated Astrogen semantic-core operating policy so broad astrology traffic is valid target-audience demand without direct product binding in broad layers.
- [x] **Phase 14: SEO Blog Content Waves** - Defined the blog-only workflow that converts validated semantic-core clusters into SERP-checked article opportunities, human-adjustable priorities, paced publication waves, validation, and performance feedback.
- [x] **Live Blog Agent Contract Update** - Applied Phase 14 rules to live Astrogen CMO, semantic-core, SEO blog planning, article, and performance-loop agent/process contracts on `ubuntu-oc`.
- [x] **Initial Astrogen Blog Registry Seed** - Registered the current public sitemap blog URLs in `seo_ops` and enriched the existing article rows with content snapshots.
- [x] **Wave 1 Article Package Delivery** - Generated Stage 65 hero images for the three approved Wave 1 articles, attached markdown/HTML/image bundles to [AST-791](/AST/issues/AST-791), and delivered the packages to Telegram for editorial review without regenerating article text.

## In Progress

- [ ] **Phase 11: Client Portal Pilot** - Continue the standalone client portal work in `/path/to/paperclip-cs-portal`. Paperclip now owns the client-safe semantic-core API; the separate portal owns auth/session/access and UI. Public Nginx/Let's Encrypt activation remains a portal-project/server-network task.
- [ ] **Phase 19: Blog Page Registry And Publication Monitor** - Turn the initial sitemap import into a scheduled publication monitor: detect new manually published blog URLs, enrich content snapshots, match them to approved article opportunities and keyword targets, and start the post-publication monitoring loop.
- [x] **Phase 22: Telegram Attachment Delivery Groups** - Source implementation, local tests, production package cutover, plugin restart, and live proof are complete. [AST-827](/AST/issues/AST-827) produced Telegram message id `628`; the live registry now reports `paperclip-plugin-telegram@0.3.1-paperclip.1`.
- [ ] **Phase 15: Paperclip Server Release Update** - Attempted and rolled back. Keep as evidence of the controlled update attempt, backup, failure mode, and rollback state.
- [x] **Phase 16: Paperclip Plugin Compatibility Upgrade** - Compatibility gate and production cutover are complete for `v2026.513.0`: plugin packaging, manifest migration, secret/config smoke, worker dependency resolution, deterministic provenance, Astrogen portal endpoint smoke, and production plugin boot check all passed.
- [x] **Phase 17: Plugin Standardization And Secrets Vault Migration** - First production pass complete: plugin inventory, secret metadata audit, standardization decisions, dead server-side Telegram sender removal, production `phase17.1` deploy, and smoke. Company-scoped shared plugin config and external provider-vault migration remain future follow-ups.
- [x] **Phase 18: Production Config Source Of Truth** - Added sanitized production templates/manifests under `ops/paperclip-production/` and a live export script for drift review without secret material.
- [x] **Phase 20: Article Writer Fallback And Cost-Controlled Recovery** - Added a second article-writer lane, structured validator blocker classes, canonical artifact verification for writers, and a strict no-passive-monitoring-after-three-checks rule. The original Claude-primary/GPT-fallback setup has been superseded: `SEO Blog Article Writer (ChatGPT)` is now the primary Stage 59 author, and `SEO Blog Article Writer (Claude)` is reserve only. Routine LLM heartbeat is disabled by default for managers and specialists unless a human explicitly approves a temporary exception.
- [x] **Telegram Notification Style Fix** - Done-message summaries are capped and rewritten into short Ukrainian operator text; document captions no longer duplicate the full completion summary. Telegram issue lifecycle delivery now goes through one path: the Telegram plugin.
- [x] **Phase 23: Blog Article Layout Pipeline** - Added `articleContent.v1` Payload CMS tool validation, `SEO Blog Article Layout Editor`, `SEO Blog Article Layout Validator`, and updated the Chinese horoscope draft through the new layout pipeline. Follow-up rules added after draft review: article endings must use at most one compact in-article CTA block, avoid repeated stacked cards, a generic/weak cover image blocks delivery until a topic-specific premium Astrogen cover is generated/uploaded and set in CMS, and cover images must not contain rendered text. Cover QA now blocks off-brand, weak-topic, artifacted, or below-brand-standard generated images. [AST-821](/AST/issues/AST-821) is closed with verified Telegram proof.
- [x] **Phase 24: LLM Heartbeat Cost Control** - Disabled idle timer heartbeats for Astrogen CEO/CMO/CTO and all active Astrogen agents, kept wake-on-demand active, added `heartbeat.skipIfNoActionableWork`, deployed `paperclip-app:v2026.513.10-heartbeat-cost-20260522`, and verified production health/plugin boot/live heartbeat state.
- [x] **Phase 25: Telegram Delivery Proof Ledger** - Make Telegram delivery proof a plugin-owned structured activity ledger event so content/CMS tasks do not remain blocked on manual message-id recovery.
- [x] **Phase 26: Weekly Blog Telegram Report** - Defined and activated a compact weekly owner-facing Telegram report for blog publishing and SEO performance, with week-over-week comparison and explicit GSC/GA4/indexing data-gap handling.
- [x] **Phase 27: Actionable Issue Orchestration Hardening** - Fixed Paperclip core so assigned actionable issues cannot sit idle after status/routing changes: event-driven wakeup guarantee, deterministic stale actionable watchdog, SEO technical issue dedupe, dedicated SEO CMS Technical Fixer lane, and HIA exclusion for deterministic CMS SEO fixes.
- [x] **Phase 28: Telegram Escalation Writeback Reliability** - Fixed HIA Telegram escalation replacement and reply writeback so superseded prompts are closed and owner replies become canonical Paperclip issue comments before an escalation resolves. Follow-up fix routes escalation replies before generic thread routing, so owner answers in Telegram topics are not consumed as ordinary agent-session messages. Deployed as `paperclip-plugin-telegram@0.3.1-paperclip.3`.

## Deferred / Future Tracks

- [ ] **Content Contracts And Quality Gates** - Stabilize Ukrainian article contracts, sanitizer checks, product confidence tone, internal links, synonyms, and HTML packaging.
- [ ] **Image Delivery System Hardening** - Covered by Phase 22 for Telegram package delivery. Image-specific follow-up should focus on generation/provider quality, variant selection, and automated visual QA against the Astrogen premium cover standard, not file transport.
- [ ] **SEO Monitoring Loop** - Connect GSC/rank/SERP monitoring, article registry, thresholds, and post-publication decision logic on top of the shared `seo_ops` model.
- [ ] **Detailed Blog SEO Dashboard** - Build the richer version of the weekly report: per-article trends, page-query matrices, indexed/submitted URL history, semantic-cluster coverage, low-CTR opportunities, conversion paths, and owner priority controls.
- [x] **Actionable Issue Reliability** - Keep Paperclip event-driven without idle LLM polling by combining immediate issue-transition wakeups with a deterministic no-LLM stale actionable issue watchdog.
- [ ] **Human Interaction And Telegram Quality** - Keep Telegram/HIA messages short, Ukrainian, human-readable, and action-oriented.
- [ ] **Strategic Growth Review Layer** - Use Product Discovery outputs to generate human-reviewable growth strategy options before execution on new/free products and routes.
- [ ] **Publication And CMS Integration** - Payload CMS is selected. Source implementation has started with a secret-backed Payload CMS agent-tools plugin for build-state checks, taxonomy lookup, media upload, blog draft create/update, guarded publish, and later production cutover into the article workflow.

## Current Next Step

Next owner-facing step: review the updated Chinese horoscope draft in Payload CMS and publish manually if accepted. After the owner manually publishes an article on the site, Phase 19 connects publication back into the page registry:

```text
approved article briefs
-> article drafts
-> Stage 64 markdown/HTML package
-> Stage 65 hero image package
-> articleContent.v1 layout package
-> Telegram editorial delivery
-> human manual publication
-> sitemap discovery
-> page registry enrichment
-> keyword target mapping
-> weekly GSC/rank monitoring
-> performance feedback
```

Do not create pages for every accepted keyword. Do not run SERP similarity for the entire semantic core by default. LLM evaluation of keyword/opportunity sets must be batch-first with stable row IDs, not one LLM call per keyword.

Next server-side follow-up: keep `ops/paperclip-production/` updated after every production config change, then design company-scoped plugin settings for shared MCP/provider plugins before moving Semantic Core MCP and other shared tokens into strictly company-local refs. Future upstream release updates must reuse the Phase 16 packaging/compatibility approach, preserve the local-agent API URL invariant, keep human Telegram lifecycle messages owned by one sender path, avoid manual CTO/Observability nudges that duplicate Paperclip recovery actions, and apply the Phase 24 heartbeat policy to other companies intentionally: no idle LLM timer polling unless a temporary human-approved exception exists.
