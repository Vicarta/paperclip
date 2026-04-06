# 2026-04-04 Live Serper Wakeup And SEO Execution Plan

## Goal

Restore a single reliable live execution path for the SEO semantic-core workflow so that:

1. `Paperclip` can wake the assigned SEO specialist through the canonical issue-comment path.
2. the specialist can run with the fixed live `Serper` plugin.
3. the downstream project can produce a real Stage 53 SEO semantic-core artifact.

This plan exists because the work had started to split across multiple overlapping threads:
- `Serper` plugin activation;
- Docker and lockfile fixes;
- direct heartbeat wakeups;
- live issue reruns;
- wider SEO-lane rollout.

The result was partial progress with weak control over the true critical path.

## Current Diagnosis

### What is already solved

- [x] `Serper` build/runtime activation failures were diagnosed as real packaging problems, not as an upstream provider limitation.
- [x] `pnpm-lock.yaml` was synchronized with the new `plugin-serper-agent-tools` workspace state.
- [x] the production `Dockerfile` was fixed to include plugin example importers in the dependency-install stage.
- [x] the live server was rebuilt from the fixed code.
- [x] the live `Serper` plugin reached `ready` state and registered the tool `paperclip.serper-agent-tools:google-search`.

### What is not yet solved

- [x] the SEO specialist issue was relaunched through one clean canonical live wakeup path.
- [x] the full specialist live chain was observed end-to-end:
  - issue comment persisted;
  - heartbeat run created;
  - specialist executed;
  - Stage 53 artifact materialized.
- [x] the Stage 53 revision lane was reawakened after DataForSEO secrets were configured in live runtime.
- [ ] the Stage 53 revision lane is still blocked by external provider authorization:
  - `paperclip.dataforseo-agent-tools:google-ads-search-volume` runs;
  - but DataForSEO returns `40100 You are not authorized to access this resource`.
- [ ] the parent manager issue still needs a clean canonical wake so the workflow can continue without an operator-side handoff.
- [ ] the older installed `Exa` and `Bright Data` plugins still need activation-parity recovery in live UI.
  Current screenshot-level symptom:
  - installed plugins are present in the manager UI;
  - plugin cards show `error`;
  - visible message: `Activation failed: Command failed: pnpm build`.

### Main blocker

The current blocker is no longer `Serper` infrastructure.

The current blocker is no longer the specialist rerun path.

The current blocker is the absence of one **authorized DataForSEO provider path** for the revised Stage 53 demand-collection contract.

## Operating Rules For This Recovery

These rules stay in force until the end-to-end SEO chain is working.

1. Use one canonical wakeup path only.
   The canonical path is `POST /api/issues/:id/comments`.

2. Do not use direct ephemeral `heartbeatService.wakeup()` from one-off helper processes.
   That path is considered invalid for live reruns because it can create orphaned or misleading heartbeat state.

3. Do not broaden scope while the wakeup path is unresolved.
   Until Stage 53 completes once, do not spend more time on:
   - `Bright Data`;
   - `Exa`;
   - unrelated plugin rollout;
   - wider SEO-lane refinements.

4. A step only counts as complete when it is externally observable.
   For rerun success, "probably worked" is not enough.

## Success Conditions

The recovery is complete only when all of the following are true for the active SEO specialist issue:

- [ ] a new comment is stored on the issue through the live API path.
- [ ] a new `heartbeat_run` is created for the assigned specialist.
- [ ] that run reaches a terminal state without the prior activation blocker.
- [ ] a new Stage 53 SEO semantic-core artifact appears in the expected workspace path.
- [ ] the artifact is materially based on live `Serper` evidence rather than placeholder logic.

## Sequential Plan

### Phase 0: Repair Serper Settings Contract And Cost Unit Semantics

- [ ] fix the `Serper` settings page save request so it sends the server-required `{ configJson: ... }` shape.
- [ ] remove the misleading `cents` operator language from the `Serper` settings UI and schema.
- [ ] change the operator-facing field to a decimal value expressed from `1 USD` per search.
- [ ] keep runtime compatibility with any already-saved legacy `flatCostCentsPerSearch` config.
- [ ] document any remaining precision constraint explicitly if Paperclip billing still aggregates external provider spend at cent granularity.
- [x] verify in the live server bundle that:
  - settings save succeeds;
  - the error `"configJson" is required and must be an object` no longer appears;
  - the new cost-unit wording is visible in the UI.

Note:
- The live bundle now serves the fixed request shape and USD wording.
- A fully authenticated click-through save in the browser UI is still worth re-checking, but the previous server-side contract bug is fixed in live code.

Exit criteria:
- live `Serper` settings save works;
- the operator-facing unit is no longer mislabeled as cents.

### Phase 1: Freeze Scope And Record The Canonical Path

