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

- [ ] the SEO specialist issue has not yet been relaunched through one clean, repeatable, canonical live wakeup path.
- [ ] the full live chain has not yet been observed end-to-end:
  - issue comment persisted;
  - heartbeat run created;
  - specialist executed;
  - Stage 53 artifact written.

### Main blocker

The current blocker is no longer `Serper` infrastructure.

The current blocker is the absence of one **validated live rerun path** for an already-assigned agent issue.

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
- [ ] verify on the live server that:
  - settings save succeeds;
  - the error `"configJson" is required and must be an object` no longer appears;
  - the new cost-unit wording is visible in the UI.

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

- [ ] construct one authenticated live request that writes a real comment onto the active SEO specialist issue.
- [ ] verify persistence at the data layer:
  - the comment exists in `issue_comments`;
  - the issue activity shows the comment event.
- [ ] verify the comment path uses the intended auth mode:
  - board session; or
  - valid agent JWT where appropriate.
- [ ] capture the exact request shape that worked so it becomes the canonical operator path.

Exit criteria:
- one real issue comment is persisted through the live path;
- the working request path is known and repeatable.

### Phase 3: Prove Comment-To-Heartbeat Wakeup

- [ ] after the successful comment, verify that a new `heartbeat_run` is created for the issue assignee.
- [ ] verify the created run is linked to the expected issue context.
- [ ] verify the run is not an orphan created by a side-channel process.
- [ ] if no run appears, debug only the issue-comment-to-wakeup chain:
  - route behavior;
  - mention detection if applicable;
  - assignee wake rules;
  - heartbeat enqueue path.

Exit criteria:
- the canonical comment mutation causes a real new heartbeat run.

### Phase 4: Prove The Specialist Can Reach Serper In Live Execution

- [ ] inspect the new specialist run logs.
- [ ] confirm that the prior `Serper` activation/build failure no longer appears.
- [ ] confirm that the strategist can see and use the registered tool in the live run.
- [ ] if the run still fails, keep debugging constrained to:
  - tool availability in run context;
  - auth/secrets;
  - adapter execution flow.

Exit criteria:
- the specialist run gets past the old plugin-activation blocker.

### Phase 5: Produce A Real Stage 53 Artifact

- [ ] confirm the run writes a new artifact under the Stage 53 workspace.
- [ ] verify the artifact is a genuine semantic-core output, not a placeholder or partial stub.
- [ ] verify the artifact uses the intended language and project context.
- [ ] verify the artifact is based on actual search-evidence retrieval where required.

Expected output location:
- downstream project workspace Stage 53 active folder

Exit criteria:
- one valid Stage 53 artifact exists from the live rerun.

### Phase 6: Validate The Artifact And Decide The Next SEO Step

- [ ] review the Stage 53 artifact for structural completeness.
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

- [ ] live `Serper` settings contract and cost-unit fix deployed.
- [ ] canonical live issue-comment mutation proven.
- [ ] comment-to-heartbeat wakeup proven.
- [ ] SEO specialist rerun proven.
- [ ] Stage 53 artifact produced.
- [ ] downstream SEO validation started.

## Definition Of Done For This Documented Track

This track is done when:

- [ ] the active SEO specialist issue can be rerun predictably through the canonical issue-comment path;
- [ ] the live run uses the fixed `Serper` plugin successfully;
- [ ] the downstream project receives a real Stage 53 semantic-core artifact;
- [ ] we can move to the next SEO stage without relying on manual or experimental wakeup hacks.
