# Phase 28 Summary: Telegram Escalation Writeback Reliability

## Result

Phase 28 is complete and deployed to production.

## What Changed

- Telegram escalation state now records a source issue identifier when the prompt contains an issue key such as `[AST-926]`.
- Creating a new pending escalation for the same company, agent, reason, and source issue now supersedes older pending escalations.
- Superseded escalations are removed from timeout tracking and their Telegram message is edited to tell the owner to use the latest prompt.
- Replies to active native escalations now write a comment to the source Paperclip issue before the escalation is marked resolved.
- If source-issue writeback fails, the escalation stays pending instead of silently losing the owner answer.
- Replies to superseded Telegram messages receive a short Ukrainian clarification instead of being ignored.
- Replies to bot escalation messages are routed before generic Telegram thread/agent-session routing, so HIA answers in group topics cannot be consumed as ordinary thread messages.

## Verification

```text
pnpm --filter paperclip-plugin-telegram test -- tests/escalation.test.ts
pnpm --filter paperclip-plugin-telegram test
pnpm --filter paperclip-plugin-telegram build
pnpm --filter paperclip-plugin-telegram typecheck
```

All checks passed locally:

- `17` Telegram plugin test files passed.
- `235` Telegram plugin tests passed.
- Build and typecheck passed.

## Production

- Deployed package path:
  `/paperclip/.paperclip/plugins/local-packages/paperclip-plugin-telegram-0.3.1-paperclip.3`
- Live plugin registry:
  `paperclip-plugin-telegram@0.3.1-paperclip.3`
- Production health:
  `/api/health` returned `status=ok`.
- Plugin loader:
  `12/12` plugins loaded, Telegram plugin activated successfully.

## Incident Follow-Up

The duplicate pending escalations from the Solar owner decision were manually marked resolved after the owner answer was recorded on [AST-926](/AST/issues/AST-926). Future corrected HIA prompts should supersede the previous pending Telegram escalation automatically.
