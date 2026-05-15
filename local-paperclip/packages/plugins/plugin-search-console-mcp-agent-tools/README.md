# Search Console MCP Agent Tools

Thin Paperclip adapter for the private Search Console MCP server.

## Purpose

This plugin lets Paperclip agents call verified Google Search Console tools through a private MCP Streamable HTTP endpoint without exposing the endpoint token to agents, prompts, UI output, or code.

Default endpoint:

```text
http://100.98.5.50:3002/mcp
```

Default allowed site:

```text
sc-domain:astrogen.com.ua
```

## Security Model

- The bearer token is stored only as a Paperclip server-side secret reference.
- The plugin backend injects `Authorization: Bearer <token>` into MCP requests.
- Agents cannot pass or override the endpoint URL or bearer token.
- Tool calls are limited to verified MCP tools.
- Calls with a mismatched `siteUrl`, `site_url`, or `site` are rejected before reaching MCP.
- Site-scoped tools receive the configured `allowedSiteUrl` automatically when the caller does not provide it.

Verified MCP tools:

- `sites_list`
- `analytics_top_queries`
- `analytics_query`
- `seo_low_ctr_opportunities`
- `inspection_inspect`
- `sitemaps_list`
- `pagespeed_analyze`

## Configuration

Plugin config fields:

- `searchConsoleMcpTokenSecretRef`: Paperclip secret ID that stores the Astrogen tenant token.
- `searchConsoleMcpUrl`: private MCP Streamable HTTP endpoint.
- `allowedSiteUrl`: Search Console site allowlist.
- `requestTimeoutMs`: timeout for one MCP connect/call cycle.

## Live Docker Networking Note

On the live Paperclip host, the MCP endpoint is bound to the host Tailscale address `100.98.5.50:3002`. The Paperclip app runs inside Docker, so the container cannot reliably connect to the host's Tailscale address directly.

The live instance uses a narrow host-side bridge proxy:

```text
Paperclip app container -> http://172.21.0.1:3002/mcp -> 100.98.5.50:3002
```

Operational constraints:

- The proxy binds only to Docker bridge gateway `172.21.0.1:3002`.
- UFW allows only `172.21.0.0/16 -> 172.21.0.1:3002/tcp`.
- The backend SSRF guard remains enabled for all plugins by default.
- `paperclip.search-console-mcp-agent-tools` has a hardcoded allowlist for exactly `100.98.5.50:3002` and `172.21.0.1:3002`.
- Do not add broader private-network access without a new explicit review.

Manual token setup:

```text
Use a local operator-only secret file outside this repository, then store the value in Paperclip Secrets.
```

Do not commit this token or paste it into prompts/issues.

## Google Analytics Recommendation for Astrogen

Google Analytics should be connected as a separate read-only analytics source, not mixed into this GSC adapter.

Recommended setup:

- Use GA4 Data API with server-side OAuth/service-account credentials stored as Paperclip secrets.
- Keep `propertyId`, timezone, and allowed host/domain in plugin config, not in agent prompts.
- Start with read-only scopes only.
- Pull weekly landing-page metrics and join them with GSC by normalized URL/date.
- Track sessions, engaged sessions, engagement rate, average engagement time, key events/conversions, source/medium, and landing page path.
- Use GA primarily to evaluate content quality and conversion behavior after publication. Use GSC for search queries, impressions, clicks, CTR, and indexing signals.
- If Astrogen later needs GA-specific workflows, implement a separate GA plugin or analytics warehouse plugin so SEO agents can query one normalized performance layer.
