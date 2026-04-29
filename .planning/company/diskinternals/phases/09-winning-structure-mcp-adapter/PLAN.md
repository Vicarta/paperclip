# Phase 9: Winning Structure MCP Adapter

## Goal

Create a Paperclip plugin adapter for the Winning Structure MCP server so DiskInternals agents can validate inputs, start async structure runs, poll status, and retrieve JSON/Markdown artifacts without exposing endpoint credentials.

## Scope

- Add bundled Paperclip plugin package for Winning Structure MCP agent tools.
- Keep endpoint/token in server-side plugin config/secrets.
- Expose MVP async tools: validate task input, start run, get status, get result.
- Add tests for allowlisted tool routing, idempotency/cache fields passthrough, and secret handling.
- Run one live smoke after endpoint/auth/test input are provided.

## Out Of Scope

- Paperclip DB import tables.
- Writer/editor workflow automation.
- Publication or rank monitoring integration.

## Implementation

- Added `@paperclipai/plugin-winning-structure-mcp-agent-tools`.
- Added server-side Streamable HTTP MCP adapter.
- Added backend-only endpoint/token configuration.
- Added optional `client_key` allowlist.
- Added adapter-side MCP payload normalization: Paperclip agents pass the v1 contract directly, while the adapter wraps MCP calls as `{ payload: ... }` when required by the server schema.
- Added exact private HTTP allowlist for the live Tailscale MCP endpoint.
- Exposed exactly four v1 tools:
  - `validate-task-input`
  - `start-winning-structure-run`
  - `get-run-status`
  - `get-run-result`
- Added settings UI for MCP URL, token secret, client key allowlist, and request timeout.
- Added package to Docker build.
- Installed the plugin in the live Paperclip registry.
- Stored the MCP bearer token as a server-side encrypted Paperclip secret.
- Configured live plugin settings for `diskinternals-us`.

## Verification

- `pnpm --filter @paperclipai/plugin-winning-structure-mcp-agent-tools test`
- `pnpm --filter @paperclipai/plugin-winning-structure-mcp-agent-tools typecheck`
- `pnpm --filter @paperclipai/plugin-winning-structure-mcp-agent-tools build`
- Live Paperclip healthcheck after deploy.
- Live `validate-task-input` smoke: `valid: true`.
- Live async smoke:
  - `start-winning-structure-run`: returned `wsrun_20260429170327342643_c39dde8945`.
  - `get-run-status`: returned `completed`.
  - `get-run-result`: returned `winning_structure`, `quality_flags`, `serp_summary`, `cost`, `retention`, and artifact URIs.

## Live Smoke Notes

- Live endpoint uses a server-side secret only; do not put bearer tokens in code, prompts, UI copy, or GSD files.
- MCP requires namespace keys (`company_id`, `project_id`, `client_key`) for status/result reads as well as start/validate.
- The smoke result had `human_review_required: true` and `confidence.level: low`, which is acceptable for adapter verification but means downstream writer automation must keep a review gate.
