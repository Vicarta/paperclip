# Phase 17: LLM Wakeup Cost Guardrails And Efficiency KPIs

## Problem

Paperclip token totals can grow far beyond useful output because scheduler/timer
wakeups may start LLM adapter runs even when there is no actionable issue,
mention, approval, routine execution, queued assignment, or concrete trigger.

Separately, session-total usage accounting can overcount after failed or
zero-usage runs if the next successful run computes its delta against the latest
run instead of the latest run in the same session that has non-zero raw usage.

## Goal

Reduce waste without damaging quality from long-context manager sessions.

## In Scope

- Make timer wakeups fail closed before adapter execution when no actionable work
  exists.
- Preserve routine/assignment/on-demand/event-driven wakes.
- Fix session usage delta baseline selection.
- Audit existing session compaction policy without adding a general forced
  rotation rule.
- Expose operational cost-efficiency KPIs so waste is visible by company/date
  range.

## Non-Goals

- Do not cap long sessions globally.
- Do not force manager/CMO/CTO session rotation.
- Do not redesign budget UI.
- Do not change provider pricing or subscription accounting.

## Implementation Plan

1. Change heartbeat timer behavior:
   - timer wakeups always run DB preflight before run creation;
   - direct `source="timer"` wakeups also run the same DB preflight before a run
     is created;
   - skipped timer wakeups are recorded as
     `heartbeat.skipped_no_actionable_work`.

2. Fix usage delta baseline:
   - find the latest prior run in the same session with non-zero raw usage;
   - ignore failed/zero/null-usage runs as delta baselines;
   - keep deriving deltas from raw session totals when the baseline exists.

3. Preserve long-context behavior:
   - leave native-context adapters (`codex_local`, `claude_local`) on
     adapter-managed compaction with no threshold-based forced rotation;
   - keep existing threshold fallback for adapters without confirmed native
     context management.

4. Add cost-efficiency KPI API:
   - `tokensPerDeliveredArticle`;
   - `tokensPerDoneIssue`;
   - `idleTokens`;
   - `noIssueTimerTokens`;
   - `zeroOutputHighInputRuns`;
   - `managerCoordinationTokens`;
   - `reworkTokensPerArticle`;
   - `tokensLostToFailedRuns`;
   - `topWasteRuns`.

## Acceptance Criteria

- Timer scheduler cannot enqueue an LLM run for an agent with no actionable
  assigned issue/comment activity.
- Direct timer wakeup API calls also skip before creating a run when there is no
  actionable work.
- A zero/null-usage run does not reset session usage baseline.
- Existing session compaction policy remains quality-preserving for
  native-context adapters.
- `/api/companies/:companyId/costs/efficiency` returns operational waste KPIs for
  a date range.

## Verification

- `heartbeat-timer-actionability` unit tests cover actionable work and usage
  baseline selection.
- `heartbeat-process-recovery` embedded test covers skipped direct timer wakeup
  without new run creation.
- `costs-service` route test covers the new efficiency endpoint.
- Server typecheck must pass.
