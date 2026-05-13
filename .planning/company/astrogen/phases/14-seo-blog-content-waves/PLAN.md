# Phase 14: SEO Blog Content Waves

## Problem

Astrogen semantic-core work is now traffic-first, but a large semantic core cannot be converted into pages mechanically. Creating all possible blog pages at once would be operationally weak, harder for humans to review, and less useful for search-growth learning.

The current next workflow must focus only on blog pages. Product pages, tools, landing pages, and non-blog page opportunities remain future scopes unless a human explicitly moves them into a separate product/page workflow.

## Goal

Define the Astrogen blog-only operating contract that turns a validated semantic core into:

- SERP-checked article opportunities;
- normalized cluster demand;
- human-adjustable content priorities;
- paced content waves;
- independent content-plan validation;
- gradual article production;
- performance-loop feedback into the next waves.

## Scope

- Astrogen planning docs.
- Shared SEO Performance Loop process docs.
- Agent contract language for:
  - `CMO`;
  - `SEO Semantic Core Strategist`;
  - `SEO Semantic Core Validator`;
  - `SEO Blog Content Strategist`;
  - `SEO Blog Content Plan Validator`;
  - `SEO Blog Article Writer`;
  - `SEO Blog Article Validator`;
  - `SEO Performance Analyst` / SEO Performance Loop.
- No new agent creation in this phase.
- No client portal UI work in this phase.
- No live MCP rerun in this phase.

## Existing Agents To Preserve

Do not create `SEO SERP Intent Analyst`, `SEO Page Opportunity Strategist`, or a generic `SEO Content Plan Strategist` for this scope.

Use the existing blog lane:

- `SEO Blog Content Strategist` owns blog article opportunities, SERP shortlist grouping, backlog, and wave selection.
- `SEO Blog Content Plan Validator` owns QA for waves, clusters, cannibalization risk, strategy mix, and publication pacing.
- `SEO Semantic Core Strategist` and `SEO Semantic Core Validator` stop at validated semantic-core readiness; they do not own blog wave selection.

## Blog Opportunity Model

Paperclip should plan blog pages through `article_opportunity` records or issue artifacts, not through raw keyword rows.

Each article opportunity must include:

- stable opportunity id;
- primary keyword;
- supporting keywords;
- source semantic-core layer(s);
- SERP grouping status: `not_checked`, `checked_same_intent`, `checked_split_required`, `needs_recheck`;
- normalized Ukraine cluster demand;
- normalized global cluster demand;
- raw per-keyword volume evidence for transparency;
- demand confidence;
- content role;
- suggested article type;
- internal-linking target;
- human priority;
- lifecycle status;
- validation notes.

## Cluster Demand

Do not use a naive sum of all keyword volumes as final cluster demand, because variants often duplicate the same demand.

Use:

```text
cluster_demand_score =
  primary_keyword_geo_volume
  + weighted_unique_variant_volume
  + GSC evidence boost
  + seasonality boost
  + strategic priority boost
```

Human-facing outputs should show:

- Ukraine demand class: high / medium / low / unknown;
- global demand class: high / medium / low / unknown;
- primary keyword volume;
- supporting keyword volume table;
- whether the final score is normalized, not a raw sum.

## Human Priority Controls

Human control should exist at the article opportunity or topic-family level, not at every keyword by default.

Allowed human priority states:

- `high`;
- `normal`;
- `low`;
- `do_not_plan`;
- `pin_next_wave`;
- `pause_temporarily`.

Humans should also be able to set strategic focus notes such as:

- prioritize horoscopes this month;
- pause compatibility topics;
- increase natal-chart education;
- avoid a sensitive topic family;
- limit one template family per wave.

## Content Roles

Use these content roles:

- `reach`: broad traffic and awareness;
- `trust`: trust-building and expectation setting;
- `expertise`: deep astrology education and authority;
- `objection_handling`: answers to doubts and objections;
- `conversion_support`: articles that support a later application, consultation, product, or signup.

The strategic order is:

```text
reach -> trust -> expertise -> objection_handling -> conversion_support
```

