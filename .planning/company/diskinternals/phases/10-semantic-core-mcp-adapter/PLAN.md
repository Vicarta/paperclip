# Phase 10: Semantic Core MCP Adapter

## Goal

Create a Paperclip plugin that lets agents use the private Semantic Core MCP server without exposing credentials, while keeping MCP as run/provenance owner and Paperclip as operational SEO state owner.

## Scope

- Add `Semantic Core MCP Agent Tools` plugin.
- Connect to Streamable HTTP MCP via backend-only secret ref.
- Expose allowlisted agent tools for schema, project registration, layer runs, job polling, import preparation, review queue, review decisions, and smoke testing.
- Validate `paperclip_import.v1` payloads before they are treated as Paperclip import candidates.
- Persist adapter operational state in plugin-owned records/state until native SEO semantic SQL tables are implemented.
- Add private endpoint allowlist for `100.98.5.50:8001`.

## Out Of Scope

- Reimplementing semantic core generation logic in Paperclip.
- Storing bearer tokens in code, prompts, docs, or logs.
- Publishing content plans or articles from this plugin.
- Native SQL migration for long-term `seo_*` tables; this remains a follow-up server/data phase.

## Verification

- [x] `pnpm --filter @paperclipai/plugin-semantic-core-mcp-agent-tools typecheck`
- [x] `pnpm --filter @paperclipai/plugin-semantic-core-mcp-agent-tools test`
- [x] `pnpm --filter @paperclipai/plugin-semantic-core-mcp-agent-tools build`
- [x] `pnpm --filter @paperclipai/server exec vitest run src/__tests__/plugin-private-http-allowlist.test.ts`
- [x] `pnpm --filter @paperclipai/server typecheck`
- [x] Live Paperclip dispatcher smoke: plugin `smoke-test` registered a project, ran mock `core_product_intent`, polled job completion, prepared import, and validated `schema_version = paperclip_import.v1`.

## Result

- Implemented and deployed `@paperclipai/plugin-semantic-core-mcp-agent-tools`.
- Configured the live DiskInternals Paperclip plugin instance with a server-side secret reference; bearer token is not stored in source.
- Added private HTTP allowlist for `100.98.5.50:8001` and Docker build inclusion.
- Adapter persists operational candidates in plugin-owned state/entities until native `seo_semantic_*` tables are implemented.

## Follow-Ups

- Native SQL tables for durable operational SEO state remain a separate data-model phase.
- Live Semantic Core MCP currently does not expose `get_review_queue`; review candidates are available through import artifacts, while a dedicated queue tool requires MCP-side support.
