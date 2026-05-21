# Production Plugin Manifest

Last verified: 2026-05-21
Source: Phase 17 live production smoke, plugin inventory, Telegram formatter smoke, Phase 22 source package verification, live Telegram delivery-groups proof on AST-827, Payload CMS live agent-tool smoke, and secret schema reconciliation smoke.
Secret handling: config keys and secret refs only; no plaintext secret values. Generic `secretService` create/resolve/rotate is reconciled with the production metadata schema.

Expected status: Astrogen-required plugins `ready`. Optional legacy connector records may remain `error` until their package/runtime wiring is deliberately restored.

| Plugin key | Package | Expected role |
| --- | --- | --- |
| `paperclip-file-browser-example` | `@paperclipai/plugin-file-browser-example` | UI helper. |
| `paperclip-plugin-telegram` | `paperclip-plugin-telegram@0.3.1-paperclip.0` target; live record may still report `0.3.0` until durable package cutover | Canonical Telegram lifecycle notifications, watch/escalation jobs, and issue attachment delivery groups. |
| `paperclip.bright-data-agent-tools` | `@paperclipai/plugin-bright-data-agent-tools` | Bright Data tools. |
| `paperclip.dataforseo-agent-tools` | `@paperclipai/plugin-dataforseo-agent-tools` | DataForSEO tools and cost ledger events. |
| `paperclip.diskinternals-bigquery-growth` | `@paperclipai/plugin-diskinternals-bigquery-growth` | DiskInternals-specific growth analytics. |
| `paperclip.exa-agent-tools` | `@paperclipai/plugin-exa-agent-tools` | Exa research connector. |
| `paperclip.perfex-crm-agent-tools` | `@paperclipai/plugin-perfex-crm-agent-tools` | Perfex CRM bridge. |
| `paperclip.payload-cms-agent-tools` | `@paperclipai/plugin-payload-cms-agent-tools` | Payload CMS bridge for Astrogen blog drafts, media upload, taxonomy lookup, build-state checks, and guarded publishing. |
| `paperclip.search-console-mcp-agent-tools` | `@paperclipai/plugin-search-console-mcp-agent-tools` | Google Search Console MCP bridge. |
| `paperclip.semantic-core-mcp-agent-tools` | `@paperclipai/plugin-semantic-core-mcp-agent-tools` | Semantic Core MCP bridge and cost ledger events. |
| `paperclip.seo-performance-loop` | `@paperclipai/plugin-seo-performance-loop` | Weekly SEO telemetry and decision loop. |
| `paperclip.serper-agent-tools` | `@paperclipai/plugin-serper-agent-tools` | Serper search tools. |
| `paperclip.winning-structure-mcp-agent-tools` | `@paperclipai/plugin-winning-structure-mcp-agent-tools` | Winning Structure MCP bridge. |

## Last Smoke

- Ready and loaded: `paperclip-file-browser-example`, `paperclip-plugin-telegram`, `paperclip.dataforseo-agent-tools`, `paperclip.diskinternals-bigquery-growth`, `paperclip.payload-cms-agent-tools`, `paperclip.perfex-crm-agent-tools`, `paperclip.search-console-mcp-agent-tools`, `paperclip.semantic-core-mcp-agent-tools`, `paperclip.seo-performance-loop`, `paperclip.winning-structure-mcp-agent-tools`.
- Payload CMS smoke:
  - `payload_cms_get_build_state` returned `HTTP 200`, `lastBuildStatus=queued`, `buildInProgress=false`.
  - `payload_cms_health_check` returned `HTTP 200`, with authenticated access to build state and Payload collections needed for blog drafts/media.
- Secret service smoke:
  - production image `paperclip-app:v2026.513.6-phase10-20260521` is active;
  - migration `0058_secret_schema_reconciliation` is applied;
  - a dummy local-encrypted secret was created, resolved, rotated, resolved again, and removed through the standard `secretService` path.
- Phase 10 smoke:
  - app health returned `HTTP 200` after cutover;
  - server bundle contains `child_issue_needs_parent_review`;
  - installed Telegram plugin bundle contains `Чернетка готова` and `Відкрити чернетку`;
  - Astrogen CMO heartbeat is `enabled=true`, `intervalSec=600`, `wakeOnDemand=true`, `maxConcurrentRuns=1`.
- Phase 22 live proof:
  - live Telegram delivery-groups path succeeded for [AST-827](/AST/issues/AST-827);
  - audit comment recorded `Telegram message ids: 628`;
  - runtime recovery aligned the persistent Telegram plugin `@paperclipai/plugin-sdk` dependency with the running app image SDK so `ctx.issues.listAttachments` and `ctx.issues.getAttachmentContent` are available.
  - this runtime alignment is a recovery patch, not the durable package-cutover target.
- Error records, not required for current Astrogen SEO flow: `paperclip.bright-data-agent-tools`, `paperclip.exa-agent-tools`, `paperclip.serper-agent-tools`.

## Invariants

- Telegram issue lifecycle notifications must have one path: `paperclip-plugin-telegram`.
- Telegram issue-done messages must be human-facing Ukrainian operator text. They must not expose internal stage labels such as `HIA`, `Stage 55`, `Wave`, raw agent lane names, artifact paths, or fallback summaries like `Задачу ... завершено`.
- Issue-done messages should use short fields: `Тема`, `Що сталося`, and `Далі`. The `Далі` line must say whether the owner needs to act now.
- Telegram article-draft classification must not match the bare word `draft`. `CMS state: draft`, Payload drafts, cover image updates, media uploads, and `coverImage` updates are CMS operations, not Stage 59 article-draft completion.
- Telegram Payload CMS draft-ready messages must include the direct CMS draft/admin URL and a `Відкрити чернетку` button. A generic forwarded `issue.updated` lifecycle notification is not delivery proof for a ready blog draft.
- Article package delivery is separate from noisy issue lifecycle notifications: a delivery issue may attach markdown, HTML, and image artifacts and send a concise Telegram package summary. Source-controlled plugin package `paperclip-plugin-telegram@0.3.1-paperclip.0` owns `delivery_groups`; production must complete the durable package cutover before direct operator Bot API delivery and live plugin-volume dependency alignment are considered retired.
- `telegram-daily-digest` must remain absent unless deliberately reintroduced with a new product decision.
- DataForSEO and Semantic Core MCP cost attribution uses `costs.write` and `ctx.costs.createEvent(...)`; this is not replaced by `metrics.write`.
- Shared MCP/provider plugins must not be switched to company-specific secrets through global instance config without company-aware secret resolution.
- Payload CMS publish remains guarded: agents may create/update drafts by default; publishing requires the explicit `payload_cms_publish_blog_post` tool with `confirmPublish=true`.
- Payload CMS blog text must be sent as `articleContent.v1`. Agents must not send raw Lexical JSON, markdown, raw HTML, inline styles, CSS classes, unsupported article blocks, or unsafe CTA URLs to the blog post create/update tools.
