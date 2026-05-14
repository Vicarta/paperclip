# Phase 17 Plugin Standardization Decisions

Date: 2026-05-15

## Key Finding

The Phase 17 plan assumed `costs.write` was a legacy compatibility capability. Live source and SDK inspection show that this assumption is too broad.

Current SDK surface explicitly documents:

- `ctx.costs.createEvent(...)` as the canonical cost ledger writer;
- `costs.write` as its required capability;
- `ctx.metrics.write(...)` as plugin metric logging, not a replacement for cost ledger rows.

Therefore DataForSEO and Semantic Core MCP should not be changed from `costs.write` to `metrics.write` unless Paperclip adds a new cost-ledger replacement contract. Doing that now would reduce cost attribution quality.

## Decisions

| Area | Decision | Rationale | Follow-up |
| --- | --- | --- | --- |
| DataForSEO cost tracking | Keep `costs.write` and `ctx.costs.createEvent`. | It writes canonical provider cost events tied to company, agent, run, billing code, provider, and cents. | None unless upstream deprecates cost ledger API. |
| Semantic Core MCP cost tracking | Keep `costs.write` and `ctx.costs.createEvent`. | MCP run/import costs need cost ledger rows, not generic plugin metrics. | None unless upstream deprecates cost ledger API. |
| Plugin metrics | Use `metrics.write` only for operational metrics. | Metrics are logged as plugin metrics and do not carry full billing semantics. | Add optional non-cost operational metrics later if useful. |
| Telegram lifecycle notifications | Keep only plugin-owned path. | Server-side issue-done sender was a duplicate path. | Removed unused server service and tests from source. |
| Daily digest | Keep removed. | It created noisy/no-handler risk and is not part of the desired owner communication model. | Reintroduce only as a real product feature with handler, contract, and owner approval. |
| Managed resources / DB namespaces | Do not retrofit blindly. | No live plugin currently uses `plugin_managed_resources` or `plugin_database_namespaces`; adding them without a use case creates churn. | Use for future plugins that truly own agents/routines/folders/state. |
| Company-scoped plugin settings | Needed for multi-company isolation. | Plugin config is instance-wide today. Some secret refs are shared across companies. | Design before migrating Semantic Core MCP token scope. |

## Source Cleanup Completed

Removed the unused server-side issue completion Telegram path from source:

- `local-paperclip/server/src/services/issue-telegram-notifications.ts`
- `local-paperclip/server/src/__tests__/issue-telegram-notifications.test.ts`

The remaining notification source of truth is the Telegram plugin.

## Compatibility Debt Remaining

| Item | Status | Owner |
| --- | --- | --- |
| Semantic Core MCP token is referenced from instance config and currently stored under another company scope. | Needs config model cleanup before changing live ref. | CTO/plugin standardization phase |
| Some shared plugins use instance settings where company settings would be safer for multi-client operation. | Needs SDK/API design; not a one-line migration. | CTO/plugin standardization phase |
| Provider vault configs table exists but has no configured provider rows. | Local encrypted Paperclip Secrets are active; external vault migration is future work. | CTO/security follow-up |

## Acceptance Result

The correct Phase 17 standard is not "replace every `costs.write` with `metrics.write`." It is:

1. keep canonical cost ledger writes where the plugin reports provider spend;
2. remove duplicate/noisy notification paths;
3. keep secrets in Paperclip Secrets;
4. isolate company-specific secrets before moving shared plugins to company-specific settings.
