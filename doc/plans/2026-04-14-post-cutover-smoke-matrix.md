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

### Additional Bright Data Smoke Completed

- `AST-448` rerun completed as `done` on the upgraded live runtime
- live Bright Data smoke confirmed:
  - `paperclip.bright-data-agent-tools:list-tools`
  - `paperclip.bright-data-agent-tools:resolve-instagram-account-post-set`
- resolver no longer failed at the old host-side `30000ms` timeout barrier
- resulting smoke comment reported:
  - `visible=58`
  - `canonical=55`
  - `final=55`
  - `isComplete=false`
- smoke scope verdict:
  - runtime blocker cleared
  - resolver completed

### Root Cause Found During Bright Data Smoke

- bundled plugin code had been updated with tool-level
  `executionTimeoutMs = 180000`
- runtime still registered the old manifest snapshot from
  `plugins.manifest_json`
- because `plugin-loader` activates installed plugins from the DB snapshot,
  not directly from `dist/manifest.js`, the new timeout field was absent in
  live registry state until the manifest snapshot was refreshed

### Hardening Applied After Bright Data Smoke

- `plugin-loader` now auto-syncs bundled plugin manifests for plugins with a
  local `package_path` before activation
- `pnpm plugins:refresh-bundled-manifests` remains the operator fallback and
  deploy-time preflight when we want an explicit dry-run/apply step

### Remaining Follow-Up

- codify bundled plugin manifest snapshot refresh in future deploy automation so
  package changes and DB plugin metadata cannot drift again

## Operational Conclusion

The cutover is production-viable.

No additional core rollback or emergency compatibility patch is indicated from the smoke evidence gathered on 2026-04-14.

The next layer of validation should stay focused and incremental, not return to infrastructure churn:

1. `DataForSEO` plugin-originated cost events must carry `heartbeatRunId = runCtx.runId` so feedback/cost views can attribute them to a concrete run
2. `Bright Data` cost attribution is still not implemented; current plugin code does not emit canonical `cost_events` because it has no integrated provider-cost extraction path yet
3. move on to the next business-critical agent lane

## Recommended Operator Path For Business Smoke

Do not create issue-backed smoke by mutating DB rows directly.

Preferred operator path:

1. use `paperclipai agent local-cli <agentRef> --company-id <company-id>` to obtain a proper agent-authenticated local control-plane session
2. create or pick a safe issue-backed smoke task through the normal API/UI path
3. let the selected agent run through normal checkout, comment, document, and status transitions

This preserves the Paperclip control-plane invariants and tests the real production path instead of a SQL-only approximation.
