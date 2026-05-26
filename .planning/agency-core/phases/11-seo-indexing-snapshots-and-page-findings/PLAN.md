# Phase 11: SEO Indexing Snapshots And Page Findings

## Goal

Close the GSC URL Inspection storage gap without creating a parallel page registry.

Paperclip already owns the reusable SEO operational model in `seo_ops`. This phase extends that model so GSC indexing audits can persist durable, deduplicated evidence and create follow-up issues without keeping raw provider payloads in LLM context.

## Principles

- `seo_ops.pages` remains the canonical site URL registry.
- `seo_ops.project_pages` remains the project SEO ownership unit.
- `seo_ops.discovery_runs` remains the run envelope for sitemap, CMS, GSC, crawl, and inspection acquisition.
- MCP remains provider acquisition/cache only.
- Paperclip PostgreSQL owns history, decisions, finding lifecycle, and issue routing.
- Do not duplicate GSC/GA4 warehouses. Store URL Inspection snapshots because Paperclip requests and depends on that operational evidence.

## Scope

1. Add `seo_ops.indexing_inspection_snapshots`.
   - One row per inspected URL result.
   - Linked to `pages`, `project_pages`, and `discovery_runs` where available.
   - Stores normalized URL Inspection fields, cache/API metadata, and compact normalized payload.
   - Stores raw payload only by reference/hash, not as the default reasoning surface.

2. Add `seo_ops.page_findings`.
   - Generic deduplicated page finding lifecycle.
   - Covers indexing, canonical, redirect, noindex, sitemap, duplicate, schema, and future technical findings.
   - Uses `fingerprint` to prevent duplicate issues.
   - Links to the latest evidence snapshot and optional Paperclip issue.

3. Document the operational use in the shared SEO Performance Loop.

4. Keep agent behavior deterministic:
   - backend/plugin code writes snapshots/findings;
   - LLM agents receive compact summaries and only create/route actionable follow-ups.

## Non-Goals

- Do not add a new `site_page_registry` table.
- Do not store every GSC/GA4 metric row locally.
- Do not implement Google Indexing API.
- Do not create per-URL issues until findings can be deduplicated through `page_findings`.
- Do not introduce Astrogen-specific table names.

## Verification

- DB schema exports include both new tables.
- Migration numbering check passes.
- DB typecheck/build passes.
- Live PostgreSQL has the new tables under `seo_ops`.
- Existing unrelated dirty files are not staged or modified.
