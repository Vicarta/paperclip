# Bright Data Cost Attribution Follow-Up

## Status

Bright Data cost attribution is **possible only as a deferred accounting flow**,
not as an inline runtime `cost_events` write from the current tool response.

## Confirmed Facts

### 1. Inline runtime response does not expose cost

Direct live probe from the app container against:

- `POST https://api.brightdata.com/datasets/v3/trigger`

returned:

- HTTP `200`
- response body with only `snapshot_id`
- headers limited to transport/content metadata

No billing, credits, usage, or cost headers were present.

### 2. Current Bright Data API key can access account-management endpoints

The same configured Bright Data token successfully reached:

- `GET https://api.brightdata.com/zone/get_all_zones`
- `GET https://api.brightdata.com/zone/cost?zone=<zone>`
- `GET https://api.brightdata.com/domains/req?...`

This means the current integration is not blocked by lack of administrative API
access.

### 3. Live zones are visible

The token currently sees at least:

- `mcp_unlocker`
- `mcp_browser`

### 4. `zone/cost` returns aggregate monetary data

Observed live response shape for `mcp_unlocker`:

- monthly aggregate:
  - `back_m0.cost = 0.003`
  - `back_m0.bw = 173556`
- daily buckets were also returned:
  - `back_d0`
  - `back_d1`
  - `back_d2`

Important limitation:

- the returned data is aggregate by zone and time bucket
- it is not request-level
- it may lag behind live execution

## What This Means

### Not viable

Do **not** write Bright Data `cost_events` inline from:

- dataset trigger responses
- MCP tool call responses
- snapshot download responses

That would require fabricating cost data that the runtime surface does not
actually expose.

### Viable

Build a **deferred Bright Data usage reconciler** that:

1. reads aggregate usage/cost from Bright Data account-management endpoints
2. stores honest Paperclip `cost_events` from that aggregate data
3. keeps attribution scope explicit

## Recommended Attribution Model

### Phase 1: honest aggregate provider-cost events

Write canonical `cost_events` at:

- provider = `brightdata.com`
- billing source = zone aggregate
- `heartbeat_run_id = null`
- `issue_id = null`
- `project_id = null` unless a safe allocation rule exists

This gives truthful provider accounting without inventing per-run cents.

### Phase 2: optional allocation ledger

If we later need workflow-level attribution, add a separate internal ledger for
Bright Data executions:

- zone candidate
- tool name
- run id
- project id
- issue id
- started_at / finished_at
- snapshot id when available

Then a reconciler may allocate aggregate zone cost by a declared policy:

- equal split across successful runs in the same bucket
- weighted by request count
- weighted by bandwidth if a usable signal exists

This allocation would be **derived accounting**, not provider-exact billing.

## Recommended Next Implementation

1. keep Bright Data runtime execution working as-is
2. do not add fake inline `ctx.costs.createEvent(...)` in the Bright Data plugin
3. add a company-level or system-level `Bright Data Usage Reconciler`
4. have that reconciler poll:
   - `zone/get_all_zones`
   - `zone/cost`
   - optionally `domains/req` if useful for diagnostics
5. write aggregate `cost_events` only after fresh usage data is visible

## Current Operator Entry Point

The first implementation now exists as a server-side script:

```sh
DATABASE_URL='postgres://…' pnpm costs:reconcile-bright-data --company-id <companyId> [--agent-id <agentId>] [--zone <zone>] [--apply]
```

Production-safe compiled entry point after build/deploy:

```sh
node dist/cli/reconcile-bright-data-costs.js --company-id <companyId> [--agent-id <agentId>] [--zone <zone>] [--apply]
```

Rules:

- dry-run is the default
- `--agent-id` is required only with `--apply`
- default zone selection uses the `mcp_*` subset
- current-day `back_d0` is excluded unless `--include-current-day` is passed

Current reconciliation model:

- reads Bright Data aggregate zone buckets
- keeps carry-over remainder below 1 cent in `plugin_state`
- writes canonical Paperclip `cost_events` only when accumulated aggregate cost
  reaches at least 1 cent

## Open Questions

1. Is aggregate company-level Bright Data cost enough for now?
2. If not, what allocation policy is acceptable for derived run/project
   attribution?
3. Do we want one reconciler for all Bright Data zones or only for dedicated
   Paperclip-owned MCP zones?
