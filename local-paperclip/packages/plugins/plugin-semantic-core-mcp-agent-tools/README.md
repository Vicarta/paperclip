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
- optional `semantic_expansion`
- optional `provider_cache`

For agent compatibility, `register-project` also accepts older Paperclip brief fields such as `target_domain`, `geo_targets`, `language_code`, `location_code`, `market_matrix`, `site_mode`, and `business_rules`. The adapter translates those fields before sending the payload to MCP so live runs do not fail config validation on stale agent-facing schema names.
If agents send top-level `semantic_expansion` or `provider_cache` beside a flat
legacy `project_config`, the adapter preserves those objects inside the
registered project config.

Keyword demand values returned in import payloads use `search_volume` as a
legacy alias for `geo_search_volume`; it must not be treated as global demand.
When available, `global_search_volume` and its status/source fields carry native
worldwide demand.

## Ownership Boundary

The MCP server owns raw generation, provider evidence, run artifacts, validation
output, review queue, cost/cache telemetry, and Paperclip import payloads.
Paperclip owns operational SEO state for agents, pages, issues, monitoring,
budgets, and accepted business decisions. Agents must import accepted MCP output
into Paperclip state before using it for downstream operational workflows.

MCP output is not a content plan. Page briefs, article briefs, implementation
tasks, monitoring targets, and content plans are downstream Paperclip work.

Agents must use `project_id`, `run_id`, and `job_id` as server-side identifiers.
Do not pass local client filesystem paths to the remote MCP server during normal
agent workflows.

## Competitor SERP Recall

The Semantic Core MCP supports opt-in competitor SERP expansion. The adapter
preserves `semantic_expansion` inside registered project config and passes it
through direct `run_layer` calls, so production semantic-core runs can request
both competitor URL ranked keywords and parsed page-content terms:

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

## Provider Cache And Live Runs

Live runs should normally use project-scoped DataForSEO cache:

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

Use `provider_cache_mode: "read_write"` for normal production runs,
`read_only` for no-spend reruns when enough cache is expected, `refresh` when
provider data must be refreshed, and `bypass` only for provider debugging.
Cache is scoped by `project_id`, not shared across companies or projects. Cache
hits are not ranking, intent, or layer-membership acceptance evidence.

Normal agent live workflow uses `run-layer-and-wait` or `run-layer` with
`async_job: true` and polling through `get-job-status`. After each live run,
call `get-run-costs` before initiating another live provider run.

## Reading Results

Use paginated result reads. Do not request thousands of rows in a single call.
Typical page size is 100.

Read:

- accepted/review/parked/rejected keywords with `get-keywords`;
- review queue with `get-review-queue`;
- clusters with `get-clusters`;
- SERP similarity/segments with `get-serp-segments`;
- run history with `list-runs`;
- cost/cache telemetry with `get-run-costs`.

Review decisions are append-only input through `submit-review-decisions`. They
do not mutate completed run artifacts; rerun the layer when decisions should be
reflected in a new artifact set.

## Security

- Do not store the bearer token in source, prompts, UI text, logs, or docs.
- Store the token as a Paperclip secret and reference it via `semanticCoreMcpTokenSecretRef`.
- Agents can pass semantic project inputs, but cannot override the configured MCP endpoint or token.
- Agents should use this Paperclip plugin rather than raw MCP URLs or desktop-local connectors.

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
