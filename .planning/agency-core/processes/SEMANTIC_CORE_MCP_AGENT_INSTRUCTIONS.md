# Semantic Core MCP Agent Instructions

## Purpose

This document records the current Paperclip-facing operating contract for Semantic Core MCP runs.

MCP Semantic Core owns semantic-core generation, raw provenance, debug artifacts, recall ledger, and provider evidence. Paperclip owns operational use: review decisions, content planning, page targeting, rank monitoring, budget attribution, and downstream tasks.

MCP output is evidence and import material, not a content plan. Content planning, page briefs, monitoring targets, and implementation tasks belong to Paperclip after accepted import.

## Required Agent Workflow

For normal runs, agents must use this sequence:

1. Confirm MCP connectivity through the Paperclip plugin.
2. Call `register-project` with full project inputs.
3. Call `validate-project` and continue only when validation returns `status = ok`.
4. For smoke tests, run `core_product_intent` with `mode = mock`.
5. For production, run semantic layers in order with `mode = live` and `provider_cache_mode = read_write`.
6. Poll `get-job-status` or use `run-layer-and-wait`.
7. Call `get-run-costs` before initiating another live run.
8. After any MCP server contract update, call `get-paperclip-import-schema` before changing import or review behavior.
9. Call `prepare-paperclip-import` for the completed `run_id` before importing or using the layer operationally.
10. Read `import_readiness`, `unsafe_reasons`, `quality_report`, `policy_version`, `search_query_eligibility`, and `query_shape_score`.
11. Generate a human review workbook or client-portal review queue for the layer before moving to the next production layer.
12. Submit human review decisions as append-only input when needed.
13. Rerun the same layer if review decisions or policy changes should be reflected in new artifacts.
14. When running later layers, pass `prior_final_keywords` with previous final statuses (`accepted`, `rejected`, `deferred`, `removed`) unless an explicit `force_re_review_keywords` list is required.
15. Only after the current layer is approved/importable, run the next layer.
16. After the last approved layer, build the downstream traffic/content plan in Paperclip.

Do not pass local filesystem paths to MCP during normal agent workflows. Use `project_id`, `run_id`, and `job_id`.

## Traffic Strategy And Layer Policy Contract

Paperclip agents own the company-specific traffic strategy. MCP must receive that strategy through `register-project` / project config instead of inferring a company's business goal from generic product bindings.

Every production semantic-core layer issue must define:
- primary traffic goal;
- funnel scope;
- target audience definition;
- allowed topical domains;
- excluded topical domains;
- whether broad top-of-funnel traffic is valuable;
- whether the layer requires product binding, service pathway, topical match, or editorial bridge;
- prior final keyword source for accepted/rejected/deferred/removed keywords.

For broad layers, Paperclip must send the layer policy through `register-project`
inside `project_config.semantic_expansion.layer_policies`. Agents should not
send these project-level options only on `run-layer`, because the MCP server
uses registered project config as the source of truth. The broad layer config
must include or preserve:

```json
{
  "requires_product_binding": false,
  "requires_service_pathway": false,
  "requires_topic_domain_match": true,
  "review_uncertain_topic_matches": true,
  "allowed_topic_domains": [
    {
      "domain_id": "project_defined_topic",
      "labels": ["configured per company"],
      "include_terms": ["configured per company"],
      "exclude_terms": [],
      "semantic_profiles": []
    }
  ]
}
```

`audience_need_intent` must use this contract directly. `audience_interest_intent`
may additionally require `requires_editorial_bridge = true`, but it still needs
the same project-defined topic-domain guard so broad-interest traffic remains
connected to the company strategy.

Use this shared layer model unless a company brief explicitly overrides it:

| Layer | Business Meaning | Required Fit |
|---|---|---|
| `core_product_intent` | Direct brand/product/service demand | product or brand binding |
| `adjacent_use_case_intent` | Adjacent use cases that can map to products/pages | service or landing pathway |
| `audience_need_intent` | Broad topical search demand from the target audience | search query + traffic evidence + allowed topic-domain match |
| `audience_interest_intent` | Broader audience interests that can attract the target audience | search query + traffic evidence + configured editorial bridge |

`no_entity_anchor` and `product_binding_status = unknown` are not universal blockers. They block a keyword only when the active layer policy requires product/entity binding.

Broad top-of-funnel search demand can be valid semantic-core material when it is a real search query, fits the configured target audience, has evidence, and can be served honestly by the company. Do not judge every layer by immediate purchase intent.

## Phase 23 Import Readiness

`prepare-paperclip-import` is the required import boundary. New runs expose:

```text
import_readiness
unsafe_reasons
quality_report
policy_version
```

Interpret `import_readiness` strictly:

- `ready_accepted_only`: accepted keywords may be imported automatically, but a layer review workbook is still the standard Astrogen/Paperclip handoff.
- `ready_after_review`: accepted keywords may be imported, and the review queue must be processed before moving to the next layer.
- `unsafe_for_import`: do not import; create a blocker with `unsafe_reasons` and inspect the run.
- `needs_policy_fix`: do not import; adjust project config or MCP policy, then rerun the layer.

