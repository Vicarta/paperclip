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
- Layer 3 has been regenerated/imported after the MCP contract update and is exposed as grouped client-review candidates.
- Current active Layer 3 portal review batch: `a5a0fb0e-eb6d-4e1b-8997-b4fba43f394d`.
- Current Layer 3 portal state from the latest execution log:
  - stage: `Третій етап: потреби аудиторії`;
  - review groups: `13`;
  - client-visible pending variants: `3077`;
  - inventory summary after internal filtering: total `3882`, accepted `183`, candidate `3690`, deferred `1`, rejected `8`.
- Known bad diagnostic rows such as `gemini ai` and `gemini google` were removed from client-visible review groups and inventory.

## Completed

- [x] **Phase 9: Semantic Core Review GUI** - Replaced Excel review with a database-backed Paperclip semantic-core review API/UI, audit trail, policy guardrails, and MCP import support.
- [x] **Phase 10: Human-Usable Semantic Core Review** - Made internal review usable by humans: stage context, accepted-core vs decision queue, Ukrainian labels, resizable/sortable columns, dark mode, and human connection assessment.
- [x] **Phase 12: Live Semantic Core Portal Pilot** - Implemented the living semantic-core portal lifecycle for Astrogen V1: complete inventory, separate current review queue, cross-layer deduplication, accepted-key visibility, manual add/remove/restore, and client-safe Paperclip API.
- [x] **Phase 13: Traffic-First Semantic Core Agent Settings** - Updated Astrogen semantic-core operating policy so broad astrology traffic is valid target-audience demand without direct product binding in broad layers.
- [x] **Phase 14: SEO Blog Content Waves** - Defined the blog-only workflow that converts validated semantic-core clusters into SERP-checked article opportunities, human-adjustable priorities, paced publication waves, validation, and performance feedback.

## In Progress

- [ ] **Phase 11: Client Portal Pilot** - Continue the standalone client portal work in `/Users/savitsky/CodexProjects/paperclip-cs-portal`. Paperclip now owns the client-safe semantic-core API; the separate portal owns auth/session/access and UI. Public Nginx/Let's Encrypt activation remains a portal-project/server-network task.
- [ ] **Layer 3 Client Review** - Complete human review of active grouped Layer 3 candidates in the client portal, then run Paperclip internal validation/import-readiness before using the result for blog planning.
- [ ] **Live Blog Agent Contract Update** - Apply Phase 14 rules to the live `SEO Blog Content Strategist` and `SEO Blog Content Plan Validator` before creating the first Astrogen blog wave.

## Deferred / Future Tracks

- [ ] **Content Contracts And Quality Gates** - Stabilize Ukrainian article contracts, sanitizer checks, product confidence tone, internal links, synonyms, and HTML packaging.
- [ ] **Image Generation System** - Finalize blog image prompt rules, audience age/hope/positivity requirements, Telegram delivery without compression, and one-article test loop.
- [ ] **SEO Monitoring Loop** - Connect GSC/rank/SERP monitoring, article registry, thresholds, and post-publication decision logic on top of the shared `seo_ops` model.
- [ ] **Human Interaction And Telegram Quality** - Keep Telegram/HIA messages short, Ukrainian, human-readable, and action-oriented.
- [ ] **Strategic Growth Review Layer** - Use Product Discovery outputs to generate human-reviewable growth strategy options before execution on new/free products and routes.
- [ ] **Publication And CMS Integration** - Pause until CMS selection is clear, then add publication adapter and content deployment workflow.

## Current Next Step

Finish Layer 3 client review for batch `a5a0fb0e-eb6d-4e1b-8997-b4fba43f394d`, run internal validation/import-readiness, then use Phase 14 to create the first small blog content wave:

```text
validated semantic core
-> article opportunities
-> SERP-checked shortlist clusters
-> human-adjustable priorities
-> paced blog wave
-> content-plan validation
-> article production
-> performance feedback
```

Do not create pages for every accepted keyword. Do not run SERP similarity for the entire semantic core by default. LLM evaluation of keyword/opportunity sets must be batch-first with stable row IDs, not one LLM call per keyword.
