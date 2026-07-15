# Phase 48: Native Search Demand Opportunity Pipeline

## Goal

Remove `paperclip.seo-performance-loop` without losing its useful SEO methods,
and make search-demand ownership/action selection a native Paperclip pipeline
that precedes topic inventory.

## Work

1. Preserve discovery, ownership, telemetry, decision, crawl-routing,
   report-channel, internal-link and measurement rules in a canonical process.
2. Add conditional native breakdown and guarded intake primitives with tests.
3. Add `astrogen-search-demand-opportunities` with the required lifecycle and
   action routing.
4. Permit topic candidate intake only from `selectedAction=new_article`.
5. Route refresh, merge, reposition, internal-link and technical actions to
   execution lanes.
6. Move structured Ukrainian weekly SEO HTML delivery into the company-scoped
   email plugin with idempotency, secret refs, proof and cost accounting.
7. Update routines, bootstrap, manifests and agent contracts; remove the old
   plugin from source/build/live after backup.
8. Deploy clean compose, sync pipelines/routines, run dry-run email and guarded
   intake/breakdown smoke tests, and verify no duplicate SEO plugin jobs remain.

## Acceptance

- The old plugin is absent from source, image, manifests and live registry.
- Weekly SEO report delivery uses `email-seo-weekly-report-send`.
- The native opportunity pipeline is healthy and has all seven main stages.
- A refresh/merge/etc. opportunity cannot create a topic candidate.
- A direct topic candidate without the guarded parent is rejected by the API.
- A `new_article` opportunity can idempotently create one topic candidate.
- Existing ready topics/article work are preserved; no CMS content is published.
