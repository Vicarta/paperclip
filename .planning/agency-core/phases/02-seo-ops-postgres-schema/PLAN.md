# Phase 2: SEO Ops Postgres Schema

## Objective

Create the durable database layer for the shared SEO Performance Loop.

The schema must support:

- multiple Paperclip companies;
- multiple projects per company;
- overlapping project scopes on the same domain/path;
- pages discovered outside Paperclip through sitemap, GSC, crawl, CMS import, or manual import;
- GSC query accumulation as evidence, not auto-accepted truth;
- semantic-core import and review decisions;
- durable semantic-core and SERP segment storage;
- page keyword target sets with tiered rank tracking;
- policy-driven rank monitoring through the Serper plugin for Google SERP positions;
- SERP snapshots and top-result evidence by search engine, geo, language, device, provider, and observation date;
- AI answer visibility tracking for ChatGPT, Claude, Gemini, and other answer engines;
- new-page opportunities from real demand;
- cost/provenance links back to Paperclip plugin runs, issues, and cost events.

## Architecture Decision

Use the existing Paperclip Postgres database with a dedicated schema:

```sql
CREATE SCHEMA IF NOT EXISTS seo_ops;
```

Do not use a separate database for MVP. SEO agents need direct joins to Paperclip `companies`, `projects`, `issues`, `plugin_job_runs`, `heartbeat_runs`, and `cost_events`.

Do not put new tables directly in `public` with only `seo_` prefixes unless Drizzle/schema tooling blocks `pgSchema`. If that fallback is used, record it as temporary technical debt with a migration path back to `seo_ops`.

## Provider Decision

Google SERP position collection must use the existing Paperclip Serper plugin first:

```text
@paperclipai/plugin-serper-agent-tools
```

The SEO Ops schema must not call Serper directly or store Serper credentials. It stores normalized Serper observations, request metadata, raw payloads, and cost/provenance references. If another provider is added later, it must fit the same `serp_*` storage contract instead of creating provider-specific operational tables.

## Implementation Location

- Drizzle schema files: `local-paperclip/packages/db/src/schema/seo_ops/*.ts`
- Schema export: `local-paperclip/packages/db/src/schema/index.ts`
- SQL migration: next file after `local-paperclip/packages/db/src/migrations/0049_heartbeat_runs_company_created_idx.sql`
- Migration journal: `local-paperclip/packages/db/src/migrations/meta/_journal.json`
- Backup/export code: `local-paperclip/packages/db/src/backup-lib.ts` must include `seo_ops`, not only `public` and `drizzle`.

## Core Tables

### `seo_ops.sites`

Site identity inside one Paperclip company.

Required fields:

- `id uuid primary key`
- `company_id uuid not null references public.companies(id)`
- `domain text not null`
- `canonical_host text`
- `default_url_scheme text default 'https'`
- `gsc_site_url text`
- `bing_site_url text`
- `status text not null default 'active'`
- `metadata jsonb not null default '{}'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints/indexes:

- unique `(company_id, domain)`
- index `(company_id, status)`

### `seo_ops.project_scopes`

Project-level ownership rules for URL discovery and monitoring.

Required fields:

- `id uuid primary key`
- `company_id uuid not null references public.companies(id)`
- `project_id uuid not null references public.projects(id)`
- `site_id uuid not null references seo_ops.sites(id)`
- `domain text not null`
- `site_scope_prefix text`
- `include_path_patterns jsonb not null default '[]'`
- `exclude_path_patterns jsonb not null default '[]'`
- `language_code text not null`
- `location_code text not null`
- `device_context text not null default 'desktop'`
- `page_type_filter text`
- `ownership_mode text not null default 'owned'`
- `conflict_policy text not null default 'flag_conflict'`
- `priority integer not null default 100`
- `status text not null default 'active'`
- `settings jsonb not null default '{}'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints/indexes:

- index `(company_id, project_id, status)`
- index `(company_id, site_id, status, priority)`
- check `ownership_mode in ('owned', 'shared', 'observe_only', 'excluded')`

### `seo_ops.discovery_runs`

Immutable run records for sitemap/GSC/crawl/manual discovery.

