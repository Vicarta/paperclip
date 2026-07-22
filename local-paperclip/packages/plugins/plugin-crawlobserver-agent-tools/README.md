# CrawlObserver Agent Tools

Thin Paperclip adapter for the private Tailnet-only CrawlObserver REST API.

Default endpoint:

```text
http://ubuntu-aibizmate-n8n.tailbd4e1c.ts.net:8899
```

## Purpose

The plugin lets Paperclip agents acquire crawl evidence from CrawlObserver without exposing credentials in prompts, issue comments, frontend code, or logs. It is not an SEO decision engine. Paperclip owns durable storage, findings, issue lifecycle, prioritization, and remediation routing.

`list-sessions` returns a bounded compact DTO. Every row has a canonical camelCase `sessionId`; provider-only `ID`, `Config`, and other large acquisition payloads are not exposed to the agent context.

## Security Model

- The API key is stored only as a Paperclip company secret reference.
- The backend injects `X-API-Key` into CrawlObserver requests.
- Agents cannot pass Basic Auth credentials.
- Agents cannot override the base URL per call.
- Generic endpoint calls are restricted to a backend allowlist of read-only API paths.
- Mutating tools are disabled by default and require `allowMutatingTools=true`.
- If `allowedProjectId` is configured, session inventory calls inject it when omitted and reject another `project_id` before reaching CrawlObserver.
- Read-only calls retry once on transient gateway statuses `502`, `503`, and `504`; mutating calls are never retried automatically.

## Configuration

- `crawlObserverApiKeySecretRef`: Paperclip secret ID storing the CrawlObserver API key.
- `crawlObserverBaseUrl`: private Tailnet API base URL.
- `allowedProjectId`: company-scoped CrawlObserver project guardrail and default for session inventory.
- `allowMutatingTools`: enables crawl start/stop/resume/retry.
- `requestTimeoutMs`: timeout for one API call.
- `maxPageLimit`: maximum forwarded `limit` for paged reads.

## Tool Surface

Read tools:

- `health-check`
- `server-info`
- `system-stats`
- `storage-stats`
- `global-stats`
- `list-projects`
- `list-sessions`
- `get-session-progress`
- `get-session-stats`
- `get-session-audit`
- `get-session-quality`
- `list-pages`
- `list-links`
- `list-internal-links`
- `get-page-detail`
- `get-sitemaps`
- `get-sitemap-urls`
- `get-resource-summary`
- `get-resource-checks`
- `get-page-issues`
- `get-redirect-pages`
- `get-near-duplicates`
- `get-structured-data`
- `call-read-endpoint`

Mutating tools, disabled by default:

- `start-crawl`
- `stop-session`
- `resume-session`
- `retry-failed`

## SEO Trust Gate

Before agents use any CrawlObserver session as evidence for SEO decisions, they
must fetch session quality:

```text
GET /api/sessions/{session_id}/quality
```

Use the named `get-session-quality` tool when available:

```json
{
  "sessionId": "crawl-session-id"
}
```

SEO recommendations may use CrawlObserver data only when:

- `quality.trusted === true`;
- `quality.status === "trusted"`;
- no returned finding has `blocking === true`;
- the session is the latest trusted full crawl for the project.

If `quality.status === "warning"`, agents may summarize the data with explicit
caveats, but must not treat it as a clean baseline for SEO recommendations.

If `quality.status === "untrusted"` or any quality finding is blocking, agents
must not generate SEO recommendations from that session. They must report:
`Crawl Observer data stale/untrusted.`

Daily Delta, partial, stopped, or otherwise incomplete sessions are not full
crawl baselines. Canary failures, coverage drops, graph drops, and PageRank
instability are data-quality incidents first; route them as acquisition/quality
incidents instead of SEO optimization tasks.

## Page Inventory And Internal Links

For SEO page inventory and internal-linking analysis, prefer the named
`list-pages` tool with `page_type=html`:

```json
{
  "sessionId": "crawl-session-id",
  "page_type": "html",
  "sort": "page_type",
  "order": "asc",
  "limit": 100,
  "offset": 0
}
```

`GET /api/sessions/{session_id}/pages` may also return non-HTML resources.
The current CrawlObserver API exposes `page_type` with values such as `html`,
`css`, `js`, `image`, `video`, `file`, `redirect`, and `other`. Use
`page_type=html` before treating rows as crawlable/indexable page candidates.

Page rows can include both:

- `internal_links_in`: number of internal pages linking to this URL;
- `internal_links_out`: number of outbound internal links found on this page.

Use `internal_links_in` directly when available instead of recomputing basic
inlink counts from raw link exports. Use link tables for source/anchor evidence
and placement details.

## Page Image Audits

For page image audits, use `get-resource-checks` with
`resource_type=image`. This calls the existing CrawlObserver endpoint:

```json
{
  "sessionId": "crawl-session-id",
  "resource_type": "image",
  "limit": 100,
  "offset": 0
}
```

Useful filters include:

- `status_code=404`
- `status_code=>=400`
- `url=fragment`
- `is_internal=true`
- `error=fragment`

The response can include image URLs found on crawled pages, HTTP status codes,
redirect URLs, content types, error text, and whether the image is internal or
external. Old crawl sessions may not contain image resource rows; use a new
crawl or resource reparse before treating missing image data as a clean result.

## Page Issue Audits

For generic page-quality findings, use `get-page-issues`. This calls:

```text
GET /api/sessions/{session_id}/page-issues
```

Useful filters include:

- `severity=error|warning`
- `issue_type=soft_404|generic_rendered_title|generic_static_metadata`
- `url=fragment`

Current CrawlObserver issue meanings:

- `soft_404` is a technical error and should be routed as a deterministic SEO
  technical fix after dedupe/cooldown.
- `generic_rendered_title` is a content warning about a generic rendered title.
- `generic_static_metadata` is a content warning about generic static metadata.

Generic title/metadata warnings are evidence for review or content-refresh
shortlisting; they are not, by themselves, permission to rewrite a page without
the normal Paperclip issue lifecycle.

## Operational Note

CrawlObserver session files and API responses are provider acquisition state. A later SEO Ops ingestion flow should persist normalized crawl snapshots and page findings into Paperclip PostgreSQL before agents route fix issues.

Production retention affects debugging and evidence availability:

- application logs from `GET /api/logs` and `GET /api/logs/export` are retained
  for 5 days only;
- production currently keeps only the 2 latest inactive crawl sessions per
  project. Running, queued, and stopping sessions are not deleted by that
  cleanup;
- production keeps the 4 latest backups.

Agents must record session id, crawl timestamps, and the compact evidence they
use in Paperclip comments/documents. Do not assume old session IDs, old logs, or
older backups will remain available for later review.