- [x] write a dedicated recovery plan instead of continuing ad hoc debugging.
- [x] explicitly declare the canonical rerun path:
  - issue comment route first;
  - UI only as fallback if API auth is the only thing failing.
- [x] explicitly declare invalid paths:
  - one-off direct `heartbeatService.wakeup()`;
  - broad parallel retries across unrelated provider threads.

Exit criteria:
- there is one written source of truth for the sequence of work;
- future progress can be marked directly in this document.

### Phase 2: Prove The Live Comment Mutation Path

- [x] construct one authenticated live request that writes a real comment onto the active SEO specialist issue.
- [x] verify persistence at the data layer:
  - the comment exists in `issue_comments`;
  - the issue activity shows the comment event.
- [x] verify the comment path uses the intended auth mode:
  - board session; or
  - valid agent JWT where appropriate.
- [x] capture the exact request shape that worked so it becomes the canonical operator path.

Exit criteria:
- one real issue comment is persisted through the live path;
- the working request path is known and repeatable.

### Phase 3: Prove Comment-To-Heartbeat Wakeup

- [x] after the successful comment, verify that a new `heartbeat_run` is created for the issue assignee.
- [x] verify the created run is linked to the expected issue context.
- [x] verify the run is not an orphan created by a side-channel process.
- [ ] if no run appears, debug only the issue-comment-to-wakeup chain:
  - route behavior;
  - mention detection if applicable;
  - assignee wake rules;
  - heartbeat enqueue path.

Exit criteria:
- the canonical comment mutation causes a real new heartbeat run.

### Phase 4: Prove The Specialist Can Reach Serper In Live Execution

- [x] inspect the new specialist run logs.
- [x] confirm that the prior `Serper` activation/build failure no longer appears.
- [x] confirm that the strategist can see and use the registered tool in the live run.
- [ ] if the run still fails, keep debugging constrained to:
  - tool availability in run context;
  - auth/secrets;
  - adapter execution flow.

Exit criteria:
- the specialist run gets past the old plugin-activation blocker.

### Phase 5: Produce A Real Stage 53 Artifact

- [x] confirm the run produces a Stage 53 package that can be materialized under the Stage 53 workspace.
- [x] verify the artifact is a genuine semantic-core output, not a placeholder or partial stub.
- [x] verify the artifact uses the intended language and project context.
- [x] verify the artifact is based on actual search-evidence retrieval where required.
- [x] repair the workspace ACL mismatch that prevented the runtime user from writing into `work/53-seo-semantic-core/active/`.
- [x] move the generated Stage 53 package and Serper evidence from container `/tmp` into the canonical Stage 53 active path.

Expected output location:
- downstream project workspace Stage 53 active folder

Exit criteria:
- one valid Stage 53 artifact exists from the live rerun.

### Phase 6: Validate The Artifact And Decide The Next SEO Step

- [x] review the Stage 53 artifact for structural completeness.
- [x] relaunch the revised Stage 53 lane after live DataForSEO plugin install and company secret wiring.
- [x] verify that the revised lane reaches the DataForSEO tool instead of failing earlier in wakeup/runtime setup.
- [x] identify the new blocker class from observed evidence:
  - provider authorization failure (`40100`);
  - not plugin registration;
  - not plugin config refs;
  - not wakeup routing.
- [ ] determine whether the next step is:
  - Stage 54 validation;
  - revision of the strategist lane;
  - or further Paperclip runtime repair.
- [ ] document any remaining gap as either:
  - Paperclip runtime problem;
  - project prompt/skill problem;
  - or provider-evidence problem.

Exit criteria:
- the next work item is unambiguous and based on observed results.

### Phase 8: Clear DataForSEO Authorization For Stage 53 Demand Metrics

Why this exists:
- the revised Stage 53 lane now reaches the correct provider tool in live runtime;
- the provider call is no longer blocked by Paperclip plugin activation, wakeup routing, or missing secret refs;
- the remaining blocker is a provider-side `40100` authorization failure.

Required work:
- [ ] verify directly, outside the strategist lane, that the configured credentials reproduce the same `40100` against the live DataForSEO endpoint.
- [ ] confirm whether the operator entered:
  - valid DataForSEO API credentials;
  - the correct account login;
  - the correct API password rather than a dashboard password or unrelated secret.
- [ ] once corrected, rerun one minimal provider smoke test for:
  - `location_name=Ukraine`
  - `language_name=Ukrainian`
  - one or two sample keywords only
- [ ] only after the smoke test passes, wake `AST-140` again through the canonical issue-comment path.
- [ ] verify the revised Stage 53 artifact now contains:
  - keyword-level `UA search volume`
  - `CPC` where available
  - cluster summed `UA search volume`
  - demand-backed prioritization

Rules:
- Do not mark the Stage 53 revision as recovered while the provider still returns `40100`.
- Do not route this blocker back into `Serper`, `Exa`, `Bright Data`, or generic plugin debugging.
- Treat this as a credentials/permissions problem until a direct smoke test proves otherwise.

