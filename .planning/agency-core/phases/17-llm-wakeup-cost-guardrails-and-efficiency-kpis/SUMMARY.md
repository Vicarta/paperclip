# Phase 17 Summary

## Completed

- Timer heartbeat now always runs a DB preflight before LLM run creation.
- Direct `source="timer"` wakeups run the same DB preflight before creating an
  adapter run.
- Skipped timer wakeups are recorded as
  `heartbeat.skipped_no_actionable_work`.
- Session usage delta accounting now uses the latest prior run in the same
  session that has non-zero raw usage; failed/zero/null-usage runs no longer
  reset the baseline.
- Existing compaction policy was audited and left quality-preserving:
  native-context adapters such as `codex_local` and `claude_local` keep
  adapter-managed context without forced threshold rotation.
- Added `/api/companies/:companyId/costs/efficiency` for operational token waste
  KPIs.

## New KPI Surface

The efficiency endpoint returns:

- `tokensPerDeliveredArticle`
- `tokensPerDoneIssue`
- `idleTokens`
- `noIssueTimerTokens`
- `zeroOutputHighInputRuns`
- `managerCoordinationTokens`
- `reworkTokensPerArticle`
- `tokensLostToFailedRuns`
- `topWasteRuns`

## Verification

- `pnpm exec vitest run server/src/__tests__/heartbeat-timer-actionability.test.ts server/src/__tests__/costs-service.test.ts`
- `pnpm exec vitest run server/src/__tests__/heartbeat-process-recovery.test.ts`
- `pnpm --filter @paperclipai/server typecheck`

All passed.