Required fields:

- `id uuid primary key`
- `company_id uuid not null references public.companies(id)`
- `project_id uuid references public.projects(id)`
- `site_id uuid references seo_ops.sites(id)`
- `source text not null`
- `status text not null default 'running'`
- `started_at timestamptz not null default now()`
- `finished_at timestamptz`
- `input jsonb not null default '{}'`
- `summary jsonb not null default '{}'`
- `error text`
- `plugin_job_run_id uuid`
- `heartbeat_run_id uuid`
- `cost_event_id uuid`

Constraints/indexes:

- index `(company_id, source, started_at desc)`
- index `(company_id, site_id, started_at desc)`

### `seo_ops.pages`

Canonical URL registry per company/site. This is page existence, not project ownership.

Required fields:

- `id uuid primary key`
- `company_id uuid not null references public.companies(id)`
- `site_id uuid not null references seo_ops.sites(id)`
- `canonical_url text not null`
- `canonical_url_normalized text not null`
- `path text not null`
- `url_hash text not null`
- `first_seen_at timestamptz not null default now()`
- `last_seen_at timestamptz not null default now()`
- `last_discovery_run_id uuid references seo_ops.discovery_runs(id)`
- `discovery_status text not null default 'seen'`
- `discovery_sources jsonb not null default '[]'`
- `sitemap_lastmod timestamptz`
- `http_status integer`
- `redirect_target_url text`
- `declared_canonical_url text`
- `robots_status text`
- `indexability_status text`
- `title text`
- `h1 text`
- `meta_description text`
- `detected_language_code text`
- `schema_types jsonb not null default '[]'`
- `page_type text`
- `content_hash text`
- `enrichment jsonb not null default '{}'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints/indexes:

- unique `(company_id, site_id, canonical_url_normalized)`
- unique `(company_id, site_id, url_hash)`
- index `(company_id, site_id, last_seen_at desc)`
- index `(company_id, site_id, discovery_status)`

### `seo_ops.project_pages`

Project-specific SEO ownership of a page. This is the operational SEO unit.

Required fields:

- `id uuid primary key`
- `company_id uuid not null references public.companies(id)`
- `project_id uuid not null references public.projects(id)`
- `site_id uuid not null references seo_ops.sites(id)`
- `page_id uuid not null references seo_ops.pages(id)`
- `project_scope_id uuid references seo_ops.project_scopes(id)`
- `ownership_status text not null default 'candidate'`
- `ownership_mode text not null default 'owned'`
- `primary_page_type text`
- `seo_state text not null default 'new'`
- `priority integer not null default 100`
- `monitoring_status text not null default 'active'`
- `first_owned_at timestamptz`
- `last_evaluated_at timestamptz`
- `last_changed_at timestamptz`
- `settings jsonb not null default '{}'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints/indexes:

- unique `(company_id, project_id, page_id)`
- index `(company_id, project_id, monitoring_status, seo_state)`
- index `(company_id, site_id, page_id)`

### `seo_ops.keywords`

Canonical normalized keyword universe scoped by language/location/device, not by source.

Required fields:

