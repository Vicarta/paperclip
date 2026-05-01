# GSC Bing GA4 MCP Agent Tools

Thin Paperclip adapter for the private Astrogen analytics MCP server.

## Purpose

This plugin lets Paperclip agents call backend-allowlisted MCP tools for Google Search Console, Bing, GA4, and PageSpeed without exposing endpoint credentials to agents, prompts, issue comments, or source code.

Default endpoint:

```text
http://100.98.5.50:3002/mcp
```

Default allowed GSC site:

```text
sc-domain:astrogen.com.ua
```

## Security Model

- The bearer token is stored only as a Paperclip server-side secret reference.
- The plugin backend injects `Authorization: Bearer <token>` into MCP requests.
- Agents cannot pass or override the endpoint URL or bearer token.
- Tool calls are limited by backend plugin config.
- The default tool allowlist contains only currently verified MCP tools.
- Calls with a mismatched `siteUrl`, `site_url`, or `site` are rejected before reaching MCP.
- Site-scoped GSC tools receive the configured `allowedSiteUrl` automatically when the caller does not provide it.

Verified default MCP tools:

- `sites_list`
- `analytics_top_queries`
- `analytics_query`
- `seo_low_ctr_opportunities`
- `inspection_inspect`
- `sitemaps_list`
- `pagespeed_analyze`

Bing and GA4 MCP tools should be added to `allowedMcpToolNamesCsv` only after MCP-side verification. This keeps the plugin ready for the combined endpoint without granting agents arbitrary future tool access.

## Configuration

Plugin config fields:

- `gscBingGa4McpTokenSecretRef`: Paperclip secret ID that stores the Astrogen tenant token.
- `gscBingGa4McpUrl`: private MCP Streamable HTTP endpoint.
- `allowedSiteUrl`: GSC site allowlist.
- `allowedMcpToolNamesCsv`: optional comma-separated backend tool allowlist. Empty means verified defaults only.
- `requestTimeoutMs`: timeout for one MCP connect/call cycle.

## Tool Surface

Paperclip tools:

- `list-tools`: list backend-allowlisted MCP tools currently exposed by the server.
- `call-tool`: call one backend-allowlisted MCP tool by name.
- `sites-list`: wrapper for `sites_list`.
- `analytics-top-queries`: wrapper for `analytics_top_queries`.
- `analytics-query`: wrapper for `analytics_query`.
- `seo-low-ctr-opportunities`: wrapper for `seo_low_ctr_opportunities`.
- `inspection-inspect`: wrapper for `inspection_inspect`.
- `sitemaps-list`: wrapper for `sitemaps_list`.
- `pagespeed-analyze`: wrapper for `pagespeed_analyze`.

## Live Docker Networking Note

On the live Paperclip host, the MCP endpoint is bound to the host Tailscale address `100.98.5.50:3002`. If the Paperclip app runs inside Docker and cannot connect to that address directly, use the existing narrow host-side bridge proxy pattern:

```text
Paperclip app container -> http://172.21.0.1:3002/mcp -> 100.98.5.50:3002
```

Operational constraints:

- The backend SSRF guard remains enabled for plugins by default.
- `paperclip.gsc-bing-ga4-mcp-agent-tools` has a hardcoded allowlist for exactly `100.98.5.50:3002` and `172.21.0.1:3002`.
- Do not add broader private-network access without a new explicit review.

Local plaintext token location for manual setup only:

```text
/Users/savitsky/CodexProjects/mcp-gsc/.secrets/search-console-mcp-astrogen-token.txt
```

Do not commit this token or paste it into prompts/issues.
