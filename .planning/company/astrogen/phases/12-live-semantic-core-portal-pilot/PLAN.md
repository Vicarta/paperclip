# Phase 12: Live Semantic Core Portal Pilot

## Problem

Astrogen is now using the portal for layer-by-layer semantic-core review, but the client needs a complete living view of the semantic core, not only the current decision queue.

The current Layer 2 portal queue exposed the issue clearly: `Astrogen` was already accepted in Layer 1, yet it appeared again during Layer 2 review. Repeated evidence should update keyword history, not ask the client to approve the same keyword again.

## Goal

Pilot the agency-core Semantic Core Lifecycle contract for Astrogen.

Astrogen portal must show:

- complete accepted semantic core across all completed layers;
- current Layer 2 decision queue separately;
- accepted Layer 1 keywords under `Статус = Погоджено`;
- no already accepted keyword as a new pending decision unless Paperclip explicitly marks it for re-review;
- manual add/remove/restore controls with audit history.

## Astrogen-Specific Requirements

- Human-facing language remains Ukrainian.
- Client labels must avoid internal terms such as `Layer 1`, `Layer 2`, `accepted_keywords`, `parked`, or raw policy labels unless translated into clear business wording.
- `Astrogen` and other already accepted Layer 1 keywords should be visible in the full accepted core, but not in the current Layer 2 pending queue.
- Manual additions should pass Paperclip validation and should not bypass locale/product/topic guardrails.
- Remove means exclude/deactivate from the active semantic core, not hard-delete historical evidence.
- Future GSC suggestions should appear as a separate candidate source, not mixed into accepted keywords automatically.

## Acceptance Criteria

- Portal filter `Статус = Погоджено` shows accepted Astrogen keywords from Layer 1 and later accepted layers.
- Current decision queue for the active stage does not include `Astrogen` if it is already accepted and not explicitly marked for re-review.
- Adding a keyword that already exists opens/updates the existing inventory record instead of creating a duplicate.
- Removing a keyword hides it from the active accepted core but preserves history and allows restore.
- The client can understand whether they are looking at:
  - full semantic core;
  - current review queue;
  - future suggestions from GSC.

## Dependencies

- Agency-core Phase 7: Client Portal Semantic Core Lifecycle.
- Existing Paperclip portal service token boundary.
- Existing Astrogen semantic-core batches:
  - Layer 1 batch `921494a2-3bf8-4aa5-9e4b-2685fea6f890`;
  - Layer 2 batch `53c2c939-a23a-4a86-87e3-da6371feecf1`.

## Verification

- Check live Astrogen portal API before and after implementation:
  - current queue count;
  - accepted inventory count;
  - duplicate normalized keywords across layers.
- Confirm `Astrogen` appears in accepted inventory and not in pending queue.
- Confirm decision changes are audited and visible in keyword history.

## Result

V1 implemented and deployed on 2026-05-08.

- Astrogen portal now receives a complete semantic-core inventory separately from the current decision queue.
- `Astrogen` no longer appears in the Layer 2 pending queue after it was accepted earlier.
- `Статус = Погоджено` can show historical accepted keywords from earlier stages.
- Manual keyword add, soft-remove, and restore actions are available in the portal and written back to Paperclip.

Live verification:

- Layer 2 pending review queue: 82 items.
- `Astrogen` in pending review queue: 0.
- Full Astrogen semantic-core inventory: 618 items.
- Accepted inventory: 106 items.
- Latin `Astrogen`: `accepted`, with history showing prior human approval plus later layer evidence.
