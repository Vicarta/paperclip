---
phase: 45
name: serp-value-gap-content-refresh
status: executed
created: 2026-07-09
depends_on: [14, 34, 35, 44]
subsystem: paperclip-astrogen-clean
tags: [paperclip, astrogen, seo, content-refresh, serp, workflow-contracts]
---

# Phase 45: SERP Value-Gap Content Refresh

## Objective

Make `content_refresh` a first-class SEO improvement lane that increases the
article's search value after SERP analysis.

Content refresh is not an editorial/layout backfill. It must not mean "add
`Коротко`", "add FAQ", "add CTA", "add related posts", or "add a comparison
block" as generic checklist work. Those may exist only when the SERP value-gap
analysis proves they are the right way to add missing user value.

## Problem

Phase 44 correctly stopped article cadence when topic inventory had zero safe
ready topics. The proposed recovery path included improving existing articles,
but that can be misread as mechanical editorial block insertion.

That is wrong for Astrogen SEO. Existing article improvement must begin with
relevant keyphrases and SERP competitors, then identify what the current article
does not answer or prove well enough.

## Decision

Introduce a bounded `serp_value_gap_content_refresh` workflow.

It is allowed when:

- no safe new topic exists, but an existing article can be improved for a
  relevant keyphrase cluster;
- weekly SEO/GEO evidence identifies a page/query opportunity where a refresh is
  better than a new article;
- a topic is rejected for duplication/cannibalization, but one existing article
  can safely absorb the missing user intent.

It is not allowed for:

- generic editorial insert backfill;
- missing layout blocks in new article delivery;
- deterministic CMS metadata, relatedPosts, or internal-link-only updates;
- creating a disguised duplicate article.

## Workflow Contract

### Input

Each refresh candidate must include:

- current CMS article id, title, slug, and draft/published state;
- target keyphrase cluster with primary and supporting phrases;
- current GSC evidence when available;
- current CMS/public article snapshot or refetch evidence;
- top SERP competitors for the relevant keyphrases;
- duplicate/cannibalization check against existing Astrogen articles and service
  pages;
- reason why refreshing the existing article is better than creating a new one.

### Required SERP Value-Gap Artifact

Before any rewrite task starts, the responsible SEO agent must produce a compact
artifact with:

- queries checked, geo/language, date, and provider/tool;
- top competing pages with URL/title/snippet or equivalent safe summary;
- common competitor coverage patterns;
- missing user questions or decision criteria;
- claims, framing, or promises Astrogen must avoid;
- the specific information-gain angle Astrogen can add;
- exact sections/paragraphs that need substantive improvement;
- whether an FAQ, comparison section, CTA change, relatedPosts update, or
  structured block is justified by the value gap.

### Output

A refresh task is complete only when it returns:

- the SERP value-gap artifact;
- a before/after change plan tied to the artifact;
- the updated article body/content package or a precise CMS update handoff;
- evidence that the changes add search/user value beyond current competitors;
- preserved title/H1/schema/metadata unless the refresh issue explicitly
  includes title/meta CTR work;
- a validator decision that the result is not generic editorial padding.

## Agent Ownership

| Responsibility | Owner |
| --- | --- |
| Route refresh vs new topic vs watch | Chief Marketing Officer |
| SERP/value-gap analysis | MKT Competitive Intelligence Analyst or SEO Blog Content Strategist |
| Refresh brief / change plan | MKT Blog Brief Strategist or SEO Blog Content Strategist |
| Article body update | SEO Blog Article Writer (Claude) or a designated refresh writer lane |
| Validation | SEO Blog Article Validator / SEO Blog Content Plan Validator |
| CMS deterministic update | SEO CMS Technical Fixer |

CEO/CMO remain managers. They route and control work; they do not personally do
SERP analysis, writing, CMS mutation, or technical repair.

## Contract Changes To Apply

1. Add `serp_value_gap_content_refresh` to clean workflow manifests.
2. Update article allocator contract:
   - if refill returns zero ready topics, close no-slot only after checking
     whether a bounded refresh candidate should be routed;
   - do not create refresh tasks from the allocator unless the current cadence
     scope allows refresh recovery.
3. Update weekly SEO/GEO routine contract:
   - `content_refresh` requires SERP value-gap evidence;
   - route editorial/layout defects separately from SEO refresh.
4. Update live/source AGENTS.md for:
   - Chief Marketing Officer;
   - SEO Blog Content Strategist;
   - SEO Blog Content Plan Validator;
   - MKT Competitive Intelligence Analyst;
   - MKT Blog Brief Strategist;
   - SEO Blog Article Writer (Claude);
   - SEO Blog Article Validator;
   - SEO Performance Analyst.
5. Preserve existing editorial/layout backfill rules, but clearly mark them as
   not the `content_refresh` lane.

## Verification

- Clean app health is OK after live contract sync.
- Source manifests and bootstrap contain `serp_value_gap_content_refresh`.
- Live clean AGENTS.md files contain the SERP value-gap refresh rule.
- Live routine descriptions for article cadence and weekly SEO/GEO distinguish:
  - `content_refresh` = SERP/value-gap body improvement;
  - `editorial_backfill` = layout/reader-structure defect repair;
  - `related_posts` and metadata = deterministic CMS/SEO fix lanes.
- No image generation, CMS publishing, Telegram proactive watch, or old
  Paperclip change is performed.

## Acceptance Criteria

- A zero-ready topic result can lead to a useful existing-article refresh lane
  only when SERP evidence proves a value gap.
- Refresh tasks no longer describe success as generic insertion of `Коротко`,
  FAQ, CTA, comparison, internal links, or related posts.
- If those elements are used, the task must explain the SERP/user-value reason.
- Agents can route refresh work without asking the owner to solve technical
  details or manually choose SEO implementation mechanics.
