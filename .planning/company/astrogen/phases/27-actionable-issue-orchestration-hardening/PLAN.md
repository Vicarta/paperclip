# Phase 27: Actionable Issue Orchestration Hardening

## Goal

Make Paperclip reliably continue assigned actionable work without relying on idle LLM heartbeats or manual operator nudges.

This phase addresses the Astrogen failure mode where SEO technical issues were moved back to `todo` with a valid assignee, but no new wakeup was queued because the assignee did not change and the status transition was not `backlog -> active`.

## Scope

1. Event-driven wakeup guarantee.
2. Deterministic stale actionable issue watchdog.
3. SEO technical issue deduplication contract.
4. Dedicated `SEO CMS Technical Fixer` execution lane.
5. HIA exclusion for deterministic technical SEO/CMS fixes.

## Requirements

- Any assigned issue that transitions into an actionable execution state must get an assignee wakeup, even when the assignee did not change.
- The deterministic watchdog must not call an LLM.
- The watchdog must scan all assigned actionable issues, regardless of priority.
- Priority may only affect ordering inside bounded batches; it must not filter out lower-priority work.
- Existing queued/running/deferred work for the same issue must prevent duplicate wakeups.
- Technical SEO findings must dedupe by `company + normalized URL + problem class`.
- Technical SEO/CMS fixes such as `noindex`, canonical, sitemap visibility, slug/category, and redirect fixes must not request HIA when Payload REST plus live HTTP verification is available.
- Astrogen must have a dedicated `SEO CMS Technical Fixer` lane for deterministic CMS SEO fixes.

## Implementation Plan

### 1. Core Wakeup Fix

Update `server/src/routes/issues.ts` so status transitions into actionable states queue a wakeup for the current assignee even if the assignee did not change.

Actionable states for this fix:

- `todo`
- `in_progress`

### 2. Stale Actionable Watchdog

Add `server/src/services/actionable-issue-watchdog.ts`.

The service should:

- find assigned issues in `todo` or `in_progress`;
- ignore hidden issues and non-invokable agents;
- use a stale threshold, initially 5 minutes;
- skip issues that already have active wakeup/run evidence;
- call `heartbeat.wakeup()` with reason `stale_actionable_issue`;
- report checked/queued/skipped/failed counts;
- never call LLMs directly.

Wire it into the existing heartbeat scheduler loop in `server/src/index.ts`.

### 3. SEO Technical Dedupe

Use the existing `originKind` / `originId` mechanism for technical SEO findings.

Required convention:

```text
originKind = seo_technical_finding
originId = {normalized_url}::{problem_class}
```

Paperclip should coalesce open issues with the same key instead of creating duplicates.

### 4. SEO CMS Technical Fixer

Add/live-configure an Astrogen agent:

```text
Name: SEO CMS Technical Fixer
Reports to: Chief Marketing Officer
Purpose: deterministic Payload CMS SEO metadata fixes and live HTTP verification
Heartbeat: disabled
Wake-on-demand: enabled
```

The agent may use Payload CMS agent tools and live HTTP checks. It must not write site source code.

### 5. HIA Exclusion

Update Astrogen routing/manager contracts so HIA is forbidden for deterministic technical SEO/CMS fixes when the fix path is available through Payload REST and live verification.

## Tests

- Route test: `blocked -> todo` with the same assignee queues a wakeup.
- Watchdog service test: stale assigned `todo` issues queue wakeups without filtering by priority.
- Watchdog service test: active wakeup/run evidence suppresses duplicate wakeups.
- Issue service test: duplicate `seo_technical_finding` origin keys coalesce to the existing open issue.

## Acceptance Criteria

- Astrogen-like `blocked -> todo` reroutes no longer leave assigned tasks idle.
- Stale assigned actionable tasks are picked up without LLM timer heartbeats.
- Low/medium priority actionable tasks are not starved.
- Duplicate SEO technical issue chains are prevented for new findings.
- `SEO CMS Technical Fixer` exists and is the intended lane for CMS SEO fixes.
- HIA is not used for noindex/canonical/sitemap/redirect implementation-path decisions.

