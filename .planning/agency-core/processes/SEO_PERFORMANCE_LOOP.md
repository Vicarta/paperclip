# SEO Performance Loop

## Purpose

This document defines the proposed SEO Performance Loop for Paperclip-managed client work.

The loop is not only a monitoring system for existing articles. It is an operational SEO system that:

- discovers pages even when they were not created through Paperclip;
- maps pages into company/project-specific SEO ownership scopes;
- accumulates real Google Search Console query evidence;
- grows the semantic core from observed demand;
- detects optimization and new-page opportunities;
- routes work into separate agent issues for validation, planning, implementation, and monitoring;
- handles new products with a structured SEO launch package.

The design is multi-company and multi-project by default. A single domain or URL may be relevant to several Paperclip projects under different rules.

## Core Principles

1. **Page existence is not the same as SEO ownership.**
   A URL exists on a site, but ownership belongs to a specific Paperclip company/project scope.

2. **GSC is a discovery engine, not only a reporting source.**
   Real queries from Google Search Console must feed keyword observations, semantic-core candidates, page keyword targets, and new-page opportunities.

3. **Primary keyword is necessary but insufficient.**
   Each project page needs a keyword target set: primary, secondary, semantic-cluster, GSC-discovered, opportunity, and business-priority terms.

4. **Rank tracking is policy-driven.**
   Tracking frequency and provider spend are controlled by company/project/keyword tier policy, not hardcoded agent judgement.

5. **MCP/provider runs create evidence; Paperclip owns operational state.**
   MCP servers may own raw artifacts and provenance. Paperclip DB owns accepted operational SEO state, decisions, tasks, monitoring, and budgets.

6. **SEO actions must be separated into child lanes.**
   Generation, validation, routing/planning, implementation, and monitoring should be separate child issues unless explicitly marked as a small smoke test.

7. **Report channel must match report size.**
   Telegram is for short owner digests and alerts. Detailed weekly SEO reports
   with tables, page/query appendices, technical findings, experiment rationale,
   and monitoring notes should be delivered by email. If email delivery is not
   configured, keep the detailed report as a Paperclip issue document and send
   only a compact Telegram summary. Email is considered configured only when
   recipients, a sender address, and a Resend API key secret reference are set;
   raw API keys must never be written into plugin config, issues, docs, or Git.

## Multi-Tenant Data Model

### Persistence Location

SEO Performance Loop state should live in the existing Paperclip Postgres database under a dedicated schema:

```text
seo_ops
```

Recommended table naming:

```text
seo_ops.sites
seo_ops.project_scopes
seo_ops.pages
seo_ops.project_pages
seo_ops.keywords
seo_ops.keyword_observations
seo_ops.page_keyword_targets
seo_ops.performance_snapshots
seo_ops.rank_tracking_policies
```

Do not create a separate database for MVP because SEO agents need operational joins with Paperclip companies, projects, issues, plugin runs, heartbeat runs, and cost events.

Do not use prefix-only tables in `public` unless Drizzle/schema tooling blocks `seo_ops`; if used, treat it as a temporary fallback with a migration path back to `seo_ops`.

Recommended operational tables:

| Table | Purpose |
|---|---|
| `seo_ops.sites` | Site identity inside a company. Same domain in another company is a separate row. |
| `seo_ops.project_scopes` | Project-level rules: domain, include/exclude paths, geo, language, device, page types, ownership mode, priority. |
| `seo_ops.discovery_runs` | Immutable run records for sitemap, GSC, crawl, manual import, or CMS discovery jobs. |
| `seo_ops.pages` | Canonical URL registry for a company/site. Populated by sitemap, GSC, crawl, manual import, or CMS events. |
| `seo_ops.project_pages` | Project-specific membership and ownership for a page. This is the operational unit for SEO work. |
| `seo_ops.keywords` | Canonical normalized keyword universe. |
| `seo_ops.keyword_observations` | Raw evidence from GSC, rank providers, semantic-core MCP, SERP tools, or manual review. |
| `seo_ops.semantic_core_runs` | Imported MCP semantic-core run metadata, artifacts, provider versions, and cost summary. |
| `seo_ops.semantic_core_memberships` | Keyword membership in core/layer/cluster: candidate, accepted, parked, rejected, needs_review. |
| `seo_ops.clusters` | Operational cluster registry imported from semantic-core MCP or created by SEO agents. |
| `seo_ops.keyword_cluster_memberships` | Many-to-many keyword-to-cluster membership. |
| `seo_ops.page_keyword_targets` | Project-page keyword targets by geo/language/device/tier/source/status. |
| `seo_ops.rank_tracking_policies` | Company/project/keyword-tier tracking frequency, provider, budget, and temporary-watch rules. |
| `seo_ops.rank_tracking_targets` | Concrete scheduled rank checks derived from keyword target and policy rows. |
| `seo_ops.performance_snapshots` | Time-series page/query/rank/GSC snapshots scoped to project page and keyword target. |
| `seo_ops.indexing_inspection_snapshots` | Durable normalized GSC URL Inspection evidence for URLs Paperclip checks through MCP/provider tools. |
| `seo_ops.page_findings` | Deduplicated operational page findings across indexing, canonical, redirect, noindex, sitemap, schema, duplicate, and technical checks. |
| `seo_ops.new_page_opportunities` | Validated or pending opportunities where observed demand lacks a good landing page. |
| `seo_ops.page_action_events` | Change history: created, refreshed, title/meta changed, internal links added, republished, etc. |
| `seo_ops.scope_conflicts` | Cases where multiple project scopes claim the same URL in conflicting ways. |

