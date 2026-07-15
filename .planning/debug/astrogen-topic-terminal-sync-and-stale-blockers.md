# Debug: Astrogen topic terminal sync and stale blockers

## Status

resolved

## Symptoms

- A delivered `astrogen-article-production` child can leave its parent topic in `ready` instead of `consumed`.
- A cancelled article can leave/release its parent topic without a durable retry-safety disposition.
- Blocked automation issues from superseded attempts remain visible after their pipeline case is terminal.
- New article production must continue to pass the complete Winning Structure lifecycle.

## Evidence

1. Topic `ready` uses native breakdown into `astrogen-article-production` and sets the topic case as `parentCaseId` of the article case.
2. Topic `reserved` currently declares `autoAdvanceOnChildrenTerminal: ready`. The core `handleChildrenTerminal` implementation selects one destination for every complete child rollup and does not distinguish `done` from `cancelled`.
3. The CMO delivery instructions ask an agent to move the topic to `consumed`, but the server independently performs the configured parent auto-transition. The business invariant is therefore advisory and races/conflicts with native lifecycle behavior.
4. Retry cleanup cancels linked automation issues only during an explicit automation retry. Normal case terminal transitions do not reconcile older blocked automation links.
5. The live article manifest contains mandatory `strategy_input`, `winning_structure`, `structure_decision`, and `structure_review` stages. The `winning_structure` stage explicitly requires all five operations exposed by `paperclip.winning-structure-mcp-agent-tools`; no transition bypasses these stages on the create path.

## Root cause

Paperclip has a generic children-terminal gate but no outcome-aware parent transition contract. Astrogen encoded a cross-pipeline terminal invariant in agent prose while the native server retained an outcome-blind `terminal -> ready` rule. Stale blocked issues are a separate lifecycle omission: terminal cases do not retire blocked links belonging to obsolete automation attempts.

## Fix boundary

- Add a typed, declarative `childrenTerminalOutcome` stage config with separate destinations for the current allocation child being done or cancelled.
- Permit an outcome transition to atomically store the current direct child case ID and a terminal proof object in parent fields. Resolve it from the configured parent field, with a latest non-retired direct child fallback only for migration.
- Reconcile active `blocked` issue links with role `automation` or `work` only when every active pipeline link for that issue points to a terminal or retired case. Any live or `external_wait` case preserves the issue and every link.
- Configure Astrogen topic `reserved`: current child done -> `consumed`; current child cancelled -> `ready`; require the current direct child; write `consumingArticleCaseId` and terminal proof. Cancellation is an autonomous technical release and must not require owner review.
- Keep the existing Winning Structure stage graph mandatory.

## Verification plan

- Service test: done article child advances topic exactly once to consumed and records proof.
- Service test: cancelled article child releases topic to ready and records cancellation proof.
- Service test: terminal transition reconciles stale blocked automation/work issues only when all active linked cases are terminal/retired; any live/external-wait link preserves the issue.
- Existing pipeline service suite and TypeScript checks.

## Live result

- Deployed image `paperclip-app:v2026.626.0-vicarta.68-topic-terminal-sync-20260715T0821Z` to clean compose only.
- Applied migration `0128_pipeline_terminal_issue_reconciliation.sql`; app and DB are healthy.
- Synced native article/topic manifests and allocator revision 12 with per-topic-version reservation generation keys.
- Reconciled the delivered article topic to `consumed` with current-child proof.
- Reconciled the proven existing-content duplicate topic to `rejected_duplicate` instead of releasing it for reallocation.
- Cancelled and retired nine stale blocked automation/work issues whose every active case link was terminal or retired.
- Preserved all ten blocked links belonging to four live `external_wait` growth cases.
- Verified the latest delivered create case has a completed Winning Structure run and durable result document before its Claude-authored draft stages.

## Implemented

- Added typed `childrenTerminalOutcome` validation and native outcome-aware parent transitions.
- Typed outcomes are transaction-strict. Any current-child, proof, target, blocker, or transition failure rolls back the child terminal transition. Legacy `autoAdvanceOnChildrenTerminal` remains best-effort.
- Current allocation child resolution uses the configured parent field and requires it to match the latest non-retired direct child. A missing field uses that latest child only as a migration fallback; a stale configured ID is a conflict.
- A cancelled current article releases its topic to `ready`; a done current article consumes it. Historical cancelled children do not override the current allocation outcome.
- Blocked `automation` and `work` issues are cancelled and their execution links retired only when every active pipeline link for that issue points to a terminal or retired case. Live and `external_wait` links preserve the issue.
- Normal terminal transitions, stage-deletion terminal moves, and automation-retry retirement use the same reconciliation helper.
- Added the `terminal_execution_issues_reconciled` durable event and migration.
- Astrogen manifest and clean live production now use the verified outcome-aware contract.

## Verification results

- `pnpm --dir local-paperclip exec vitest run server/src/__tests__/pipelines-service.test.ts`: 1 file passed, 37 tests passed.
- `pnpm --dir local-paperclip exec vitest run packages/db/src/pipelines-schema.test.ts`: 1 file passed, 1 test passed.
- `pnpm --dir local-paperclip exec vitest run packages/shared/src/validators/issue.test.ts packages/db/src/pipelines-schema.test.ts`: 2 files passed, 25 tests passed.
- `pnpm --dir local-paperclip exec tsc --noEmit -p server/tsconfig.json`: passed before the final retry-path fixture adjustment; the final targeted Vitest run compiled and passed the changed service/test file.
- Full `pnpm typecheck` across the workspace passed after the final review adjustments.
- Live health returned `status=ok`; the clean app runs the new image with restart count zero.
