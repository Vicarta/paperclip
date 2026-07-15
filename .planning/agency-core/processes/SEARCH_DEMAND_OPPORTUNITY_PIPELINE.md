# Search Demand Opportunity Pipeline

## Purpose

This is the canonical Astrogen process for converting search demand into a
measured action. It replaces the standalone SEO Performance Loop scheduler and
prevents topic generation from bypassing query-to-URL ownership analysis.

The native lifecycle is:

`discovered -> evidence_ready -> ownership_review -> action_selected -> delegated -> verified -> measured`

## Retained Source Material

The process preserves the useful algorithms and constraints from:

- `.planning/agency-core/processes/SEO_PERFORMANCE_LOOP.md`;
- `.planning/company/astrogen/CONTENT_PLAN_AND_INTERNAL_LINKING_UA.md`;
- the removed plugin's `README.md`, `docs/schema-design.md`,
  `docs/gsc-and-rank-ingestion-contract.md`, and `docs/dao-contract.md`;
- Phase 14 SEO Blog Content Waves, Phase 34 GSC + CrawlObserver decision queue,
  Phase 35 weekly SEO operationalization, Phase 44 topic refill, Phase 45 SERP
  value-gap refresh, and Phase 47 Winning Structure contracts.

The standalone plugin's unimplemented provider dispatch, instance-scoped state,
duplicate scheduler jobs, and follow-up placeholders are intentionally not
retained.

## Evidence Model

Each opportunity uses a stable fingerprint and keeps append-only Paperclip case
events/documents for provenance. Required evidence is compact and current:

- GSC query, page, impressions, clicks, CTR and position;
- query-to-page conflicts and the current ranking owner;
- semantic-core opportunity/cluster IDs when available, Ukraine geo frequency,
  and frequency source;
- Payload CMS and live-page coverage, canonical/indexability state, and existing
  article/product/service ownership;
- CrawlObserver technical and link-graph findings;
- current SERP shape and competitor coverage when an action needs it;
- GA4 business outcomes as context, never as a replacement for search demand.

Broad astrology demand can be relevant to Astrogen without direct product
binding. It still needs audience relevance, safe ownership, and a plausible
internal path to useful Astrogen content or service discovery.

## Coverage And Ownership

`coverageState` is one of:

- `uncovered`: no Astrogen page safely owns the query cluster;
- `weak_owner`: one intended page exists but under-serves the intent;
- `covered`: one page already satisfies the intent;
- `conflicting`: two or more pages compete for substantially the same intent.

Ownership review compares title, H1, heading tree, main-content purpose, query
overlap, GSC rankings, canonical state, and incoming/outgoing internal links.
Similarity alone is not cannibalization; conflicting intent ownership and search
evidence are required.

## Action Selection

Exactly one action is selected:

| Action | When it is valid | Execution lane |
| --- | --- | --- |
| `new_article` | Uncovered demand, safe ownership, sufficient evidence | Guarded native breakdown to `astrogen-topic-inventory` |
| `refresh` | Existing owner is correct but lacks SERP/user value | Winning Structure refresh through article production |
| `merge` | Multiple pages split one intent and one stronger owner is possible | Growth action with redirect/canonical/content/link migration |
| `reposition` | Existing page targets the wrong primary intent | Growth action with new ownership, metadata/content and monitoring plan |
| `internal_link` | Content exists but discovery/authority flow is weak | Growth action with exact source, target, anchor and rendered verification |
| `technical` | Indexability, canonical, sitemap, rendering or metadata blocks ownership | Technical growth action / developer handoff |
| `no_action` | Evidence is weak, demand is covered, or action is unsafe | Cooldown with reason and `nextReviewAt` |

Only `new_article` may create a topic candidate. After the decision is durable,
the opportunity advances to `delegated`; native breakdown there creates the
topic child and waits for its terminal outcome before verification. The topic
intake API therefore requires a parent opportunity at `delegated` with
`selectedAction=new_article`. Agents and routines cannot create valid topic
candidates directly.

## Internal Linking And Cannibalization

A new article must define before topic validation:

- its primary owner query cluster and queries it must not target;
- at least one plausible incoming link source and contextual anchor role;
- outgoing links to the correct service/product/expert or supporting owner;
- anchor diversity and a rule against changing another page's primary owner;
- post-delivery rendered link and link-graph verification.

For cannibalization:

- `merge` chooses the surviving URL, redirect map, canonical, sitemap update,
  content migration, incoming-link migration, rollback path, and monitoring;
- `reposition` changes one page's primary intent and preserves the other owner;
- `internal_link` clarifies hierarchy when content overlap is acceptable;
- `no_action` is used when apparent overlap has no ranking or intent conflict.

## Weekly Policy

The weekly SEO/GEO cycle uses the completed Wednesday-Tuesday Europe/Kiev
window and compares it with the previous window. It treats the latest two source
days as provisional when provider latency applies.

The cycle applies hold/watch/benchmark/action logic rather than reacting to one
small weekly delta. A decline triggers SERP/ownership evidence before refresh.
Stable or low-volume signals remain on watch with a review date.

Cloudflare email-protection probe URLs are ignored. Near-duplicate and zero-word
JavaScript findings require rendered confirmation. Deterministic canonical,
noindex, sitemap, redirect and metadata findings may route directly to a
technical lane without asking the owner.

Detailed reports are simple Ukrainian HTML email through
`paperclip.email-notifications:email-seo-weekly-report-send`; Telegram remains
summary-only and is not a technical log channel.

## Verification And Measurement

Task closure is not proof. Verification is action-specific:

- article: guarded topic/article chain, CMS draft and delivery proof;
- refresh: before-after value diff and unchanged media unless scoped;
- merge/reposition: production canonical, redirect, sitemap, ownership and link
  migration evidence;
- internal link: rendered source/target/anchor and updated graph evidence;
- technical: exact affected URLs and post-deploy checks.

Every action records a baseline, measurement window, result and next review.
A blocked action affects only its own dependency chain and never stops unrelated
safe opportunities.
