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
legacy `project_config` during `register-project`, the adapter preserves those
objects inside the registered project config. Do not send these options to
`run-layer`: live MCP reads them only from the registered `project_config`, so
the adapter rejects them on `run-layer` instead of allowing a silent no-op.

Keyword demand values returned in import payloads use `search_volume` as a
legacy alias for `geo_search_volume`; it must not be treated as global demand.
When available, `global_search_volume` and its status/source fields carry native
worldwide demand.

`prepare-paperclip-import` treats these artifact names as keyword-like artifacts:
`accepted_keywords`, `review_candidates`, `parked_outside_layer`,
`rejected_noise`, `serp_competitor_candidates`, and `recall_ledger`. The adapter
fills missing volume contract fields on those rows and rejects provider error
text such as `Invalid Field`, `enable_browser_rendering`, `status_message`, or
standalone timing strings like `0 sec`.

`clusters` and `serp_segments` are native non-keyword artifacts. Do not render or
import them through keyword CSV columns; use their own schema from
`prepare_paperclip_import().artifacts`, `get_clusters`, or `get_serp_segments`.

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

## Required Agent Workflow

Normal agent flow:

1. Call `list-tools` or `smoke-test` to confirm connectivity.
2. Call `register-project`.
3. Call `validate-project` and continue only when validation returns `status = ok`.
4. Use `mode: "mock"` for adapter smoke tests.
5. Use `mode: "live"` with `provider_cache_mode: "read_write"` for production semantic-core runs.
6. Poll with `get-job-status` or use `run-layer-and-wait`.
7. Call `get-run-costs` before another live provider run.
8. Read keywords, clusters, SERP segments, review queue, and import payloads with pagination.
9. Submit review decisions as append-only input; completed run artifacts are immutable.
10. Import accepted output into Paperclip DB before downstream planning or monitoring.

Do not generate content plans directly from MCP outputs. Content planning is downstream Paperclip work.

## Policy-Driven Layer Decisions

The MCP layer decision engine is policy-driven. Agents must not assume hardcoded
allowed/forbidden words.

Project-specific niche terms belong in `project_config`, seed catalog, entity
inputs, or `semantic_expansion`. High-demand conflicts should be routed to review
rather than silently parked or rejected.

When broad or ambiguous keywords may be commercially important, register a review
escalation policy in project config:

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

When this policy fires, MCP returns `candidate_review` with
`parked_reason = high_demand_conflict`. This is not auto-acceptance; it is a
safeguard against losing high-demand keywords silently. Inspect `decision_trace`
when explaining membership decisions.

## Competitor SERP Recall

The Semantic Core MCP supports opt-in competitor SERP expansion. The adapter
preserves `semantic_expansion` inside registered project config, so production
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
- `decision_trace`;
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
Invalid cached provider responses are provider/cache telemetry, not keyword
evidence. If MCP returns a provider or task error, the adapter must not pass that
error text downstream as a keyword row.

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
- `validate-project`
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
