# Native Pipeline Case Operations

Use this reference for native Paperclip pipeline stage automation and for
scheduled routine/portfolio tasks that need bounded native case inventory.
Stage-automation tasks supply `case_id`, `case_version`, `pipeline_id`, and
`stage_key`. Routine tasks may supply only company context and pipeline keys;
resolve those keys through the inventory discovery path below.

All routes are under `$PAPERCLIP_API_URL/api`. Authenticate with
`Authorization: Bearer $PAPERCLIP_API_KEY`. Include
`X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID` on every mutation.

Do not search OpenAPI, browser assets, or Paperclip source to discover these routes.

## Read

- Case detail: `GET /cases/{caseId}`
- Case document: `GET /cases/{caseId}/documents/{key}`
- Linked issues: `GET /cases/{caseId}/issue-links`
- Case outputs: `GET /cases/{caseId}/outputs`
- Full case output document: `GET /cases/{caseId}/outputs/documents/{documentId}`
- Events: `GET /cases/{caseId}/events`
- Context pack: `GET /cases/{caseId}/context-pack`

`GET /cases/{caseId}` returns a detail envelope, not a bare case row. Read mutable
case data from `.case`, the current stage from `.stage`, and transition choices
from `.allowedNextStages`:

```jq
{
  version: .case.version,
  fields: .case.fields,
  stageKey: .stage.key,
  allowedNextStageKeys: [.allowedNextStages[]?.key]
}
```

Do not read top-level `.version` or `.fields`; those paths are absent and produce
`null`, which is not a valid case version or an empty field set.

Document reads are also envelopes:

- `GET /cases/{caseId}/documents/{key}` returns metadata in `.document`, the
  current content in `.revision.body`, and link metadata in `.link`.
- `GET /cases/{caseId}/outputs/documents/{documentId}` returns the bounded
  cross-agent content in `.document.body` and its producer metadata in `.source`.

Do not interpret a missing top-level `.body` as a missing document. Select the
document body from the envelope path above and treat a non-string body as a
protocol error.

### Plugin Tool Response Shape

Native stage agents commonly use company-bound plugin tools:

- `GET /agents/me/plugin-tools` returns a direct JSON array of tool descriptors.
- `POST /agents/me/plugin-tools/execute` returns a dispatcher envelope with
  `pluginId`, `toolName`, and `result`.
- Read typed provider/plugin output from `.result.data`; `.result.content` is the
  optional human-readable content channel.

Do not read `.tools` from discovery or top-level `.data`, `.id`, or `.document`
from execution. Validate the envelope and treat an unexpected shape as a protocol
error before retrying or spending provider budget.

### Inventory Discovery For Routine Tasks

Do not guess generic `/cases`, `/pipeline-cases`, or key-in-UUID routes. Resolve
the real pipeline UUID first:

1. `GET /companies/{companyId}/pipelines`
2. Find the row whose `key` matches the required pipeline key.
3. `GET /pipelines/{pipelineId}/cases?stageKey={stageKey}&terminal=false&limit=10&offset=0`

The case list also accepts exact `caseKey={caseKey}` for canonical idempotent
lookups. `limit` is capped at 100. Omit `stageKey`, `terminal`, `caseKey`, or
`offset` only when the routine contract does not need that filter.

The response is a **direct JSON array** of case rows, even when it contains no
rows. Count it with `Array.isArray(response) ? response.length : protocol_error`.
Only `[]` proves an empty result. Do not read `response.items` or
`response.cases`, and do not treat a non-array response as empty inventory.
Record it as a protocol failure instead.

Agent run JWTs may read these routes only inside their own company. A `500`
caused by putting a pipeline key where `{pipelineId}` requires a UUID is a caller
contract error, not evidence that native inventory is unavailable.

Always read the case immediately before a write and use the returned `.case.version`.
Follow the fetch hint returned by case outputs for full document bodies. Do not read a
linked agent's document through its foreign issue route; case outputs are the typed
cross-agent handoff boundary.

## Update Case Content

`PATCH /cases/{caseId}` accepts:

```json
{
  "title": "Optional title",
  "summary": "Optional summary",
  "fieldPatch": { "status": "verified" },
  "workspaceRef": null,
  "parentCaseId": null,
  "expectedVersion": 3
}
```

Use `fieldPatch` for incremental field updates. Paperclip merges those top-level keys atomically
into the current fields object under the same `expectedVersion` check. Use `fields` only when you
intentionally replace the complete fields object. Never send both in one request.

## Documents

Create a document with `PUT /cases/{caseId}/documents/{key}`:

```json
{
  "title": "Evidence",
  "format": "markdown",
  "body": "Durable evidence",
  "changeSummary": "Created stage evidence"
}
```

For an existing document, read it first and include its latest revision id as `baseRevisionId`.

## Transition

`POST /cases/{caseId}/transition`:

```json
{
  "toStageKey": "next_stage",
  "expectedVersion": 3,
  "reason": "Completion evidence recorded"
}
```

Agents must not use `force`. On version conflict, refetch once, reconcile material changes, and
retry only when the transition remains valid.

## Reviews

For review stages use `POST /cases/{caseId}/review`:

```json
{
  "decision": "approve",
  "reason": "Optional rationale",
  "expectedVersion": 3
}
```

`decision` is `approve`, `request_changes`, or `reject`. Use only the configured native review path.

## Blockers And Links

- Replace case blockers: `PUT /cases/{caseId}/blockers` with `{"blockedByCaseIds": ["..."]}`.
- Create new delegated work atomically through `POST /companies/{companyId}/issues`. Include the
  normal issue fields plus:

```json
{
  "pipelineCaseLink": {
    "caseId": "case uuid",
    "requestKey": "stable-purpose-key"
  }
}
```

  The issue and its `work` link are committed in one transaction. Repeating the same case and
  request key returns the existing issue with `delegationCreated=false`; do not create another.
- Link existing or migrated work only: `POST /cases/{caseId}/issue-links` with an `issueId` and
  role `origin`, `conversation`, `work`, or `automation`. Do not use this two-step path for new
  delegation.

A missing permission, unavailable plugin binding, or unavailable execution environment is a typed
technical blocker. It is not permission to create a parallel legacy workflow or duplicate case.
