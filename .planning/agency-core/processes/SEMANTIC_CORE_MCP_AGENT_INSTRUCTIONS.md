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
8. Read accepted/review/parked/rejected keywords, clusters, SERP segments, recall ledger, and competitor expansion debug artifacts.
9. Submit review decisions as append-only input when needed.
10. Prepare Paperclip import and persist accepted operational state in Paperclip DB.

Do not pass local filesystem paths to MCP during normal agent workflows. Use `project_id`, `run_id`, and `job_id`.

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
      "keywords_data/clickstream_data/global_search_volume/live": 30,
      "serp/google/organic/live/advanced": 7,
      "dataforseo_labs/google/ranked_keywords/live": 14,
      "on_page/content_parsing/live": 30
    }
  }
}
```

Use `provider_cache_mode = read_write` for normal production runs, `read_only` for no-spend reruns when enough cache is expected, `refresh` for intentional fresh provider data, and `bypass` only for debugging provider behavior.

Cache is scoped by `project_id`, not shared across companies or projects. Cache hits are not ranking, intent, or layer-membership acceptance evidence.

## Agent Rules

- Parsed content terms are candidate evidence, not accepted keywords.
- Accepted/review/parked/rejected status must come from normal MCP gates.
- Do not accept a candidate unless `layer_membership` and status justify it.
- Do not treat unavailable volume as zero.
- Do not treat `search_volume` as global demand; it is a legacy alias for `geo_search_volume`.
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
