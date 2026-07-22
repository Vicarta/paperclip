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
  affected URLs, per-page changes, and verification steps. It accepts only
  configured public website hosts, rejects Paperclip/loopback/private endpoints,
  requires primarily Ukrainian source text when the company language is Ukrainian, and
  renders safe HTML plus a plain-text fallback.
- `email-seo-weekly-report-send` - typed Ukrainian weekly SEO/GEO report with
  safe HTML, plain-text fallback, simple owner-facing language, action status,
  KPI tables, watch/cooldown items, and explicit owner-action handling.

Human prose that arrives with escaped paragraph separators (`\\n\\n`) is
normalized at the transport boundary so recipients see real paragraphs.
Developer handoffs must use the typed handoff tool; a generic notification is
not sufficient for work that needs to be passed to site developers. Configure
`developerHandoffAllowedHosts` explicitly. An internal Paperclip API, plugin,
agent, route, permission, or harness problem is never a developer handoff: keep
it in the CTO recovery path and do not email the owner.
Weekly SEO/GEO delivery must use the typed weekly report tool. It rejects an
obvious English fallback when the configured company language is Ukrainian.
The renderer is also the owner-facing presentation boundary: known internal
pipeline/API vocabulary is replaced with plain Ukrainian, and CrawlObserver
acquisition diagnostics are reduced to whether verified technical crawl
evidence was included in the report.

Every successful non-dry-run send writes:

- delivery proof to plugin state with an idempotency key;
- a plugin activity log entry;
- a Resend cost event when `costAccountingMode=estimated_per_email`.

Use `dryRun=true` before first live delivery or after recipient/config changes.