### Identity Rules

Use explicit tenancy on every operational SEO table:

```text
company_id
project_id where applicable
site_id where applicable
```

Do not use `domain + url` alone as ownership identity.

Recommended page identity:

```text
seo_pages:
  company_id + site_id + canonical_url_normalized

seo_project_pages:
  company_id + project_id + page_id
```

Recommended keyword identity:

```text
normalized_keyword + language_code + location_code + device_context
```

Observation identity is not keyword identity. One keyword can have many observations from many sources and runs.

## Project Scope And Domain Overlap

Different projects may work on different parts of one site or even the same page under different rules.

`seo_project_scopes` should support:

- `domain`
- `site_scope_prefix`
- `include_path_patterns`
- `exclude_path_patterns`
- `language_code`
- `location_code`
- `device_context`
- `page_type_filter`
- `ownership_mode`: `owned`, `shared`, `observe_only`, `excluded`
- `priority`
- `conflict_policy`

When daily discovery finds a URL:

1. Upsert the URL into `seo_pages`.
2. Evaluate it against all active `seo_project_scopes` for the same company/site.
3. Create or update `seo_project_pages`.
4. If several projects match:
   - `observe_only + owned` is allowed.
   - `shared + shared` is allowed if the rule permits.
   - `owned + owned` creates `seo_scope_conflicts`.
5. Conflicts block implementation/edit actions until resolved by a manager or human.

## Daily Page Discovery

Pages can appear outside Paperclip. Therefore discovery must not depend on Paperclip publication events.

Daily discovery sources:

- `sitemap.xml` and sitemap indexes;
- GSC pages report;
- optional CMS/public crawl;
- manual imports;
- Paperclip publication events when available.

Discovery should update:

- `first_seen_at`
- `last_seen_at`
- `sitemap_lastmod`
- `source`
- `discovery_status`
- `last_discovery_run_id`

## Page Enrichment

Sitemap presence does not prove indexability or good SEO state.

Enrichment should check:

- HTTP status;
- redirects;
- canonical URL;
- `noindex`;
- robots constraints when available;
- title;
- H1;
- meta description;
- language;
- schema/structured data;
- content type;
- internal canonical consistency;
- product/category inference.

Enrichment cadence can be lower than sitemap discovery unless a page is new, changed, declining, or in temporary watch.

## CrawlObserver Finding Routing

CrawlObserver is a provider/acquisition layer. It can crawl the site and expose
technical evidence, but Paperclip owns task routing, decisions, cooldowns, and
issue lifecycle.

Default automatic routing:

- create technical fix tasks for deterministic CMS/indexability findings:
  missing meta descriptions, canonical mismatch, noindex, sitemap visibility,
  redirects, and route/canonical category problems;
- route those tasks to `SEO CMS Technical Fixer`;
- do not ask the owner for deterministic CMS SEO fixes;
- apply the configured cooldown before reopening an equivalent finding.

Default ignored-noise policy:

- ignore Cloudflare `/cdn-cgi/l/email-protection` 404 URLs;
- ignore CrawlObserver near-duplicate findings until a better duplicate detector
  is approved;
- ignore JS zero-word artifacts unless rendered HTML or another approved source
  confirms the issue.

