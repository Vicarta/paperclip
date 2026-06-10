# Phase 34: GSC + CrawlObserver SEO Decision Queue

## Objective

Make Astrogen SEO operations use joined evidence from Google Search Console and CrawlObserver before routing SEO actions.

This phase turns the regular SEO cycle from separate reports into a decision queue:

```text
CMS / sitemap / GSC / URL Inspection / CrawlObserver
-> normalized page and query evidence
-> joined candidate queue
-> deterministic technical/internal-link fixes or strategic SEO decisions
-> implementation
-> monitoring-window review
```

## Scope

- Update the reusable agency-core SEO Performance Loop so GSC and CrawlObserver have distinct required roles.
- Update Astrogen regular SEO cycle contract with explicit action classes and routing rules.
- Update CMO and SEO Performance Analyst contracts so they use the joined queue instead of isolated reports.
- Keep deterministic CMS/indexability/internal-linking/related-post fixes out of HIA.
- Treat CrawlObserver or GSC unavailability as a named acquisition gap when the action class requires that evidence.

## Action Classes

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

## Routing

- `SEO CMS Technical Fixer`: deterministic technical SEO fixes, indexing/CMS fixes, internal-linking, relatedPosts.
- `SEO Performance Analyst`: trend interpretation, CTR/content refresh, wrong-landing, off-page/watch decisions.
- `CMO`: strategic routing, content-wave decisions, new-page opportunity acceptance, off-page lane coordination.
- Content planning lanes: only after validated new-page/article opportunity decisions.

## Non-goals

- Do not duplicate CrawlObserver raw crawl storage in Paperclip.
- Do not store a full GSC/GA4 warehouse in Paperclip.
- Do not ask LLM agents to process raw crawl/page/query dumps.
- Do not use CrawlObserver near-duplicate findings for automated rewrite/merge decisions.

## Acceptance Criteria

- GSC and CrawlObserver evidence roles are documented separately.
- The Astrogen cycle defines joined candidate queue fields.
- Contracts say incomplete source acquisition is a named gap, not a normal complete report.
- Deterministic CMS/internal-link fixes remain owner-free.
- Production config source of truth preserves the CrawlObserver hostname mapping needed by Paperclip containers.
