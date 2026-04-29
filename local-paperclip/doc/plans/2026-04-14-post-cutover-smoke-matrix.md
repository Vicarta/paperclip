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
- `cost_cents = 8`
- rows present in upstream `cost_events`

Post-cutover validation now confirms two states:

- legacy pre-fix rows still exist with `heartbeat_run_id = null`
- new post-fix rows now persist with `heartbeat_run_id = <live heartbeat run id>`

Confirmed live example after cutover:

- `heartbeat_run_id = f3e79b5e-92cc-4ca8-8cf7-d6e632319f71`
- `project_id = db6ccac5-25c7-46b0-a49f-7c614dfe7973`

This confirms the upstream-compatible plugin cost bridge is persisting external provider costs without reintroducing the old forked reporting API, and that `DataForSEO` traceability now attaches costs to the originating heartbeat run.

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
- earlier blocked smoke lane `AST-447` was later cancelled as superseded by
  `AST-448`, so it no longer remains as an open post-cutover blocker
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

### Additional Bright Data Billing Probe Completed

- live direct REST probe against Bright Data dataset trigger completed from the
  upgraded runtime
- request path used:
  - `POST https://api.brightdata.com/datasets/v3/trigger`
  - `dataset_id = gd_l1vikfch901nx3by4`
  - `discover_by = user_name`
- response status was `200`
- response headers only included transport/content metadata:
  - `content-type`
  - `content-length`
  - `date`
  - `etag`
  - `server`
  - `vary`
- no billing, credits, usage, or cost headers were present in the live
  response
- Bright Data billing can therefore not be derived safely from the current
  dataset trigger response alone
- follow-up live account-management probes also confirmed:
  - `GET /zone/get_all_zones` works with the configured token
  - `GET /zone/cost?zone=mcp_unlocker` returns aggregate monetary data
  - the viable Bright Data path is therefore delayed zone-cost reconciliation,
    not inline response-based billing

### Additional DataForSEO Heartbeat Traceability Smoke Completed

- `AST-449` completed as `done` on the upgraded live runtime
- live issue-backed smoke artifact written to:
  - `/astrogen/work/53-seo-semantic-core/active/smoke-post-cutover-dataforseo-heartbeat-runid-money-ua-2026-04-14.md`
- live completion comment confirmed:
  - tool used: `paperclip.dataforseo-agent-tools:google-ads-search-volume`
  - keyword used: `фінансова натальна карта`
  - blocker remains: `none`
- canonical `cost_events` verification after the run confirmed fresh rows with:
  - `provider = dataforseo.com`
  - `model = google_ads_search_volume`
  - `cost_cents = 8`
  - `heartbeat_run_id = f3e79b5e-92cc-4ca8-8cf7-d6e632319f71`

### Practical Route Contract Note From AST-449

- `POST /api/agents/me/plugin-tools/execute` expects `parameters`, not `arguments` or `params`
- for agent-authenticated calls outside the normal issue checkout flow, pass `projectId` explicitly if the current issue lookup does not resolve from `execution_run_id`
- the successful live recovery call used:
  - `tool = paperclip.dataforseo-agent-tools:google-ads-search-volume`
  - `projectId = db6ccac5-25c7-46b0-a49f-7c614dfe7973`
  - `parameters.keywords = [\"фінансова натальна карта\"]`
  - `parameters.location_name = \"Ukraine\"`
  - `parameters.language_name = \"Ukrainian\"`

### Additional Issue Lifecycle And Document Revision Smoke Completed

- direct issue creation via the normal CLI/API path succeeded again after the
  cutover fix:
  - `AST-450`
- root cause for the prior failure was confirmed and fixed:
  - `companies.issue_counter` had drifted behind the real maximum
    `issues.issue_number`
  - issue creation now advances from the maximum of the company counter and the
    current company issue rows, preventing duplicate identifiers after stale
    counter states
- live issue-document smoke completed on `AST-450`:
  - `PUT /api/issues/AST-450/documents/plan`
  - `GET /api/issues/AST-450/documents/plan/revisions`
  - `POST /api/issues/AST-450/documents/plan/revisions/:revisionId/restore`
- confirmed live revision sequence:
  - initial create succeeded
  - update with `baseRevisionId` produced the next revision
  - restore produced a new revision and persisted the restored body as the new
    latest document state
- an API response inconsistency was also fixed during this smoke:
  - `restoreIssueDocumentRevision(...)` had returned a payload that still
    carried the stale internal `latestBody` field from the pre-restore state
  - the response contract now matches the actual restored state and no longer
    leaks stale `latestBody`
- final live verification after the fix confirmed:
  - restore response includes `body`
  - restore response does **not** include `latestBody`
  - follow-up `GET /documents/plan` returns the restored body and the expected
    new revision number

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

### Additional Operator Wakeup Smoke Completed On 2026-04-14

