# Phase 25: Telegram Delivery Proof Ledger

## Problem

Astrogen article delivery repeatedly creates or leaves tasks blocked on
`Telegram proof`. The current process is too dependent on humans or managers
finding message ids in comments. That makes successful content/CMS work appear
blocked even after Telegram delivery already happened.

The core defect is not message sending. The defect is that delivery proof is not
recorded as one canonical, queryable system event owned by the Telegram plugin.

## Goal

Make Telegram proof a system-level delivery receipt:

```text
Telegram plugin sends message/file
-> plugin writes structured proof ledger event
-> content/CMS tasks can close on CMS proof
-> delivery failures become Telegram/plugin incidents, not content blockers
```

## Decisions

1. The Telegram plugin owns proof for Telegram delivery.
2. CMO/CTO/content agents must not manually recover message ids as normal flow.
3. Proof should be stored as structured activity, not only free-text comments.
4. Existing activity routes are enough for the first pass; no new DB table is
   required unless later reporting needs richer indexing.
5. Delivery proof must include `issueId`, `chatId`, `messageId`, `sentAt`,
   delivery kind, trigger, and available content reference metadata.
6. Content/CMS work should not stay blocked solely because a Telegram proof task
   has a technical gap. That gap belongs to the Telegram plugin lane.

## Implementation

### Source

- Add a reusable Telegram proof helper in the Telegram plugin.
- For generic issue notifications, write an `operational.telegram_delivery_proof`
  activity event when a message is sent.
- For attachment delivery groups, write the same proof action with message ids,
  group count, file count, and fingerprint.
- Keep existing comments for human-readable audit, but do not make comments the
  canonical proof source.
- Add tests proving structured proof is written.

### Production

- Build and test the Telegram plugin package.
- Install the updated source-controlled package on production.
- Restart Paperclip.
- Smoke-check plugin health and verify the plugin loader reports the updated
  package.

### Process

- Update Astrogen state/roadmap so future article lanes treat Telegram proof
  gaps as plugin/system incidents, not as blockers for accepted CMS content.

## Verification

- Local plugin tests pass.
- Local plugin build passes.
- Production health returns `status=ok`.
- Telegram plugin loads successfully.
- New issue delivery proof activity can be queried from issue activity after a
  future send.

## Acceptance Criteria

- Successful Telegram issue notifications write `operational.telegram_delivery_proof`.
- Successful Telegram attachment delivery writes `operational.telegram_delivery_proof`.
- Delivery proof is structured and includes Telegram message ids where available.
- Future agents have a clear contract: check activity proof first; do not scrape
  comments as the normal path.
