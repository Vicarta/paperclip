# Winning Structure MCP Agent Tools

Thin Paperclip adapter for a Winning Structure MCP server.

## Purpose

This plugin lets Paperclip agents call a Winning Structure MCP endpoint without
exposing endpoint credentials to agents, prompts, UI output, or code.

The MCP server is expected to produce SEO structure recommendation artifacts,
not publishable content.

## Ownership Boundary

MCP owns:

- SERP/crawl evidence.
- Competitor snapshots.
- Run artifacts and provenance.
- Winning Structure JSON and Markdown report.
- Quality flags and human-review reasons.

Paperclip owns:

- Business/task ownership.
- Review decisions.
- Writer/editor assignment.
- Final page rewrite, publication, and monitoring.

## Tools

The plugin exposes the v1 async lifecycle:

- `validate-task-input` -> MCP `validate_task_input`
- `start-winning-structure-run` -> MCP `start_winning_structure_run`
- `get-run-status` -> MCP `get_run_status`
- `get-run-result` -> MCP `get_run_result`

## Configuration

Plugin config fields:

- `winningStructureMcpUrl`: MCP Streamable HTTP endpoint.
- `winningStructureMcpTokenSecretRef`: optional Paperclip secret ID for bearer auth.
- `allowedClientKeysCsv`: optional comma-separated `client_key` allowlist.
- `requestTimeoutMs`: timeout for one MCP connect/call cycle.

If a token secret is configured, the plugin backend injects:

```text
Authorization: Bearer <token>
```

If no token secret is configured, the plugin calls the MCP endpoint without
Authorization.

## Security Notes

- Agents cannot pass or override the endpoint URL or bearer token.
- Tool calls are limited to the four v1 MCP tools.
- Optional `client_key` allowlist is enforced before the request reaches MCP.
- Private-network endpoints may need an explicit Paperclip host allowlist entry
  before live deployment, because the host blocks private/reserved plugin fetch
  targets by default.

## v1 Contract Reminder

Required task inputs should include opaque namespace keys:

- `company_id`
- `project_id`
- `client_key`

Recommended inputs:

- `idempotency_key` or `input_hash`
- `task.keyword_cluster_id`
- explicit `market.output_language`
- `cache_policy`
- `editorial_constraints`
- `business_context`

The MCP must not return final publishable prose. Allowed recommendation fields
include `section_purpose`, `writer_instruction`, and `examples_to_avoid`.