- `id uuid primary key`
- `normalized_keyword text not null`
- `display_keyword text not null`
- `language_code text not null`
- `location_code text not null`
- `device_context text not null default 'desktop'`
- `keyword_hash text not null`
- `status text not null default 'candidate'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints/indexes:

- unique `(normalized_keyword, language_code, location_code, device_context)`
- unique `(keyword_hash)`
- index `(language_code, location_code, status)`

### `seo_ops.keyword_observations`

Raw evidence from GSC, rank providers, semantic-core MCP, SERP tools, or manual review.

Required fields:

- `id uuid primary key`
- `company_id uuid not null references public.companies(id)`
- `project_id uuid references public.projects(id)`
- `site_id uuid references seo_ops.sites(id)`
- `page_id uuid references seo_ops.pages(id)`
- `project_page_id uuid references seo_ops.project_pages(id)`
- `keyword_id uuid references seo_ops.keywords(id)`
- `raw_query text`
- `normalized_query text`
- `source text not null`
- `source_run_id text`
- `discovery_run_id uuid references seo_ops.discovery_runs(id)`
- `date_from date`
- `date_to date`
- `country text`
- `device text`
- `search_appearance text`
- `clicks integer`
- `impressions integer`
- `ctr numeric`
- `average_position numeric`
- `geo_search_volume integer`
- `global_search_volume integer`
- `global_search_volume_status text`
- `intent_label text`
- `intent_probability numeric`
- `membership text`
- `reason text`
- `evidence_status text not null default 'raw'`
- `payload jsonb not null default '{}'`
- `observed_at timestamptz not null default now()`
- `created_at timestamptz not null default now()`

Constraints/indexes:

- index `(company_id, project_id, observed_at desc)`
- index `(company_id, project_page_id, observed_at desc)`
- index `(company_id, keyword_id, source, observed_at desc)`
- dedupe unique key for GSC observations: `(company_id, project_id, page_id, normalized_query, source, date_from, date_to, country, device)` where source is `gsc`

Notes:

- Do not store canonical SERP rank positions here. Use `seo_ops.serp_rank_observations`.
- If a source emits rank-like evidence as part of a raw payload, keep it in `payload` or import it into the canonical SERP tables.

### `seo_ops.semantic_core_runs`

Imported MCP semantic-core run metadata.

Required fields:

- `id uuid primary key`
- `company_id uuid not null references public.companies(id)`
- `project_id uuid not null references public.projects(id)`
- `client_key text not null`
- `mcp_project_id text not null`
- `mcp_run_id text not null`
- `layer text not null`
- `run_mode text`
- `schema_version text`
- `provider_versions jsonb not null default '{}'`
- `artifact_manifest_uri text`
- `source_hashes jsonb not null default '[]'`
- `cost jsonb not null default '{}'`
- `status text not null default 'imported'`
- `generated_at timestamptz`
- `imported_at timestamptz not null default now()`
- `created_at timestamptz not null default now()`

Constraints/indexes:

- unique `(company_id, project_id, mcp_run_id)`
- index `(company_id, project_id, layer, imported_at desc)`

### `seo_ops.semantic_core_memberships`

Keyword membership in layers/clusters and review state.

Required fields:

- `id uuid primary key`
- `company_id uuid not null references public.companies(id)`
- `project_id uuid not null references public.projects(id)`
- `semantic_core_run_id uuid references seo_ops.semantic_core_runs(id)`
- `keyword_id uuid not null references seo_ops.keywords(id)`
- `cluster_id text`
- `layer text not null`
- `membership text not null default 'candidate'`
- `parked_reason text`
- `rejected_reason text`
- `review_decision text`
- `reviewed_by_agent_id uuid`
- `reviewed_by_user_id text`
- `reviewed_at timestamptz`
- `payload jsonb not null default '{}'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints/indexes:

- unique `(company_id, project_id, keyword_id, layer)`
- index `(company_id, project_id, layer, membership)`

### `seo_ops.clusters`

Operational cluster registry imported from semantic-core MCP or created by SEO agents.

Required fields:

- `id uuid primary key`
- `company_id uuid not null references public.companies(id)`
- `project_id uuid not null references public.projects(id)`
- `external_cluster_id text`
- `label text not null`
- `layer text`
- `intent_label text`
- `status text not null default 'candidate'`
- `payload jsonb not null default '{}'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints/indexes:

- unique `(company_id, project_id, external_cluster_id)` where `external_cluster_id is not null`
- index `(company_id, project_id, layer, status)`

### `seo_ops.semantic_segments`

Durable segment registry for semantic-core SERP segments, audience segments, and later strategy segments. Segments are operational planning objects, not just debug artifacts.

Required fields:

- `id uuid primary key`
- `company_id uuid not null references public.companies(id)`
- `project_id uuid not null references public.projects(id)`
- `semantic_core_run_id uuid references seo_ops.semantic_core_runs(id)`
- `external_segment_id text`
- `segment_type text not null`
- `label text`
- `layer text`
- `intent_label text`
- `owner_type_final text`
- `product_bindings jsonb not null default '[]'`
- `primary_keywords jsonb not null default '[]'`
- `cluster_ids jsonb not null default '[]'`
- `evidence_summary jsonb not null default '{}'`
- `status text not null default 'candidate'`
- `payload jsonb not null default '{}'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints/indexes:

- unique `(company_id, project_id, external_segment_id)` where `external_segment_id is not null`
- index `(company_id, project_id, segment_type, status)`
- index `(company_id, project_id, layer, intent_label)`

### `seo_ops.semantic_segment_keywords`

Many-to-many keyword-to-segment relationship.

Required fields:

- `id uuid primary key`
- `company_id uuid not null references public.companies(id)`
- `project_id uuid not null references public.projects(id)`
- `semantic_segment_id uuid not null references seo_ops.semantic_segments(id)`
- `keyword_id uuid not null references seo_ops.keywords(id)`
- `relationship_type text not null default 'member'`
- `source text`
- `payload jsonb not null default '{}'`
- `created_at timestamptz not null default now()`

Constraints/indexes:

- unique `(company_id, project_id, semantic_segment_id, keyword_id, relationship_type)`
- index `(company_id, project_id, keyword_id)`

### `seo_ops.keyword_cluster_memberships`

Many-to-many keyword-to-cluster relationship.

Required fields:

- `id uuid primary key`
- `company_id uuid not null references public.companies(id)`
- `project_id uuid not null references public.projects(id)`
- `cluster_id uuid not null references seo_ops.clusters(id)`
- `keyword_id uuid not null references seo_ops.keywords(id)`
- `membership_status text not null default 'candidate'`
- `source text`
- `created_at timestamptz not null default now()`

Constraints/indexes:

- unique `(company_id, project_id, cluster_id, keyword_id)`
- index `(company_id, project_id, keyword_id)`

### `seo_ops.page_keyword_targets`

Accepted/candidate keyword target set for each project page.

Required fields:

- `id uuid primary key`
- `company_id uuid not null references public.companies(id)`
- `project_id uuid not null references public.projects(id)`
- `project_page_id uuid not null references seo_ops.project_pages(id)`
- `keyword_id uuid not null references seo_ops.keywords(id)`
- `target_type text not null`
- `status text not null default 'candidate'`
- `tier text not null default 'tier_3'`
- `source text not null`
- `priority integer not null default 100`
- `is_primary boolean not null default false`
- `accepted_at timestamptz`
- `parked_reason text`
- `rejected_reason text`
- `notes text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints/indexes:

- unique `(company_id, project_id, project_page_id, keyword_id, target_type)`
- partial unique primary target: one accepted primary per `(company_id, project_id, project_page_id)` where `is_primary = true and status = 'accepted'`
- index `(company_id, project_id, tier, status)`

### `seo_ops.rank_tracking_policies`

Company/project/tier policy for rank providers, frequency, and budgets. For Google SERP rank tracking, `provider` should be `serper` unless a later provider is explicitly configured.

Required fields:

- `id uuid primary key`
- `company_id uuid not null references public.companies(id)`
- `project_id uuid references public.projects(id)`
- `scope_level text not null`
- `tier text not null`
- `provider text not null`
- `search_engine text not null default 'google'`
- `geo text not null`
- `language_code text not null`
- `device_context text not null default 'desktop'`
- `frequency text not null`
- `interval_days integer`
- `schedule_cron text`
- `jitter_minutes integer not null default 0`
- `max_keywords integer`
- `max_cost_cents_per_period integer`
- `escalation_threshold jsonb not null default '{}'`
- `temporary_watch_duration_days integer`
- `stop_conditions jsonb not null default '{}'`
- `status text not null default 'active'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints/indexes:

- unique `(company_id, project_id, scope_level, tier, provider, search_engine, geo, language_code, device_context)` with nullable-project handling in code or separate company-default/project tables if needed
- index `(company_id, project_id, status)`

### `seo_ops.rank_tracking_targets`

Concrete scheduled rank checks derived from keyword targets and policy.

Required fields:

