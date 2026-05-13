# Phase 4: SEO Ops Operational Memory And Decision Windows

## Problem

The first `seo_ops` schema slice created a broad foundation for pages, keywords, semantic-core imports, rank tracking, SERP snapshots, performance snapshots, and opportunities.

The next design pass must tighten the operational model before agents start relying on it for Astrogen decisions. The risk is subtle: if Paperclip stores generic keyword performance snapshots, agents may reason as if a keyword itself ranks. In reality, a specific page ranks for a specific query in a specific search context:

```text
project_page + keyword + geo + language + device + search_engine
```

Google Search Console and Google Analytics already hold their own historical metric stores. Paperclip should not duplicate those warehouses. Paperclip needs enough durable operational memory to explain decisions, replay evidence, track its own Serper observations, and connect performance changes to actions that were performed or deliberately skipped.

## Goal

Refine SEO Ops into a decision system centered on page-level search behavior over time.

The system must:

- preserve complete local history for Paperclip-owned SERP observations collected through Serper;
- preserve page action history and no-action decisions;
- keep GSC/GA4 as provider systems of record while storing bounded decision digests and query parameters;
- support short decision windows over a longer historical context;
- create new-page and refresh decisions from page fit, action history, semantic-core state, and provider evidence;
- make weekly tracking a policy parameter, not hard-coded behavior;
- support Astrogen as the first live tenant without introducing Astrogen-only schema assumptions.

## Scope

### Schema Refinement

Review and update the existing `seo_ops` schema around these concepts:

- `project_pages` as the operational page unit.
- `page_serp_targets` or a tightened `rank_tracking_targets` contract where identity is page/query/context, not only keyword/context.
- append-only `serp_snapshots`, `serp_snapshot_results`, and `serp_rank_observations` for Serper evidence.
- `page_action_events` as a first-class input into all SEO decisions.
- `metric_windows` or a refined `performance_snapshots` table for decision-ready GSC/GA4/Serper digests.
- `seo_decisions` for append-only page decisions with policy snapshots, evidence references, and opened issue links.
- `new_page_opportunities` evidence bundles that include landing fit, semantic-core membership, current accidental landing page, and cannibalization risk.
- semantic-core review fields from Phase 23 as queryable columns, not only opaque JSON.

### Plugin Workflow

Design plugin tools that agents can call instead of writing SQL:

- register or resolve Astrogen site/project scope;
- import GSC query observations for a bounded period;
- import GA4 page/session/conversion digests for a bounded period;
- import prepared MCP semantic-core runs after `prepare_paperclip_import`;
- record human semantic-core review decisions;
- derive page keyword targets from accepted semantic core and GSC evidence;
- schedule rank targets from policy;
- collect due Serper snapshots;
- compute decision windows;
- create refresh/new-page/cannibalization recommendations.

### Artifact Review Handoff

Semantic-core review workbooks must be handled as operational artifacts, not only local files.

Plan one of:

- allow `.xlsx` issue attachments through Paperclip attachment configuration and UI accept lists; or
- register workbook paths as issue work products with a clear download/open URL; or
- replace workbook round-trips with a dedicated semantic-core review GUI and keep Excel as export/import fallback.

Preferred direction after the Astrogen `AST-708` review: replace workbook round-trips with a dedicated semantic-core review GUI. The GUI should be database-backed, group duplicate keyword rows across artifacts, expose only decision-relevant fields by default, and submit MCP review decisions from Postgres. Excel should remain only as an export/import fallback.

For MVP, Paperclip may still support `.xlsx` upload for review artifacts, but `.xlsx` must not become the canonical semantic-core review state.

## Non-Goals

- Do not build a full local GSC or GA4 warehouse.
- Do not scrape or store every provider metric row indefinitely unless Paperclip generated the observation itself.
- Do not make accepted semantic-core membership automatic from GSC impressions.
- Do not hard-code weekly tracking in the runner; default weekly behavior must come from policy.
- Do not introduce Astrogen-specific table names.
- Do not store provider secrets, access tokens, or raw credentials in `seo_ops`.

