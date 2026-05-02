# Phase 3: Runtime Silent-Noop Recovery And Telegram Operational Alerts

## Problem

Paperclip can currently record an agent adapter run as `succeeded` even when the assigned issue receives no useful side effect: no issue comment, no status transition, no artifact handoff, and no visible continuation path.

This creates a dangerous silent-stall state:

- the runtime believes the agent completed;
- the issue remains in `todo` or otherwise unchanged;
- the manager/owner sees no actionable progress;
- the workflow can stop without a clear blocker.

The concrete trigger for this phase is an assigned validation issue where the agent run exited `0`, consumed substantial tokens, but left the issue unchanged.

## Goal

Make silent no-op assignment runs fail loudly and notify the human/operator in Telegram with enough context to recover the workflow.

## Scope

- Detect assignment runs that finish successfully but leave their issue unchanged.
- Mark those runs as failed with a stable runtime error code.
- Leave an issue comment explaining the runtime guard.
- Send a short human-readable Telegram alert.
- Include the responsible agent name in operational alerts and issue-done Telegram messages.
- Document the governance rule for future agents and managers.

## Non-Goals

- Do not auto-regenerate SEO artifacts.
- Do not change the SEO content-plan workflow itself.
- Do not treat every no-comment run as invalid; timer/background runs can legitimately have no issue side effect.
- Do not expose Telegram tokens or plugin secrets in code, logs, prompts, or docs.

## Design

### Silent-Noop Rule

A run is suspicious when all of these are true:

- invocation source is `assignment`;
- run would otherwise be `succeeded`;
- run context points to an issue/task;
- issue is still in an unresolved executable state such as `todo` or `backlog`;
- there is no issue comment created by that run.

For the MVP, the guard fails the run with:

```text
errorCode = silent_noop
status = failed
```

The issue remains open and execution lock is released through the existing finalization path.

### Telegram Alert

Telegram alert content must be human-facing:

- company context;
- issue identifier and title;
- agent name;
- plain-language summary of what went wrong;
- one Paperclip task link.

The alert goes through the existing Telegram plugin config and server-side secret resolution.

### Existing Done Notifications

Issue-completion notifications must include the agent name when `agentId` is known, so the human can understand who produced the result.

## Implementation Steps

1. Add a runtime silent-noop predicate and tests.
2. Add DB-backed detection in heartbeat finalization.
3. Convert detected silent no-op results into failed runs before final status persistence.
4. Add an issue comment for detected no-op runs.
5. Add operational Telegram alert service for runtime guards.
6. Add agent name to issue-done Telegram messages and tests.
7. Update agency-core governance docs.
8. Run focused tests and typecheck.

## Acceptance Criteria

- A succeeded assignment run for an unchanged `todo` issue is persisted as `failed` with `silent_noop`.
- A runtime guard comment is written to the issue.
- A Telegram alert is sent when Telegram plugin config is ready.
- Telegram alert text includes the agent name.
- Existing issue-done Telegram notifications include the agent name when known.
- Existing notification tests still pass.
- No plaintext secrets are introduced.

