# SEO Performance Loop Schema Design

This document defines the first DB/schema slice for the `SEO Performance Loop` plugin.
It is a design/spec only document. It does not introduce migrations, seed data, or live API calls.

## Scope

The plugin owns five logical tables:

1. `seo_published_articles`
2. `seo_article_telemetry_snapshots`
3. `seo_article_query_snapshots`
4. `seo_article_decisions`
5. `seo_performance_policies`

Physical table naming may follow the platform's plugin-table conventions, but the logical names above are the canonical contract for this phase.

## Design Principles

- One canonical published-article registry row per live article identity.
- Publication registration must be idempotent.
- Telemetry snapshots are append-only.
- Decisions are append-only and retain the policy snapshot used at decision time.
- Policies are mutable, but the current default policy must be explicit and queryable.
- Retention is time-based and enforced by a later cleanup job, not by ad hoc deletions.

## `seo_published_articles`

This is the canonical registry row for a published article.
It is the source of truth for later telemetry lookup and decision making.

### Columns

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | yes | Primary key. |
| `company_id` | `uuid` | yes | Owning company. |
| `project_id` | `uuid` | yes | Owning project. |
| `origin_issue_id` | `uuid` | yes | First issue that produced this published page. Immutable. |
| `current_issue_id` | `uuid` | yes | Latest issue that refreshed the page. Mutable on republish. |
| `publication_event_key` | `text` | yes | Idempotency key from the publication-completed callback. |
| `publication_channel` | `text` | yes | Canonical publishing channel, e.g. `web`. |
| `publication_adapter` | `text` | yes | Adapter or publisher implementation name. |
| `first_published_at` | `timestamptz` | yes | First successful publication time. |
| `last_published_at` | `timestamptz` | yes | Latest successful publication time. |
| `canonical_url` | `text` | yes | Canonical published URL. |
| `canonical_slug` | `text` | yes | Canonical slug at the time of the latest publication. |
| `route_key` | `text` | yes | Product route or content lane. |
| `product_surface` | `text` | yes | Surface label, e.g. blog route, glossary, landing page. |
| `language` | `text` | yes | Article language. |
| `geo` | `text` | yes | Default geo for rank tracking. |
| `primary_keyword` | `text` | yes | Canonical tracked keyword. |
| `supporting_keywords_json` | `jsonb` | yes | Array of supporting keywords or keyword groups. |
| `title_snapshot` | `text` | yes | Final public title snapshot. |
| `h1_snapshot` | `text` | yes | Final public H1 snapshot. |
| `meta_title_snapshot` | `text` | yes | HTML `<title>` snapshot. |
| `meta_description_snapshot` | `text` | yes | HTML meta description snapshot. |
| `author_snapshot` | `text` | yes | Published author provenance. |
| `publishable_markdown_attachment_id` | `uuid` | yes | Clean Markdown artifact attachment. |
| `publishable_html_attachment_id` | `uuid` | yes | Clean HTML artifact attachment. |
| `editorial_source_attachment_id` | `uuid` | yes | Stage 59/61 source artifact attachment. |
| `image_asset_ref` | `text` | no | Future publication-image reference. |
| `status` | `text` | yes | One of `published`, `republished`, `retired`. |
| `republish_count` | `integer` | yes | Starts at `0`. Incremented on republish. |
| `retired_at` | `timestamptz` | no | Populated when the page is retired. |
| `created_at` | `timestamptz` | yes | Row creation time. |
| `updated_at` | `timestamptz` | yes | Row update time. |

### Constraints and Indexes

Required uniqueness rules:

- Unique on `(company_id, project_id, publication_event_key)`.
- Unique on `(company_id, project_id, origin_issue_id)`.
- Unique on `(company_id, project_id, canonical_url)`.

Recommended indexes:

- `(company_id, project_id, status, last_published_at desc)`
- `(company_id, project_id, canonical_url)`
- `(company_id, project_id, primary_keyword)`
- `(company_id, project_id, route_key, product_surface)`
- `(company_id, project_id, current_issue_id)`
- `(company_id, project_id, first_published_at desc)`

### Update Rules

- `origin_issue_id` never changes.
- `current_issue_id` changes when the same live page is refreshed from a new issue.
- `publication_event_key` is write-once per event; duplicate callbacks must no-op.
- `canonical_url` may change if the publisher confirms a canonical move for the same article identity.
- `republish_count` increments when the row is updated by a later publication event for the same live page.
- `status = retired` means the row stays in the registry but should be skipped by new telemetry collection.

## `seo_article_telemetry_snapshots`

This table stores weekly page-level telemetry and rank observations.
It is append-only.

