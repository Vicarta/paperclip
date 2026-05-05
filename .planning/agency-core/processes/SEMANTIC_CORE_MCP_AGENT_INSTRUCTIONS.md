# Semantic Core MCP Agent Instructions

## Purpose

This document records the current Paperclip-facing operating contract for Semantic Core MCP runs.

MCP Semantic Core owns semantic-core generation, raw provenance, debug artifacts, recall ledger, and provider evidence. Paperclip owns operational use: review decisions, content planning, page targeting, rank monitoring, budget attribution, and downstream tasks.

## Competitor SERP Recall Modes

MCP supports competitor SERP recall in two modes:

1. Competitor URL ranked keywords: keywords for which a competitor URL ranks.
2. Competitor page content parsing: headings, anchors, and short content phrases parsed from the competitor page.

Content parsing is opt-in. It is disabled by default.

## Production Run Parameters

For full production semantic-core generation with maximum recall, Paperclip agents should pass:

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

## Agent Rules

- Parsed content terms are candidate evidence, not accepted keywords.
- Accepted/review/parked/rejected status must come from normal MCP gates.
- Do not accept a candidate unless `layer_membership` and status justify it.
- Import `recall_ledger` even when candidates are not accepted.
- Preserve parked and rejected candidates because later semantic layers or human review may use them.
- Show `competitor_expansion_endpoint` to reviewers when present, so they can distinguish ranked-keyword SEO evidence from parsed page-content evidence.
- Show `serp_result_classification_reason` when present, so reviewers can understand why a competitor result was considered relevant.

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