## Design Principles

### Provider Source Of Truth

GSC and GA4 remain external source systems for their full historical data.

Paperclip stores:

- provider query parameters;
- collection run metadata;
- bounded decision digests;
- selected raw payload references only when needed for audit;
- evidence references used in decisions.

### Paperclip-Owned History

Serper observations are Paperclip-owned measurements and should be append-only locally:

- requested query;
- geo/language/device/search engine;
- full top-result evidence;
- owned domain/page matches;
- best owned position;
- owned result count;
- SERP feature and competitor context when available.

### Page Action Awareness

Every decision must consider recent page actions:

- publication;
- title/meta/H1 edits;
- content refresh;
- section additions;
- internal-link changes;
- schema/canonical changes;
- redirects/merges;
- explicit no-action decisions.

Action events should carry `cooldown_until`, `affected_keyword_ids`, `expected_effect`, and `issue_id` when available.

### Decision Windows

Agents should reason over bounded windows, not over all history equally.

Recommended concepts:

- `baseline_window`: before the relevant action;
- `cooldown_period`: do not judge too early after a change;
- `post_action_window`: period after cooldown;
- `comparison_window`: recent period for normal monitoring when no recent action exists;
- `historical_context`: older data used only for seasonality and anomaly checks.

### Opportunity Decisions

New page decisions must be based on landing fit and ownership, not only keyword demand:

- query has meaningful demand or strategic value;
- current landing page is weak, wrong, or absent;
- existing page refresh is not the better answer;
- semantic-core membership permits the topic;
- business/topic fit is sufficient;
- cannibalization risk is understood;
- proposed page type is explicit.

## Implementation Steps

1. Audit current `seo_ops` schema against the refined operational model.
2. Decide whether to add `page_serp_targets` or evolve `rank_tracking_targets` with a required page/context identity.
3. Add first-class Phase 23 semantic-core import/review columns.
4. Add or refine decision window storage for bounded GSC/GA4/Serper digests.
5. Add `seo_decisions` if no current table captures append-only decisions with policy/evidence/action context.
6. Add missing indexes and uniqueness constraints for page/context/time queries.
7. Add plugin backend tools for ingest/import/schedule/collect/decision workflows.
8. Add `.xlsx` review artifact support or work-product handoff for semantic-core review workbooks.
9. Seed Astrogen site/project scope and default rank tracking policy with `interval_days=7`.
10. Run a dry Astrogen workflow: import reviewed layer 1, derive targets, schedule weekly Serper checks, compute a decision packet without creating downstream content tasks.

## Acceptance Criteria

- Agents can answer: "Which Astrogen page ranks for this keyword in this geo/language/device, and how has that changed over time?"
- Agents can answer: "What changed on this page before the movement?"
- Agents can answer: "Is this a refresh, no-action, cannibalization, or new-page opportunity?"
- Serper SERP history is append-only and queryable by page/query/context/date.
- GSC/GA4 are not duplicated as full warehouses; decision digests include source query parameters and evidence references.
- Weekly rank tracking is configured by policy and can be overridden by tier/project/temporary watch.
- Semantic-core review decisions can be stored in Postgres after a human review.
- Astrogen `AST-708` review artifact handoff has a non-image path for `.xlsx` or an equivalent GUI/work-product workflow.

## Verification

- Schema tests cover uniqueness and indexes for page/query/context identities.
- Plugin tests cover idempotent imports from GSC, GA4, MCP semantic core, and Serper.
- Decision-window tests cover baseline, cooldown, post-action, and no-recent-action cases.
- A fixture proves that a keyword with multiple Astrogen pages creates a cannibalization signal instead of overwriting rank state.
- A fixture proves that a GSC-supported query becomes a candidate/opportunity, not an automatically accepted semantic-core keyword.
- A fixture proves that a reviewed `.xlsx`/review GUI decision updates semantic-core membership without accepting unsafe rows.
