# Google Search Console And Rank Ingestion Contract

## Purpose

This document defines the first canonical ingestion contract for the `SEO Performance Loop` plugin.
It covers:

- Google Search Console credential and property mapping;
- page and query telemetry dimensions;
- configurable collection windows;
- Serper-backed Google SERP rank collection;
- error handling, retries, and idempotency;
- how snapshots are persisted for downstream decision jobs.

This is a contract only. It does not contain live secrets, live API calls, or provider-specific credentials.

## Scope

The first version of the plugin must treat the following as governed inputs:

1. a single canonical Google Search Console property mapping;
2. Serper plugin as the first Google SERP rank provider;
3. configurable telemetry/rank collection cadence and decision evaluation;
4. persisted snapshots that can be queried later by agents and tools.

The plugin must not embed external auth logic inside free-form prompts.

## Canonical Settings

The plugin instance settings must expose these configuration values:

- `googleSearchConsoleCredentialSecretRef`
- `googleSearchConsolePropertyUrl`
- `defaultRankProvider`
- `defaultSearchEngine`
- `defaultRankGeo`
- `defaultRankLanguage`
- `defaultRankDevice`
- `defaultPolicyId`
- `weeklyCollectionEnabled`
- `weeklyCollectionDay`
- `weeklyCollectionHourUtc`

### Google Search Console Credential Secret

`googleSearchConsoleCredentialSecretRef` must point to a secret managed by Paperclip.

The secret must contain only credential material needed by the connector, not business data.
It should be treated as opaque by the plugin UI and by downstream agents.

Recommended secret shape:

- OAuth client credentials or equivalent Google access material;
- refresh token or delegated access material if that is the chosen auth path;
- token metadata required to refresh access;
- no page telemetry, no page metadata, no rank data.

The plugin must reject missing or empty credential refs before any scheduled job starts.

### Google Search Console Property Mapping

`googleSearchConsolePropertyUrl` is the canonical property selector.

Normalization rules:

- accept one canonical property string per plugin instance;
- preserve the configured scheme and trailing slash for URL-prefix properties;
- treat `https://example.com/` and `https://example.com` as the same property target after normalization;
- do not silently switch between domain property and URL-prefix property;
- if the property is a domain property, store the domain form explicitly as the canonical property key;
- if a property is not readable by the configured credentials, fail fast with a configuration/auth error.

The ingestion layer must derive a stable `property_key` from the configured property string and persist that key alongside every snapshot run.

## Telemetry Windows

The first implementation may default to a weekly cadence for GSC performance collection, but rank and AI visibility checks must be driven by policy/target rows and can be daily, weekly, or another configured interval.

Default schedule:

- `weeklyCollectionDay = MO`
- `weeklyCollectionHourUtc = 3`

Window rules:

- windows are UTC-based;
- `snapshot_window_start` is inclusive;
- `snapshot_window_end` is exclusive;
- each weekly job must target the last fully closed 7-day window;
- the job must not mix a partial current week with a closed historical window.

Recommended weekly window:

- Monday 00:00:00 UTC to next Monday 00:00:00 UTC;
- the job may run at any later hour on Monday, but it must read the previous closed window only.

The decision job must always read the latest closed telemetry window and must never decide from a partially collected week.

## Google Search Console Dimensions And Metrics

The plugin must support two canonical GSC snapshot shapes.

### Page-Level Snapshot

Required dimensions:

- `page`

Allowed contextual dimensions when the connector can provide them:

- `country`
- `device`
- `searchAppearance`

Required metrics:

- `clicks`
- `impressions`
- `ctr`
- `averagePosition`

### Query-Level Snapshot

Required dimensions:

- `page`
- `query`

Allowed contextual dimensions when the connector can provide them:

- `country`
- `device`
- `searchAppearance`

Required metrics:

- `clicks`
- `impressions`
- `ctr`
- `averagePosition`

### Collection Rules

- page-level telemetry is mandatory for every eligible project page;
- query-level telemetry is mandatory when the property exposes query data for that page;
- if GSC returns no data for a page or query, that is a successful zero-data observation, not an error;
- page-level and query-level snapshots must be tied back to the same `project_page_id` when the page is project-owned, and to `page_id` when it is only discovered but not yet project-owned;
- the raw payload must be stored for auditability.

## Serper SERP Rank Collection

Google SERP rank collection must use the existing Serper plugin first. The SEO Performance Loop must not store Serper credentials or call Serper internals directly; it should dispatch through Paperclip plugin tooling and persist normalized results.

New providers may be added later, but they must fit the same SERP snapshot / rank observation storage contract.

### Provider Selection Order

1. use `serper` for Google SERP rank checks;
2. if Serper is unavailable, persist the provider failure for the specific target and continue the rest of the batch;
3. do not silently switch to another provider unless a policy explicitly allows fallback.

### Rank Snapshot Inputs

Rank snapshot requests must be built from:

- rank tracking target;
- keyword;
- expected canonical page/domain;
- search engine, default `google`;
- geo;
- language;
- device;
- collection window start and end;
- provider identifier.

### Rank Snapshot Output

Every rank snapshot must record:

- `rank_position`
- `rank_url`
- `rank_keyword`
- `rank_search_engine`
- `rank_geo`
- `rank_language`
- `rank_device`
- `rank_provider`
- `observed_at`
- `snapshot_window_start`
- `snapshot_window_end`
- provider raw payload

The plugin should preserve the provider response shape in `raw_payload_json` and persist top-result rows separately so agents can inspect competitor movement, not only the owned-page position.

### Extension Point For New Providers

A new provider can be introduced later if it implements the same minimum contract:

- `getRankSnapshot`
- `health`
- `capabilities`
- `rateLimit` metadata when available

The plugin must treat provider-specific fields as opaque and must not hard-code provider internals into the storage contract.

## Persistence Contract

The plugin must persist three kinds of records.

### 1. Ingestion Run Ledger

Each scheduled execution must create or update a run record with:

- job key;
- window start / end;
- start time;
- finish time;
- status;
- attempt count;
- error kind;
- error message;
- property key;
- provider used for the rank pass.

This run ledger is the idempotency anchor for retries.

### 2. Telemetry Snapshots

The canonical snapshot tables should be able to represent:

- one page-level GSC snapshot per project page per collection window;
- zero or more query-level rows linked to that page-level snapshot;
- one SERP snapshot per rank tracking target per policy window;
- one rank observation per keyword/search engine/provider/geo/language/device/date.

Snapshot rows must include:

- `page_id`
- `project_page_id`
- `source_kind`
- `snapshot_window_start`
- `snapshot_window_end`
- `captured_at`
- metrics
- contextual dimensions
- `raw_payload_json`

The same collection window must never produce duplicate canonical rows.
Upserts should be keyed by page/project-page id, source kind, window bounds, and provider/dimension tuple where relevant.

### 3. Decision Rows

The decision job must persist one row per project page per decision window with:

- `project_page_id`
- `decision_window_end`
- `decision_status`
- `decision_reason`
- `trigger_snapshot_ids_json`
- `parameter_snapshot_json`
- `opened_issue_id` when follow-up is created
- `created_by_agent_id` when an analysis role makes the call

The decision row must reference the exact telemetry rows that triggered it.

## Error Handling

The ingestion jobs must classify failures instead of treating all errors the same.

### Hard Failures

Fail fast and do not retry in the same run when:

- the credential secret ref is missing;
- the GSC property cannot be resolved;
- auth is invalid or revoked;
- the configured property is unreadable by the credential;
- a required plugin config field is missing;
- the payload shape is structurally invalid.

### Transient Failures

Retry with backoff when:

- the remote API returns `429`;
- the remote API returns `5xx`;
- the network times out;
- the provider is temporarily unavailable;
- the connector receives a transient serialization or transport error.

Recommended retry policy:

- exponential backoff with jitter;
- at least 3 attempts for transient errors;
- keep the retry budget bounded so the scheduled job still finishes within a reasonable window;
- if a transient failure survives retries, persist a failed run and let the next schedule retry from the same idempotency key.

### Partial Failures

The job must continue processing the rest of the project-page batch if one page or one provider fails.

Rules:

- one failed page must not cancel the entire run;
- one failed rank provider must not cancel the GSC snapshot for the same page;
- a failure must be recorded per page and per provider so that the next run can retry only the missing piece.

### No-Data Handling

Do not convert empty data into an error.

- zero clicks is still valid data;
- zero impressions is still valid data;
- a page with no query rows is still a successful telemetry snapshot if the page-level request succeeded.

## Scheduled Job Behavior

### `collect-search-telemetry`

For each eligible project page:

1. resolve the canonical registry row;
2. resolve the GSC property mapping;
3. fetch page-level GSC metrics for the closed telemetry window;
4. fetch query-level GSC rows when available;
5. fetch rank snapshots for active rank tracking targets due under policy;
6. persist normalized snapshots and raw payloads;
7. mark the run ledger with success or a structured failure state.

### `evaluate-seo-decisions`

For each project page with a fresh telemetry window:

1. load the latest page-level and rank snapshots;
2. load the active policy parameters;
3. compare the current window with previous windows;
4. write a decision row;
5. optionally open a follow-up issue when the policy says to do so.

The plugin should never require human approval before it records the decision row.
Human review may happen later, but the ingestion and decision ledger must remain automatic.

## Minimum Tooling Surface

The first version of the plugin should expose deterministic tools for downstream roles:

- `seo_project_page_get`
- `seo_search_telemetry_get`
- `seo_rank_snapshot_get`
- `seo_performance_decision_get`
- `seo_followup_issue_open`

These tools should return stored canonical rows only.
They must not call live external APIs on demand.

## Operational Notes

- use existing Paperclip-connected SEO providers before adding new ones;
- keep provider choice configurable;
- keep telemetry policy thresholds configurable;
- keep the registry and snapshot store canonical inside Paperclip plugin tables;
- keep raw payload retention long enough for debugging and future schema changes;
- do not store live secrets in telemetry rows;
- do not make the agent guess at provider auth or GSC property ownership.

## Out Of Scope

This contract does not define:

- the live Google OAuth handshake implementation;
- the exact SQL migration files;
- the refresh-agent prompt;
- SERP crawling or competitor content analysis;
- backlink acquisition workflows;
- notification delivery to Telegram or article publishing.

Those belong to later phases or separate contracts.
