# Production Plugin Manifest

Last verified: 2026-05-19
Source: Phase 17 live production smoke, plugin inventory, Telegram formatter smoke, and Phase 22 source package verification.
Secret handling: config keys and secret refs only; no plaintext secret values.

Expected status: Astrogen-required plugins `ready`. Optional legacy connector records may remain `error` until their package/runtime wiring is deliberately restored.

| Plugin key | Package | Expected role |
| --- | --- | --- |
| `paperclip-file-browser-example` | `@paperclipai/plugin-file-browser-example` | UI helper. |
| `paperclip-plugin-telegram` | `paperclip-plugin-telegram@0.3.1-paperclip.0` | Canonical Telegram lifecycle notifications, watch/escalation jobs, and issue attachment delivery groups after the next production image cutover. |
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

## Last Smoke

- Ready and loaded: `paperclip-file-browser-example`, `paperclip-plugin-telegram`, `paperclip.dataforseo-agent-tools`, `paperclip.diskinternals-bigquery-growth`, `paperclip.perfex-crm-agent-tools`, `paperclip.search-console-mcp-agent-tools`, `paperclip.semantic-core-mcp-agent-tools`, `paperclip.seo-performance-loop`, `paperclip.winning-structure-mcp-agent-tools`.
- Error records, not required for current Astrogen SEO flow: `paperclip.bright-data-agent-tools`, `paperclip.exa-agent-tools`, `paperclip.serper-agent-tools`.

## Invariants

- Telegram issue lifecycle notifications must have one path: `paperclip-plugin-telegram`.
- Telegram issue-done messages must be human-facing Ukrainian operator text. They must not expose internal stage labels such as `HIA`, `Stage 55`, `Wave`, raw agent lane names, artifact paths, or fallback summaries like `Задачу ... завершено`.
- Issue-done messages should use short fields: `Тема`, `Що сталося`, and `Далі`. The `Далі` line must say whether the owner needs to act now.
- Article package delivery is separate from noisy issue lifecycle notifications: a delivery issue may attach markdown, HTML, and image artifacts and send a concise Telegram package summary. Source-controlled plugin package `paperclip-plugin-telegram@0.3.1-paperclip.0` owns `delivery_groups`; production must deploy that package before direct operator Bot API delivery is considered retired.
- `telegram-daily-digest` must remain absent unless deliberately reintroduced with a new product decision.
- DataForSEO and Semantic Core MCP cost attribution uses `costs.write` and `ctx.costs.createEvent(...)`; this is not replaced by `metrics.write`.
- Shared MCP/provider plugins must not be switched to company-specific secrets through global instance config without company-aware secret resolution.