- `id uuid primary key`
- `company_id uuid not null references public.companies(id)`
- `project_id uuid not null references public.projects(id)`
- `project_page_id uuid references seo_ops.project_pages(id)`
- `page_keyword_target_id uuid references seo_ops.page_keyword_targets(id)`
- `keyword_id uuid not null references seo_ops.keywords(id)`
- `policy_id uuid references seo_ops.rank_tracking_policies(id)`
- `provider text not null`
- `search_engine text not null default 'google'`
- `geo text not null`
- `language_code text not null`
- `device_context text not null`
- `tracking_status text not null default 'active'`
- `next_check_at timestamptz`
- `last_check_at timestamptz`
- `temporary_watch_until timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints/indexes:

- unique `(company_id, project_id, keyword_id, provider, search_engine, geo, language_code, device_context, project_page_id)`
- index `(tracking_status, next_check_at)`
- index `(company_id, project_id, tracking_status)`

### `seo_ops.serp_snapshots`

One immutable SERP fetch result for one keyword/search context at one observation time. Google SERP snapshots are collected through the Serper plugin.

Required fields:

- `id uuid primary key`
- `company_id uuid not null references public.companies(id)`
- `project_id uuid not null references public.projects(id)`
- `site_id uuid references seo_ops.sites(id)`
- `rank_tracking_target_id uuid references seo_ops.rank_tracking_targets(id)`
- `keyword_id uuid not null references seo_ops.keywords(id)`
- `provider text not null default 'serper'`
- `search_engine text not null default 'google'`
- `geo text not null`
- `language_code text not null`
- `device_context text not null default 'desktop'`
- `requested_query text not null`
- `requested_num_results integer`
- `observed_at timestamptz not null`
- `snapshot_date date not null`
- `status text not null default 'ok'`
- `request_fingerprint text not null`
- `raw_payload jsonb not null default '{}'`
- `plugin_job_run_id uuid`
- `heartbeat_run_id uuid`
- `cost_event_id uuid`
- `created_at timestamptz not null default now()`

Constraints/indexes:

- unique `(request_fingerprint)`
- index `(company_id, project_id, snapshot_date desc)`
- index `(company_id, project_id, keyword_id, observed_at desc)`
- index `(company_id, project_id, provider, search_engine, geo, language_code, device_context, snapshot_date desc)`

### `seo_ops.serp_snapshot_results`

Normalized top-N organic and special-result rows from a SERP snapshot.

Required fields:

- `id uuid primary key`
- `company_id uuid not null references public.companies(id)`
- `project_id uuid not null references public.projects(id)`
- `serp_snapshot_id uuid not null references seo_ops.serp_snapshots(id)`
- `result_position integer not null`
- `result_type text not null default 'organic'`
- `result_url text`
- `result_url_normalized text`
- `result_domain text`
- `title text`
- `snippet text`
- `is_owned_domain boolean not null default false`
- `matched_site_id uuid references seo_ops.sites(id)`
- `matched_page_id uuid references seo_ops.pages(id)`
- `payload jsonb not null default '{}'`
- `created_at timestamptz not null default now()`

Constraints/indexes:

- unique `(serp_snapshot_id, result_position, result_type)`
- index `(company_id, project_id, result_domain)`
- index `(company_id, project_id, matched_page_id, serp_snapshot_id)`

### `seo_ops.serp_rank_observations`

Time-series rank observation for our site/page for one keyword/search context. This is derived from `serp_snapshot_results`, not a replacement for raw SERP snapshots.

Required fields:

- `id uuid primary key`
- `company_id uuid not null references public.companies(id)`
- `project_id uuid not null references public.projects(id)`
- `site_id uuid references seo_ops.sites(id)`
- `project_page_id uuid references seo_ops.project_pages(id)`
- `page_keyword_target_id uuid references seo_ops.page_keyword_targets(id)`
- `rank_tracking_target_id uuid references seo_ops.rank_tracking_targets(id)`
- `keyword_id uuid not null references seo_ops.keywords(id)`
- `serp_snapshot_id uuid references seo_ops.serp_snapshots(id)`
- `provider text not null default 'serper'`
- `search_engine text not null default 'google'`
- `geo text not null`
- `language_code text not null`
- `device_context text not null`
- `observed_at timestamptz not null`
- `snapshot_date date not null`
- `rank_position numeric`
- `rank_url text`
- `rank_url_normalized text`
- `rank_result_type text`
- `owned_result_count integer not null default 0`
- `best_owned_position numeric`
- `visibility_state text not null default 'observed'`
- `payload jsonb not null default '{}'`
- `created_at timestamptz not null default now()`

Constraints/indexes:

- unique `(company_id, project_id, keyword_id, provider, search_engine, geo, language_code, device_context, snapshot_date, project_page_id)`
- index `(company_id, project_id, keyword_id, observed_at desc)`
- index `(company_id, project_page_id, observed_at desc)`
- index `(company_id, project_id, visibility_state, snapshot_date desc)`

### `seo_ops.performance_snapshots`

Time-series page/query/GSC and summarized performance snapshots. Do not store canonical SERP rank rows here; use `seo_ops.serp_rank_observations` for rank positions.

Required fields:

- `id uuid primary key`
- `company_id uuid not null references public.companies(id)`
- `project_id uuid not null references public.projects(id)`
- `site_id uuid references seo_ops.sites(id)`
- `project_page_id uuid references seo_ops.project_pages(id)`
- `keyword_id uuid references seo_ops.keywords(id)`
- `page_keyword_target_id uuid references seo_ops.page_keyword_targets(id)`
- `snapshot_date date not null`
- `source text not null`
- `clicks integer`
- `impressions integer`
- `ctr numeric`
- `average_position numeric`
- `provider text`
- `classification text`
- `payload jsonb not null default '{}'`
- `created_at timestamptz not null default now()`

Constraints/indexes:

- index `(company_id, project_id, snapshot_date desc)`
- index `(company_id, project_page_id, snapshot_date desc)`
- index `(company_id, keyword_id, snapshot_date desc)`

### `seo_ops.new_page_opportunities`

Validated or pending demand where no good landing page exists.

Required fields:

- `id uuid primary key`
- `company_id uuid not null references public.companies(id)`
- `project_id uuid not null references public.projects(id)`
- `site_id uuid references seo_ops.sites(id)`
- `keyword_id uuid references seo_ops.keywords(id)`
- `source_observation_id uuid references seo_ops.keyword_observations(id)`
- `current_page_id uuid references seo_ops.pages(id)`
- `current_project_page_id uuid references seo_ops.project_pages(id)`
- `landing_fit_state text not null`
- `intent_label text`
- `audience_relevance text`
- `topical_authority_fit text`
- `product_relation text`
- `business_value text`
- `proposed_page_type text`
- `suggested_priority integer not null default 100`
- `validation_status text not null default 'candidate'`
- `decision text`
- `linked_issue_id uuid references public.issues(id)`
- `payload jsonb not null default '{}'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints/indexes:

