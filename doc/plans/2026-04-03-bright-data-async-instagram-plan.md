# 2026-04-03 Bright Data Async Instagram Plan

## Goal

Teach Paperclip's Bright Data integration to use Bright Data asynchronous dataset requests for Instagram collection workflows, then validate the result against the live server and real agent usage.

## Why This Change Is Needed

Observed failure mode in the current Stage 57 workflow:

- account audits relied on Bright Data MCP profile-style retrieval;
- that path returned only a subset of posts for the Astrogen Instagram account;
- the agent correctly blocked, but the integration still lacked a full-history retrieval path.

The user explicitly pointed to Bright Data asynchronous requests as the correct retrieval model for larger account/post workloads.

## Source Constraints

- Bright Data and Exa remain separate systems.
- Bright Data is the only allowed account-evidence path for Instagram account audit work.
- Bright Data credentials must remain server-side via Paperclip secrets.
- The token must not be stored in client-visible code or repo-tracked config.

## Bright Data API Direction

Adopt Bright Data REST async flow for Instagram collection:

1. `POST /datasets/v3/trigger`
- start an asynchronous dataset job
- receive a `snapshot_id`

2. `GET /datasets/v3/progress/{snapshot_id}`
- monitor job state
- distinguish `running`, `ready`, `failed`, and partial/error cases

3. `GET /datasets/v3/snapshot/{snapshot_id}`
- download the completed dataset payload
- support at least JSON output in Paperclip tools

4. Optional:
- support Bright Data webhook delivery fields in trigger requests, but do not require webhook usage for the first live remediation

## Paperclip Plugin Changes

Extend `plugin-bright-data-agent-tools` with first-class async dataset tools:

1. `trigger-dataset-request`
- server-side Bearer auth using the resolved secret
- generic dataset trigger support
- parameters should cover:
  - `datasetId`
  - `input`
  - optional delivery / notify fields
  - optional include-errors and limits

2. `get-snapshot-progress`
- accept `snapshotId`
- return normalized Bright Data progress payload

3. `download-snapshot`
- accept `snapshotId`
- support `format=json`
- return parsed JSON when possible, otherwise text

4. `run-dataset-request`
- convenience wrapper:
  - trigger
  - poll until ready / failed / timeout
  - optionally download snapshot automatically
- if timeout hits, return the `snapshotId` and latest known status instead of pretending failure

Keep existing MCP tools:

- `list-tools`
- `call-tool`

Reason:

- some Bright Data features remain MCP-native;
- Instagram full-history retrieval should move to async dataset flow.

## Astrogen Workflow Changes

Update Stage 57 account-audit rules so that:

- profile/account metadata may still come from Bright Data account/profile retrieval;
- full post-history collection must use the async dataset path when the issue requires whole-account coverage;
- "subset returned by profile payload" no longer counts as a full-account audit;
- if async dataset flow fails, the agent must block and add `Human Decision Needed`.

## Testing Plan

### Paperclip repo

- unit tests for the new Bright Data REST client helpers
- plugin worker tests for new tools
- plugin package build

### Live server

- deploy the updated plugin to the server-first runtime
- verify the Bright Data plugin worker is running
- execute a real async Instagram dataset request against `https://www.instagram.com/astrogen.com.ua/`
- confirm:
  - trigger returns `snapshot_id`
  - progress polling works
  - snapshot download returns structured results

### Live agent workflow

- update Astrogen Stage 57 skill/agent/process docs
- rerun the Instagram account audit via Paperclip
- verify the agent uses the async dataset path
- verify that blocker labels are removed when a previously blocked issue is actually unblocked during the test cycle

## Success Criteria

- Paperclip exposes working Bright Data async dataset tools.
- Live server execution succeeds without exposing the Bright Data token client-side.
- Stage 57 can retrieve materially broader Instagram account evidence than the current subset path.
- Agent contracts explicitly require async dataset retrieval for whole-account Instagram audits.

## Validation Result

Validated on the live server against `https://www.instagram.com/astrogen.com.ua/`:

- `paperclip.bright-data-agent-tools:run-dataset-request` now completes end-to-end through the Paperclip control plane;
- the validated recipe is:
  - dataset `gd_l1vikfch901nx3by4`
  - `type: discover_new`
  - `discoverBy: user_name`
  - input `[{ "user_name": "astrogen.com.ua" }]`
- the async wrapper successfully returned a structured snapshot payload plus image/media URLs for representative visual review;
- the Paperclip skill contract now explicitly states that plugin-tool execution must use `POST /api/agents/me/plugin-tools/execute` with `projectId` and `parameters`.

## Remaining Runtime Gap

The live retest also exposed a separate orchestration problem:

- specialist and manager runs were able to produce the correct Stage 57 artifact package;
- however, they did not always finalize the issue lifecycle with the expected status patch after successful artifact creation.

This is a runtime follow-through gap, not a Bright Data retrieval failure.
The validated async data path should therefore be treated as working, while the issue-closeout behavior still needs tightening in later Paperclip runtime work.
