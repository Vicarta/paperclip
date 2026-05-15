# SEO Performance Loop Plugin

Paperclip plugin for the first published-page SEO loop:

- stores published-article registry records in plugin-owned state;
- records telemetry ingestion requests and supplied GSC / rank-provider snapshots through plugin tools;
- evaluates weekly hold / watch / benchmark decisions from stored telemetry and configurable thresholds;
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