But waves should not be completely single-role. The first waves should be reach-heavy, then gradually increase trust, expertise, objections, and conversion support.

Recommended starting mix:

| Stage | Reach | Trust | Expertise | Objections | Conversion |
|---|---:|---:|---:|---:|---:|
| Early | 70% | 20% | 10% | 0% | 0% |
| Middle | 50% | 25% | 15% | 10% | 0% |
| Mature | 35% | 20% | 20% | 15% | 10% |

## Wave Policy

Default Astrogen wave settings:

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

Wave selection score:

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

## SERP-Based Grouping

Do not run expensive SERP-overlap analysis for the entire semantic core by default.

Workflow:

1. Use MCP semantic-core clusters as preliminary groups.
2. Build a candidate shortlist for the next wave pool, usually `new_articles_per_wave * selection_pool_multiplier`.
3. Run SERP similarity only for shortlisted candidates and ambiguous cluster boundaries.
4. Split or merge article opportunities based on SERP overlap, user intent, page type, and template-family policy.
5. Keep the SERP evidence with the article opportunity.

One article cluster is allowed only when:

- SERP top results overlap enough;
- search intent is the same;
- expected page type is the same;
- one article can satisfy the user;
- no template policy requires separate pages.

Date-specific or template-series queries may remain separate even when text similarity is high.

## Batch-First LLM Evaluation

Agents must not evaluate keywords one by one with separate LLM calls.

For keyword or opportunity classification:

- send the largest safe batch per prompt;
- include stable row IDs;
- include compact fields only: keyword, normalized keyword, layer, source, geo/global volume, GSC evidence, current lifecycle state, topic/domain flags, known human priority, and short evidence summary;
- ask for structured output keyed by row ID;
- chunk only when token budget or model limits require it;
- retry only failed or ambiguous rows, not the whole set;
- keep prompt templates reusable and company-agnostic, with Astrogen strategy passed as a config block.

Per-keyword LLM calls are allowed only for narrow exception handling after a batch result fails validation.

## Agent Contract Updates

### CMO

Must define the current blog-wave stage and human priority policy before creating blog planning tasks.

CMO must not request "write all accepted keywords". It should request a bounded wave or planning horizon.

### SEO Semantic Core Strategist

Must hand off validated keyword groups and diagnostics, not a blog plan.

### SEO Semantic Core Validator

Must certify whether the semantic core is usable for blog planning and state any exclusions before the blog lane starts.

### SEO Blog Content Strategist

Must:

- convert validated semantic-core groups into article opportunities;
- compute normalized cluster demand;
- apply human priorities;
- select a short wave pool;
- run or request SERP checks only for the shortlist;
- produce a wave plan with content roles and internal-link targets.

### SEO Blog Content Plan Validator

Must validate:

- query-to-article grouping;
- SERP evidence for the shortlist;
- role mix;
- publication pacing;
- cannibalization risk;
- whether broad reach articles still connect to Astrogen topical authority;
- whether human priority overrides were respected.

### SEO Blog Article Writer

Must write only approved wave articles or briefs. It must not pull additional semantic-core keywords directly into production.

### SEO Blog Article Validator

Must verify the article against the approved opportunity and wave brief.

### SEO Performance Analyst / SEO Performance Loop

Must feed GSC/rank evidence back into:

- article opportunity status;
- cluster demand confidence;
- refresh candidates;
- cannibalization warnings;
- next-wave priority adjustments.

## Acceptance Criteria

- Astrogen roadmap contains Phase 14.
- Astrogen requirements include blog waves, cluster demand, human priorities, and batch-first LLM evaluation.
- Agency-core SEO Performance Loop describes article opportunities, wave policy, SERP shortlist grouping, and feedback from monitoring into future waves.
- Semantic Core MCP agent instructions explain that downstream Paperclip LLM evaluation should be batch-first.
- No new agent role is proposed for work already owned by `SEO Blog Content Strategist`.

## Verification

- Review docs for duplicate agent responsibilities.
- Confirm no direct MCP or live Paperclip run is triggered by this phase.
- Confirm `outputs/` remains ignored and not committed.
