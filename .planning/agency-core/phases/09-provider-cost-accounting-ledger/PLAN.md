# Phase 9: Provider Cost Accounting Ledger

## Problem

Paperclip has a canonical `cost_events` ledger, but paid external provider coverage is inconsistent.

Current observed state:

- DataForSEO writes provider cost from API response `cost` fields into `cost_events`.
- OpenRouter/LLM adapters write metered costs when the adapter response includes cost metadata.
- Semantic Core MCP plugin has a cost import path, but live Astrogen ledger did not show `semantic-core-builder` rows, so the end-to-end contract needs verification.
- Serper performs paid SERP searches but does not have `costs.write` capability and does not write cost events.
- Exa does not have `costs.write`; its plugin is currently not active in production, and its usage/cost endpoint is not integrated.
- Bright Data has a server-side zone-cost reconciler, but the plugin itself does not write per-call costs, and the live plugin is currently not active.

This makes paid provider spend hard to audit by company, project, issue, agent, run, and provider.

## Goal

Make paid external provider usage auditable through one canonical Paperclip cost path.

Every paid provider integration should do one of:

- write a direct `cost_events` row from authoritative provider response cost;
- write a deterministic estimated `cost_events` row from configured per-call pricing when the provider does not return cost per request;
- reconcile authoritative aggregate provider spend into `cost_events`;
- explicitly record that the call is subscription-included or zero-cost and should not create metered spend.

## Scope

Provider/plugin coverage:

- `paperclip.serper-agent-tools`
- `paperclip.dataforseo-agent-tools`
- `paperclip.exa-agent-tools`
- `paperclip.bright-data-agent-tools`
- `paperclip.semantic-core-mcp-agent-tools`
- LLM adapters only as verification that existing OpenRouter/Codex/Claude cost behavior still works

Shared platform coverage:

- plugin `costs.write` capabilities;
- cost event schema usage;
- provider/biller/model/billing code naming conventions;
- issue/project/goal/run attribution;
- tests and production smoke queries.

## Non-Goals

- Do not redesign budgets UI.
- Do not add provider secrets to Git.
- Do not hardcode Astrogen-specific assumptions.
- Do not use raw provider dashboard exports as the primary runtime ledger unless an API endpoint is unavailable.
- Do not block agents from using a provider solely because exact cost is unavailable; use explicit estimated/reconciled accounting instead.

## Design Principles

### Canonical Ledger

All provider spend that Paperclip can know about should end in `cost_events`.

Required fields:

- `company_id`
- `agent_id`
- `heartbeat_run_id`
- `issue_id` when available
- `project_id` when available
- `goal_id` when available
- `provider`
- `biller`
- `billing_type`
- `model`
- `billing_code`
- `cost_cents`
- `occurred_at`

### Billing Types

Use stable names:

- `metered_api` for paid per-use API calls;
- `subscription_included` for known included calls;
- `estimated_metered_api` if the provider does not return per-call cost and Paperclip calculates it from configured pricing;
- `reconciled_metered_api` for aggregate provider reconciliation rows.

If `cost_events.billing_type` currently rejects new enum-like strings, either use the closest existing value or add a migration and tests.

### Provider Naming

Use stable provider/biller identifiers:

- Serper: `serper.dev`
- DataForSEO: `dataforseo.com`
- Exa: `exa.ai`
- Bright Data: `brightdata.com`
- Semantic Core MCP: provider `semantic-core-builder`, biller according to MCP payload when available, otherwise `semantic-core-builder`

### Idempotency

Cost events must not duplicate when:

- a tool call result is retried at the Paperclip layer;
- a Semantic Core import is reprocessed;
- Bright Data zone reconciliation is run repeatedly;
- Exa usage reconciliation overlaps windows.

Use a provider-specific idempotency key stored in plugin state where provider request IDs are unavailable.

## Provider Plan

### Serper

Serper does not currently write any cost events.

Implementation:

- add `costs.write` capability to the Serper manifest;
- add config for cost mode:
  - `disabled`;
  - `estimated_per_request`;
  - later `usage_reconciliation` if Serper exposes an account usage endpoint suitable for this;
- add config for estimated unit cost by endpoint/type:
  - web search;
  - news search;
  - optional overrides by `num` if pricing is credit-based;
- emit one `cost_events` row per successful Serper API response when estimated cost is greater than zero;
- include `billingCode` with tool name and normalized endpoint, e.g. `serper:google-search:web`;
- include the request run context so the row maps to company/agent/run/project.

Acceptance:

- A successful Serper search creates exactly one cost event.
- Failed Serper calls do not create spend unless provider confirms billing on failure.
- AST-806-style Serper checks become visible in cost summary queries.

### DataForSEO

DataForSEO already reads `cost` from provider responses and writes cost events.

Implementation:

- preserve existing behavior;
- add regression tests for both tools:
  - `googleAdsSearchVolume`;
  - `googleAdsKeywordsForKeywords`;
- ensure issue/project/goal attribution is populated when run context provides it;
- add a smoke query documenting current live totals.

Acceptance:

- Existing DataForSEO tests still pass.
- Cost rows remain `metered_api`, provider/biller `dataforseo.com`.
- No regression in search-volume or keyword-expansion tool outputs.

