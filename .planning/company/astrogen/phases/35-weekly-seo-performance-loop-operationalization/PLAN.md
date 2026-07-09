# Phase 35: Weekly SEO Performance Loop Operationalization

## Objective

Turn the documented Astrogen weekly SEO operating cycle into a working production result.

The phase is complete only when Paperclip can run:

```text
traffic and page evidence
-> SEO strategy interpretation
-> joined action queue
-> internal-linking / relatedPosts / refresh / technical / offpage tasks
-> owner-facing summary and durable issue evidence
```

without stopping at a report-only output or a stale technical blocker.

## Current Production Gap

The active routine already exists:

- Routine: `Weekly Astrogen SEO action cycle`
- Routine id: `a3ed0133-5c27-4371-a76a-0508e32237ac`
- Schedule: Wednesday `09:00 Europe/Kiev`
- Assignee before this phase: `Chief Marketing Officer`

The last execution, [AST-1417](/AST/issues/AST-1417), stopped before completion because the GA4 ecommerce KPI path was blocked:

- `analytics_ecommerce` appears in the GSC/Bing/GA4 plugin manifest examples.
- Live company config omits `analytics_ecommerce` from `allowedMcpToolNamesCsv`.
- Execution therefore rejects it with `GSC/Bing/GA4 MCP tool is not allowed: analytics_ecommerce`.

The result is that CMO can collect partial CMS/GSC/GA4 metrics, but cannot close the weekly SEO cycle with Organic Search-attributed ecommerce evidence, a joined action queue, and routing for SEO actions.

## Requirements

- `AST-GOV-01`: keep Astrogen planning under `.planning/company/astrogen/`.
- `AST-GOV-04`: use Paperclip issue ownership and plugin tools; no silent stuck work.
- `AST-SEO-04`: combine GSC, rank/SERP, and content refresh decisions.
- `AST-SEO-13`: work from article/page opportunities, not individual keywords.
- `AST-HIA-01`: owner-facing messages in concise Ukrainian.
- Current Phase 34 requirement: weekly completion requires joined GSC + CrawlObserver + CMS/Payload evidence and an action queue, not only a report.

## Execution Plan

### 1. Create `SEO Performance Analyst`

Create a production Astrogen agent dedicated to weekly SEO performance interpretation.

Responsibilities:

- Own weekly KPI package and joined SEO action queue.
- Use GSC/GA4/CrawlObserver/Payload evidence through Paperclip plugin tools.
- Separate evidence from inference.
- Create or update deduplicated follow-up issues for:
  - `technical_fix`
  - `indexing_fix`
  - `internal_linking`
  - `related_posts`
  - `content_refresh`
  - `title_meta_ctr`
  - `new_page_opportunity`
  - `wrong_landing`
  - `offpage_candidate`
  - `watch`
- Never publish content, edit CMS, or perform outreach directly.
- Treat `content_refresh` as an existing-article SEO/body improvement lane that
  requires relevant keyphrases and SERP value-gap evidence. Do not use it for
  generic editorial blocks, metadata-only edits, internal-link-only changes, or
  relatedPosts-only changes.
- Report to `Chief Marketing Officer`.
- Use wake-on-demand / assignment-driven execution, not idle timer polling.

### 2. Unblock GA4 ecommerce KPI tool path

Update live plugin config for `paperclip.gsc-bing-ga4-mcp-agent-tools`:

- Add `analytics_ecommerce` to `allowedMcpToolNamesCsv`.
- Do not expose secrets or change GA4 property/site constraints.
- Do not restart Postgres.
- Restart/recycle only the app/plugin runtime if required for config reload.

Verification:

- Plugin stays `ready`.
- `analytics_ecommerce` is callable through the Paperclip plugin surface.
- The old blocker on [AST-1417](/AST/issues/AST-1417) is no longer valid.

### 3. Update weekly routine ownership/contract

Move the weekly routine from CMO-owned execution to analyst-owned execution, with CMO remaining the manager/reviewer.

Contract changes:

