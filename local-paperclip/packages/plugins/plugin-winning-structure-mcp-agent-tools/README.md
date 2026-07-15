# Winning Structure MCP Agent Tools v0.2.0

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

The plugin exposes the complete five-operation async lifecycle:

- `validate-task-input` -> MCP `validate_task_input`
- `start-winning-structure-run` -> MCP `start_winning_structure_run`
- `get-run-status` -> MCP `get_run_status`
- `submit-run-decisions` -> MCP `submit_run_decisions`
- `get-run-result` -> MCP `get_run_result`

Agents pass the MCP input object directly. The adapter wraps it as
`{ payload: ... }` internally; already wrapped calls are not double-wrapped.
Every operation requires the same non-empty `company_id`, `project_id`, and
`client_key` namespace. Status, decision, and result calls also require
`run_id`. Decision submissions accept exactly one pending versioned decision.

The public wrapper schemas validate these stable operation boundaries while
allowing additional fields inside task, market, evidence, ownership, decision
response, and other nested objects. This keeps the adapter forward compatible
with additive MCP contract changes.

At worker startup, and again before each remote call, the adapter runs
`tools/list` and verifies all five required MCP tools. Missing tools are exposed
as an error health state; connection failures produce degraded health. Health
diagnostics contain tool names and contract state only, never authorization
headers or secret values.

## Configuration

Plugin config fields:

- `winningStructureMcpUrl`: MCP Streamable HTTP endpoint. It has no shared
  default; each company deployment must configure its own private endpoint.
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
- Tool calls are limited to the five lifecycle MCP tools.
- Optional `client_key` allowlist is enforced before the request reaches MCP.
- Namespace fields are mandatory for every operation, including status/result
  reads and decision submissions.
- Private-network endpoints may need an explicit Paperclip host allowlist entry
  before live deployment, because the host blocks private/reserved plugin fetch
  targets by default.

## Results And Cost Accounting

Validation, start, status, and decision calls return a compact agent-visible JSON
summary of lifecycle state, decision requests, errors, review gates, artifact
keys, retention, and provider cost. `get-run-result` returns the complete
agent-visible result payload so it can be imported durably before expiry. The
same complete remote `structuredContent` also remains available in tool result
data.

Remote states are classified as active, paused, completed, stale decision,
decision conflict, expired, validation error, terminal error, or remote tool
error. Remote validation and decision errors are marked non-retryable; the
calling workflow decides whether to retry transport failures with bounded
backoff.

When a completed status/result reports a positive provider cost, the plugin
writes one Paperclip cost event per remote `run_id`. Both cent and micro-unit
amounts are recorded, preserving sub-cent costs through `amountMicros`.

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
