# Phase 9: Winning Structure MCP Adapter

## Goal

Create a Paperclip plugin adapter for the Winning Structure MCP server so DiskInternals agents can validate inputs, start async structure runs, poll status, and retrieve JSON/Markdown artifacts without exposing endpoint credentials.

## Scope

- Add bundled Paperclip plugin package for Winning Structure MCP agent tools.
- Keep endpoint/token in server-side plugin config/secrets.
- Expose MVP async tools: validate task input, start run, get status, get result.
- Add tests for allowlisted tool routing, idempotency/cache fields passthrough, and secret handling.
- Stop before live smoke until endpoint/auth/test input are provided.

## Out Of Scope

- Paperclip DB import tables.
- Writer/editor workflow automation.
- Publication or rank monitoring integration.

## Implementation

- Added `@paperclipai/plugin-winning-structure-mcp-agent-tools`.
- Added server-side Streamable HTTP MCP adapter.
- Added backend-only endpoint/token configuration.
- Added optional `client_key` allowlist.
- Exposed exactly four v1 tools:
  - `validate-task-input`
  - `start-winning-structure-run`
  - `get-run-status`
  - `get-run-result`
- Added settings UI for MCP URL, token secret, client key allowlist, and request timeout.
- Added package to Docker build.

## Verification

- `pnpm --filter @paperclipai/plugin-winning-structure-mcp-agent-tools test`
- `pnpm --filter @paperclipai/plugin-winning-structure-mcp-agent-tools typecheck`
- `pnpm --filter @paperclipai/plugin-winning-structure-mcp-agent-tools build`

## Live Smoke Inputs Needed

- Winning Structure MCP Streamable HTTP endpoint URL.
- Auth mode and token secret setup, if bearer auth is required.
- Exact exposed MCP tool names if they differ from the accepted v1 contract.
- One real test task input for DiskInternals.
- If the endpoint is private or Tailscale-only, Paperclip may need an explicit plugin host allowlist for the exact `host:port`.
