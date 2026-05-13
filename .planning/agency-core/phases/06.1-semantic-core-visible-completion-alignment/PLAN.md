# Phase 6.1: Semantic Core Visible Completion Alignment

## Problem

Astrogen layer 2 client review is complete in the portal: the client-visible queue has `82/82` decisions. Paperclip still keeps the source review batch in `client_review_status=in_review` because completion logic counts one hidden historical duplicate (`Astrogen`) that the portal correctly excludes from the review queue.

This creates a contract mismatch:

- portal review endpoint says the client has nothing left to decide;
- backend completion trigger still sees a pending item;
- no internal completion handoff is posted;
- next layer generation does not start automatically.

## Goal

Make semantic-core client review completion use the same client-visible item set as the portal review endpoint.

## Scope

- Paperclip server semantic-core completion service.
- Focused route/service tests.
- Live deployment and Astrogen batch verification.

## Requirements

- Completion progress must exclude historical accepted duplicates unless explicitly marked for re-review.
- The duplicate exclusion rule must match the portal review endpoint semantics.
- Hidden/internal rows must not block `client_review_completed`.
- Decision changes must still update the completion revision and snapshot.
- The fix must be generic and not Astrogen-specific.

## Acceptance Criteria

- A batch with all visible review items decided completes even if it contains a hidden historical duplicate with no new decision.
- The accepted seed snapshot does not require a second decision for a keyword already accepted in an earlier completed batch.
- Current Astrogen layer 2 batch `53c2c939-a23a-4a86-87e3-da6371feecf1` moves to `client_review_status=completed`.
- The linked issue receives/has a completion handoff so agents can proceed to validation/import readiness and layer 3 planning.
- Focused tests pass.

## Verification

- Run `pnpm vitest run server/src/__tests__/seo-ops-semantic-review.test.ts server/src/__tests__/portal-routes.test.ts`.
- Run `pnpm typecheck`.
- Deploy Paperclip.
- Verify live:
  - portal review summary has `pending=0`;
  - DB batch has `client_review_status=completed`;
  - no new layer 3 run is claimed unless a downstream agent actually starts it.

## Result

Implemented and deployed on 2026-05-10.

- `syncSemanticCoreClientReviewCompletion()` now computes the historical accepted keyword set before the active batch and excludes those duplicates from client-visible completion unless `re_review` / `force_client_review` is explicit.
- Added tests for:
  - hidden historical accepted duplicate not blocking completion;
  - explicit re-review duplicates remaining visible/pending;
  - existing portal review/inventory behavior.
- Verified locally:
  - `pnpm vitest run server/src/__tests__/seo-ops-semantic-review.test.ts server/src/__tests__/portal-routes.test.ts`
  - `pnpm typecheck`
- Deployed Paperclip and reran completion sync for Astrogen layer 2 batch `53c2c939-a23a-4a86-87e3-da6371feecf1`.
- Live result:
  - batch `client_review_status=completed`;
  - progress `82/82`, accepted `76`, rejected `6`, deferred `0`;
  - completion handoff posted to linked issue and parent issue;
  - parent [AST-705](/AST/issues/AST-705) moved from `blocked` to `todo`.

