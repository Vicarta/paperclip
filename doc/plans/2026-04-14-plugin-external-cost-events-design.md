# Plugin External Cost Events Design

> Date: 2026-04-14
> Baseline branch: `codex/upstream-v2026.403.0-convergence`
> Status: accepted design direction, implementation pending

## Purpose

Define the upstream-compatible replacement for the old Vicarta plugin-local
`ctx.costs.report(...)` pattern that was removed during convergence.

The goal is to restore external provider cost attribution for plugin-driven
tool usage without reintroducing the pre-upstream forked cost API.

## Confirmed Findings

### 1. The upstream ledger model already exists

Current upstream-aligned server code already has:

- `cost_events` as the request-scoped usage ledger
- `server/src/services/costs.ts` with `costService.createEvent(...)`
- `POST /api/companies/:companyId/cost-events`
- `createCostEventSchema` with upstream fields:
  - `provider`
  - `biller`
  - `billingType`
  - `model`
  - token counts
  - `costCents`
  - optional `issueId`, `projectId`, `goalId`, `heartbeatRunId`

This means we do **not** need a second storage model for plugin provider costs.

### 2. The plugin SDK has no current `ctx.costs.*` surface

Current worker context exposes:

- `ctx.activity`
- `ctx.metrics`
- `ctx.telemetry`
- `ctx.http`
- other host RPC clients

It does **not** expose a native cost-write client.

### 3. Public HTTP from plugin workers is the wrong primitive

Although workers can do outbound HTTP through `ctx.http.fetch`, that is not the
right way to record internal Paperclip billing events:

- it would require the worker to know the host base URL
- it would require session or machine auth handling inside the plugin
- it would bypass the existing typed host-worker bridge pattern
- it would make internal accounting depend on an HTTP loopback path instead of
  a direct host service

## Accepted Design Direction

Add a **new plugin host RPC surface** for cost writes.

This should follow the same architectural pattern as:

- `ctx.activity.log`
- `ctx.metrics.write`
- `ctx.issues.documents.*`

The cost write should be a host capability-gated operation, not an arbitrary
HTTP call from plugin code.

## Proposed Surface

### New capability

- `costs.write`

Reason:

- symmetrical with existing `costs.read`
- explicit least-privilege declaration
- easy to gate in plugin manifest validation and runtime enforcement

### New SDK client

```ts
ctx.costs.createEvent(...)
```

Minimal payload:

- `companyId`
- `agentId`
- optional `issueId`
- optional `projectId`
- optional `goalId`
- optional `heartbeatRunId`
- optional `billingCode`
- `provider`
- optional `biller`
- optional `billingType`
- `model`
- `inputTokens`
- `cachedInputTokens`
- `outputTokens`
- `costCents`
- `occurredAt`

This should intentionally match the existing `createCostEventSchema` as closely
as possible.

### New worker-host protocol method

- `costs.createEvent`

This keeps plugin billing writes inside the typed JSON-RPC bridge rather than
inventing a parallel ingestion path.

## Server-Side Routing

The new host service should call `costService.createEvent(...)` directly.

Recommended placement:

- add `costs` service to `HostServices`
- implement it in `server/src/services/plugin-host-services.ts`
- wire it through:
  - `packages/plugins/sdk/src/protocol.ts`
  - `packages/plugins/sdk/src/types.ts`
  - `packages/plugins/sdk/src/host-client-factory.ts`
  - `packages/plugins/sdk/src/worker-rpc-host.ts`
  - plugin capability validator

## Required Audit Semantics

The plugin host write path must preserve the same operational semantics as the
HTTP route, not just the raw DB insert.

That means:

1. write the `cost_events` row through `costService.createEvent`
2. update company/agent monthly counters through existing service behavior
3. run budget evaluation hooks that are already attached to cost ingestion
4. write an activity log entry analogous to `cost.reported`
5. preserve provider vs biller separation

If there is no shared helper today for steps 1-4, create one rather than
duplicating route-only logic and plugin-only logic.

## Why this is upstream-compatible

This design aligns with the existing Paperclip architecture:

- typed worker-to-host RPC
- manifest capability gating
- server-owned authoritative cost ledger
- no plugin-managed DB writes
- no plugin-managed auth/session hacks

It adds one missing host primitive instead of reintroducing the old Vicarta
cost API as a special case.

## Explicitly Rejected Alternatives

### A. Bring back old `ctx.costs.report`

Rejected because it would recreate a local forked interface tied to the old
plugin runtime assumptions instead of extending the current host RPC surface.

### B. Make plugins call `/api/companies/:companyId/cost-events` over HTTP

Rejected because it introduces:

- host URL coupling
- auth/session coupling
- unnecessary HTTP loopback
- weaker typing and traceability than the host RPC bridge

### C. Store plugin provider costs only as telemetry or metrics

Rejected because telemetry and metrics are not the canonical accounting ledger.
The canonical billing/usage ledger must remain `cost_events`.

## Implementation Scope

### First wave

Implement only:

- `costs.write` capability
- `ctx.costs.createEvent`
- host bridge wiring
- server host service implementation
- unit tests for capability gating and cost event insertion

### Deferred

- richer plugin billing helpers
- cost batching helpers
- automatic plugin tool wrappers that emit cost events
- finance-event creation from plugins

## Acceptance Criteria

1. A plugin with `costs.write` can create a valid `cost_events` row through the
   host bridge.
2. A plugin without `costs.write` is denied at runtime.
3. Company and agent spend counters update exactly as they do for route-based
   cost ingestion.
4. `provider`, `biller`, and `billingType` survive end-to-end unchanged.
5. Activity/audit output is produced for plugin-originated cost writes.
6. Existing upstream reads (`summary`, `by-agent`, `by-provider`, `by-biller`)
   reflect plugin-originated rows with no special-case query path.