- a fresh agent API key was minted through the normal `agent local-cli` path for
  the live `CEO` agent
- two concurrent manual CLI invocations of:
  - `pnpm paperclipai heartbeat run --agent-id b45dcb01-db0d-40c9-9bdf-d7c1d93e8c1d`
  were launched against the upgraded live runtime
- both invocations resolved to the same live run id:
  - `ffd587ee-8ef7-42d6-8b6e-55e441084276`
- this confirms the post-cutover `followExistingIfRunning` path is coalescing
  duplicate operator wakeups instead of creating a second queued run tail
- the shared run completed with final status:
  - `succeeded`

### Additional Volume And Diagnostics Hardening Completed On 2026-04-15

- live `paperclip_paperclip_data` had grown to `56.11G`
- direct inspection showed the dominant consumer was the automatic SQL backup
  directory under:
  - `/var/lib/docker/volumes/paperclip_paperclip_data/_data/instances/default/data/backups`
- the live AST deployment had accumulated `216` SQL dump files because backup
  cadence and retention were still effectively set to:
  - `intervalMinutes = 60`
  - `retentionDays = 30`
- operational cleanup removed `198` stale dumps and kept a narrow retention set:
  - one backup per day
  - plus the two fresh cutover snapshots from `2026-04-14`
- resulting live state after cleanup:
  - `paperclip_paperclip_data = 6.97G`
  - backup directory size ≈ `5.1G`
- live config was then hardened to:
  - `database.backup.intervalMinutes = 1440`
  - `database.backup.retentionDays = 7`
- the production image now also includes `procps`, so standard process
  diagnostics such as `ps` are available inside `paperclip-app-1`
- live verification after rebuild confirmed:
  - `/usr/bin/ps`
  - `ps -eo pid,comm` executes successfully inside the running app container

### Additional Writer Runtime Smoke Completed On 2026-04-14

- the final writer-runtime smoke tail is now closed:
  - `AST-451`
  - `AST-452`
  - `AST-453`
- all three issues completed through the normal issue-backed execution path
  after the post-cutover runtime fixes
- confirmed live outcomes:
  - issue comment wakeup created a fresh writer heartbeat run
  - the run received populated issue context fields:
    - `paperclipIssueId`
    - `paperclipIssueIdentifier`
    - `paperclipCurrentIssueMarkdown`
  - the assigned writer run created the expected minimal `draft` issue document
  - the assigned writer run added a completion comment
  - the assigned writer run applied normal issue protocol and closed the issue as
    `done`
- representative completed runs:
  - `AST-453` -> run `54820b15-ba2e-475c-a44d-53e24afdd0e9`
  - `AST-452` -> run `b357636f-e734-4b41-8e46-f8f510dc826f`
  - `AST-451` -> run `0119b0c8-9f15-4216-81e8-2f2593f3ffe8`

### Root Cause Found During Writer Runtime Smoke

- issue-bound OpenRouter runs were not receiving a normalized current-issue
  payload in adapter-visible runtime context
- the writer run therefore started with effectively empty current-issue content
  even though the wakeup was tied to a concrete Paperclip issue
- this caused false-positive execution where the run could succeed mechanically
  without actually following the intended issue-backed draft/comment/closeout
  contract

### Hardening Applied After Writer Runtime Smoke

- heartbeat runtime context now injects normalized issue-bound fields for the
  current task:
  - `paperclipIssueId`
  - `paperclipIssueIdentifier`
  - `paperclipCurrentIssueMarkdown`
- the new helper path is covered by local server tests and validated by the
  live `AST-451/452/453` smoke sequence

## Operational Conclusion

The cutover is production-viable.

No additional core rollback or emergency compatibility patch is indicated from the smoke evidence gathered on 2026-04-14.

The next layer of validation should stay focused and incremental, not return to infrastructure churn:

1. `DataForSEO` heartbeat traceability is now confirmed on live runtime; keep this behavior covered in future cutover smoke
2. `Bright Data` deferred accounting path is now bootstrapped on live runtime: the reconciler completed its first `--apply`, initialized `plugin_state` baseline, and correctly emitted `0` `brightdata.com` cost events because the visible zone-cost buckets were still zero; future non-zero usage should now accumulate from that baseline instead of requiring another historical bootstrap
3. the writer issue-backed runtime smoke tail is now closed; remaining follow-up work is no longer a business-critical cutover blocker and should be treated as normal post-cutover stabilization or product-domain backlog

## Recommended Operator Path For Business Smoke

Do not create issue-backed smoke by mutating DB rows directly.

Preferred operator path:

1. use `paperclipai agent local-cli <agentRef> --company-id <company-id>` to obtain a proper agent-authenticated local control-plane session
2. create or pick a safe issue-backed smoke task through the normal API/UI path
3. let the selected agent run through normal checkout, comment, document, and status transitions

This preserves the Paperclip control-plane invariants and tests the real production path instead of a SQL-only approximation.
