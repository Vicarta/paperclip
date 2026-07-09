# Phase 36: SEO Linking And Off-Page Proposals

## Objective

Turn the weekly SEO report into concrete owner-reviewable proposals for:

- internal contextual links;
- Payload CMS `relatedPosts` experiments;
- product/service/blog hub links;
- external link acquisition candidates.

This phase exists because the 2026-06-24 weekly SEO run produced useful
technical and metadata work, but did not produce explicit internal-linking or
off-page proposals.

## Live Input

- Latest weekly issue: `Weekly Astrogen SEO action cycle`
  (`8d2f9acd-7f10-479e-9359-28b36318ebd6`).
- Target week: `2026-06-15..2026-06-21`.
- Comparison week: `2026-06-08..2026-06-14`.
- Current routed actions:
  - `/experts/taro` technical/canonical issue;
  - `/relationships` title/meta CTR refresh;
  - `/solar` noindex blocker;
  - fresh blog posts on watch until `2026-07-08`.

## Required Output Today

Create a live Paperclip issue assigned to `SEO Performance Analyst` requiring an
owner-facing Ukrainian proposal package before the end of 2026-06-24 Kyiv time.

The package must include:

1. Internal-linking opportunities.
   - target URL;
   - source URL candidates;
   - proposed anchor/placement;
   - change type: body link, hub/product link, or `relatedPosts`;
   - evidence from GSC, GA4, CrawlObserver, Payload CMS, or explicit gap;
   - monitoring KPI and date.
2. External link acquisition candidates.
   - target URL/page cluster;
   - why authority may be the limiting factor;
   - acceptable donor/site categories;
   - forbidden donor categories;
   - anchor policy;
   - rough priority/budget band;
   - approval requirement before any purchase or outreach.
3. Follow-up routing.
   - create or update internal-linking implementation issues when evidence is
     strong enough;
   - create an off-page approval/recommendation issue for CMO review;
   - mark weak candidates as watch with a date and reason.

## Contract Hardening

Update the recurring weekly SEO contract after the live task is created:

- weekly completion is not enough when it creates only technical/metadata work;
- the action queue must include a separate `internal_linking/related_posts`
  section and a separate `offpage_candidate` section;
- if no candidates qualify, the issue must explicitly say why, with evidence
  and next review date.

## Safety

- Do not buy links or send outreach automatically.
- Do not edit CMS content directly from the analyst task.
- Current access limitation: Paperclip agents and the owner do not have a
  working edit/deploy path for Astrogen product pages, service pages, expert
  pages, or any non-blog website pages. Agents may propose non-blog targets, but
  they must not assume they can edit those pages.
- If internal linking requires adding or changing links from any page outside
  `/blog/`, create a technical task for a human/runtime operator with the
  required website access. Blog-origin links and Payload CMS `relatedPosts`
  remain normal CMS/Payload lanes.
- Do not invent metrics when GSC/GA4/CrawlObserver/Payload evidence is absent.
- Keep owner-facing text in Ukrainian and avoid internal slang.
