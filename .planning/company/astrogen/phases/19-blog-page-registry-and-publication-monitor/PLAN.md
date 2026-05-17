# Phase 19: Blog Page Registry And Publication Monitor

## Goal

Make `seo_ops` the operational page registry for Astrogen blog work, so published articles, keyword targets, content snapshots, and post-publication performance monitoring are connected in one place.

## Current State

- Owner approved all three Wave 1 article topics.
- [AST-755](/AST/issues/AST-755) completed the article briefs for those topics.
- Stage 59 article-writing tasks are open:
  - [AST-757](/AST/issues/AST-757) for the zodiac-sign article;
  - [AST-758](/AST/issues/AST-758) for the natal-chart article;
  - [AST-759](/AST/issues/AST-759) for the zodiac-compatibility article.
- Live Postgres `seo_ops` now contains the first Astrogen blog registry seed:
  - 40 blog-related sitemap URLs;
  - 35 blog article pages;
  - 4 category pages;
  - 1 blog index page.
- The 35 article pages are enriched from the public site data source with title, meta description, category, tags, featured image, author metadata, content text, content size, and content hash.
- Keyword target mapping is still pending for existing articles.

## Scope

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
   - Prefer structured CMS/public site data when available.
   - Fall back to live page metadata extraction only when structured data is unavailable.
   - Store title, H1/title fallback, meta description, category, tags, image, author metadata, content text, and content block count.
   - Do not store secrets, CMS credentials, or raw private API keys in planning docs or Git.

4. **Article opportunity matching**
   - For newly published manual articles, match the URL to the approved article opportunity or Paperclip issue when possible.
   - If no safe match exists, create a human-readable Paperclip task for CMO/SEO review instead of guessing.
   - Attach primary and supporting keyword targets to `seo_ops.page_keyword_targets` only after a match is explicit.

5. **Post-publication monitoring**
   - After a page is registered and matched to keyword targets, start the weekly GSC/rank monitoring loop.
   - Store time-series observations separately from the page registry.
   - Use short decision windows for action recommendations while preserving full historical data.

6. **Manual publication workflow**
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
