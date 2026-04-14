# Post-Cutover Smoke Matrix — 2026-04-14

## Scope

Validate that the upstream-first `v2026.403.0` cutover preserved the minimum production behavior required for Astrogen operations:

- live app health
- live DB migration state
- plugin activation
- manager/researcher heartbeat execution
- OpenRouter writer execution
- external provider cost-event persistence

## Evidence Summary

### 1. Live service health

- Host reachable over SSH: `ubuntu-oc.tailbd4e1c.ts.net`
- `paperclip-app-1` healthy after cutover
- `/api/health` returns:
  - `status: ok`
  - `version: 0.3.1`
  - `deploymentExposure: private`
  - `authReady: true`

### 2. Live DB migration state

- Production DB already passed:
  - preflight schema bridge
  - upstream migration chain
- `companies` is on cents-based budget fields
- `drizzle.__drizzle_migrations` present and populated

### 3. Plugin activation on live runtime

Observed from `paperclip-app-1` logs immediately after restart:

- `paperclip.exa-agent-tools`
- `paperclip.bright-data-agent-tools`
- `paperclip.serper-agent-tools`
- `paperclip.dataforseo-agent-tools`
- `paperclip-file-browser-example`

Observed loader result:

- `plugin-loader: loadAll complete`
- `total: 5`
- `succeeded: 5`
- `failed: 0`

Persisted package paths are normalized to canonical non-symlink image paths:

- `/app/packages/plugins/plugin-exa-agent-tools`
- `/app/packages/plugins/plugin-bright-data-agent-tools`
- `/app/packages/plugins/plugin-serper-agent-tools`
- `/app/packages/plugins/plugin-dataforseo-agent-tools`

### 4. Heartbeat execution after cutover

In the first ~120 minutes after cutover:

- recent heartbeat statuses were all `succeeded` except a single currently running audit lane
- no fresh failed heartbeat runs were observed

Representative successful lanes after cutover:

- `CEO`
- `Chief Marketing Officer`
- `Blog Content Strategist`
- `Blog Brief Strategist`
- `SEO Blog Content Strategist`
- `SEO Blog Content Plan Validator`
- `SEO Semantic Core Strategist`
- `SEO Semantic Core Validator`
- `SEO Blog Article Validator`

### 5. OpenRouter execution preserved

Observed successful `openrouter` researcher runs after cutover:

- `SEO Blog Article Writer`
- at least 2 successful runs in the first post-cutover window

Observed canonical provider cost events for OpenRouter:

- `provider = openrouter`
- `model = anthropic/claude-4.6-sonnet-20260217`
- recent non-zero `cost_cents` rows persisted in `cost_events`

### 6. External provider cost-event persistence preserved

Observed canonical provider cost events for DataForSEO:

- `provider = dataforseo.com`
- `model = keywords_data/google_ads/search_volume/live`
- `cost_cents = 8`
- rows present in upstream `cost_events`

This confirms the upstream-compatible plugin cost bridge is persisting external provider costs without reintroducing the old forked reporting API.

## Smoke Verdict

### Passed

- live application health after cutover
- live DB convergence
- bundled plugin loading on production image
- manager/researcher heartbeat execution on upgraded runtime
- OpenRouter article-writer execution
- canonical `cost_events` persistence for OpenRouter and DataForSEO

### Additional Business Smoke Completed

- `AST-446` rerun completed as `done` on the upgraded live runtime
- live agent-side discovery route confirmed:
  - `GET /api/agents/me/plugin-tools`
- live agent-side execution route confirmed:
  - `POST /api/agents/me/plugin-tools/execute`
- successful live tool executions during the smoke rerun:
  - `paperclip.serper-agent-tools:google-search`
  - `paperclip.dataforseo-agent-tools:google-ads-search-volume`
  - `paperclip.exa-agent-tools:crawl-url`
- issue lifecycle path confirmed:
  - issue reopen/update
  - checkout by assigned agent
  - artifact write
  - completion comment
  - final `done` transition

### Not Yet Fully Exercised

- fresh live Bright Data tool invocation after cutover

## Operational Conclusion

The cutover is production-viable.

No additional core rollback or emergency compatibility patch is indicated from the smoke evidence gathered on 2026-04-14.

The next layer of validation should stay focused and incremental, not return to infrastructure churn:

1. run a safe live smoke that explicitly exercises `Bright Data`
2. verify plugin-originated cost events and heartbeat traceability on that exact path
3. move on to the next business-critical agent lane

## Recommended Operator Path For Business Smoke

Do not create issue-backed smoke by mutating DB rows directly.

Preferred operator path:

1. use `paperclipai agent local-cli <agentRef> --company-id <company-id>` to obtain a proper agent-authenticated local control-plane session
2. create or pick a safe issue-backed smoke task through the normal API/UI path
3. let the selected agent run through normal checkout, comment, document, and status transitions

This preserves the Paperclip control-plane invariants and tests the real production path instead of a SQL-only approximation.
