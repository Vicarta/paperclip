# @paperclipai/plugin-email-notifications

Company-scoped email notification tools for Paperclip agents.

The plugin intentionally uses concrete recipient email addresses instead of
semantic labels such as "owner". Configure `defaultRecipientEmails` for normal
delivery and `allowlistedRecipientEmails` for all addresses an agent may target.
If a tool call supplies `recipientEmails`, every address must be allowlisted.
If it omits `recipientEmails`, the plugin sends to the configured defaults.

## Transport

- Provider: Resend
- Secret handling: `resendApiKeySecretRef` only
- Do not store raw Resend API keys in plugin config, issue comments, docs, or
  Git.

## Tools

- `email-notification-send` - concise arbitrary notification.
- `email-change-report-send` - structured backup/change/verification report.
- `email-incident-report-send` - structured incident or blocker report.
- `email-developer-handoff-send` - implementer-ready handoff that requires exact
  affected URLs, per-page changes, and verification steps.
- `email-seo-weekly-report-send` - typed Ukrainian weekly SEO/GEO report with
  safe HTML, plain-text fallback, simple owner-facing language, action status,
  KPI tables, watch/cooldown items, and explicit owner-action handling.

Human prose that arrives with escaped paragraph separators (`\\n\\n`) is
normalized at the transport boundary so recipients see real paragraphs.
Developer handoffs must use the typed handoff tool; a generic notification is
not sufficient for work that needs to be passed to site developers.
Weekly SEO/GEO delivery must use the typed weekly report tool. It rejects an
obvious English fallback when the configured company language is Ukrainian.

Every successful non-dry-run send writes:

- delivery proof to plugin state with an idempotency key;
- a plugin activity log entry;
- a Resend cost event when `costAccountingMode=estimated_per_email`.

Use `dryRun=true` before first live delivery or after recipient/config changes.