### Exa

Exa does not currently write cost events and the live plugin is not active.

Implementation:

- fix production activation separately if still broken when executing this phase;
- add `costs.write` capability;
- prefer authoritative usage endpoint for reconciliation when available;
- if per-call cost is not available in tool responses, add `estimated_per_request` mode with explicit config and mark rows `estimated_metered_api`;
- add optional account-usage reconciliation task that writes delta rows with `reconciled_metered_api`;
- ensure tool calls have provider `exa.ai`.

Acceptance:

- Exa web search/crawl/code-context either write estimated rows or are explicitly configured as not metered.
- Reconciliation does not duplicate prior rows.
- Plugin activation smoke passes before production use.

### Bright Data

Bright Data has a reconciler but plugin activation and direct cost accounting are incomplete.

Implementation:

- fix production activation separately if still broken when executing this phase;
- keep Bright Data cost accounting primarily reconciled from `/zone/cost`;
- ensure reconciler can be run safely on schedule and manually;
- write aggregate delta rows as `reconciled_metered_api`;
- include zone/bucket in `billingCode`;
- document that per-tool direct cost is not authoritative unless Bright Data returns request-level cost.

Acceptance:

- Reconciler dry run reports deltas without writes.
- Reconciler apply writes only positive deltas.
- Re-running apply for the same window does not duplicate cost.
- Live plugin status is `ready` before enabling routine use.

### Semantic Core MCP

Semantic Core MCP plugin already has a `get_run_costs` tool and import-cost recording logic.

Implementation:

- verify latest MCP `get_run_costs` response shape;
- verify import payload includes `cost.events` and `cost.total` or `cost.total_estimated`;
- make import-cost event idempotency key include run id and provider payload checksum if needed;
- if MCP returns detailed cost events, decide whether to write one aggregate row or detailed rows. Prefer aggregate first unless detailed rows are needed for provider attribution.

Acceptance:

- A semantic-core run import with non-zero cost creates a `semantic-core-builder` cost event.
- A repeated import of the same run does not duplicate cost.
- If MCP returns zero/no cost, the plugin records a diagnostic comment/log rather than silently implying spend is tracked.

## Agent Contract Updates

Update reusable Paperclip guidance so managers and technical agents know:

- paid provider use must be cost-audited;
- CTO fixes technical cost-ledger gaps but does not decide business spend policy alone;
- CMO can request spend summaries by provider/project before broad paid runs;
- agents should prefer cached provider calls when configured and should mention unusually large provider batches before execution.

Do not expose raw cost-ledger implementation details in client-facing Telegram messages.

## Implementation Steps

1. Audit current provider plugin cost behavior.
2. Define shared cost event naming and billing-type conventions.
3. Add Serper cost accounting with tests.
4. Confirm DataForSEO regression coverage and attribution.
5. Add/fix Exa cost accounting or reconciliation mode.
6. Add/fix Bright Data reconciler production path and scheduling hook.
7. Verify Semantic Core MCP import-cost recording against current MCP contract.
8. Add SQL smoke checks for provider totals by company/project/issue/run.
9. Deploy to production with plugin activation smoke.
10. Run one low-cost controlled call for Serper and DataForSEO; do not run expensive Bright Data/Exa calls without explicit scope.
11. Update `ops/paperclip-production/` sanitized manifests if plugin capabilities/config schema change.
12. Commit and push all source/planning changes.

## Tests

Required automated tests:

- Serper worker test: successful call emits one estimated cost event.
- Serper worker test: missing/zero cost config emits no cost event and returns tool result.
- Serper worker test: failed provider call emits no cost event.
- DataForSEO existing cost tests still pass.
- Semantic Core MCP test: import with non-zero cost writes one idempotent cost event.
- Bright Data reconciler test: repeated apply does not duplicate cost.
- Exa test: estimated or reconciled cost path writes expected event, depending on selected mode.

Required production smoke:

```sql
select provider, biller, billing_type, model,
       count(*) as events,
       round(sum(cost_cents)::numeric / 100, 2) as usd_total,
       min(occurred_at) as first_seen,
       max(occurred_at) as last_seen
from cost_events
where company_id = '<company_id>'
group by provider, biller, billing_type, model
order by last_seen desc;
```

Also verify a fresh Serper call appears with provider `serper.dev`.

## Acceptance Criteria

- Serper no longer performs paid search without a ledger entry or explicit zero-cost config.
- DataForSEO cost recording remains intact.
- Exa has a documented cost path before being re-enabled for production use.
- Bright Data has a documented reconciled cost path before being re-enabled for production use.
- Semantic Core MCP imports either write cost rows or produce an explicit diagnostic that no cost was returned by MCP.
- Cost summaries can answer: provider spend by company, project, issue, agent, and run.
- No secrets are added to Git.
- Production plugin manifests and ops templates are updated if capabilities/config schemas change.

## Verification

- Run targeted plugin tests.
- Run production plugin status query.
- Run production cost summary query before and after one controlled Serper call.
- Confirm no duplicate cost rows after a repeated no-op reconciliation/import.
- Confirm Telegram/operator messages remain concise and do not include raw cost internals unless explicitly requested.
