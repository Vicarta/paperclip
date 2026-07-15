# SEO Performance Loop Plugin

Paperclip plugin for the first published-page SEO loop:

- stores published-article registry records in plugin-owned state;
- records telemetry ingestion requests and supplied GSC / rank-provider snapshots through plugin tools;
- evaluates weekly hold / watch / benchmark decisions from stored telemetry and configurable thresholds;
- exposes the canonical report-channel split for weekly SEO reports:
  Telegram receives only a compact owner digest, while email receives the detailed
  page/query/indexing appendix;
- classifies CrawlObserver technical findings into automatic task candidates,
  ignored policy noise, or record-only evidence before an agent spends LLM
  tokens on interpretation;
- keeps external GSC and rank-provider collection behind an integration boundary until provider dispatch is wired.

This is not an article writer, HTML exporter, or CMS publisher. It starts after publication.

## Development

```bash
pnpm install
pnpm dev            # watch builds
pnpm dev:ui         # local dev server with hot-reload events
pnpm test
```

## Agent Tools

- `seo-published-article-upsert`: register or update a published article.
- `seo-published-article-get`: read a registry record by article id, canonical URL, or origin issue id.
- `seo-telemetry-ingestion-record`: record a scheduled or host-dispatched ingestion request, optionally with supplied snapshot data.
- `seo-telemetry-ingestion-get`: read recent ingestion requests for an article.
- `seo-telemetry-snapshot-record`: store one GSC or rank-provider telemetry snapshot.
- `seo-search-telemetry-get`: read recent telemetry snapshots for an article.
- `seo-performance-decision-get`: read the latest weekly decision.
- `seo-followup-issue-open`: record a requested follow-up action; host-level issue creation is intentionally out of scope for this slice.
- `seo-weekly-report-plan-get`: return the report window, comparison window, and
  delivery-channel policy. Agents must use it before creating weekly report text.
- `seo-crawl-finding-route-plan`: classify CrawlObserver findings. Deterministic
  CMS/indexability findings route to the configured technical fixer; known noise
  such as Cloudflare email-protection URLs and CrawlObserver near-duplicates is
  ignored by policy.

## Weekly Report Delivery Policy

The weekly owner report is split by channel:

- Telegram: short Ukrainian digest only, blank lines between paragraphs, no raw
  tables, no issue/run/plugin internals, hard-capped by
  `telegramSummaryHardCapChars`.
- Email: full detailed report in the configured company report language
  (`detailedReportLanguage`, `uk` for Astrogen) with KPI tables, page/query
  movements, GA4 ecommerce sales/revenue breakdowns, indexing/technical
  appendices, recommended experiments, cooldowns, and monitoring dates.
- Weekly reports must separate traffic from business outcome. Sessions, users,
  and engagement are traffic context; they are not a substitute for purchases,
  orders, or revenue.
- The required business KPI set is total sales/orders, total revenue when
  available, Organic Search-attributed sales/orders, and Organic
  Search-attributed revenue when available. If ecommerce data is unavailable,
  the report must say that plainly and route a tracking/data gap instead of
  presenting traffic metrics as sales.
- If `detailedReportChannel=email` but recipients, `detailedReportFromEmail`, or
  `resendApiKeySecretRef` are missing, the plan marks email delivery as not
  ready and the host/agent should keep the detailed report as a Paperclip issue
  document until email transport is configured.
- Resend transport is configured through `resendApiKeySecretRef` only. Do not
  store a raw Resend API key in plugin config, issue comments, docs, or Git.
- Agents send the detailed report with `seo-detailed-report-email-send`. The
  canonical weekly flow passes the structured `report` object, and the plugin
  renders safe HTML plus a plain-text fallback. Legacy text-only calls are also
  wrapped in HTML so a missed `html` field cannot produce an unformatted email.
  Use an issue-scoped `idempotencyKey`; retries return the existing delivery
  proof instead of sending a duplicate. Use `dryRun=true` for validation before
  first live delivery.
- The email tool rejects an obviously wrong-language detailed report for
  Ukrainian companies before calling Resend, so agents must rewrite the report
  instead of sending an English fallback.

## Current Boundary

The plugin persists registry, ingestion-request, telemetry, and decision records through the supported `ctx.state` plugin store.
The planned dedicated plugin-table DAO remains documented in `docs/`, but the current SDK surface does not expose a direct table API to plugin workers.
Provider reuse should happen through host-dispatched plugin tools, not direct imports from Serper/DataForSEO plugin internals.



## Install Into Paperclip

```bash
curl -X POST http://127.0.0.1:3100/api/plugins/install \
  -H "Content-Type: application/json" \
  -d '{"packageName":"/path/to/paper-clip/local-paperclip/packages/plugins/plugin-seo-performance-loop","isLocalPath":true}'
```

## Build Options

- `pnpm build` uses esbuild presets from `@paperclipai/plugin-sdk/bundlers`.
- `pnpm build:rollup` uses rollup presets from the same SDK.
