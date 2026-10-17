# Phase 49 Plan: Semantic Core Trend Discovery And Topic Portfolio Guardrails

## Goal

Restore authenticated Semantic Core MCP access and add its trend generator as a bounded evidence source that broadens Astrogen topic discovery without bypassing semantic validation, URL ownership, duplicate checks, or cannibalization review.

## Invariants

- `generate_trend_topic_report` never creates semantic imports, topic cases, or articles directly.
- Every promising trend phrase passes the normal Semantic Core lifecycle before search-demand intake.
- Only a delegated `selectedAction=new_article` search-demand case can create topic inventory.
- Explicit day/month article themes such as `22 травня` are paused. Relative current-period phrases are handled by normal portfolio/repetitive-family limits.
- A daily article batch contains at most one topic from the same repetitive query family.
- A successful zero-cluster trend report is valid and never padded with invented topics.
- Provider telemetry is preserved. Paperclip cost ledger entries are written only for numeric positive USD costs, using `amountMicros` for sub-cent precision.
- Tokens remain encrypted company secrets and never appear in source, logs, issue text, or plugin settings.

## Work Plan

1. Upgrade `paperclip.semantic-core-mcp-agent-tools` to expose `generate-trend-topic-report`, persist `trend_topic_report.v1`, and enforce no-import/no-topic boundaries.
2. Add idempotent trend cost accounting and unit tests for numeric, unknown, and repeated provider cost events.
3. Add source-controlled search-demand and trend policies for audience breadth, date-topic exclusion, cache isolation, frequency validation, ownership review, and handoff boundaries.
4. Update native pipeline, workflow, routine, bootstrap, and agent-harness contracts. Correct the allocator's native case wrapper parsing at the same time.
5. Add a server-side activation script that backs up clean Postgres, reads the Semantic Core token in place, stores it as a Paperclip company secret, binds it to the plugin, and activates the project allowlist.
6. Add deterministic policy sync and fixture smoke scripts. Verify the trend run persists separately and does not increase semantic import candidates.
7. Build and deploy only `paperclip-astrogen-clean`, sync manifests/contracts/policies, and restart the clean app.
8. Run live health, plugin, secret-ref, fixture trend, local inventory, cost telemetry, date-policy, and native pipeline verification.
9. Resume existing Semantic Core blocked work through the canonical recovery path. Do not create manual article tasks or force the allocator.

## Verification

- Plugin unit tests and TypeScript build pass.
- Clean health is `ok`; plugin is ready at version `0.3.0` and exposes the trend tool.
- The company secret binding exists while plaintext remains inaccessible to agents.
- Fixture trend returns `trend_topic_report.v1`, persists one trend entity, leaves semantic import counts unchanged, and records telemetry/cost evidence correctly.
- Live policies and contracts match Git source hashes.
- Explicit calendar-date candidates cannot advance to topic production.
- Existing unrelated article work keeps its live path; no CMS publication or proactive Telegram watch is enabled.

## Rollback

- Restore the pre-activation Postgres dump.
- Revert the clean app image tag to the previous compose image.
- Restore backed-up company policy files.
- Leave the external Semantic Core service and old Paperclip untouched.
