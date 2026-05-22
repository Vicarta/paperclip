# Phase 24: LLM Heartbeat Cost Control

## Problem

Astrogen generated 84 LLM-backed Paperclip runs between 2026-05-21 23:00 and 2026-05-22 10:00 Europe/Kiev. All were `timer/system` heartbeats for CEO, CMO, and CTO. They produced no event-specific work trigger and consumed 26,543,631 input tokens, including 4,541,327 non-cached input tokens.

The current cost pattern is not caused by article writing or semantic-core generation. It is caused by routine LLM wakeups that scan state even when no actionable event exists.

## Goal

Make Astrogen event-driven by default:

```text
real issue/comment/approval/watchdog event
-> wake the right agent once
-> agent acts

no event
-> no LLM call
```

## Decisions

1. Disable timer heartbeats for Astrogen CEO, CMO, and CTO.
2. Keep `wakeOnDemand=true` so assignment/comment/approval/manual wakes still work.
3. Leave specialist agents without timer heartbeats.
4. Do not use frequent CMO timer heartbeat as the recovery mechanism.
5. Recovery must come from deterministic watchdog/routine checks that wake an agent only when there is a concrete action.
6. Preserve scheduled routines for explicit jobs such as weekly release checks; routines create concrete issues and are not equivalent to idle LLM heartbeats.

## Implementation

### Live Astrogen Config

Update live `agents.runtime_config.heartbeat.enabled=false` for:

- `CEO`
- `Chief Marketing Officer`
- `Chief Technical Officer`

Keep:

- `wakeOnDemand=true`
- existing `intervalSec` values as historical/default metadata
- `maxConcurrentRuns=1`

### Source/Planning

- Update Astrogen roadmap/current state to record that routine LLM heartbeats are no longer allowed for top managers by default.
- Update production manifest so future config exports do not re-enable timer heartbeats for Astrogen managers.
- Add a source-level optional timer guard: `heartbeat.skipIfNoActionableWork`.
  - When enabled, the server checks assigned `todo` issues or new assigned issue/comment activity since the previous heartbeat before creating a timer LLM run.
  - If nothing actionable exists, the scheduler skips without starting an adapter/LLM run.
- Add implementation notes for other companies so DiskInternals/VIONECTA can apply the same policy intentionally instead of copying Astrogen blindly.

### Verification

Run SQL verification against live Paperclip:

- Astrogen CEO/CMO/CTO show `hb_enabled=false`.
- All Astrogen active agents show no `hb_enabled=true` unless explicitly approved.
- Recent timer-run count should stop increasing after the change.
- Wake-on-demand remains enabled.
- Local source tests pass:
  - `pnpm exec vitest run server/src/__tests__/heartbeat-timer-actionability.test.ts server/src/__tests__/heartbeat-silent-noop.test.ts`
  - `pnpm --filter @paperclipai/server typecheck`

## Acceptance Criteria

- No Astrogen agent has timer heartbeat enabled after the live config update.
- Astrogen manager agents can still be woken by assignment/comment/manual events.
- The next overnight idle period should produce zero Astrogen `timer/system` LLM cost events.
- Future use of 5-15 minute LLM heartbeat requires explicit temporary human approval and expiry.
