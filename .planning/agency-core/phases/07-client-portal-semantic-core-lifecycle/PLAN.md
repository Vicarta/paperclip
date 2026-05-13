# Phase 7: Client Portal Semantic Core Lifecycle

## Problem

The portal currently has a single dominant semantic-core surface: the current client review queue. That solved the immediate layer-gate problem, but it is not the correct long-term product model.

Clients need to see the complete semantic core, including keywords accepted in earlier layers, while only truly new or unresolved proposals should ask for a new decision. A keyword such as `Astrogen` can be accepted in layer 1 and later reappear as evidence in layer 2; that should enrich the existing keyword history, not create a new pending client task.

The portal must become a living semantic-core management surface, not just a batch review form.

## Goal

Create a reusable Paperclip-to-portal contract where:

- `semantic-core/review` is only the current decision queue;
- `semantic-core` or `semantic-core/inventory` is the complete client-visible semantic core;
- accepted keywords from all previous layers are visible when filtering by `Статус = Погоджено`;
- already accepted keywords never reappear as pending review items only because a later layer found them again;
- humans can add, remove, restore, and change keyword statuses with audit history;
- Google Search Console can later feed regular candidate suggestions without polluting the accepted core.

## Product Model

Use two separate mental models in the client portal:

1. `Семантичне ядро`
   - Complete living inventory.
   - Shows accepted, rejected, deferred, removed, and candidate keywords depending on filters.
   - This is where the client can remember what was already approved.
   - This is where manual additions and removals happen.

2. `Потребують рішення`
   - Narrow current review queue.
   - Shows only proposals that currently require a client decision for the active stage/layer.
   - Does not show machine-safe accepted rows or keywords already accepted in earlier stages.

The same keyword may have many source occurrences, but it should have one client-visible inventory identity per company/site/language/geo scope.

## Data Contract

Add or formalize canonical semantic-core inventory records separate from per-run review items.

Recommended entities:

- `semantic_core_keywords`
  - company/site/project scope;
  - normalized keyword;
  - display keyword;
  - language, geo, device scope where relevant;
  - current lifecycle status: `accepted`, `candidate`, `deferred`, `rejected`, `removed`;
  - origin: MCP layer, human manual add, GSC suggestion, SERP evidence, imported seed;
  - latest volume metrics: geo and global separately;
  - latest difficulty metric if available;
  - active flag and removal reason;
  - created/updated timestamps.
- `semantic_core_keyword_sources`
  - keyword id;
  - source type: layer accepted, layer review, GSC query, SERP, human add, manual import;
  - source run/batch/item ids;
  - layer/stage;
  - evidence summary;
  - first seen / last seen.
- `semantic_core_keyword_decisions`
  - append-only audit log for accept/reject/defer/remove/restore/manual-add/status-change;
  - actor type and id;
  - previous status;
  - new status;
  - note/reason;
  - timestamp.

Review batches should link proposals to canonical keyword ids when possible. They should not duplicate canonical accepted keywords as new pending items.

## Deduplication Rules

- Normalize keyword text consistently before import and before manual add.
- If a later layer returns an already accepted keyword:
  - do not create a client-visible pending review item;
  - attach the new occurrence/evidence to the existing keyword;
  - update latest metrics if the new metric family is valid;
  - keep the accepted status unless a policy issue requires internal review.
- If a later layer returns a previously rejected or removed keyword:
  - keep it out of the normal client queue by default;
  - expose it only as a candidate with a clear reason if new evidence is strong enough.
- If a human manually adds a keyword that already exists:
  - do not create a duplicate;
  - show the existing keyword and append a manual-add/source note.

## Portal API Contract

Keep the existing review endpoint narrow:

- `GET /api/portal/companies/:companySlug/semantic-core/review`
  - returns only current pending/review-worthy items.
  - excludes previously accepted canonical keywords unless explicit re-review is required.

Add a full inventory endpoint:

- `GET /api/portal/companies/:companySlug/semantic-core`
  - filter by status, layer, source, text, geo, language, volume range, changed since;
  - returns accepted keywords from all previous layers when `status=accepted`;
  - includes summary counts and current active stage context.

Add write endpoints:

- `POST /api/portal/companies/:companySlug/semantic-core/keywords`
  - manual add;
  - validates provider/policy constraints before status becomes accepted;
  - creates audit event.
- `PATCH /api/portal/semantic-core/keywords/:keywordId`
  - status changes: accept, reject, defer, remove, restore;
  - requires note for remove/restore and for warning overrides;
  - creates audit event.

The portal remains read-through/write-through. Paperclip owns state and validation.

## UI Requirements

Client-facing pages should include:

- a full `Семантичне ядро` page with filters, including `Статус = Погоджено`;
- a separate `Потребують рішення` tab/card for the current active stage;
- visible stage context so the client knows whether they are reviewing layer 1, layer 2, GSC suggestions, or manual candidates;
- manual `Додати запит` control;
- remove action that means soft-remove/exclude, not physical deletion;
- restore action for removed keywords;
- keyword detail/history panel showing when and why the keyword was added or changed;
- no raw internal labels such as `core_product_intent`, `parked`, `unsafe_blocked`, or MCP warnings.

## Google Search Console Candidates

GSC should become a recurring candidate source, not an automatic accepted-core source.

Flow:

1. Import GSC queries for a configured period.
2. Deduplicate against canonical semantic core.
3. Classify into:
   - already in core;
   - new candidate;
   - noisy/internal-only;
   - needs product/page decision.
4. Expose only review-worthy new candidates in the portal.
5. Keep internal/noisy candidates available to agents for analysis but not in the client queue.

## Acceptance Criteria

- A keyword accepted in layer 1 and found again in layer 2 is not returned as a pending portal review item.
- Filtering full semantic core by `accepted` shows accepted keywords from previous layers.
- Current review queue and full semantic-core inventory can return different lists by design.
- Manual add creates or reuses one canonical keyword and records audit history.
- Remove is reversible and does not destroy historical evidence.
- GSC candidates can be stored without becoming accepted keywords automatically.
- Tests cover duplicate accepted keyword behavior, inventory filtering, manual add dedupe, soft remove/restore, and review queue exclusion.

## Verification

- Server/API tests for review vs inventory endpoint behavior.
- Migration tests for canonical keyword/source/decision tables.
- Portal integration test for `Статус = Погоджено` showing historical accepted keywords.
- Portal integration test confirming an already accepted keyword does not appear in the active decision queue.

## Result

V1 implemented and deployed on 2026-05-08.

- Added Paperclip portal inventory endpoint: `GET /api/portal/companies/:companySlug/semantic-core`.
- Kept review endpoint narrow: `GET /api/portal/companies/:companySlug/semantic-core/review` now excludes keywords already accepted in earlier batches unless explicitly forced into re-review.
- Added keyword lifecycle action table `seo_ops.semantic_core_keyword_actions` for portal-side manual add/remove/restore/status actions.
- Added portal write endpoint: `POST /api/portal/companies/:companySlug/semantic-core/keywords`.
- Updated the standalone client portal to fetch both inventory and current review queue, show accepted historical keywords under `Статус = Погоджено`, and expose manual add / soft-remove / restore controls.
- Deployed migration `0055_semantic_core_keyword_lifecycle.sql`.

Live Astrogen verification after deploy:

- Current review queue: 82 items.
- `Astrogen` in current review queue: 0.
- Full inventory: 618 items.
- Accepted inventory: 106 items.
- Latin `Astrogen` is present in inventory as `accepted`.

Remaining follow-up: GSC recurring candidate ingestion/classification is planned by this phase but not yet implemented in this V1 cut.
