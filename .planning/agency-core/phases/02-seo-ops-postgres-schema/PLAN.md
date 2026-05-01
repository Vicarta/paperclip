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
- page keyword target sets with tiered rank tracking;
- policy-driven rank monitoring;
- new-page opportunities from real demand;
- cost/provenance links back to Paperclip plugin runs, issues, and cost events.

## Architecture Decision

Use the existing Paperclip Postgres database with a dedicated schema:

```sql
CREATE SCHEMA IF NOT EXISTS seo_ops;
```

Do not use a separate database for MVP. SEO agents need direct joins to Paperclip `companies`, `projects`, `issues`, `plugin_job_runs`, `heartbeat_runs`, and `cost_events`.

Do not put new tables directly in `public` with only `seo_` prefixes unless Drizzle/schema tooling blocks `pgSchema`. If that fallback is used, record it as temporary technical debt with a migration path back to `seo_ops`.

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
- `rank_position numeric`
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

Company/project/tier policy for rank providers, frequency, and budgets.

Required fields:

- `id uuid primary key`
- `company_id uuid not null references public.companies(id)`
- `project_id uuid references public.projects(id)`
- `scope_level text not null`
- `tier text not null`
- `provider text not null`
- `geo text not null`
- `language_code text not null`
- `device_context text not null default 'desktop'`
- `frequency text not null`
- `max_keywords integer`
- `max_cost_cents_per_period integer`
- `escalation_threshold jsonb not null default '{}'`
- `temporary_watch_duration_days integer`
- `stop_conditions jsonb not null default '{}'`
- `status text not null default 'active'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints/indexes:

- unique `(company_id, project_id, scope_level, tier, geo, language_code, device_context)` with nullable-project handling in code or separate company-default/project tables if needed
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

- unique `(company_id, project_id, keyword_id, geo, language_code, device_context, project_page_id)`
- index `(tracking_status, next_check_at)`
- index `(company_id, project_id, tracking_status)`

### `seo_ops.performance_snapshots`

Time-series page/query/rank/GSC snapshots.

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
- `rank_position numeric`
- `rank_url text`
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

## Optional Phase 2.1 Tables

Defer unless required by plugin implementation:

- `seo_ops.provider_cost_events` if existing `public.cost_events` cannot represent provider request counts granularly.
- `seo_ops.artifact_links` if MCP artifact URIs need a generic normalized table rather than JSON fields on run tables.
- `seo_ops.serp_segments` if semantic-core or winning-structure imports need durable SERP segment state before rank monitoring uses it.

## Drizzle Requirements

- Prefer `pgSchema("seo_ops")` for table definitions.
- Keep FK references to `public` Paperclip tables explicit and tested.
- Use `jsonb` for provider payloads and forward-compatible metadata, but keep operational query fields as typed columns.
- Use `numeric` for CTR/positions/probabilities, not float.
- Use partial indexes where needed for accepted primary keyword enforcement.
- Add migration idempotency guards where compatible with existing migration runtime.

## Operational Requirements

- Every operational table must include `company_id`.
- Every project-owned table must include `project_id`.
- Do not identify page ownership by URL alone.
- Do not identify keywords by text alone; include language/location/device.
- Preserve raw GSC query text even when normalized keyword differs.
- Never reject a keyword only because external volume is zero/null/unavailable.
- Store source/provenance IDs for MCP/import/provider runs.
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
   - one rank tracking target from policy;
   - one new-page opportunity from a `no_landing_page` query.
5. Verify backup/export includes `seo_ops` schema and can restore it.

## Acceptance Criteria

- `seo_ops` schema is created by migration.
- MVP tables exist with FKs, indexes, unique constraints, and JSON payload fields.
- Drizzle exports include SEO Ops schema.
- Backup/export tooling includes `seo_ops`.
- Multi-company same-domain records are allowed.
- Same-company overlapping project scope conflict can be represented.
- GSC observations can create keyword candidates without auto-accepting them.
- Page keyword targets can store primary, secondary, cluster, GSC-discovered, opportunity, business-priority, and temporary-watch targets.
- Rank tracking policies can be configured at company/project/tier level.
- New-page opportunities can link back to source GSC observation and forward to a Paperclip issue.

## Non-Goals

- Do not implement sitemap crawler logic in this phase.
- Do not implement GSC import jobs in this phase.
- Do not implement rank provider calls in this phase.
- Do not build UI screens in this phase.
- Do not migrate existing Astrogen/DiskInternals SEO data yet.
