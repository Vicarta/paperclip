# Phase 16: Google Drive Docs And Telegram Delivery Profiles

## Goal

Give Paperclip agents a reusable, controlled way to create Google Drive/Docs
documents and send completion notifications through configured Telegram bot
profiles, without exposing credentials to agents or hardcoding a single company
workflow.

## Scope

- Add a Google Drive/Docs plugin that creates Google Docs from safe HTML and
  supports bounded metadata, sharing, text replacement, batch update, and export
  operations.
- Extend the Telegram plugin with delivery profiles so agents can send messages
  through a configured bot/chat/topic profile instead of only the standard
  lifecycle notification path.
- Define the orchestration contract for document delivery workflows, including
  future DiskInternals RSS/news-driven article generation.

## Requirements

1. Google credentials must be backend secrets only.
2. Agents must receive only document IDs, URLs, and sanitized metadata.
3. Google Docs creation must be folder-guarded by optional allowlists.
4. HTML import must reject scripts and JavaScript URLs.
5. Telegram delivery profiles must select bot token, chat, topic, parse mode,
   and preview/notification defaults through config.
6. Telegram tool deliveries must optionally write message-id proof to the issue.
7. RSS/news scanning must remain a separate provider acquisition layer; the Docs
   plugin must not contain RSS/news logic.

## Implementation Plan

1. Create `paperclip.google-drive-docs-agent-tools`.
2. Add service-account JWT OAuth and Google Drive/Docs REST calls.
3. Register agent tools:
   - `google_drive_docs_health_check`
   - `google_doc_create_from_html`
   - `google_doc_get`
   - `google_doc_share`
   - `google_doc_replace_all_text`
   - `google_doc_batch_update`
   - `google_doc_export`
4. Extend Telegram plugin config with `deliveryProfiles`.
5. Register `telegram_send_message` as a human-facing agent tool.
6. Add tests for Google Docs creation, guardrails, and Telegram profile routing.
7. Add reusable process documentation and DiskInternals handoff rules.

## Verification

- `pnpm --filter @paperclipai/plugin-google-drive-docs-agent-tools typecheck`
- `pnpm --filter @paperclipai/plugin-google-drive-docs-agent-tools test`
- `pnpm --filter @paperclipai/plugin-google-drive-docs-agent-tools build`
- `pnpm --filter paperclip-plugin-telegram typecheck`
- `pnpm --filter paperclip-plugin-telegram test -- delivery-profiles`

## Deployment Notes

This phase ships the code and contracts. Live activation still requires:

- A Google service-account JSON stored as a Paperclip secret.
- A target Google Drive folder shared with the service account.
- Company plugin config with the allowed folder ID.
- A Telegram delivery profile for each non-standard bot/chat route.