### Columns

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | yes | Primary key. |
| `company_id` | `uuid` | yes | Owning company. |
| `project_id` | `uuid` | yes | Owning project. |
| `published_article_id` | `uuid` | yes | FK to `seo_published_articles.id`. |
| `collection_run_key` | `text` | yes | Idempotency/provenance key for the weekly job run. |
| `source_kind` | `text` | yes | One of `gsc` or `rank_provider`. |
| `source_key` | `text` | yes | Source identifier, e.g. GSC property URL or rank provider name. |
| `snapshot_window_start` | `timestamptz` | yes | Start of the measured period. |
| `snapshot_window_end` | `timestamptz` | yes | End of the measured period. |
| `captured_at` | `timestamptz` | yes | When the snapshot was stored. |
| `page_impressions` | `integer` | no | Page-level impressions from GSC. |
| `page_clicks` | `integer` | no | Page-level clicks from GSC. |
| `page_ctr` | `numeric(8,4)` | no | Page-level CTR from GSC. |
| `page_average_position` | `numeric(8,2)` | no | Page-level average position from GSC. |
| `rank_keyword` | `text` | no | Primary tracked keyword for rank snapshots. |
| `rank_geo` | `text` | no | Geo used for rank snapshot. |
| `rank_language` | `text` | no | Language used for rank snapshot. |
| `rank_position` | `numeric(8,2)` | no | Observed rank. |
| `raw_payload_json` | `jsonb` | yes | Provider payload for debugging and replay. |
| `snapshot_fingerprint` | `text` | yes | Deterministic dedupe key. |
| `created_at` | `timestamptz` | yes | Row creation time. |

### Constraints and Indexes

Required uniqueness rules:

- Unique on `snapshot_fingerprint`.
- Also enforce a logical composite uniqueness for the same article/window/source tuple:
  - `published_article_id`
  - `source_kind`
  - `source_key`
  - `snapshot_window_start`
  - `snapshot_window_end`
  - `rank_keyword`
  - `rank_geo`
  - `rank_language`

Recommended indexes:

- `(company_id, project_id, published_article_id, snapshot_window_end desc)`
- `(company_id, project_id, source_kind, snapshot_window_end desc)`
- `(company_id, project_id, rank_keyword, rank_geo, rank_language, snapshot_window_end desc)`
- `(company_id, project_id, collection_run_key)`

### Update Rules

- Telemetry snapshots are append-only.
- Duplicate payloads must be deduped by `snapshot_fingerprint`.
- `source_kind = gsc` primarily fills page metrics.
- `source_kind = rank_provider` primarily fills rank fields.
- Nulls are allowed on fields that do not apply to the chosen source kind.

## `seo_article_query_snapshots`

This table stores the query-level rows returned from GSC.
It is append-only and always linked to one parent telemetry snapshot.

### Columns

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | yes | Primary key. |
| `company_id` | `uuid` | yes | Owning company. |
| `project_id` | `uuid` | yes | Owning project. |
| `telemetry_snapshot_id` | `uuid` | yes | FK to `seo_article_telemetry_snapshots.id`. |
| `query` | `text` | yes | Raw query string from GSC. |
| `query_normalized` | `text` | yes | Lower-cased, trimmed, deduped query string. |
| `clicks` | `integer` | yes | Query clicks. |
| `impressions` | `integer` | yes | Query impressions. |
| `ctr` | `numeric(8,4)` | yes | Query CTR. |
| `average_position` | `numeric(8,2)` | yes | Query average position. |
| `query_snapshot_key` | `text` | yes | Deterministic dedupe key. |
| `raw_payload_json` | `jsonb` | no | Optional per-row payload if the provider emits it. |
| `created_at` | `timestamptz` | yes | Row creation time. |

### Constraints and Indexes

Required uniqueness rules:

- Unique on `query_snapshot_key`.
- Unique on `(telemetry_snapshot_id, query_normalized)`.

Recommended indexes:

- `(company_id, project_id, telemetry_snapshot_id)`
- `(company_id, project_id, query_normalized)`
- `(company_id, project_id, query_normalized, average_position)`

### Update Rules

- Query rows are append-only under the parent telemetry snapshot.
- The same normalized query must not be inserted twice for one snapshot.

## `seo_article_decisions`

This table stores the weekly senior SEO decision record.
It is append-only.