Exit criteria:
- one direct DataForSEO smoke test succeeds in live runtime;
- `AST-140` is reawakened after that proof, not before.

### Phase 7: Restore Activation Parity For Existing Exa And Bright Data Plugins

Why this exists:
- the current SEO critical path is no longer blocked by `Serper`;
- `DataForSEO` is now live and ready;
- but the screenshot shows two older plugins still degraded in the operator UI:
  - `paperclip.exa-agent-tools`
  - `paperclip.bright-data-agent-tools`

Required work:
- [ ] inspect the current registry state for `Exa` and `Bright Data` plugin rows:
  - package path;
  - status;
  - last error;
  - whether the rows predate the Docker/importer fixes.
- [ ] inspect live logs for the exact activation failure for each plugin instead of relying only on the generic UI banner.
- [ ] compare their package importer coverage with the now-fixed `Serper` and `DataForSEO` path:
  - `pnpm-lock.yaml`
  - `Dockerfile` deps-stage package copies
  - package build prerequisites
- [ ] determine whether the correct recovery path is:
  - `enable` on the existing plugin row;
  - reinstall from bundled example;
  - or uninstall + reinstall.
- [ ] run the minimal safe recovery path for `Exa`.
- [ ] run the minimal safe recovery path for `Bright Data`.
- [ ] verify each plugin reaches `ready` and registers its tools in live runtime.
- [ ] verify the plugin cards in the UI no longer show the generic build-failure banner.

Rules:
- Do not guess from the generic UI error text alone.
- Use exact server logs and registry state for each plugin before choosing recovery.
- Prefer `enable`/recovery over destructive reinstall if the stored config should be preserved.
- If a reinstall is required, preserve server-side secrets and confirm they remain referenced correctly.

Exit criteria:
- `Exa Agent Tools` is `ready` in live UI.
- `Bright Data Agent Tools` is `ready` in live UI.
- neither card shows `Activation failed: Command failed: pnpm build`.

## Debug Decision Tree

Use this exact branching logic to avoid another loop.

### If the comment does not persist

Treat the problem as:
- request construction;
- authentication;
- route usage;
- or actor-permission mismatch.

Do not debug `Serper`.

### If the comment persists but no heartbeat run appears

Treat the problem as:
- issue comment wakeup routing;
- mention/assignee wake logic;
- heartbeat enqueue behavior.

Do not debug `Serper`.

### If the heartbeat run appears but fails before tool usage

Treat the problem as:
- adapter execution;
- run context delivery;
- secrets/config visibility;
- or plugin runtime availability in the live run.

### If the run succeeds technically but no artifact appears

Treat the problem as:
- agent prompt/discipline;
- workspace write path;
- or downstream stage contract.

### If the specialist run succeeds but operator recovery is needed to materialize the artifact

Treat the problem as:
- workspace ACL/ownership drift;
- stale blocker state cleanup;
- parent-manager wakeup;
- not as a `Serper` or specialist prompt failure.

## Anti-Loop Rules

The following are explicit "stop repeating this" rules:

- [x] do not treat partial infrastructure success as proof of end-to-end workflow success.
- [x] do not create or keep using side-channel wakeups once the canonical path is known.
- [x] do not branch into `Bright Data`, `Exa`, or other provider work until the current live SEO rerun succeeds once.
- [x] do not claim completion of the SEO execution path until the Stage 53 artifact exists.

## Progress Log

Use this section as the running ledger when we advance the plan.

### Completed before this document

- [x] `Serper` plugin packaged and wired server-side.
- [x] secret-backed provider model implemented.
- [x] external provider cost model added.
- [x] lockfile repaired.
- [x] Docker dependency scope repaired.
- [x] live server rebuilt and healthchecked.
- [x] live `Serper` tool registration observed.

### Pending now

- [x] live `Serper` settings contract and cost-unit fix deployed.
- [x] canonical live issue-comment mutation proven.
- [x] comment-to-heartbeat wakeup proven.
- [x] SEO specialist rerun proven.
- [ ] parent-manager wake / downstream SEO continuation.
- [ ] Stage 53 rerun with `DataForSEO`-backed Ukrainian demand metrics.
- [ ] activation-parity recovery for `Exa` and `Bright Data` plugin cards shown in live UI.
- [x] Stage 53 artifact produced.
- [x] stale child blocker state cleared after runtime ACL repair.
- [ ] parent-manager wake proven after specialist completion recovery.
- [ ] downstream SEO validation started.

## Definition Of Done For This Documented Track

This track is done when:

- [ ] the active SEO specialist issue can be rerun predictably through the canonical issue-comment path;
- [ ] the live run uses the fixed `Serper` plugin successfully;
- [ ] the downstream project receives a real Stage 53 semantic-core artifact;
- [ ] we can move to the next SEO stage without relying on manual or experimental wakeup hacks.
