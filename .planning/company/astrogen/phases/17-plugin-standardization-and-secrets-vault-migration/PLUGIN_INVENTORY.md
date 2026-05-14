# Phase 17 Plugin Inventory

Date: 2026-05-15  
Source: live production DB and container inspection on `ubuntu-oc`  
Secret handling: secret names/keys only; no plaintext values were read or recorded.

## Live Status

Production health is OK and the plugin registry reports `12/12` ready.

| Plugin key | Package | Path | Status | Capabilities | Tools | Notes |
| --- | --- | --- | --- | --- | ---: | --- |
| `paperclip-file-browser-example` | `@paperclipai/plugin-file-browser-example` | `/paperclip/plugins/plugin-file-browser-example` | ready | `ui.*`, project/comment/state reads | 0 | UI helper only. |
| `paperclip-plugin-telegram` | `paperclip-plugin-telegram` | installed plugin volume | ready | issues, agents, events, state, http, secrets, activity, metrics, jobs | 4 | Owns human Telegram lifecycle notifications. Daily digest job removed. |
| `paperclip.bright-data-agent-tools` | `@paperclipai/plugin-bright-data-agent-tools` | `/app/packages/plugins/plugin-bright-data-agent-tools` | ready | http, secrets, tools, state, settings | 7 | Uses Astrogen-scoped Bright Data secret. |
| `paperclip.dataforseo-agent-tools` | `@paperclipai/plugin-dataforseo-agent-tools` | `/app/packages/plugins/plugin-dataforseo-agent-tools` | ready | http, secrets, tools, settings, costs | 2 | Uses canonical cost ledger via `ctx.costs.createEvent`. |
| `paperclip.diskinternals-bigquery-growth` | `@paperclipai/plugin-diskinternals-bigquery-growth` | `/app/packages/plugins/plugin-diskinternals-bigquery-growth` | ready | http, secrets, tools, settings, jobs | 21 | DiskInternals-specific; not Astrogen-owned. |
| `paperclip.exa-agent-tools` | `@paperclipai/plugin-exa-agent-tools` | `/app/packages/plugins/plugin-exa-agent-tools` | ready | http, secrets, tools, settings | 3 | Shared research connector. |
| `paperclip.perfex-crm-agent-tools` | `@paperclipai/plugin-perfex-crm-agent-tools` | `/app/packages/plugins/plugin-perfex-crm-agent-tools` | ready | http, secrets, tools, settings, state, projects, companies | 8 | Shared CRM bridge. |
| `paperclip.search-console-mcp-agent-tools` | `@paperclipai/plugin-search-console-mcp-agent-tools` | `/app/packages/plugins/plugin-search-console-mcp-agent-tools` | ready | http, secrets, tools, settings | 9 | Uses Astrogen-scoped Search Console MCP token. |
| `paperclip.semantic-core-mcp-agent-tools` | `@paperclipai/plugin-semantic-core-mcp-agent-tools` | `/app/packages/plugins/plugin-semantic-core-mcp-agent-tools` | ready | http, secrets, tools, settings, state, projects, companies, costs | 16 | Uses canonical cost ledger. Secret scope needs cleanup before company-isolated rollout. |
| `paperclip.seo-performance-loop` | `@paperclipai/plugin-seo-performance-loop` | plugin volume | ready | tools, events, jobs, state, settings, dashboard widget | 8 | Owns weekly SEO telemetry/decision jobs. |
| `paperclip.serper-agent-tools` | `@paperclipai/plugin-serper-agent-tools` | `/app/packages/plugins/plugin-serper-agent-tools` | ready | http, secrets, tools, settings | 1 | Uses Astrogen-scoped Serper secret. |
| `paperclip.winning-structure-mcp-agent-tools` | `@paperclipai/plugin-winning-structure-mcp-agent-tools` | `/app/packages/plugins/plugin-winning-structure-mcp-agent-tools` | ready | http, secrets, tools, settings | 4 | Shared MCP bridge. |

## Scheduled Jobs

| Plugin | Job key | Schedule | Status |
| --- | --- | --- | --- |
| `paperclip-plugin-telegram` | `check-escalation-timeouts` | `* * * * *` | active |
| `paperclip-plugin-telegram` | `check-watches` | `*/15 * * * *` | active |
| `paperclip.diskinternals-bigquery-growth` | `crawl-due-items` | `*/15 * * * *` | active |
| `paperclip.seo-performance-loop` | `collect-weekly-search-telemetry` | `0 3 * * 1` | active |
| `paperclip.seo-performance-loop` | `evaluate-weekly-seo-decisions` | `30 3 * * 1` | active |

`telegram-daily-digest` is not present in live jobs or installed Telegram plugin files.

## Managed Resource / Namespace Usage

No live plugin currently has rows in:

- `plugin_managed_resources`
- `plugin_database_namespaces`
- `plugin_migrations`

This means Phase 17 does not need to migrate existing plugin-owned DB namespaces. Future plugin modernization can introduce them deliberately where the plugin owns state.

## Instance Config Keys

Only config keys were inspected.

| Plugin | Config keys |
| --- | --- |
| `paperclip-plugin-telegram` | `defaultChatId`, `digestMode`, `enableCommands`, `enableInbound`, `escalationChatId`, `escalationTimeoutMs`, `notifyOnAgentError`, `notifyOnApprovalCreated`, `notifyOnIssueCreated`, `notifyOnIssueDone`, `paperclipBaseUrl`, `paperclipPublicUrl`, `telegramBotTokenRef` |
| `paperclip.bright-data-agent-tools` | `brightDataGroups`, `brightDataMcpUrl`, `brightDataTokenSecretRef` |
| `paperclip.dataforseo-agent-tools` | `dataforseoApiBaseUrl`, `dataforseoApiLoginSecretRef`, `dataforseoApiPasswordSecretRef` |
| `paperclip.exa-agent-tools` | `exaApiKeySecretRef`, `exaMcpUrl` |
| `paperclip.perfex-crm-agent-tools` | `addCommentToolName`, `assigneeByActionTypeJson`, `createTaskToolName`, `defaultDryRun`, `enableTaskWrites`, `getTaskCommentsToolName`, `getTaskToolName`, `perfexHealthUrl`, `perfexMcpTokenSecretRef`, `perfexMcpUrl`, `perfexProjectId`, `projectManagerId`, `requestTimeoutMs`, `statusCheckIntervalMinutes` |
| `paperclip.search-console-mcp-agent-tools` | `allowedSiteUrl`, `requestTimeoutMs`, `searchConsoleMcpTokenSecretRef`, `searchConsoleMcpUrl` |
| `paperclip.semantic-core-mcp-agent-tools` | `allowedClientKeysCsv`, `allowedProjectIdsCsv`, `pollIntervalMs`, `requestTimeoutMs`, `runWaitTimeoutMs`, `semanticCoreMcpTokenSecretRef`, `semanticCoreMcpUrl` |
| `paperclip.serper-agent-tools` | `flatCostUsdPerSearch`, `serperApiBaseUrl`, `serperApiKeySecretRef` |
| `paperclip.winning-structure-mcp-agent-tools` | `allowedClientKeysCsv`, `requestTimeoutMs`, `winningStructureMcpTokenSecretRef`, `winningStructureMcpUrl` |

There are no Astrogen-specific rows in `plugin_company_settings` at this checkpoint.
