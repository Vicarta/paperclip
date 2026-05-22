# Phase 24 Summary: LLM Heartbeat Cost Control

## Result

Phase 24 is complete for Astrogen.

The non-functional overnight LLM usage was caused by manager timer heartbeats, not by article generation or semantic-core work. Between 2026-05-21 23:00 and 2026-05-22 10:00 Europe/Kiev, Astrogen produced 84 `timer/system` LLM runs from CEO, CMO, and CTO.

Live Astrogen is now event-driven by default:

- active Astrogen timer heartbeats: `0`;
- active Astrogen wake-on-demand agents: `29`;
- active Astrogen agents with `heartbeat.skipIfNoActionableWork=true`: `29`.

## Implemented

- Disabled idle timer heartbeat for active Astrogen agents.
- Preserved wake-on-demand so assignments, comments, manual wakes, and explicit routines can still trigger work.
- Added server-side `heartbeat.skipIfNoActionableWork` support.
- Added actionability checks before timer runs are created:
  - `todo` assigned issue means actionable;
  - `in_progress`, `in_review`, or `blocked` assigned issue means actionable only if the issue or comments changed after the previous heartbeat.
- Updated production config export to include heartbeat policy fields.
- Updated Astrogen roadmap, state, and production manifest.

## Verification

Local source verification:

```text
pnpm exec vitest run server/src/__tests__/heartbeat-timer-actionability.test.ts server/src/__tests__/heartbeat-silent-noop.test.ts
pnpm --filter @paperclipai/server typecheck
```

Production verification:

- deployed image: `paperclip-app:v2026.513.10-heartbeat-cost-20260522`;
- health: `/api/health` returned `status=ok`;
- plugin boot: 13 ready plugins loaded successfully, 92 tools registered;
- live Astrogen heartbeat state: `timer_enabled_agents=0`, `wake_on_demand_agents=29`, `skip_guard_agents=29`.

## Follow-Up For Other Companies

Apply the same policy intentionally per company. Do not copy Astrogen blindly if a company has an explicitly approved timer workflow.

Default rule:

```text
no concrete event -> no LLM call
```

Use wake-on-demand and deterministic watchdog/routine issues instead of frequent idle manager polling.
