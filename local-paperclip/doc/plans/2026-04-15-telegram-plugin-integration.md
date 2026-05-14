# Telegram Plugin Integration

> Date: 2026-04-15
> Baseline branch: `codex/upstream-v2026.403.0-convergence`
> Status: implementation in progress; live bot wiring complete, task-level delivery path implemented, first live end-to-end verification passed

## Purpose

Add Telegram as the first external communication surface for Paperclip so the
instance can:

- push outbound task and agent notifications to Telegram
- provide an owner-facing external indication layer for important issue events
- later support structured inbound commands without creating a shadow control plane

## Accepted Direction

- Use `paperclip-plugin-telegram` as the initial integration base.
- Keep Paperclip as the system of record.
- Treat Telegram as an interface and notification layer, not as an alternate
  task database or decision store.
- Prefer task-level or workflow-level notification policy over generic noisy
  firehose notifications.

## What Was Implemented

### 1. Plugin installation on the live instance

The plugin was installed into the authenticated/private production Paperclip
instance using the standard board-authenticated CLI flow:

- package: `paperclip-plugin-telegram`
- installed version: `0.3.0`
- plugin status: `ready`

Observed runtime activation:

- worker started
- 3 scheduled jobs registered
- 4 agent tools registered

## Confirmed Plugin Surface

The installed plugin contributes:

- notifications for issue creation, completion, approvals, agent errors, and
  run lifecycle
- Telegram bot commands such as `/status`, `/issues`, `/agents`, `/approve`
- reply routing back into Paperclip issue comments
- escalation, handoff, discuss, and watch tools
- scheduled operational checks

Host safeguard now in place:

- manifest-declared scheduled jobs that fail with `No handler registered for job ...`
  are auto-paused by the scheduler instead of continuing to fail on every tick
- manifest-declared jobs without handlers should stay out of production manifests

## Live Activation Status

The first live activation slice is now complete:

1. A dedicated Telegram bot exists via `@BotFather`
2. The bot token is stored in Paperclip Secrets
3. The Telegram plugin is configured with:
   - `telegramBotTokenRef`
   - `paperclipBaseUrl`
   - `paperclipPublicUrl`
   - `defaultChatId`
4. Inbound routing and bot commands remain disabled for the first rollout
5. A direct outbound bot message to the Paperclip operations group succeeded

Current Telegram target:

- group title: `Astrogen AI Paperclip`

Additional smoke:

- a controlled `issue_done` transition was triggered on `AST-454`
- plugin-side delivery for that event still needs explicit confirmation; the
  plugin log surface remained empty, so this is not yet treated as verified
  evidence of plugin-driven notification delivery

## Recommended Activation Sequence

1. Create a dedicated Telegram bot for Paperclip operations
2. Store the bot token as a Paperclip secret
3. Configure plugin settings:
   - `telegramBotTokenRef`
   - `defaultChatId`
   - optional routing fields:
     - `approvalsChatId`
     - `errorsChatId`
     - `escalationChatId`
4. Set `paperclipPublicUrl` to the externally reachable Paperclip board URL
5. Start with outbound notifications only
6. After outbound flow is stable, enable structured inbound usage

## Recommended Rollout Policy

### Phase 1

Enable only outbound notifications for:

- issue done
- approval requested
- blocked / escalation-worthy states
- optional daily digest

### Phase 2

Enable structured inbound controls:

- `/status`
- `/issues`
- `/approve`

### Phase 3

Introduce task-level notification contracts so specific workflows can request:

- notify on completion
- attach final artifact
- route to a specific chat or topic

## Accepted Decisions For Task-Level Notifications

The first implementation of task-scoped completion notifications will use the
following policy:

### 1. Delivery format

- For article-completion notifications, send the final result as a **file
  attachment**.
- Do not send the full article body inline as the primary delivery mode.

Reason:

- article bodies are too long and brittle for Telegram message formatting
- file attachment preserves the canonical output exactly
- this avoids message-length and formatting degradation risks

### 2. Storage location for notification configuration

- The notification contract will live in a **dedicated issue document**.
- Do not store the contract as free-form task prose.
- Do not make raw Telegram routing instructions part of the core issue schema in
  the first wave.

Reason:

- dedicated issue documents are versionable
- they fit the existing issue-document model better than ad-hoc comments
- they avoid schema churn while the notification model is still evolving

## Planned Contract Shape

The first contract should be implemented as a dedicated issue document, for
example:

- `notification-contract`

Initial scope should support:

- enabled / disabled
- channel = `telegram`
- trigger = `issue_done`
- delivery mode = `attach_file` or `attach_files`
- artifact selector for the final canonical article result
- recipient or routing target abstraction

The first wave should stay narrow and article-oriented instead of trying to
solve every notification case generically.

## Notes On Bot Strategy

A new Telegram bot is recommended.

Reason:

- clear separation between Paperclip operational traffic and unrelated bots
- easier secret rotation
- simpler routing and audit expectations

An existing bot could be reused, but only if its purpose and chat audience are
already aligned with Paperclip operations.

## What Was Implemented In Core

The first task-level implementation slice is now in the Paperclip codebase:

- shared schema for a dedicated `notification-contract`
- server-side parser for a markdown-backed issue document containing a JSON
  notification contract
- server-side resolver for Telegram delivery preview
- attachment selection logic for `attach_file` and `attach_files` delivery
- issue route:
  - `GET /api/issues/:issueId/notification-contracts/telegram`

The second implementation slice is now also in place:

- server-side Telegram delivery service for `issue_done`
- delivery uses the dedicated `notification-contract` issue document
- delivery resolves the selected issue attachment from storage and sends it as a
  real Telegram file attachment via `sendDocument`
- delivery reuses the installed Telegram plugin's config and secret reference as
  the canonical source of bot token and default routing
- issue update flow now triggers this delivery path when an issue transitions
  into `done`
- first live end-to-end smoke passed on `AST-456`, producing an
  `issue.notification_sent` activity row with Telegram `messageId`

The first-wave contract stays intentionally narrow:

- channel = `telegram`
- trigger = `issue_done`
- delivery mode = `attach_file`
- source artifact = matching issue attachment

Article-image delivery rule:

- generated blog images must be delivered through the same document attachment
  path (`sendDocument`) rather than `sendPhoto`
- reason: Telegram photo delivery compresses/re-encodes images, while document
  delivery preserves the generated asset for review and later publication use
- article-image contracts should select image attachments with
  `contentTypePrefix: "image/"` when a Stage 65 image bundle is included

## Outstanding Follow-Up

- decide whether to keep the trigger path fire-and-forget only or add explicit
  retry/queue semantics for failed Telegram sends
- optionally extend recipient `routing_key` semantics beyond the initial config
  fields (`default`, `approvals`, `errors`, `escalation`)
