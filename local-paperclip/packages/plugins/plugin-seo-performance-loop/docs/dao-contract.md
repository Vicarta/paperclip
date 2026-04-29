# SEO Performance Loop DAO Contract

This document defines the storage-layer contract for the first `SEO Performance Loop` implementation slice.
The DAO is responsible for persistence and idempotent upserts only.
It must not perform network calls, open issues directly, or decide policies on its own.

## Contract Boundaries

The DAO owns:

- registry writes and lookups;
- telemetry snapshot writes and lookups;
- query snapshot writes;
- decision record writes and lookups;
- policy reads and policy upserts.

The DAO does not own:

- Google Search Console authentication;
- rank-provider API calls;
- follow-up issue creation;
- SEO interpretation;
- HTML or Markdown generation;
- external scheduler wiring.

## Shared Types

The methods below are written in pseudo-TypeScript for clarity.
Field names are the canonical contract, even if the implementation language differs later.

### Common Identity

```ts
type SeoScope = {
  companyId: string;
  projectId: string;
};
```

### Common Idempotency

Every write method must accept or derive a deterministic idempotency key.

```ts
type IdempotentWriteResult<TId extends string> = {
  id: TId;
  created: boolean;
  updated: boolean;
  deduped: boolean;
};
```

If a caller retries the same logical write, the DAO must return the same row and must not create duplicates.

## Published Article Registry

### `upsertPublishedArticleFromPublicationEvent`

```ts
type UpsertPublishedArticleFromPublicationEventInput = SeoScope & {
  publicationEventKey: string;
  publicationChannel: string;
  publicationAdapter: string;
  originIssueId: string;
  currentIssueId: string;
  firstPublishedAt: string;
  lastPublishedAt: string;
  canonicalUrl: string;
  canonicalSlug: string;
  routeKey: string;
  productSurface: string;
  language: string;
  geo: string;
  primaryKeyword: string;
  supportingKeywords: string[];
  titleSnapshot: string;
  h1Snapshot: string;
  metaTitleSnapshot: string;
  metaDescriptionSnapshot: string;
  authorSnapshot: string;
  publishableMarkdownAttachmentId: string;
  publishableHtmlAttachmentId: string;
  editorialSourceAttachmentId: string;
  imageAssetRef?: string | null;
  status: "published" | "republished" | "retired";
};
```

Behavior:

- Upsert by `publicationEventKey`, `originIssueId`, and `canonicalUrl`.
- If the row does not exist, insert it.
- If the row exists and the event is a duplicate, return the existing row without changes.
- If the row exists and the page has been republished, update mutable fields and increment `republishCount`.
- The DAO must never create two registry rows for the same live canonical URL inside the same company/project scope.

Return:

```ts
type UpsertPublishedArticleFromPublicationEventResult = IdempotentWriteResult<string> & {
  status: "published" | "republished" | "retired";
  publishedAt: string;
  canonicalUrl: string;
};
```

### `getPublishedArticle`

```ts
type GetPublishedArticleInput = SeoScope & {
  publishedArticleId?: string;
  canonicalUrl?: string;
  originIssueId?: string;
  currentIssueId?: string;
};
```

Behavior:

- Return one registry row by any supported identity selector.
- Prefer `publishedArticleId` if provided.
- If multiple selectors are supplied, they must agree or the DAO should return a validation error.

### `listPublishedArticlesForTelemetry`

```ts
type ListPublishedArticlesForTelemetryInput = SeoScope & {
  status?: Array<"published" | "republished">;
  publishedBefore?: string;
  limit?: number;
  cursor?: string | null;
};
```

Behavior:

- Return registry rows eligible for telemetry collection.
- Exclude `retired` rows by default.
- Use stable cursor pagination.

## Telemetry Snapshots

### `recordTelemetrySnapshot`

```ts
type RecordTelemetrySnapshotInput = SeoScope & {
  publishedArticleId: string;
  collectionRunKey: string;
  sourceKind: "gsc" | "rank_provider";
  sourceKey: string;
  snapshotWindowStart: string;
  snapshotWindowEnd: string;
  capturedAt: string;
  pageMetrics?: {
    impressions?: number | null;
    clicks?: number | null;
    ctr?: number | null;
    averagePosition?: number | null;
  };
  rankMetrics?: {
    keyword?: string | null;
    geo?: string | null;
    language?: string | null;
    position?: number | null;
  };
  rawPayload: Record<string, unknown>;
  snapshotFingerprint: string;
};
```

Behavior:

- Insert one append-only telemetry row.
- Dedupe by `snapshotFingerprint`.
- Store page metrics for `gsc` rows and rank metrics for `rank_provider` rows.
- If the same snapshot is retried, return the existing row.

Return:

```ts
type RecordTelemetrySnapshotResult = IdempotentWriteResult<string> & {
  sourceKind: "gsc" | "rank_provider";
  snapshotWindowStart: string;
  snapshotWindowEnd: string;
};
```

### `recordTelemetryQueries`

```ts
type RecordTelemetryQueriesInput = SeoScope & {
  telemetrySnapshotId: string;
  queries: Array<{
    query: string;
    queryNormalized: string;
    clicks: number;
    impressions: number;
    ctr: number;
    averagePosition: number;
    querySnapshotKey: string;
    rawPayload?: Record<string, unknown> | null;
  }>;
};
```

