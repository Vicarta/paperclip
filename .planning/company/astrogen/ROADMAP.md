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
- Stage 55 article briefs are complete on [AST-755](/AST/issues/AST-755). First-pass Stage 59 drafts were produced on [AST-757](/AST/issues/AST-757), [AST-758](/AST/issues/AST-758), and [AST-759](/AST/issues/AST-759), then Stage 61 validation returned all three for focused revision. Stage 59 revisions [AST-763](/AST/issues/AST-763), [AST-764](/AST/issues/AST-764), and [AST-765](/AST/issues/AST-765) are also returned by Stage 61 revalidation [AST-766](/AST/issues/AST-766), [AST-767](/AST/issues/AST-767), and [AST-768](/AST/issues/AST-768). The next step is a stricter corrective writing pass or contract fix before owner editorial review.
- Initial Astrogen blog page registry is seeded in live Postgres `seo_ops` from `https://astrogen.com.ua/sitemap.xml`: 40 blog-related URLs, including 35 article pages enriched with title/meta/content snapshots from the public site data source.
- Known bad diagnostic rows such as `gemini ai` and `gemini google` were removed from client-visible review groups and inventory.
- Paperclip server update planning is now required before relying on automated weekly release checks:
  - live `/api/health` reports `version=0.3.1`;
  - latest GitHub release observed on 2026-05-14 is `v2026.513.0`;
  - live deployment lacks deterministic release provenance, tracked by `[AST-726](/AST/issues/AST-726)`.
- Phase 15 attempted the update and rolled app runtime back after proving the current live plugin ecosystem is not compatible with the newer upstream runtime as-is. Phase 16 is now the required compatibility gate before another production deploy attempt.
- Phase 16 compatibility gate is complete and promoted to production. Phase 17 first pass is now live as `paperclip-app:v2026.513.0-phase17.1`, all 12 live plugins boot, and Astrogen portal semantic-core endpoints returned 200 after the Phase 17 smoke. CTO release-check [AST-729](/AST/issues/AST-729) confirmed there is no newer GitHub release. Agent-local API URL mismatch [AST-730](/AST/issues/AST-730) is fixed with `PAPERCLIP_AGENT_API_URL=http://127.0.0.1:3100`.
- Telegram issue lifecycle notifications now have one canonical path: the Telegram plugin. The previous server-side issue-done sender is disabled, the old daily digest job is removed, and completion messages use the Astrogen HIA style rule: short Ukrainian text, no long technical explanation in chat, and no repeated long caption when an attachment is sent.
- Phase 18 added `ops/paperclip-production/` as the sanitized Git source of truth for production compose shape, plugin/job/secret-reference manifests, and live drift export. Plaintext secrets and generated live exports remain excluded from Git.

## Completed

- [x] **Phase 9: Semantic Core Review GUI** - Replaced Excel review with a database-backed Paperclip semantic-core review API/UI, audit trail, policy guardrails, and MCP import support.
- [x] **Phase 10: Human-Usable Semantic Core Review** - Made internal review usable by humans: stage context, accepted-core vs decision queue, Ukrainian labels, resizable/sortable columns, dark mode, and human connection assessment.
- [x] **Phase 12: Live Semantic Core Portal Pilot** - Implemented the living semantic-core portal lifecycle for Astrogen V1: complete inventory, separate current review queue, cross-layer deduplication, accepted-key visibility, manual add/remove/restore, and client-safe Paperclip API.
- [x] **Phase 13: Traffic-First Semantic Core Agent Settings** - Updated Astrogen semantic-core operating policy so broad astrology traffic is valid target-audience demand without direct product binding in broad layers.
- [x] **Phase 14: SEO Blog Content Waves** - Defined the blog-only workflow that converts validated semantic-core clusters into SERP-checked article opportunities, human-adjustable priorities, paced publication waves, validation, and performance feedback.
- [x] **Live Blog Agent Contract Update** - Applied Phase 14 rules to live Astrogen CMO, semantic-core, SEO blog planning, article, and performance-loop agent/process contracts on `ubuntu-oc`.
- [x] **Initial Astrogen Blog Registry Seed** - Registered the current public sitemap blog URLs in `seo_ops` and enriched the existing article rows with content snapshots.

