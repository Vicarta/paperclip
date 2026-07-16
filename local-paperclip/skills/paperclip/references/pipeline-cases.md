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

### Inventory Discovery For Routine Tasks

Do not guess generic `/cases`, `/pipeline-cases`, or key-in-UUID routes. Resolve
the real pipeline UUID first:

1. `GET /companies/{companyId}/pipelines`
2. Find the row whose `key` matches the required pipeline key.
3. `GET /pipelines/{pipelineId}/cases?stageKey={stageKey}&terminal=false&limit=10&offset=0`

The case list also accepts exact `caseKey={caseKey}` for canonical idempotent
lookups. `limit` is capped at 100. Omit `stageKey`, `terminal`, `caseKey`, or
`offset` only when the routine contract does not need that filter.

Agent run JWTs may read these routes only inside their own company. A `500`
caused by putting a pipeline key where `{pipelineId}` requires a UUID is a caller
contract error, not evidence that native inventory is unavailable.

Always read the case immediately before a write and use the returned `case.version`.
Follow the fetch hint returned by case outputs for full document bodies. Do not read a
linked agent's document through its foreign issue route; case outputs are the typed
cross-agent handoff boundary.

## Update Case Content

`PATCH /cases/{caseId}` accepts:

```json
{
  "title": "Optional title",
  "summary": "Optional summary",
  "fields": {},
  "workspaceRef": null,
  "parentCaseId": null,
  "expectedVersion": 3
}
```

`fields` replaces the complete fields object. Merge the current fields locally and send the full
result. Never send a partial fields object that would erase existing evidence.

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