Automatic shortlist limits, cooldowns, ignored-noise toggles, and the target
technical-fixer agent are settings. They must not live only in agent prompt text.

## GSC URL Inspection And Page Findings

URL Inspection is operational evidence, not a replacement for the page registry.

Use existing tables this way:

1. Register page existence in `seo_ops.pages`.
2. Register project SEO ownership in `seo_ops.project_pages`.
3. Record each audit acquisition as `seo_ops.discovery_runs.source = 'gsc_url_inspection'`.
4. Store normalized URL Inspection results in `seo_ops.indexing_inspection_snapshots`.
5. Update deduplicated lifecycle state in `seo_ops.page_findings`.

`seo_ops.indexing_inspection_snapshots` stores provider evidence for one checked URL at one time:

- inspected URL and normalized URL;
- verdict, coverage state, indexing state, fetch state, robots state;
- Google-selected canonical and user-declared canonical;
- last crawl time and inspection result link;
- cache hit/API call/quota metadata from the acquisition layer;
- compact normalized payload plus optional raw payload reference or hash.

`seo_ops.page_findings` is the durable decision surface for agents:

- one open finding per fingerprint;
- generic finding types such as `indexing`, `canonical`, `redirect`, `noindex`, `sitemap`, `duplicate`, `schema`, and `technical`;
- lifecycle statuses: `open`, `acknowledged`, `resolved`, `ignored`;
- latest evidence snapshot and optional linked Paperclip issue.

LLM agents should not reason over raw per-URL inspection payloads. Backend/plugin code should write snapshots and update findings deterministically, then return compact summaries:

- checked URL count;
- new findings;
- resolved findings;
- repeated open findings;
- findings already linked to open issues;
- API/cache usage.

## GSC Query Ingestion

GSC imports should collect page/query evidence for each active project scope.

For each row, store raw evidence in `seo_keyword_observations`:

- raw query;
- normalized query;
- page URL;
- company/project/site/page mapping;
- date range;
- clicks;
- impressions;
- CTR;
- average position;
- country;
- device;
- search appearance if available;
- import run id;
- source = `gsc`;
- evidence status.

Important rules:

- A GSC query is not automatically an accepted keyword.
- Zero/null/unavailable volume from other providers must not reject a GSC-supported query.
- Raw query must be preserved even if normalized keyword differs.
- Observations should be deduplicated by source/date/page/query dimensions.

## GSC To Semantic Core Flow

GSC must continuously expand the semantic universe.

Recommended flow:

1. Import GSC query observations.
2. Normalize and match against existing `seo_keywords`.
3. If missing, create a keyword candidate.
4. Attach the observation to the project page.
5. Classify relevance:
   - relevant to current page;
   - relevant to another existing page;
   - relevant but no good landing page;
   - adjacent/topic-expansion candidate;
   - irrelevant/noise;
   - needs human review.
6. Add candidate to semantic-core membership as `candidate`, `needs_review`, `parked`, or `accepted` according to rules.
7. Promote only after validation or trusted automation thresholds.

## Page Keyword Target Set

For each `seo_project_page`, maintain a target set in `seo_page_keyword_targets`.

Target types:

- `primary`: main keyword for the page.
- `secondary`: close variants and important supporting terms.
- `cluster`: keywords imported from semantic core clusters.
- `gsc_discovered`: real GSC queries landing on the page.
- `opportunity`: queries with meaningful impressions/clicks/ranking potential.
- `business_priority`: commercially important terms, including low-volume long-tail.
- `temporary_watch`: terms tracked more frequently after content changes.

Statuses:

- `candidate`
- `accepted`
- `parked`
- `rejected`
- `needs_review`

Primary is required for planned SEO pages when known, but monitoring and opportunity discovery must work even when primary is missing.

## Landing Fit And New Page Opportunities

Some GSC queries may be relevant to the audience but land on the wrong page or no good page.

For each meaningful GSC query, evaluate landing fit:

| State | Meaning | Action |
|---|---|---|
| `good_fit` | Current page satisfies intent | Monitor or optimize CTR if needed |
| `weak_fit` | Current page is relevant but incomplete | Create optimization/refresh task |
| `wrong_fit` | Query lands on a page with mismatched intent | Evaluate new page or reroute internal linking |
| `no_landing_page` | No existing page should own the query | Create new-page opportunity |
| `cannibalized` | Several pages compete for same intent | Create cannibalization review |

`seo_new_page_opportunities` should include:

- query/keyword id;
- evidence from GSC;
- current accidental landing URL if any;
- impressions/clicks/CTR/position;
- intent;
- audience relevance;
- topical-authority fit;
- product/category relation;
- business value;
- proposed page type;
- suggested priority;
- validation status;
- linked content-plan issue when created.

## New Page Opportunity Validation

Before a new page is added to the content plan, validate:

- relevance to target audience;
- fit with topical authority;
- relationship to product/category;
- whether existing page refresh would be better;
- cannibalization risk;
- commercial or lifecycle value;
- evidence quality and seasonality;
- language/geo/device match;
- expected internal-linking target.

Possible decisions:

- create new SEO traffic article;
- create beginner/support article;
- create product support page;
- create FAQ/tool page;
- add section to existing page;
- merge/canonicalize;
- park for later;
- reject as noise.

## Blog Article Opportunities And Waves

For blog-only SEO work, Paperclip should not convert every accepted keyword into
an article. The planning unit is an article opportunity:

```text
validated semantic-core keywords
-> article opportunities
-> shortlisted SERP-checked clusters
-> paced content waves
-> published articles
-> performance feedback
```

An article opportunity should include:

- primary keyword;
- supporting keywords;
- source semantic-core layers and GSC observations;
- SERP grouping status;
- normalized geo/global cluster demand;
- raw per-keyword volume evidence for transparency;
- content role;
- proposed article type;
- internal-linking target;
- human priority;
- lifecycle status;
- validation notes.

Do not treat cluster demand as a naive sum of all keyword volumes. Close
variants often share the same demand. Use a normalized score such as:

```text
cluster_demand_score =
  primary_keyword_geo_volume
  + weighted_unique_variant_volume
  + GSC evidence boost
  + seasonality boost
  + strategic priority boost
```

Human-facing output should show demand classes and evidence, for example:

- Ukraine demand: high / medium / low / unknown;
- global demand: high / medium / low / unknown;
- primary keyword volume;
- supporting keyword volume table;
- note that cluster demand is normalized, not a raw sum.

Human priority belongs at the opportunity or topic-family level. Recommended
states:

- `high`;
- `normal`;
- `low`;
- `do_not_plan`;
- `pin_next_wave`;
- `pause_temporarily`.

## Content Roles And Wave Mix

Blog waves should build a traffic portfolio rather than only selecting the
largest-volume topics.

Use these content roles:

| Role | Purpose |
|---|---|
| `reach` | broad traffic and awareness |
| `trust` | trust-building and expectation setting |
| `expertise` | deeper topical authority |
| `objection_handling` | answers to doubts, risks, and objections |
| `conversion_support` | supports later applications, consultations, products, signups, or purchases |

The strategic order is:

```text
reach -> trust -> expertise -> objection_handling -> conversion_support
```

But the operational mix should be progressive, not strictly single-role. Early
waves can be reach-heavy, then gradually add trust, expertise, objections, and
conversion support.

Recommended default mix:

| Stage | Reach | Trust | Expertise | Objections | Conversion |
|---|---:|---:|---:|---:|---:|
| Early | 70% | 20% | 10% | 0% | 0% |
| Middle | 50% | 25% | 15% | 10% | 0% |
| Mature | 35% | 20% | 20% | 15% | 10% |

Default wave settings should be company-configurable:

```json
{
  "cadence": "weekly",
  "new_articles_per_wave": 3,
  "refreshes_per_wave": 1,
  "brief_buffer_weeks": 2,
  "selection_pool_multiplier": 4,
  "max_same_template_family_per_wave": 2,
  "min_monitoring_weeks_before_refresh": 4,
  "planning_horizon_weeks": 8
}
```

Suggested wave score:

```text
wave_score =
  cluster_demand_score
  + strategic_stage_fit
  + topical_authority_value
  + internal_linking_value
  + human_priority_boost
  + seasonality_boost
  - cannibalization_risk
  - similarity_penalty
  - operational_repetition_penalty
```

## SERP-Based Grouping Boundary

SERP-overlap checks are valuable but should be bounded by cost and operational
need. Do not run expensive SERP similarity analysis for the entire semantic core
by default.

Recommended flow:

1. Treat MCP semantic-core clusters as preliminary groups.
2. Build a shortlist for the next wave pool, usually
   `new_articles_per_wave * selection_pool_multiplier`.
3. Run SERP similarity for shortlisted candidates and ambiguous cluster
   boundaries.
