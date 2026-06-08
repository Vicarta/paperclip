# Phase 14: SEO Report Channels And CrawlObserver Finding Policy

## Goal

Make SEO reporting and CrawlObserver follow-up deterministic enough that agents do
not spend LLM tokens re-deciding the same operational rules.

Telegram remains the short owner notification channel. Detailed SEO reports move
to email, with Paperclip issue documents as the fallback when email transport is
not configured.

## Context

Astrogen weekly SEO reports became too large for Telegram once publishing, GSC,
GA4, indexing, CrawlObserver, and experiment planning were combined. The owner
still wants Telegram for short situational awareness, but detailed tables and
appendices should arrive by email.

CrawlObserver is now a recurring technical crawl source. Its data should create
tasks automatically for deterministic CMS/indexability problems, but should not
create noise for known bad classes such as Cloudflare email-protection URLs or
CrawlObserver near-duplicate suggestions.

## Scope

In scope:

- add reusable SEO loop settings for report delivery channels;
- expose a plugin tool that returns the weekly report window, comparison window,
  Telegram digest policy, and detailed-report email policy;
- expose a plugin tool that classifies CrawlObserver findings into:
  - automatic technical task candidate;
  - ignored by policy;
  - record-only evidence;
- set weekly SEO jobs to Wednesday because GSC/GA4 data has a practical delay;
- document the owner-facing channel split;
- add tests for report-window/channel policy and finding routing.

Out of scope:

- implementing SMTP/Resend delivery inside this phase;
- building the detailed dashboard UI;
- replacing GSC/GA4 MCP acquisition;
- asking CMO to manually triage every CrawlObserver finding.

## Decisions

- Telegram gets only the compact owner digest.
- Email gets the detailed report: KPI tables, page/query movements, GA4
  breakdowns, indexing findings, experiments, cooldowns, and monitoring dates.
- If email recipients are not configured, the detailed report must stay as a
  Paperclip issue document and must not be pushed into Telegram.
- CrawlObserver near-duplicates are ignored by policy for now.
- Cloudflare `/cdn-cgi/l/email-protection` 404 findings are ignored by policy.
- JS zero-word artifacts are ignored unless confirmed by rendered HTML or another
  approved source.
- Deterministic CMS/indexability findings route to `SEO CMS Technical Fixer`.
- Cooldowns and automatic shortlist limits are settings, not prompt memory.

## Implementation

1. Extend `plugin-seo-performance-loop` configuration with:
   - report timezone and data-delay metadata;
   - Telegram digest hard cap;
   - detailed report channel and recipient list;
   - automatic finding task routing settings;
   - ignored-noise toggles;
   - cooldown and max-per-run settings.
2. Add `seo-weekly-report-plan-get`.
3. Add `seo-crawl-finding-route-plan`.
4. Update plugin jobs to run Wednesday UTC.
5. Update README/process docs.
6. Add tests for the policy module and tool exposure.

## Acceptance Criteria

- Agents can call one tool to know that Telegram is summary-only and email is
  the detailed-report channel.
- The weekly report window for a Wednesday run covers the previous full
  Monday-Sunday week and compares it to the week before.
- Known CrawlObserver noise is ignored without LLM review.
- Missing meta/canonical/noindex/sitemap/redirect findings are routed as
  deterministic technical tasks.
- The plugin test suite passes.