Accepted keywords are machine-safe, not "maybe useful". Competitor SERP/content-parsing terms normally belong in review, parked, or recall artifacts unless normal policy gates accepted them.

Agents must preserve and display these keyword fields when present:

```text
domain_topic_match
domain_topic_match_score
product_binding_status
acceptance_confidence
review_priority
human_review_required
human_review_reason
recommended_human_decision
evidence_summary
policy_version
```

`product_binding_status` values are:

```text
canonized_product
brand_binding
topic_only
proposed_product
unknown
```

Human-added keywords are not privileged. Submit them through review decisions or the configured human-add flow, then validate/rerun so provider validation and policy gates still apply.

## Search-Query-Only Contract

Semantic-core keywords must be plausible search queries. Audience notes, JTBD
phrases, product-planning phrases, and content-plan topics are not semantic-core
keywords unless MCP marks them as real query candidates.

MCP may return diagnostic rows with:

```text
layer_membership = rejected_noise
rejected_reason = not_search_query
search_query_eligibility = not_search_query
query_shape_score
```

Paperclip agents must preserve these rows for diagnostics, but must not show
them to clients as review items and must not import them into the active
semantic core. Client-visible review should include only `accepted_keywords`,
`review_candidates`, and relevant `parked_outside_layer` opportunities that are
eligible search queries.

`query_shape_score`, `evidence_summary`, and `decision_trace` are agent
diagnostics. Use them to debug MCP behavior; do not expose raw diagnostic labels
or not-search-query rows in the client portal.

## Paperclip Batch-First LLM Evaluation

MCP does not perform final AI judgment for Paperclip business decisions. When a
Paperclip agent uses an LLM to evaluate keyword rows, review candidates, article
opportunities, or cluster boundaries after MCP output, the agent must use
batch-first prompting.

Required behavior:

- evaluate the largest safe batch per prompt instead of calling an LLM once per
  keyword;
- include stable row IDs and require structured output keyed by row ID;
- include only compact evidence needed for the decision: keyword, normalized
  keyword, layer, lifecycle state, geo/global volume, GSC evidence, topic/domain
  flags, human priority, and short evidence summary;
- chunk deterministically when context limits require it;
- retry only failed, malformed, or explicitly ambiguous rows;
- preserve the batch prompt, model, policy version, and output summary as
  audit/debug evidence when the decision affects lifecycle or content planning.

Per-keyword LLM calls are allowed only for narrow exception handling after a
batch result fails validation. They must not be the normal review strategy.

## Human Review Workbook

For each production layer, create one Excel workbook with multiple sheets:

- `Run Summary`: project id, run id, layer, mode, import readiness, unsafe reasons, policy version, counts, cost summary, and quality report.
- `Accepted`: accepted keywords with a default human decision of `import`.
- `Review Queue`: review candidates with editable `human_decision`, `human_notes`, and optional binding override columns.
- `Parked`: parked/outside-layer terms for context and later-layer recall.
- `SERP Evidence`: SERP competitor candidates or recall evidence when present.
- `Decision Guide`: allowed review decisions and short instructions.

Keep source evidence columns intact. Put editable human columns at the beginning of each review sheet so accidental edits to evidence are easier to detect.

## Policy-Driven Layer Decisions

Agents must not assume that specific words are hardcoded as allowed or forbidden by the MCP server. Layer membership is policy-driven.

Project or niche terms belong in `register-project.inputs.project_config`, entity packs, seed catalog, or `semantic_expansion` config. Production code must not contain site-specific lexical vetoes.

High-demand conflicts should be routed to review instead of silently parked or rejected. Configure review escalation in project config when broad terms may be commercially important:

```json
{
  "semantic_expansion": {
    "review_escalation_policy": {
      "enabled": true,
      "geo_volume_threshold": 100,
      "fallback_low_volume_threshold": 10,
      "use_project_volume_percentile": true,
      "percentile_threshold": 0.8,
      "use_global_volume": true,
      "use_gsc_impressions": true,
      "blocked_reasons": ["duplicate_cluster", "unsupported_locale"]
    }
  }
}
```

When escalation fires, MCP returns the keyword as `candidate_review` with `parked_reason = high_demand_conflict`. This is not auto-acceptance; it means silent loss is unsafe and downstream review is required.

When explaining keyword membership, inspect `decision_trace` when it is present.

Review escalation must not be volume-only. High demand can promote a borderline keyword to review only when there is enough topical or domain confidence to justify human attention. If a keyword has high volume but no entity anchor, no product/topic fit, and comes from an off-topic competitor/domain/result type, it should remain parked or be rejected as noise instead of entering the human review queue. For example, generic marketplace service terms, banking/institution names, app-store UI labels, household service queries, and unrelated jobs/services should not be escalated only because they have demand.

