# Phase 12: CrawlObserver SEO Crawl Adapter

## Objective

Add a reusable Paperclip plugin adapter for the Tailnet-only CrawlObserver REST API.

The adapter is acquisition infrastructure only: it exposes safe agent tools for crawl sessions and crawl evidence, injects backend-held credentials, and leaves SEO decisions, durable snapshots, issue routing, and remediation ownership inside Paperclip.

## Scope

- Create `@paperclipai/plugin-crawlobserver-agent-tools`.
- Store CrawlObserver API key as a Paperclip secret reference.
- Use the Tailnet base URL by default:
  `http://ubuntu-aibizmate-n8n.tailbd4e1c.ts.net:8899`.
- Provide read tools for health, projects, sessions, progress, stats, pages, links, page detail, sitemap URLs, resource summary, redirects, duplicates, and structured data.
- Provide mutating tools for crawl start/stop/resume/retry only when `allowMutatingTools=true`.
- Add project guardrails: optional `allowedProjectId` blocks calls that try to use another CrawlObserver project.
- Add endpoint allowlisting so agents cannot turn the plugin into an arbitrary HTTP proxy.
- Update Docker build packaging so the plugin ships with Paperclip.
- Add tests for credential injection, project guardrails, mutating-tool gating, and read endpoint allowlisting.

## Out Of Scope

- No Basic Auth storage in the plugin. Basic Auth remains an operator-only fallback.
- No crawl scheduling logic in this phase.
- No direct writes to `seo_ops` in the adapter. A later SEO Ops ingestion phase should persist crawl snapshots and page findings.
- No SEO classification or prioritization inside CrawlObserver adapter responses.

## Acceptance Criteria

- Plugin builds, typechecks, and tests pass.
- Agents never see `CO_API_KEY`; the backend injects `X-API-Key`.
- Mutating session tools fail closed unless explicitly enabled in instance config.
- Calls with mismatched `project_id` fail before reaching CrawlObserver when `allowedProjectId` is configured.
- Generic read endpoint tool accepts only a fixed allowlist of CrawlObserver API paths.
- Docker production build list includes the new plugin.

## Verification

- `pnpm --filter @paperclipai/plugin-crawlobserver-agent-tools typecheck`
- `pnpm --filter @paperclipai/plugin-crawlobserver-agent-tools test`
- `pnpm --filter @paperclipai/plugin-crawlobserver-agent-tools build`
