# Phase 22 Summary: Telegram Attachment Delivery Groups

Date: 2026-05-19

## Result

Phase 22 source implementation is complete and ready for a controlled production image/plugin cutover.

What changed:

- `notification-contract` now supports `delivery.mode = "delivery_groups"`.
- Each delivery group can contain up to 5 selected issue attachments.
- A contract can contain many groups, so article packages are no longer blocked by the old single `attach_files` limit.
- Plugin SDK/host services now expose gated attachment reads:
  - `ctx.issues.listAttachments(issueId, companyId)`;
  - `ctx.issues.getAttachmentContent(attachmentId, companyId)`.
- New plugin capability: `issue.attachments.read`.
- Server-side access checks reject cross-company attachment reads.
- A source-controlled Telegram plugin overlay was added as `paperclip-plugin-telegram@0.3.1-paperclip.0`.
- Telegram delivery uses `sendDocument` by default so images and documents keep original file quality.
- Delivery is idempotent by issue id, notification contract revision, group keys, and attachment ids.
- Delivery writes an issue audit comment and activity log entry with group/file counts and Telegram message ids.
- The Telegram completion formatter remains short Ukrainian operator text and does not reintroduce upstream English/noisy lifecycle wording.

## Verification

Passed locally:

```text
pnpm vitest run server/src/__tests__/issue-notification-contracts.test.ts server/src/__tests__/plugin-attachment-bridge.test.ts
pnpm --filter paperclip-plugin-telegram test -- tests/attachment-delivery.test.ts tests/formatters.test.ts
pnpm --filter paperclip-plugin-telegram typecheck
pnpm --filter paperclip-plugin-telegram build
pnpm --filter @paperclipai/server typecheck
```

## Production Status

Not production-deployed in this source phase.

Next production step:

1. Build a new Paperclip app image that includes `local-paperclip/packages/plugins/plugin-telegram`.
2. Deploy through the normal Phase 16/17 production image cutover procedure.
3. Smoke:
   - `/api/health`;
   - plugin loader readiness;
   - Telegram plugin jobs still only `check-escalation-timeouts` and `check-watches`;
   - a safe grouped delivery issue sends all selected attachments once;
   - repeated `issue.updated status=done` does not duplicate delivery.

Until that cutover is complete, the source-controlled delivery path exists but live production may still require the temporary audited direct Bot API delivery workaround for urgent article packages.
