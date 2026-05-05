# Semantic Core MCP Agent Tools

Thin Paperclip adapter for a private Semantic Core MCP endpoint.

The plugin does not generate semantic cores itself. It keeps endpoint credentials on the backend, calls the MCP server, validates `paperclip_import.v1`, and stores operational import candidates in plugin-owned Paperclip state/entities for downstream SEO agents.

## Project Config Compatibility

The MCP server expects the current project config contract:

- `site_id`
- `domain`
- `locale_matrix`
- `sections`
- `owner_rules`
- `thresholds`
- `intent_rules`
- `title_meta_policy`

For agent compatibility, `register-project` also accepts older Paperclip brief fields such as `target_domain`, `geo_targets`, `language_code`, `location_code`, `market_matrix`, `site_mode`, and `business_rules`. The adapter translates those fields before sending the payload to MCP so live runs do not fail config validation on stale agent-facing schema names.

Keyword demand values returned in import payloads use `search_volume` as a
legacy alias for `geo_search_volume`; it must not be treated as global demand.
When available, `global_search_volume` and its status/source fields carry native
worldwide demand.

## Competitor SERP Recall

The Semantic Core MCP supports opt-in competitor SERP expansion. The adapter
passes `semantic_expansion` through direct `run_layer` calls, so production
semantic-core runs can request both competitor URL ranked keywords and parsed
page-content terms:

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

Recommended usage:

- Production semantic-core runs: set `enable_content_parsing: true`.
- Quick, smoke, or budget-sensitive runs: leave content parsing disabled.
- Do not treat parsed content terms as accepted keywords unless the returned row passes normal `layer_membership`/status gates.
- Preserve `recall_ledger` and review/parked/rejected candidates because they can inform later layers or human review.

When `prepare-paperclip-import` receives competitor expansion artifacts, the tool response includes a `competitor_expansion` summary with counts for:

- `serp_result_classification_reason`;
- `competitor_expansion_endpoint`;
- `recall_ledger`;
- `serp_competitor_candidates`;
- `competitor_expansion_debug.source_counts`;
- `competitor_expansion_debug.endpoint_counts`;
- `competitor_expansion_debug.result_type_counts`.

## Security

- Do not store the bearer token in source, prompts, UI text, logs, or docs.
- Store the token as a Paperclip secret and reference it via `semanticCoreMcpTokenSecretRef`.
- Agents can pass semantic project inputs, but cannot override the configured MCP endpoint or token.

## Tools

- `list-tools`
- `get-paperclip-import-schema`
- `register-project`
- `run-layer`
- `run-layer-and-wait`
- `get-job-status`
- `list-runs`
- `get-keywords`
- `get-clusters`
- `get-serp-segments`
- `prepare-paperclip-import`
- `get-review-queue`
- `submit-review-decisions`
- `get-run-costs`
- `smoke-test`

## Verification

```bash
pnpm --filter @paperclipai/plugin-semantic-core-mcp-agent-tools typecheck
pnpm --filter @paperclipai/plugin-semantic-core-mcp-agent-tools test
pnpm --filter @paperclipai/plugin-semantic-core-mcp-agent-tools build
```