### Columns

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | yes | Primary key. |
| `company_id` | `uuid` | yes | Owning company. |
| `project_id` | `uuid` | yes | Owning project. |
| `published_article_id` | `uuid` | yes | FK to `seo_published_articles.id`. |
| `decision_window_start` | `timestamptz` | yes | Start of the decision window. |
| `decision_window_end` | `timestamptz` | yes | End of the decision window. |
| `decision_status` | `text` | yes | One of `hold`, `watch`, `refresh`, `benchmark_serp`, `offpage_recommendation`, `escalate`. |
| `decision_reason` | `text` | yes | Human-readable explanation. |
| `trigger_snapshot_ids_json` | `jsonb` | yes | Ordered snapshot IDs used in the decision. |
| `policy_id` | `uuid` | yes | Active policy used for the decision. |
| `policy_snapshot_json` | `jsonb` | yes | Immutable copy of the policy parameters. |
| `metrics_snapshot_json` | `jsonb` | yes | Compact metric summary used for the decision. |
| `opened_issue_id` | `uuid` | no | Follow-up issue opened as a result of the decision. |
| `created_by_agent_id` | `uuid` | no | Agent that authored the decision. |
| `decision_key` | `text` | yes | Dedupe key for the decision write. |
| `created_at` | `timestamptz` | yes | Row creation time. |

### Constraints and Indexes

Required uniqueness rules:

- Unique on `decision_key`.
- Unique on `(published_article_id, decision_window_end, policy_id)`.

Recommended indexes:

- `(company_id, project_id, published_article_id, decision_window_end desc)`
- `(company_id, project_id, decision_status, decision_window_end desc)`
- `(company_id, project_id, opened_issue_id)`

### Update Rules

- Decisions are append-only.
- A later week may supersede a prior decision, but the previous row stays intact.
- If the system opens a follow-up issue, the issue ID is recorded back into the decision row.

## `seo_performance_policies`

This table stores the configurable thresholds for `stable`, `noisy`, and `declining`.
The thresholds are parameters, not hard-coded constants.

### Columns

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | yes | Primary key. |
| `company_id` | `uuid` | yes | Owning company. |
| `name` | `text` | yes | Human-readable policy name. |
| `is_default` | `boolean` | yes | Exactly one default policy per company. |
| `stable_window_weeks` | `integer` | yes | Stability lookback window. |
| `noisy_window_weeks` | `integer` | yes | Noisy lookback window. |
| `decline_window_weeks` | `integer` | yes | Decline lookback window. |
| `stable_position_delta_threshold` | `numeric(8,2)` | yes | Position change threshold for `stable`. |
| `decline_position_delta_threshold` | `numeric(8,2)` | yes | Position change threshold for `declining`. |
| `stable_click_delta_pct` | `numeric(8,2)` | yes | Click change threshold for `stable`. |
| `decline_click_delta_pct` | `numeric(8,2)` | yes | Click change threshold for `declining`. |
| `stable_impression_delta_pct` | `numeric(8,2)` | yes | Impression change threshold for `stable`. |
| `decline_impression_delta_pct` | `numeric(8,2)` | yes | Impression change threshold for `declining`. |
| `created_at` | `timestamptz` | yes | Row creation time. |
| `updated_at` | `timestamptz` | yes | Row update time. |

### Constraints and Indexes

Required uniqueness rules:

- Only one row per company may have `is_default = true`.

Recommended indexes:

- `(company_id, is_default desc, updated_at desc)`
- `(company_id, name)`

### Update Rules

- Policies are mutable and versioned by timestamp.
- A decision row must store the exact policy snapshot used at decision time, so later policy edits do not change history.

## Retention

Recommended initial retention:

- `seo_published_articles`: retain indefinitely while live; keep retired rows indefinitely unless a later archive policy is introduced.
- `seo_article_telemetry_snapshots`: retain 18 months of raw snapshots.
- `seo_article_query_snapshots`: retain 12 months of query rows, or the same horizon as telemetry if storage pressure is low.
- `seo_article_decisions`: retain indefinitely.
- `seo_performance_policies`: retain indefinitely.

Retention cleanup should be a scheduled maintenance job, not part of the publication or telemetry write path.

## Publication-Time Registration Path

The registration path must be automatic and idempotent.

1. The publication adapter confirms that the page is live and canonical.
2. The adapter emits a publication-completed payload with the full article snapshot:
   - issue references
   - canonical URL and slug
   - SEO snapshots
   - attachment references
   - author and route metadata
3. The plugin upserts `seo_published_articles`.
4. If the row does not exist, insert it.
5. If the row already exists by `canonical_url`, `origin_issue_id`, or `publication_event_key`, update the mutable fields and treat the call as a republish or duplicate event.
6. The returned `published_article_id` becomes the join key for all future telemetry and decisions.

The registration step must not create duplicate rows for the same live page.

## Non-Goals For This Slice

- No migrations.
- No provider OAuth implementation.
- No rank-provider API wiring.
- No decision agent prompt.
- No live issue opening.
- No article rewriting.

