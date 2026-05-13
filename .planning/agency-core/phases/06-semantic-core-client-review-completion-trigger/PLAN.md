# Phase 6: Semantic Core Client Review Completion Trigger

## Problem

The client portal can now collect all client-visible semantic-core decisions, but Paperclip still treats the source review batch as blocked because legacy counters include hidden/internal rows. This leaves Astrogen layer 1 complete from the client's point of view while `AST-705` and `AST-708` remain blocked and no next-layer agent work starts.

## Goal

When the last client-visible semantic-core review item receives a decision, Paperclip should record that client review is complete, create or expose a deterministic next-layer seed snapshot, and create a clear internal handoff for validation/import readiness and next-layer generation.

## Scope

- Paperclip server API and SEO Ops schema only.
- Portal remains a read-through/write-through UI and does not own semantic-core state.
- Client-visible completion must be based on the same safety filter used by the portal review endpoint, not on all batch rows.
- Hidden parked/internal/noisy candidates must not block client review completion.

## Requirements

- Recompute client-visible review progress after every portal decision write.
- Persist client review state separately from the raw batch status/counters.
- Support client decision changes:
  - before next-layer work starts, update the completion snapshot;
  - after next-layer work starts, require a new revision/follow-up instead of silently mutating prior seed input.
- Keep blocked/unsafe policy rows as internal validation blockers, not client-facing pending work.
- Produce a concise internal issue/comment handoff that agents can use to continue validation/import or layer 2 generation.

## Acceptance Criteria

- A batch with `pending=0` among client-visible items is marked `client_review_completed`.
- A batch with hidden/internal pending rows can still complete client review.
- Accepted/rejected/deferred counts match the sanitized client-visible queue.
- Completion exposes an accepted seed list containing only client-visible human accepted items plus existing machine-safe accepted items.
- Re-changing a decision before internal processing refreshes the completion snapshot.
- Tests prove portal decisions trigger completion and do not complete when any client-visible item is still pending.

## Verification

- Unit/API tests for portal semantic-core decision endpoint.
- DB migration applies cleanly.
- Local server test suite passes for portal/SEO semantic review routes.

## Result

Implemented on 2026-05-08.

- Added batch-level `client_review_status`, `client_review_completed_at`, `client_review_revision`, `client_review_progress`, and `client_review_snapshot`.
- Synced client-visible completion after every semantic-core review decision using the same client-safe review eligibility used by the portal endpoint.
- Persisted a deterministic accepted seed snapshot that ignores hidden/internal pending rows.
- Posted internal handoff comments and unblocked the linked issue and its parent when the client-visible queue completes.
- Deployed to live Paperclip and applied migration `0054_semantic_core_client_review_completion.sql`.
- Astrogen batch `921494a2-3bf8-4aa5-9e4b-2685fea6f890` is now `client_review_completed` with progress `30/30`, accepted `27`, rejected `2`, deferred `1`.

Follow-up: the next agent lane now reaches a concrete import-boundary blocker instead of the old client-review blocker. Paperclip still needs a fresh post-writeback import-readiness runner/result before layer 2 is allowed.
