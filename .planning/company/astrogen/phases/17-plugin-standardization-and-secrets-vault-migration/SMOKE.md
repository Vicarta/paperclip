# Phase 17 Smoke

Date: 2026-05-15

## Read-Only Production Checks

These checks did not mutate production secrets or run semantic-core generation.

| Check | Result |
| --- | --- |
| App health | OK |
| Plugin registry | `12/12` ready |
| Telegram jobs | only `check-escalation-timeouts` and `check-watches` for Telegram |
| `telegram-daily-digest` | absent from live job table and installed plugin files |
| Plugin managed resources | no rows |
| Plugin database namespaces | no rows |
| Provider vault configs | no rows configured |
| Recovery schema | `issue_recovery_actions` exists |
| Secret schema | `company_secret_provider_configs` and `secret_access_events` exist |

## Source Checks

| Check | Result |
| --- | --- |
| Old server-side issue-done Telegram service | removed from source |
| Old server-side issue-done Telegram tests | removed from source |
| Forbidden old noisy Telegram text | not found in source/planning search |
| DataForSEO canonical costs | still uses `ctx.costs.createEvent` intentionally |
| Semantic Core MCP canonical costs | still uses `ctx.costs.createEvent` intentionally |

## Production Deploy Smoke

Image deployed: `paperclip-app:v2026.513.0-phase17.1`

Note: the first `phase17` image exposed stale compiled `dist` output from the removed server-side Telegram sender. `phase17.1` rebuilt after adding `pnpm run clean` to the server build script and removing the stale live backup files from the Telegram plugin volume.

| Check | Result |
| --- | --- |
| `GET /api/health` | 200 / OK |
| Plugin loader log | `total=12`, `succeeded=12`, `failed=0` |
| Plugin DB status | `12/12` ready |
| Telegram jobs | `check-escalation-timeouts`, `check-watches` only |
| Old server-side issue Telegram service in image | absent |
| Old Telegram plugin backup files containing removed digest handler | removed |
| Astrogen semantic-core portal inventory endpoint | HTTP 200 |
| Astrogen semantic-core portal review endpoint | HTTP 200 |
| Astrogen semantic-core portal review-groups endpoint | HTTP 200 |

## Staging Decision

No separate staging deployment was required for the read-only inventory and dead-code cleanup portion because no plugin package behavior or data schema was changed. Production deploy was still performed so the image no longer contains the old server-side issue completion sender.

Staging remains required before:

- changing plugin config model;
- introducing company-scoped settings;
- switching Semantic Core MCP token scope;
- changing cost ledger behavior;
- migrating to external provider vaults.
