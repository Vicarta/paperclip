# Production Plugin Manifest

Last verified: 2026-05-15
Source: Phase 17 live production smoke and plugin inventory.
Secret handling: config keys and secret refs only; no plaintext secret values.

Expected status: all plugins `ready`.

| Plugin key | Package | Expected role |
| --- | --- | --- |
| `paperclip-file-browser-example` | `@paperclipai/plugin-file-browser-example` | UI helper. |
| `paperclip-plugin-telegram` | `paperclip-plugin-telegram` | Canonical Telegram lifecycle notifications and watch/escalation jobs. |
| `paperclip.bright-data-agent-tools` | `@paperclipai/plugin-bright-data-agent-tools` | Bright Data tools. |
| `paperclip.dataforseo-agent-tools` | `@paperclipai/plugin-dataforseo-agent-tools` | DataForSEO tools and cost ledger events. |
| `paperclip.diskinternals-bigquery-growth` | `@paperclipai/plugin-diskinternals-bigquery-growth` | DiskInternals-specific growth analytics. |
| `paperclip.exa-agent-tools` | `@paperclipai/plugin-exa-agent-tools` | Exa research connector. |
| `paperclip.perfex-crm-agent-tools` | `@paperclipai/plugin-perfex-crm-agent-tools` | Perfex CRM bridge. |
| `paperclip.search-console-mcp-agent-tools` | `@paperclipai/plugin-search-console-mcp-agent-tools` | Google Search Console MCP bridge. |
| `paperclip.semantic-core-mcp-agent-tools` | `@paperclipai/plugin-semantic-core-mcp-agent-tools` | Semantic Core MCP bridge and cost ledger events. |
| `paperclip.seo-performance-loop` | `@paperclipai/plugin-seo-performance-loop` | Weekly SEO telemetry and decision loop. |
| `paperclip.serper-agent-tools` | `@paperclipai/plugin-serper-agent-tools` | Serper search tools. |
| `paperclip.winning-structure-mcp-agent-tools` | `@paperclipai/plugin-winning-structure-mcp-agent-tools` | Winning Structure MCP bridge. |

## Invariants

- Telegram issue lifecycle notifications must have one path: `paperclip-plugin-telegram`.
- `telegram-daily-digest` must remain absent unless deliberately reintroduced with a new product decision.
- DataForSEO and Semantic Core MCP cost attribution uses `costs.write` and `ctx.costs.createEvent(...)`; this is not replaced by `metrics.write`.
- Shared MCP/provider plugins must not be switched to company-specific secrets through global instance config without company-aware secret resolution.
