# Phase 19: Blog Page Registry And Publication Monitor

## Goal

Make `seo_ops` the operational page registry for Astrogen blog work, so published articles, keyword targets, content snapshots, and post-publication performance monitoring are connected in one place.

This phase is now the Astrogen implementation profile for the shared
`SEO_PERFORMANCE_LOOP`, not a separate blog-only monitor. The regular cycle
must connect Payload CMS publishing state, public sitemap discovery, Google
Search Console, GA4, URL Inspection, and CrawlObserver evidence into one
settings-driven loop.

## Current State

- Owner approved all three Wave 1 article topics.
- [AST-755](/AST/issues/AST-755) completed the article briefs for those topics.
- First-pass Stage 59 drafts were produced:
  - [AST-757](/AST/issues/AST-757) for the zodiac-sign article;
  - [AST-758](/AST/issues/AST-758) for the natal-chart article;
  - [AST-759](/AST/issues/AST-759) for the zodiac-compatibility article.
- Stage 61 validation returned all three for focused revision; revision tasks [AST-763](/AST/issues/AST-763), [AST-764](/AST/issues/AST-764), and [AST-765](/AST/issues/AST-765) produced revised drafts.
- Stage 61 revalidation [AST-766](/AST/issues/AST-766), [AST-767](/AST/issues/AST-767), and [AST-768](/AST/issues/AST-768) returned all three revised drafts again. These drafts should not enter owner editorial review or publication until a stricter corrective writing pass closes SEO lock, route/CTA, and analytics handoff blockers.
- Live Postgres `seo_ops` now contains the first Astrogen blog registry seed:
  - 40 blog-related sitemap URLs;
  - 35 blog article pages;
  - 4 category pages;
  - 1 blog index page.
- The 35 article pages are enriched from the public site data source with title, meta description, category, tags, featured image, author metadata, content text, content size, and content hash.
- Keyword target mapping is still pending for existing articles.

## Scope

0. **Operating cadence**
   - Use the shared agency-core `SEO_PERFORMANCE_LOOP` cadence:
     - daily CMS/sitemap/CrawlObserver page discovery;
     - daily fresh-URL indexability checks for new or changed pages;
     - every-3-days product/service/landing/expert URL checks;
     - weekly Wednesday report for the previous Monday-Sunday week after the
       GSC/GA4 freshness delay;
     - monthly or monitoring-window experiment review.
   - Do not create a second blog-only timer that duplicates the shared loop.
   - Thresholds, cooldowns, shortlist sizes, URL class cadence, ignored-noise
     classes, and report recipients must come from settings.

1. **Sitemap discovery**
   - Poll `https://astrogen.com.ua/sitemap.xml` on a schedule.
   - Filter blog URLs from the full sitemap.
   - Detect new, changed, and removed URLs.
   - Store each discovery pass as a `seo_ops.discovery_runs` row.

2. **Page registry**
   - Upsert canonical page rows in `seo_ops.pages`.
   - Maintain project membership in `seo_ops.project_pages`.
   - Classify page type as `blog_index`, `blog_category`, or `blog_article`.
   - Store sitemap lastmod, live status, content hash, and registry completeness.

3. **Content enrichment**
   - Prefer Payload CMS structured data as the primary source for article
     publishing state, draft/readiness counts, category, author, cover image,
     workflow status, and content snapshots.
   - Use public sitemap and live HTML as verification, not as the primary CMS
     publication count when the CMS adapter is available.
   - Fall back to live page metadata extraction only when structured data is unavailable.
   - Store title, H1/title fallback, meta description, category, tags, image, author metadata, content text, and content block count.
   - Do not store secrets, CMS credentials, or raw private API keys in planning docs or Git.

4. **Article opportunity matching**
   - For newly published manual articles, match the URL to the approved article opportunity or Paperclip issue when possible.
   - If no safe match exists, create a human-readable Paperclip task for CMO/SEO review instead of guessing.
   - Attach primary and supporting keyword targets to `seo_ops.page_keyword_targets` only after a match is explicit.

5. **Post-publication monitoring**
   - After a page is registered and matched to keyword targets, enroll it in
     the shared weekly GSC/GA4/indexing/CrawlObserver monitoring loop.
   - Store time-series observations separately from the page registry.
   - Use short decision windows for action recommendations while preserving full historical data.
   - Create follow-up issues automatically for deterministic CMS/indexability
     findings that pass dedupe and cooldown. Route those to `SEO CMS Technical
     Fixer`; do not ask the owner for noindex/canonical/sitemap fixes.

6. **CrawlObserver integration**
   - Consume the latest Astrogen CrawlObserver project crawl through the
     Paperclip adapter/API.
   - Import page status, indexability, canonical, robots/noindex, title/H1/meta,
     internal-link, sitemap-coverage, redirect, structured-data, and resource
     summaries into the SEO loop.
   - Ignore CrawlObserver near-duplicate findings for now; the current detector
     is not reliable enough for automatic action.
   - Use CrawlObserver for technical SEO and internal-linking evidence, while
     Paperclip keeps issue routing, decisions, settings, cooldowns, and history.

7. **Manual publication workflow**
   - Paperclip generates article drafts.
   - Human publishes the article on the site.
   - Discovery detects the new URL.
   - Registry records the page and content snapshot.
   - Matching connects the page to the approved article/keyword cluster.
   - Monitoring starts automatically.

## Acceptance Criteria

- Existing Astrogen blog URLs from the public sitemap are registered in `seo_ops`.
- Existing article rows have content snapshots and stable content hashes.
- A new manually published article appears in `seo_ops.pages` after the next scheduled discovery run.
- New article registration is linked to the approved article opportunity or creates a clear review task when no match is safe.
- Keyword targets for each registered article are explicit: `pending`, `matched`, or `needs_review`.
- Weekly monitoring can read the registry and identify which pages/keywords need rank and GSC checks.
- Weekly Wednesday reporting reads CMS publishing state, GSC, GA4, URL
  Inspection/indexing findings, and CrawlObserver technical summaries from the
  regular loop.
- CrawlObserver and GSC findings create or update deduplicated
  `seo_ops.page_findings` rows before any Paperclip child issue is opened.
- Telegram receives a compact owner-facing summary; detailed weekly SEO
  evidence is delivered by email and/or a reviewable issue document.

## Out Of Scope

- Direct CMS publishing automation.
- Bulk rewriting all existing articles.
- Creating product pages.
- Moving semantic-core ownership into the client portal.

## Verification

- SQL count by page type in `seo_ops.project_pages`.
- SQL sample of enriched blog article rows with title/content hash/content word count.
- Simulated sitemap diff against a fixture or known new URL.
- Paperclip issue created when a new URL cannot be matched to an approved article opportunity.
- Weekly report evidence checklist showing CMS, GSC, GA4, URL Inspection, and
  CrawlObserver acquisition status.
- Sample `seo_ops.page_findings` rows proving dedupe/cooldown for noindex,
  canonical, sitemap, redirect, and status-code classes.