- index `(company_id, project_id, validation_status, suggested_priority)`
- index `(company_id, keyword_id)`

### `seo_ops.ai_visibility_targets`

Configured recurring answer-engine visibility checks. These are not normal SERP rank targets; they represent prompts/questions checked in ChatGPT, Claude, Gemini, or another answer engine.

Required fields:

- `id uuid primary key`
- `company_id uuid not null references public.companies(id)`
- `project_id uuid not null references public.projects(id)`
- `site_id uuid references seo_ops.sites(id)`
- `keyword_id uuid references seo_ops.keywords(id)`
- `project_page_id uuid references seo_ops.project_pages(id)`
- `prompt_text text not null`
- `prompt_normalized text not null`
- `answer_engine text not null`
- `engine_variant text`
- `geo text`
- `language_code text not null`
- `device_context text`
- `target_domain text`
- `target_url text`
- `frequency text not null`
- `interval_days integer`
- `next_check_at timestamptz`
- `last_check_at timestamptz`
- `tracking_status text not null default 'active'`
- `priority integer not null default 100`
- `settings jsonb not null default '{}'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints/indexes:

- unique `(company_id, project_id, prompt_normalized, answer_engine, engine_variant, geo, language_code, target_domain)`
- index `(tracking_status, next_check_at)`
- index `(company_id, project_id, answer_engine, tracking_status)`

### `seo_ops.ai_visibility_observations`

Time-series observations of whether the site, brand, or URL is mentioned in answer-engine output on a given date.

Required fields:

- `id uuid primary key`
- `company_id uuid not null references public.companies(id)`
- `project_id uuid not null references public.projects(id)`
- `site_id uuid references seo_ops.sites(id)`
- `ai_visibility_target_id uuid not null references seo_ops.ai_visibility_targets(id)`
- `keyword_id uuid references seo_ops.keywords(id)`
- `project_page_id uuid references seo_ops.project_pages(id)`
- `answer_engine text not null`
- `engine_variant text`
- `geo text`
- `language_code text not null`
- `observed_at timestamptz not null`
- `snapshot_date date not null`
- `prompt_text text not null`
- `answer_hash text not null`
- `target_domain_mentioned boolean not null default false`
- `brand_mentioned boolean not null default false`
- `target_url_mentioned boolean not null default false`
- `mentioned_urls jsonb not null default '[]'`
- `mention_rank integer`
- `visibility_score numeric`
- `sentiment_label text`
- `citation_count integer`
- `raw_answer_excerpt text`
- `raw_payload jsonb not null default '{}'`
- `provider text`
- `plugin_job_run_id uuid`
- `heartbeat_run_id uuid`
- `cost_event_id uuid`
- `created_at timestamptz not null default now()`

Constraints/indexes:

- unique `(ai_visibility_target_id, answer_engine, engine_variant, snapshot_date, answer_hash)`
- index `(company_id, project_id, answer_engine, snapshot_date desc)`
- index `(company_id, project_id, target_domain_mentioned, snapshot_date desc)`
- index `(company_id, project_page_id, snapshot_date desc)`

### `seo_ops.page_action_events`

Immutable record of SEO-relevant changes to a project page.

Required fields:

- `id uuid primary key`
- `company_id uuid not null references public.companies(id)`
- `project_id uuid not null references public.projects(id)`
- `project_page_id uuid not null references seo_ops.project_pages(id)`
- `issue_id uuid references public.issues(id)`
- `agent_id uuid`
- `event_type text not null`
- `event_payload jsonb not null default '{}'`
- `occurred_at timestamptz not null default now()`
- `created_at timestamptz not null default now()`

Constraints/indexes:

- index `(company_id, project_id, project_page_id, occurred_at desc)`
- index `(company_id, issue_id)`

### `seo_ops.scope_conflicts`

Conflicts when several project scopes claim the same URL in incompatible ways.

Required fields:

- `id uuid primary key`
- `company_id uuid not null references public.companies(id)`
- `site_id uuid not null references seo_ops.sites(id)`
- `page_id uuid not null references seo_ops.pages(id)`
- `conflict_type text not null`
- `conflicting_project_page_ids jsonb not null default '[]'`
- `status text not null default 'open'`
- `resolution text`
- `resolved_by_agent_id uuid`
- `resolved_by_user_id text`
- `resolved_at timestamptz`
- `linked_issue_id uuid references public.issues(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints/indexes:

- index `(company_id, status, created_at desc)`
- index `(company_id, site_id, page_id)`

## Deferred Phase 2.1 Tables

Defer unless required by plugin implementation:

- `seo_ops.provider_cost_events` if existing `public.cost_events` cannot represent provider request counts granularly.
- `seo_ops.artifact_links` if MCP artifact URIs need a generic normalized table rather than JSON fields on run tables.

Do not defer semantic segments, SERP snapshots, SERP rank observations, or AI visibility observations. They are part of Phase 2 because they define the durable monitoring model.

## Drizzle Requirements

- Prefer `pgSchema("seo_ops")` for table definitions.
- Keep FK references to `public` Paperclip tables explicit and tested.
- Use `jsonb` for provider payloads and forward-compatible metadata, but keep operational query fields as typed columns.
- Use `numeric` for CTR/positions/probabilities, not float.
- Use partial indexes where needed for accepted primary keyword enforcement.
- Do not rely on plain unique constraints with nullable columns. For nullable dimensions like `project_id`, `project_page_id`, `engine_variant`, `geo`, or `target_domain`, use generated/fingerprint keys or explicit partial unique indexes.
- Add migration idempotency guards where compatible with existing migration runtime.

## Operational Requirements

- Every operational table must include `company_id`.
- Every project-owned table must include `project_id`.
- Do not identify page ownership by URL alone.
- Do not identify keywords by text alone; include language/location/device.
- Preserve raw GSC query text even when normalized keyword differs.
- Never reject a keyword only because external volume is zero/null/unavailable.
- Store source/provenance IDs for MCP/import/provider runs.
- Store every discovered page at `seo_ops.pages` before deciding whether a project owns it.
- Store semantic segments as first-class planning objects, not only as JSON artifacts.
- Store SERP rank observations separately from GSC performance snapshots.
- Store `provider`, `search_engine`, `geo`, `language_code`, `device_context`, and observation date on every SERP rank row.
- Use the Serper plugin as the first Google SERP rank collection provider.
- Store AI answer-engine visibility separately from SERP rank data.
- Treat ChatGPT, Claude, Gemini, and future answer engines as answer-engine dimensions, not search-engine providers.
- Rank tracking frequency must come from policy rows, not agent prompts.

## Verification Plan

1. Run DB package typecheck/build.
2. Run migration-numbering check.
3. Run migration status tests.
4. Add focused tests that create:
   - two companies with the same domain;
   - two projects in one company with overlapping scopes;
   - one sitemap-discovered page;
   - one GSC-discovered keyword observation;
   - one accepted page keyword target;
   - one semantic segment with keyword memberships;
   - one Serper-backed rank tracking target from policy;
   - one SERP snapshot with top results;
   - one SERP rank observation for the owned domain/page;
   - one AI visibility target and one ChatGPT/Claude/Gemini observation;
   - one new-page opportunity from a `no_landing_page` query.
5. Verify backup/export includes `seo_ops` schema and can restore it.

## Acceptance Criteria

- `seo_ops` schema is created by migration.
- MVP tables exist with FKs, indexes, unique constraints, and JSON payload fields.
- Drizzle exports include SEO Ops schema.
- Backup/export tooling includes `seo_ops`.
- Multi-company same-domain records are allowed.
- Same-company overlapping project scope conflict can be represented.
- All discovered site pages can be stored even when no project owns them yet.
- GSC observations can create keyword candidates without auto-accepting them.
- Semantic-core segments can be imported, queried, and linked to keywords.
- Page keyword targets can store primary, secondary, cluster, GSC-discovered, opportunity, business-priority, and temporary-watch targets.
- Rank tracking policies can be configured at company/project/tier level.
- Serper-backed Google SERP snapshots and rank observations can be stored per keyword/search engine/geo/language/device/date.
- AI answer visibility can be stored per prompt/answer engine/geo/language/date, including domain/brand/URL mentions.
- New-page opportunities can link back to source GSC observation and forward to a Paperclip issue.

## Non-Goals

- Do not implement sitemap crawler logic in this phase.
- Do not implement GSC import jobs in this phase.
- Do not implement rank provider calls in this phase.
- Do not build UI screens in this phase.
- Do not migrate existing Astrogen/DiskInternals SEO data yet.

## Critical Review After Scope Expansion

The revised schema now covers the requested durable state: all discovered pages, semantic core, semantic segments, page keyword targets, Serper-backed SERP positions, SERP top-result evidence, and AI answer visibility. It is now closer to a `Search + Answer Engine Visibility Store` than the earlier article-only performance loop.

Remaining implementation risks:

- Table count is high for one migration. Implementation should be split into small Drizzle files under `schema/seo_ops/`, but one migration can still create the full schema if tests stay focused.
- `performance_snapshots` must stay GSC/page-performance focused. Do not reintroduce canonical SERP rank fields there.
- Serper is Google-first. `search_engine` is still stored so Bing or another provider can be added later without schema redesign.
- AI visibility provider mechanics are not defined here. This phase stores the durable state only; provider tools/runners can be implemented later.
- Nullable unique dimensions must be handled carefully in SQL. Plain Postgres unique constraints allow multiple NULLs, which would break idempotency for targets and observations.
- Existing plugin code may still contain legacy article-centric names. Implementation should map any old article registry concept onto `project_pages` and avoid reintroducing article-only assumptions.
