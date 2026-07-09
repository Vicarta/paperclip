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

The weekly Wednesday SEO cycle must therefore be treated as an active SEO work
cycle, not as a report-only routine. The owner-facing Telegram message is only
the digest; the operational output is the joined decision queue plus created or
updated follow-up issues.

## Scope

- Update the reusable agency-core SEO Performance Loop so GSC and CrawlObserver have distinct required roles.
- Update Astrogen regular SEO cycle contract with explicit action classes and routing rules.
- Update CMO and SEO Performance Analyst contracts so they use the joined queue instead of isolated reports.
- Keep deterministic CMS/indexability/internal-linking/related-post fixes out of HIA.
- Treat CrawlObserver or GSC unavailability as a named acquisition gap when the action class requires that evidence.
- Require the weekly cycle to evaluate internal-linking and related-post
  opportunities from joined GSC + CrawlObserver evidence and create measurable
  experiments when configured thresholds pass.

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

## Weekly Internal-Linking Experiment Requirement

Every weekly cycle must evaluate:

- pages with GSC impressions/clicks, declining trend, low CTR, or high business
  value;
- current internal links and related-post state from CrawlObserver/Payload CMS;
- internal PageRank and weak-link/orphan evidence from CrawlObserver;
- relevant adjacent articles, not only same-category articles.

When evidence supports action, CMO/SEO Performance Analyst must route a child
issue with one of these action classes:

- `internal_linking`: add or adjust contextual links in body/article content;
- `related_posts`: set or refresh Payload CMS `blogPosts.relatedPosts`;
- `content_refresh`: improve an existing article's body/content after relevant
  keyphrase and SERP value-gap analysis proves missing user value that internal
  links or related posts cannot solve;
- `watch`: no change now, with a specific monitoring date and reason.

Internal-linking and related-post changes are experiments. Each issue must
record the target URL/article, proposed source pages or related post ids,
baseline GSC/GA4/CrawlObserver evidence, monitoring window, and the expected
decision after the window: continue, expand, adjust, or revert.

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
- Weekly run completion requires a created/updated action queue, not only a
  Telegram/email report.
- Production config source of truth preserves the CrawlObserver hostname mapping needed by Paperclip containers.