- Weekly routine creates execution issue assigned to `SEO Performance Analyst`.
- Analyst produces detailed issue evidence and action queue.
- CMO reviews/accepts strategic conclusions and owner-facing summary.
- The routine cannot close as complete unless it either creates/updates action issues or records explicit `watch/cooldown/ignored` decisions with dates.

### 4. Rerun or repair [AST-1417]

After the ecommerce path works:

- Reopen [AST-1417](/AST/issues/AST-1417) or create a narrow continuation issue if reopening would corrupt history.
- Rerun the missing ecommerce KPI package for `2026-06-08..2026-06-14` vs `2026-06-01..2026-06-07`.
- Accept already completed child work:
  - [AST-1418](/AST/issues/AST-1418): indexing package accepted.
  - [AST-1421](/AST/issues/AST-1421): noindex/sitemap fix complete.
- Do not reopen [AST-1420](/AST/issues/AST-1420) unless the ecommerce tool still fails after config fix.
- Finish the joined action queue and detailed report evidence.

### 5. Make tomorrow's cycle self-sufficient

Before the next scheduled run:

- Ensure routine `next_run_at` remains `2026-06-24 09:00 Europe/Kiev`.
- Ensure the assigned analyst is idle/available.
- Ensure no active blocked weekly parent will coalesce tomorrow's run.
- Ensure the routine description names the concrete output artifacts.

### 6. Verify working result

Working result requires:

- `SEO Performance Analyst` exists and is active.
- Weekly routine is active and assigned to the analyst.
- `analytics_ecommerce` is allowed and callable, or a new precise runtime blocker is recorded.
- [AST-1417](/AST/issues/AST-1417) no longer remains blocked on the stale allowlist mismatch.
- A weekly SEO report/action queue issue exists with:
  - CMS publication snapshot
  - GSC comparison
  - GA4 ecommerce/organic KPI result
  - URL Inspection/indexing evidence
  - CrawlObserver/internal-link evidence
  - action queue with issue ids or explicit watch/cooldown decisions
  - Telegram/owner summary contract

## Safety Rules

- Do not restart Postgres.
- Do not edit CMS content as part of this phase.
- Do not send external outreach.
- Do not create LLM timer heartbeats.
- Do not hide missing data as a successful report.
- Keep human-facing output Ukrainian and concise.

## Success Criteria

- [x] New `SEO Performance Analyst` agent exists in production and reports to CMO.
- [x] GSC/Bing/GA4 plugin allows `analytics_ecommerce` execution for Astrogen.
- [x] Weekly SEO routine is analyst-owned and has the action-queue contract.
- [x] [AST-1417](/AST/issues/AST-1417) is either completed or replaced by a narrow continuation issue that completes the same missing result.
- [x] At least one concrete action queue artifact or issue set exists for the weekly cycle.
- [x] No active production run is left hanging.

## Execution Result

Completed on 2026-06-23.

- Created production agent `SEO Performance Analyst`
  (`e6faaf59-5b48-44a8-a637-a39701afeee8`) reporting to CMO.
- Reassigned weekly routine `Weekly Astrogen SEO action cycle`
  (`a3ed0133-5c27-4371-a76a-0508e32237ac`) to the analyst.
- Allowed and verified the GA4 ecommerce path through the live
  `paperclip.gsc-bing-ga4-mcp-agent-tools` plugin.
- Fixed the private Search Console/GA4 MCP `analytics_ecommerce` query shape so
  product-level ecommerce and Organic Search channel ecommerce reports both
  return valid GA4 results.
- Completed [AST-1417](/AST/issues/AST-1417) as a real weekly SEO evidence to
  action loop for 2026-06-15..2026-06-21.
- The loop produced a real technical action item:
  [AST-1855](/AST/issues/AST-1855) -> [AST-1856](/AST/issues/AST-1856), because
  live `/solar` contains a hardcoded runtime `noindex, nofollow`.

Remaining non-SEO-loop blocker:

- [AST-1859](/AST/issues/AST-1859) must provide the real website frontend
  source/deploy path for the current live Vite/Lovable SPA before CTO can
  remove the `/solar` runtime noindex. Local repos, production host paths, and
  available Vicarta GitHub repos were checked; the deployable source for the
  live bundle is not currently attached to Paperclip.
