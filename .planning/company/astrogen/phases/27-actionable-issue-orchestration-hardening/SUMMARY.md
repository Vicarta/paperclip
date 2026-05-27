# Phase 27 Summary: Actionable Issue Orchestration Hardening

## Completed

- Added Paperclip core event-driven wakeup coverage for assigned issues that transition into `todo` or `in_progress` without assignee changes.
- Added deterministic no-LLM `actionableIssueWatchdogService`.
- Wired the watchdog into the existing heartbeat scheduler loop.
- Added default token guardrail: the watchdog queues at most one new wakeup per agent per tick.
- Added SEO technical issue coalescing for open issues using:
  - `originKind = seo_technical_finding`
  - `originId = {normalized_url}::{problem_class}`
- Added and live-synced Astrogen `SEO CMS Technical Fixer` contract.
- Created live Astrogen `SEO CMS Technical Fixer` agent with timer heartbeat disabled and wake-on-demand enabled.
- Updated CMO, SEO GSC Indexing Auditor, and published-page SEO process contracts so deterministic `noindex`, canonical, redirect, slug/category, and sitemap fixes route to `SEO CMS Technical Fixer`, not HIA or CTO.
- Deployed the server build to production and verified health.

## Verification

- `pnpm --filter @paperclipai/server exec vitest run src/__tests__/actionable-issue-watchdog.test.ts src/__tests__/issue-comment-reopen-routes.test.ts src/__tests__/issues-service.test.ts`
- `pnpm --filter @paperclipai/server typecheck`
- `pnpm --filter @paperclipai/server build`
- Production health: `200 /api/health`.
- Production watchdog evidence: first post-deploy tick found stale Astrogen actionable issues and queued wakeups.
- CMO rerouted active SEO technical remediation issues to `SEO CMS Technical Fixer`.

## Notes

- The first production watchdog tick happened before the per-agent token guardrail update and queued multiple existing stale tasks. The guardrail is now deployed.
- Old CTO Telegram proof/replay tasks were also stale/actionable and were picked up by the first watchdog tick. They are now blocked, so future watchdog ticks will not keep waking CTO for those tasks.