Do not create a canonical product binding only because a keyword is commercially important. If a product does not exist yet, represent the keyword as a core topic, brand topic, review candidate, or parked opportunity until Product Discovery or a human decision explicitly canonizes it.

## Competitor SERP Recall Modes

MCP supports competitor SERP recall in two modes:

1. Competitor URL ranked keywords: keywords for which a competitor URL ranks.
2. Competitor page content parsing: headings, anchors, and short content phrases parsed from the competitor page.

Content parsing is opt-in. It is disabled by default.

## Production Run Parameters

For full production semantic-core generation with maximum recall, Paperclip agents should register this inside `register_project.inputs.project_config` before running the layer:

```json
{
  "semantic_expansion": {
    "serp_competitor_expansion": {
      "enabled": true,
      "enable_content_parsing": true,
      "max_representatives_per_cluster": 1,
      "max_serp_results_per_representative": 5,
      "max_competitor_urls_per_cluster": 3,
      "max_ranked_keywords_per_url": 100,
      "max_content_terms_per_url": 50,
      "content_term_min_words": 2,
      "content_term_max_words": 8
    }
  }
}
```

For quick, smoke, or budget-sensitive runs, keep `enable_content_parsing: false` or omit it.

Do not send `semantic_expansion` directly to `run_layer`. Current live MCP reads this configuration from the registered `project_config`; sending it on `run_layer` is not a valid way to enable expansion.

## Provider Cache

Use project-scoped provider cache for live runs:

```json
{
  "provider_cache": {
    "enabled": true,
    "mode": "read_write",
    "default_ttl_days": 30,
    "endpoint_ttl_days": {
      "dataforseo_labs/google/search_intent/live": 60,
      "dataforseo_labs/google/keyword_overview/live": 30,
      "keywords_data/google/search_volume/live": 30,
      "serp/google/organic/live/advanced": 7,
      "dataforseo_labs/google/ranked_keywords/live": 14,
      "on_page/content_parsing/live": 30
    }
  }
}
```

This `provider_cache` block belongs in `register_project.inputs.project_config`.
Use `provider_cache_mode = read_write` on `run_layer` for normal production runs,
`read_only` for no-spend reruns when enough cache is expected, `refresh` for
intentional fresh provider data, and `bypass` only for debugging provider
behavior. The Paperclip adapter defaults live `run_layer` calls to
`provider_cache_mode = read_write` when agents omit it, but agents should still
set it explicitly in task handoffs and execution notes.

Cache is scoped by `project_id`, not shared across companies or projects. Cache hits are not ranking, intent, or layer-membership acceptance evidence.

## Agent Rules

- Parsed content terms are candidate evidence, not accepted keywords.
- Accepted/review/parked/rejected status must come from normal MCP gates.
- Do not accept a candidate unless `layer_membership` and status justify it.
- Do not treat unavailable volume as zero.
- Do not treat `search_volume` as global demand; it is a legacy alias for `geo_search_volume`.
- Treat `geo_search_volume` and `global_search_volume` as the same DataForSEO
  metric family from `keywords_data/google/search_volume/live`; geo uses the
  configured locale, global omits locale targeting.
- Do not expect `global_search_volume_country_distribution` in new runs; keep it
  only as legacy/backward-compatible evidence when already present.
- Import `recall_ledger` even when candidates are not accepted.
- Preserve parked and rejected candidates because later semantic layers or human review may use them.
- Show `competitor_expansion_endpoint` to reviewers when present, so they can distinguish ranked-keyword SEO evidence from parsed page-content evidence.
- Show `serp_result_classification_reason` when present, so reviewers can understand why a competitor result was considered relevant.
- Do not use `editorial_growth_intent` as a semantic-core layer.

## Output Fields To Preserve

Paperclip plugin/import layers should preserve these fields when present:

```text
serp_result_classification_reason
competitor_expansion_endpoint
```

Paperclip should also preserve and expose these debug artifacts when present:

```text
competitor_expansion_debug
recall_ledger
serp_competitor_candidates
```

Within `competitor_expansion_debug`, reviewers should be able to see:

```text
source_counts
endpoint_counts
result_type_counts
```

These fields explain whether candidates came from URL ranked keywords, content parsing, headings, anchors, content terms, product/support/blog/media/forum SERP pages, or other classified sources.

## Recommended Review Interpretation

Use `competitor_expansion_endpoint` as a trust signal:

- ranked-keyword endpoint: stronger SEO evidence because the URL already ranks for the term;
- content parsing endpoint: weaker discovery evidence that requires normal relevance and layer-membership validation.

The reviewer should not reject a candidate only because it came from parsed content. The reviewer should also not accept it only because it appeared in competitor content.

## Cost And Budget Behavior

Content parsing increases provider usage. Use it for production semantic-core runs where recall quality matters. Avoid it for smoke tests, diagnostics, or low-budget exploratory runs unless explicitly requested.