Behavior:

- Insert one row per normalized query.
- Dedupe by `querySnapshotKey`.
- The same query must not be written twice for the same telemetry snapshot.

Return:

```ts
type RecordTelemetryQueriesResult = {
  telemetrySnapshotId: string;
  insertedCount: number;
  dedupedCount: number;
};
```

### `getLatestTelemetrySnapshot`

```ts
type GetLatestTelemetrySnapshotInput = SeoScope & {
  publishedArticleId: string;
  sourceKind?: "gsc" | "rank_provider";
};
```

Behavior:

- Return the latest snapshot for the selected article and source kind.
- If no source kind is supplied, prefer the latest `gsc` row and include the latest `rank_provider` row if available.

### `listTelemetrySnapshots`

```ts
type ListTelemetrySnapshotsInput = SeoScope & {
  publishedArticleId: string;
  sourceKind?: "gsc" | "rank_provider";
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string | null;
};
```

Behavior:

- Return chronological snapshots for graphing and analysis.

## Decisions

### `recordDecision`

```ts
type RecordDecisionInput = SeoScope & {
  publishedArticleId: string;
  decisionWindowStart: string;
  decisionWindowEnd: string;
  decisionStatus:
    | "hold"
    | "watch"
    | "refresh"
    | "benchmark_serp"
    | "offpage_recommendation"
    | "escalate";
  decisionReason: string;
  triggerSnapshotIds: string[];
  policyId: string;
  policySnapshot: {
    stableWindowWeeks: number;
    noisyWindowWeeks: number;
    declineWindowWeeks: number;
    stablePositionDeltaThreshold: number;
    declinePositionDeltaThreshold: number;
    stableClickDeltaPct: number;
    declineClickDeltaPct: number;
    stableImpressionDeltaPct: number;
    declineImpressionDeltaPct: number;
  };
  metricsSnapshot: Record<string, unknown>;
  decisionKey: string;
  createdByAgentId?: string | null;
  openedIssueId?: string | null;
};
```

Behavior:

- Append one decision row.
- Dedupe by `decisionKey`.
- Preserve the exact policy snapshot used at decision time.
- Do not mutate prior decision rows.

Return:

```ts
type RecordDecisionResult = IdempotentWriteResult<string> & {
  decisionStatus:
    | "hold"
    | "watch"
    | "refresh"
    | "benchmark_serp"
    | "offpage_recommendation"
    | "escalate";
};
```

### `getLatestDecision`

```ts
type GetLatestDecisionInput = SeoScope & {
  publishedArticleId: string;
};
```

Behavior:

- Return the most recent decision row for the article.

## Policies

### `getActivePolicy`

```ts
type GetActivePolicyInput = SeoScope & {
  policyId?: string;
  name?: string;
  useDefault?: boolean;
};
```

Behavior:

- Return the selected policy.
- If `useDefault = true`, return the company default policy.
- If no selector is provided, return the default policy.

### `upsertPolicy`

```ts
type UpsertPolicyInput = SeoScope & {
  policyId?: string;
  name: string;
  isDefault: boolean;
  stableWindowWeeks: number;
  noisyWindowWeeks: number;
  declineWindowWeeks: number;
  stablePositionDeltaThreshold: number;
  declinePositionDeltaThreshold: number;
  stableClickDeltaPct: number;
  declineClickDeltaPct: number;
  stableImpressionDeltaPct: number;
  declineImpressionDeltaPct: number;
};
```

Behavior:

- Insert a new policy when `policyId` is absent.
- Update an existing policy when `policyId` is present.
- Enforce one default policy per company.
- Return the current policy row.

Return:

```ts
type UpsertPolicyResult = IdempotentWriteResult<string> & {
  isDefault: boolean;
  name: string;
};
```

## Optional Support Methods

These methods are useful for the collection/decision services even if they are not exposed as user-facing tools yet.

### `listEligibleArticlesForTelemetry`

Returns registry rows that should be processed in the next weekly collection run.

### `markArticleRetired`

Marks a registry row as `retired` without deleting it.

### `getDecisionContext`

Returns the registry row, latest snapshots, latest decision, and active policy for one article in one read.

## Transaction Rules

- `upsertPublishedArticleFromPublicationEvent` must be atomic.
- `recordTelemetrySnapshot` and its query rows must be written in one transaction.
- `recordDecision` must be atomic with the decision payload and trigger snapshot references.
- Policy updates should be atomic with default-policy switching.

## Error Semantics

- `InvalidSelectorError` when conflicting selectors are supplied to a read method.
- `DuplicateWriteError` should not be thrown for retried idempotent writes; return the existing row instead.
- `MissingForeignKeyError` when a telemetry or decision write references a non-existent article or policy.
- `ValidationError` when required metrics are absent for the selected source kind.

## Implementation Notes

- The DAO should normalize query strings before writing `seo_article_query_snapshots`.
- The DAO should not derive SEO decisions from telemetry.
- The DAO should not open follow-up issues; that is a higher-level service concern.
- The DAO should be usable by both scheduled jobs and manual inspection tools.

