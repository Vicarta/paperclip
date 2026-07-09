---
phase: 42
name: email-notifications-plugin
status: completed
updated: 2026-07-03
---

# Summary: Email Notifications Plugin

Completed on 2026-07-03.

Implemented locally:

- Scaffolded and replaced a worker-only Paperclip plugin package:
  `@paperclipai/plugin-email-notifications`.
- Plugin id: `paperclip.email-notifications`.
- Added tools:
  - `email-notification-send`
  - `email-change-report-send`
  - `email-incident-report-send`
- Added allowlisted concrete recipients, default recipients, Resend secret-ref
  transport, idempotent delivery proof, activity logging, and cost accounting.
- Updated clean Astrogen manifests/bootstrap so system/change email uses
  `paperclip.email-notifications` instead of borrowing the SEO Performance Loop
  transport.

Activated in clean live Paperclip:

- Clean DB backup before mutation:
  `/home/paperclip/backups/astrogen-clean-before-email-plugin-20260703T131556Z.dump`.
- Copied plugin package into clean app container at
  `/app/packages/plugins/plugin-email-notifications`.
- Registered plugin row/config/company settings for Astrogen.
- Restarted only `paperclip-astrogen-clean-app-1`.
- Runtime registered 3 tools:
  - `paperclip.email-notifications:email-notification-send`
  - `paperclip.email-notifications:email-change-report-send`
  - `paperclip.email-notifications:email-incident-report-send`
- Dry-run `email-change-report-send` passed through the Paperclip tool
  dispatcher.
- Live `email-change-report-send` sent to `o.savitsky@gmail.com`.
- CTO weekly self-learning routine contract now points to
  `paperclip.email-notifications` / `email-change-report-send`.