## In Progress

- [ ] **Phase 11: Client Portal Pilot** - Continue the standalone client portal work in `/path/to/paperclip-cs-portal`. Paperclip now owns the client-safe semantic-core API; the separate portal owns auth/session/access and UI. Public Nginx/Let's Encrypt activation remains a portal-project/server-network task.
- [ ] **Wave 1 Article Drafting** - Resolve repeated Stage 61 failures on the three revised drafts before owner editorial review. Do not send these as final owner-ready texts until SEO lock, route/CTA, and analytics handoff blockers are closed.
- [ ] **Phase 19: Blog Page Registry And Publication Monitor** - Turn the initial sitemap import into a scheduled publication monitor: detect new manually published blog URLs, enrich content snapshots, match them to approved article opportunities and keyword targets, and start the post-publication monitoring loop.
- [ ] **Phase 15: Paperclip Server Release Update** - Attempted and rolled back. Keep as evidence of the controlled update attempt, backup, failure mode, and rollback state.
- [x] **Phase 16: Paperclip Plugin Compatibility Upgrade** - Compatibility gate and production cutover are complete for `v2026.513.0`: plugin packaging, manifest migration, secret/config smoke, worker dependency resolution, deterministic provenance, Astrogen portal endpoint smoke, and production plugin boot check all passed.
- [x] **Phase 17: Plugin Standardization And Secrets Vault Migration** - First production pass complete: plugin inventory, secret metadata audit, standardization decisions, dead server-side Telegram sender removal, production `phase17.1` deploy, and smoke. Company-scoped shared plugin config and external provider-vault migration remain future follow-ups.
- [x] **Phase 18: Production Config Source Of Truth** - Added sanitized production templates/manifests under `ops/paperclip-production/` and a live export script for drift review without secret material.
- [x] **Telegram Notification Style Fix** - Done-message summaries are capped and rewritten into short Ukrainian operator text; document captions no longer duplicate the full completion summary. Telegram issue lifecycle delivery now goes through one path: the Telegram plugin.

## Deferred / Future Tracks

- [ ] **Content Contracts And Quality Gates** - Stabilize Ukrainian article contracts, sanitizer checks, product confidence tone, internal links, synonyms, and HTML packaging.
- [ ] **Image Generation System** - Finalize blog image prompt rules, audience age/hope/positivity requirements, Telegram delivery without compression, and one-article test loop.
- [ ] **SEO Monitoring Loop** - Connect GSC/rank/SERP monitoring, article registry, thresholds, and post-publication decision logic on top of the shared `seo_ops` model.
- [ ] **Human Interaction And Telegram Quality** - Keep Telegram/HIA messages short, Ukrainian, human-readable, and action-oriented.
- [ ] **Strategic Growth Review Layer** - Use Product Discovery outputs to generate human-reviewable growth strategy options before execution on new/free products and routes.
- [ ] **Publication And CMS Integration** - Pause until CMS selection is clear, then add publication adapter and content deployment workflow.

## Current Next Step

Complete Wave 1 article drafting from the approved Stage 55 briefs, then use Phase 19 to connect manual publication back into the page registry:

```text
approved article briefs
-> article drafts
-> human manual publication
-> sitemap discovery
-> page registry enrichment
-> keyword target mapping
-> weekly GSC/rank monitoring
-> performance feedback
```

Do not create pages for every accepted keyword. Do not run SERP similarity for the entire semantic core by default. LLM evaluation of keyword/opportunity sets must be batch-first with stable row IDs, not one LLM call per keyword.

Next server-side follow-up: keep `ops/paperclip-production/` updated after every production config change, then design company-scoped plugin settings for shared MCP/provider plugins before moving Semantic Core MCP and other shared tokens into strictly company-local refs. Future upstream release updates must reuse the Phase 16 packaging/compatibility approach, preserve the local-agent API URL invariant, keep human Telegram lifecycle messages owned by one sender path, and avoid manual CTO/Observability nudges that duplicate Paperclip recovery actions.