4. Split or merge opportunities based on SERP overlap, user intent, expected
   page type, and template-family policy.
5. Store SERP evidence with the article opportunity.

One article cluster is appropriate only when:

- SERP top results overlap enough;
- search intent is the same;
- expected page type is the same;
- one article can satisfy the user;
- no template policy requires separate pages.

Textual similarity is insufficient. Date-specific, location-specific, or
template-series queries may need separate pages even when the words look almost
identical.

## Batch-First LLM Evaluation

When agents evaluate keyword sets, article opportunities, or wave candidates
with an LLM, they must use batch-first prompting.

Rules:

- send the largest safe batch per prompt;
- include stable row IDs;
- include compact evidence fields only;
- request structured output keyed by row ID;
- chunk only when token limits require it;
- retry only failed or ambiguous rows;
- avoid per-keyword LLM calls except for narrow exception handling.

This improves consistency, lowers cost, and lets the model compare candidates
against each other inside one decision context.

## Rank Tracking Policy

Rank tracking must be controlled by parameters.

Precedence:

```text
agency default -> company default -> project override -> keyword override
```

Recommended tiers:

| Tier | Contents | Default Behavior |
|---|---|---|
| Tier 1 | primary + business-critical + launch-watch terms | frequent tracking |
| Tier 2 | secondary + opportunity terms | moderate tracking |
| Tier 3 | long-tail + GSC-discovered candidates | no regular rank tracking unless signal grows |
| Temporary watch | changed pages / new launches | more frequent tracking for a limited period |

Policy fields:

- provider;
- geo;
- language;
- device;
- frequency;
- max keywords per project;
- max cost per period;
- escalation threshold;
- temporary-watch duration;
- stop conditions.

Agents must not decide frequency ad hoc. They may recommend tier changes.

## Performance Classification

Each project page should be classified over time.

Suggested states:

- `new`
- `insufficient_data`
- `indexing_issue`
- `growing`
- `stable`
- `noisy`
- `declining`
- `ctr_opportunity`
- `content_gap`
- `wrong_landing_page`
- `new_page_opportunity`
- `cannibalization`
- `needs_serp_review`
- `needs_human_decision`

Thresholds must be configurable by company/project, not hardcoded.

## Action Routing

When the loop finds an issue or opportunity, create separate child issues.

Default lanes:

- `generation`: gather GSC/SERP/MCP/provider data.
- `validation`: check relevance, schema, evidence, fit, and quality.
- `review/routing`: decide page refresh vs new page vs parked/rejected.
- `implementation`: write/update content, internal links, metadata, or CMS changes.
- `monitoring`: follow post-change performance.

Do not mix all lanes into one issue except for explicitly marked smoke tests.

## Product Launch SEO Workflow

When a new product appears on the site, launch a separate SEO workflow.

Trigger sources:

- new product route discovered in sitemap;
- human request;
- Product Discovery artifact;
- CMS/product catalog update;
- CMO/CEO issue.

Recommended workflow:

1. **Product Discovery**
   Define what the product is, for whom, promise, CTA, limits, trust signals, and visible user workflow.

2. **Canonical Product Profile**
   Add or update product catalog/reference layer.

3. **Strategic Opportunity Review**
   For free tools, trials, calculators, quizzes, horoscope-like routes, or acquisition routes, create a Strategic Opportunity Brief before execution.

4. **Semantic Seed**
   Generate initial semantic core:
   - `core_product_intent`;
   - `adjacent_use_case_intent`;
   - `audience_need_intent`;
   - `audience_interest_intent`.

5. **Beginner Content Package**
   Create articles for users who do not yet understand the product:
   - what it is;
   - who it is for;
   - how to prepare;
   - what inputs are needed;
   - how to interpret results;
   - common mistakes;
   - trust/expectation framing.

6. **SEO Traffic Package**
   Create traffic-oriented pages/articles:
   - direct product keywords;
   - problem-aware queries;
   - comparison queries;
   - adjacent use cases;
   - long-tail queries;
   - GSC-discovered opportunities;
   - audience-intent clusters.

7. **Internal Linking Plan**
   Product page links to support articles. Articles link contextually to product page and related cluster pages.

8. **Monitoring Enrollment**
   Every created URL gets:
   - `seo_project_page`;
   - keyword target set;
   - rank tier;
   - GSC monitoring;
   - temporary watch period;
   - post-launch thresholds.

9. **First 4-8 Week Watch**
   Monitor indexation, impressions, GSC-discovered queries, CTR gaps, wrong-landing signals, and early content opportunities.

