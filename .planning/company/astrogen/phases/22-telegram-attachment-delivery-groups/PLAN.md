# Phase 22: Telegram Attachment Delivery Groups

## Goal

Make Telegram file delivery a first-class Paperclip plugin capability so owner-ready packages can be delivered from issue attachments without operator-side direct Telegram Bot API calls.

This phase generalizes the Astrogen Wave 1 recovery into a reusable, company-safe mechanism for any Paperclip company.

## Problem

Paperclip already has a `notification-contract` schema that can select issue attachments, including `attach_file` and `attach_files`. The current Telegram plugin, however, only sends lifecycle text messages. It does not execute the attachment delivery contract with `sendDocument`/file delivery.

The Astrogen Wave 1 recovery delivered files by directly calling Telegram Bot API with a token resolved from Paperclip Secrets. That worked, but it is not the desired operating model.

## Design Decisions

1. Keep the existing `attach_files` limit.
   - Do not remove the current max-5 artifact selection rule.
   - The limit remains useful for small, simple notifications.

2. Add delivery groups.
   - A delivery group is a named packet of up to 5 selected issue attachments.
   - A notification contract may contain multiple groups.
   - Each group is delivered independently, so large packages never hit the single `attach_files` limit.

3. Telegram delivery should use documents by default.
   - Markdown, HTML, PDF, spreadsheets, and images should be sent as Telegram documents.
   - This avoids Telegram image compression and preserves original files.

4. No live `dist` hotfix as the main solution.
   - Implement in source-controlled plugin/core code.
   - Build and deploy through the normal Paperclip plugin packaging flow.
   - Record the deployed plugin version/hash in `ops/paperclip-production/`.

5. Keep lifecycle notifications separate from package delivery.
   - Lifecycle messages stay short.
   - Package delivery is driven by the notification contract and creates its own audit trail.

## Contract Shape

Extend `notification-contract` with a new delivery mode:

```json
{
  "version": 1,
  "enabled": true,
  "channel": "telegram",
  "trigger": "issue_done",
  "delivery": {
    "mode": "delivery_groups",
    "summary": "Готовий пакет матеріалів для перегляду.",
    "groups": [
      {
        "key": "article-1",
        "title": "Стаття 1",
        "caption": "1/3 Назва статті",
        "artifacts": [
          { "source": "issue_attachment", "filenameIncludes": "article-1", "contentTypePrefix": "text/markdown" },
          { "source": "issue_attachment", "filenameIncludes": "article-1", "contentTypePrefix": "text/html" },
          { "source": "issue_attachment", "filenameIncludes": "article-1", "contentTypePrefix": "image/" }
        ]
      }
    ]
  },
  "recipient": {
    "target": "default_chat"
  }
}
```

Rules:
- `group.artifacts` keeps the same max-5 rule as `attach_files`.
- `delivery.groups` can contain many groups, with a sane configurable upper bound for abuse control.
- `summary` and `caption` are client-facing text and must be safe for Telegram.
- `routing_key` remains supported for company-specific routing.

## Required Implementation

### Core Paperclip

- Extend the shared `notification-contract` validator with `delivery_groups`.
- Extend the resolver so it returns `attachmentGroups` with:
  - group key;
  - title;
  - caption;
  - resolved attachments;
  - missing selectors;
  - content paths or attachment IDs.
- Keep backward compatibility for existing `attach_file` and `attach_files` contracts.
- Add tests for:
  - valid grouped delivery;
  - group artifact max-5 enforcement;
  - missing attachment reporting;
  - duplicate attachment de-duplication inside one group;
  - existing single-file/multi-file contracts still passing.

### Plugin SDK / Host Services

Add plugin-safe attachment read APIs:

- `ctx.issues.listAttachments(issueId, companyId)`;
- `ctx.issues.getAttachmentContent(attachmentId, companyId)` or an equivalent host-mediated binary stream/blob API.

Security requirements:
- The plugin must not fetch Paperclip private attachment URLs through outbound HTTP.
- Attachment content must come through host services after company access checks.
- Add capability gate: `issue.attachments.read`.
- Add tests proving cross-company attachment reads are rejected.

### Telegram Plugin

- On `issue.updated` with `status=done`, check whether the issue has a Telegram notification contract.
- If delivery mode is `delivery_groups`:
  - resolve recipient chat/topic;
  - send one short summary message if configured;
  - send each group as Telegram documents;
  - put the group caption on the first file in the group;
  - preserve original filename/content type where Telegram allows it;
  - log Telegram `message_id` values for every sent file.
- Use `sendDocument` for all files by default.
- Add optional future support for `sendPhoto` only if explicitly requested by contract; default remains document delivery.
- Add idempotency:
  - compute a delivery fingerprint from issue id, contract revision id, attachment ids, and group keys;
  - do not resend if the same fingerprint was already delivered;
  - if the contract or attachments change, allow a new delivery.
- Add audit trail:
  - activity log event: `telegram.attachment_delivery_sent`;
  - issue comment summarizing groups, file count, and Telegram message IDs;
  - no token values, no raw secrets, no verbose internal stack traces in human-facing comments.

### Operational / Upgrade Safety

- Do not patch live installed `dist` files as the planned path.
- If the Telegram plugin source is external to this repo, first locate the source package and choose one of:
  - upstream PR into the Paperclip/plugin source;
  - tracked local plugin overlay with explicit package name/version until upstream accepts it.
- The production deployment must pin the plugin package/version and record it in `ops/paperclip-production/manifests/plugins.md`.
- Add a smoke command or checklist that verifies:
  - plugin loads;
  - config resolves `telegramBotTokenRef` from Paperclip Secrets;
  - grouped contract preview resolves expected attachments;
  - test delivery sends files in staging or a safe test chat.

## Acceptance Criteria

- A delivery issue with 9 files can be delivered through the Telegram plugin using 3 delivery groups of 3 files each.
- No agent/operator needs direct Telegram Bot API access for normal package delivery.
- `attach_files` remains limited; large packages use `delivery_groups`.
- Existing issue lifecycle Telegram notifications still work and remain short.
- Repeated `issue.updated status=done` events do not duplicate file delivery.
- Missing files produce a clear issue comment and failed/skipped delivery state, not a silent success.
- The implementation survives future Paperclip upstream updates because it is source-controlled, packaged, tested, and recorded in production manifests.

## Out Of Scope

- Regenerating article text.
- Regenerating images.
- Changing client portal behavior.
- Removing or weakening existing Telegram lifecycle notification behavior.
- Storing plaintext bot tokens or chat credentials in Git/planning files.

## Verification Plan

1. Unit-test the shared contract schema/resolver.
2. Unit-test plugin SDK attachment APIs and company isolation.
3. Unit-test Telegram plugin delivery with mocked Telegram `sendDocument` responses.
4. Integration-smoke one grouped delivery issue in a non-production or safe Telegram chat.
5. Deploy through normal plugin packaging.
6. Update `ops/paperclip-production/` manifests after deploy.
