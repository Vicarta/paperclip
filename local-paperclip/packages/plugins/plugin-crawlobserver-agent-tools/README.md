# CrawlObserver Agent Tools

Thin Paperclip adapter for the private Tailnet-only CrawlObserver REST API.

Default endpoint:

```text
http://ubuntu-aibizmate-n8n.tailbd4e1c.ts.net:8899
```

## Purpose

The plugin lets Paperclip agents acquire crawl evidence from CrawlObserver without exposing credentials in prompts, issue comments, frontend code, or logs. It is not an SEO decision engine. Paperclip owns durable storage, findings, issue lifecycle, prioritization, and remediation routing.

## Security Model

- The API key is stored only as a Paperclip company secret reference.
- The backend injects `X-API-Key` into CrawlObserver requests.
- Agents cannot pass Basic Auth credentials.
- Agents cannot override the base URL per call.
- Generic endpoint calls are restricted to a backend allowlist of read-only API paths.
- Mutating tools are disabled by default and require `allowMutatingTools=true`.
- If `allowedProjectId` is configured, calls with another `project_id` are rejected before reaching CrawlObserver.

## Configuration

- `crawlObserverApiKeySecretRef`: Paperclip secret ID storing the CrawlObserver API key.
- `crawlObserverBaseUrl`: private Tailnet API base URL.
- `allowedProjectId`: optional CrawlObserver project guardrail.
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
- `list-pages`
- `list-links`
- `list-internal-links`
- `get-page-detail`
- `get-sitemaps`
- `get-sitemap-urls`
- `get-resource-summary`
- `get-redirect-pages`
- `get-near-duplicates`
- `get-structured-data`
- `call-read-endpoint`

Mutating tools, disabled by default:

- `start-crawl`
- `stop-session`
- `resume-session`
- `retry-failed`

## Operational Note

CrawlObserver session files and API responses are provider acquisition state. A later SEO Ops ingestion flow should persist normalized crawl snapshots and page findings into Paperclip PostgreSQL before agents route fix issues.
