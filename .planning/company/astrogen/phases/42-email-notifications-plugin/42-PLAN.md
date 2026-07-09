---
phase: 42
name: email-notifications-plugin
status: active
updated: 2026-07-03
depends_on: [40, 41]
subsystem: paperclip-plugins
tags: [paperclip, astrogen, email, resend, notifications, agent-tools]
---

# Plan: Email Notifications Plugin

## Objective

Create and activate `paperclip.email-notifications` as the dedicated Paperclip
email transport for Astrogen system, change, and incident reports, so CTO/CEO
operating routines do not depend on the SEO Performance Loop plugin for
non-SEO email.

## Requirements

- Use a Paperclip runtime plugin, not an external script.
- Store the Resend API key only as a Paperclip secret ref, same as other
  Astrogen secrets.
- Configure concrete email addresses in plugin settings.
- Allow `o.savitsky@gmail.com` as the default recipient.
- Reject any explicitly supplied recipient that is not allowlisted.
- Provide agent tools for:
  - concise notification email;
  - backup/change/verification report;
  - incident/blocker report.
- Write delivery proof to plugin state.
- Use idempotency so weekly routines do not duplicate sends.
- Write plugin activity and cost ledger events for successful sends.
- Keep SEO detailed reports on the SEO plugin for now, but move system/change
  email to the new plugin.

## Execution Plan

1. Implement source plugin under
   `local-paperclip/packages/plugins/plugin-email-notifications/`.
2. Add manifest capabilities:
   `agent.tools.register`, `http.outbound`, `secrets.read-ref`,
   `plugin.state.read`, `plugin.state.write`, `activity.log.write`,
   `costs.write`, and `instance.settings.register`.
3. Add instance config:
   `resendApiKeySecretRef`, `fromEmail`, `defaultRecipientEmails`,
   `allowlistedRecipientEmails`, `defaultLanguage`,
   `costAccountingMode`, and `estimatedEmailCostUsd`.
4. Add tools:
   `email-notification-send`, `email-change-report-send`,
   `email-incident-report-send`.
5. Add tests for registration, allowlist rejection, default recipient sending,
   idempotency, dry-run change report, delivery proof, activity, and cost.
6. Update clean Astrogen manifests and bootstrap:
   - active plugin entry;
   - `resend-api-key` `usedBy`;
   - self-learning workflow transport;
   - CTO weekly improvement routine contract;
   - bootstrap plugin registration for plugins that do not exist in old live
     plugin rows.
7. Build and verify locally.
8. Deploy to clean Paperclip only:
   - copy/build plugin into the clean app package path;
   - back up clean DB before changing plugin registry/config;
   - register plugin row/config with concrete recipient settings;
   - restart or reload plugin workers as needed.
9. Smoke:
   - plugin health ready;
   - tool list exposes three email tools;
   - dry-run `email-change-report-send`;
   - one live change-report email to `o.savitsky@gmail.com`;
   - proof exists in plugin state/activity/cost ledger.

## Non-Goals

- Do not enable Telegram proactive watches.
- Do not change old live Paperclip.
- Do not publish CMS content or call paid SEO/image/content providers.
- Do not replace the SEO detailed weekly report flow in this phase.
- Do not add SMTP/SES until Resend path is stable.

## Rollback

- Keep the DB backup path from before plugin registry/config changes.
- If worker activation fails, disable `paperclip.email-notifications` in the
  clean plugin registry and leave the old SEO email transport unchanged.
- If email send fails, do not mutate weekly self-learning contracts to require
  the new plugin until transport is fixed.