## Agent Contract Changes Required

### GSC / SEO Performance Agent

Must:

- ingest GSC page/query data;
- create keyword observations;
- detect new queries with meaningful traffic;
- evaluate landing fit;
- create candidate page keyword targets;
- create new-page opportunity candidates;
- preserve run and cost/provenance metadata.

Must not:

- auto-accept all GSC queries into the semantic core;
- assume current landing page is the right page;
- hardcode rank tracking frequency.

### Semantic Core Agent

Must:

- accept GSC-discovered candidates as input;
- separate raw observations from accepted keywords;
- classify candidate status: accepted, parked, rejected, needs_review;
- avoid rejecting low/unknown-volume keywords when GSC evidence or strategic relevance exists.

### SEO Opportunity Validator

Must:

- decide whether a query needs a new page, existing-page refresh, section addition, internal-linking change, or parking;
- check topical authority and audience relevance;
- flag cannibalization and wrong-landing issues;
- pass validated opportunities into content planning.

### Senior SEO Agent

Must:

- make page-level strategy decisions;
- decide wait vs refresh vs new page vs SERP analysis;
- recommend backlink/internal-linking actions only when evidence supports them;
- keep thresholds configurable.

### Rank Tracking Agent

Must:

- use company/project/keyword-tier policy;
- track only selected keywords according to budget;
- support temporary watch after launches or content updates;
- report cost and provider usage.

### Content Plan Creator

Must:

- accept validated new-page opportunities into backlog;
- classify planned pages by type: beginner, SEO traffic, product support, pillar/cluster, FAQ/tool;
- prioritize by evidence, business value, topical authority, and internal-linking value.

For companies with dedicated SEO blog roles, blog content planning should be
routed to `SEO Blog Content Strategist` instead of a generic content planner.

### SEO Blog Content Strategist

Must:

- convert validated semantic-core and GSC opportunity evidence into article
  opportunities;
- normalize cluster demand instead of summing duplicate keyword variants;
- apply human priority controls;
- select a bounded wave pool;
- run or request SERP grouping only for the shortlist and ambiguous boundaries;
- produce paced blog waves with content roles and internal-linking targets.

Must not:

- create a page for every accepted keyword;
- run unbounded SERP checks for the whole semantic core by default;
- bypass content-plan validation for high-volume topics.

### SEO Blog Content Plan Validator

Must validate:

- article opportunity grouping;
- SERP evidence for the wave shortlist;
- role mix and publication pacing;
- cannibalization and template-family repetition risk;
- human priority override handling;
- whether reach articles still support topical authority and future conversion
  paths.

### Product Discovery Analyst

Must:

- trigger canonical product profile work when a new product route appears;
- identify whether the route is product, lead magnet, tool, acquisition entry page, or generic content route.

### CMO / SEO Manager

Must:

- create separate child issues for generation, validation, routing, implementation, and monitoring;
- avoid letting manager parent issues close before child results are reviewed;
- require human approval where product positioning, offer architecture, monetization, or publication strategy changes.

## Minimum MVP

MVP should implement:

1. `seo_sites`, `seo_project_scopes`, `seo_pages`, `seo_project_pages`.
2. Daily sitemap discovery and project-scope membership.
3. GSC query ingestion into `seo_keyword_observations`.
4. `seo_page_keyword_targets` with target types and tiers.
5. Basic new-page opportunity detection from GSC queries.
6. Configurable rank tracking policy.
7. Agent contract updates for GSC/Performance, Semantic Core, Rank Tracking, Content Plan Creator, and SEO Manager.

## Later Enhancements

- Native SERP feature tracking.
- Cannibalization graph.
- Internal-link graph and link opportunity scoring.
- Content decay model.
- GSC anomaly detection.
- Seasonality-aware thresholds.
- Integration with Winning Structure MCP for refresh/new-page briefs.
- Native dashboard for SEO pages, opportunities, and monitoring states.

## Final Architecture Formula

```text
Paperclip company/project scopes define ownership.
Sitemap/GSC discover pages and queries.
GSC observations expand keyword candidates.
Validation promotes candidates into semantic core or page targets.
Rank tracking follows configurable tier policy.
Performance loop creates refresh or new-page opportunities.
Product launches create beginner + SEO traffic packages.
Blog plans are released as paced waves, not as all possible pages at once.
Every new or changed page enters monitoring.
```
