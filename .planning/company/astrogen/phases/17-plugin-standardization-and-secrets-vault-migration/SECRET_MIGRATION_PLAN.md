# Phase 17 Secret Migration Plan

Date: 2026-05-15  
Secret handling: metadata only; no plaintext values were read or recorded.

## Current Astrogen Secret State

Astrogen has active local-encrypted Paperclip secrets for:

| Secret key | Purpose | Status |
| --- | --- | --- |
| `bright-data-api-token` | Bright Data Agent Tools | active |
| `dataforseo-api-login` | DataForSEO login | active |
| `dataforseo-api-password` | DataForSEO password | active |
| `exa-api-key` | Exa Agent Tools | active |
| `openrouter-api-key` | OpenRouter adapter settings | active |
| `search-console-mcp-astrogen-token` | Search Console MCP Astrogen tenant token | active |
| `serper-api-key` | Serper Agent Tools | active |
| `telegram.bot_token.astrogen_ai_bot` | Astrogen Telegram bot token | active |

Provider vault configs exist in schema but no provider-vault rows are configured yet.

## Plugin Secret Ref Mapping

| Plugin | Config ref | Current state |
| --- | --- | --- |
| `paperclip-plugin-telegram` | `telegramBotTokenRef` | Astrogen-scoped active secret |
| `paperclip.bright-data-agent-tools` | `brightDataTokenSecretRef` | Astrogen-scoped active secret |
| `paperclip.dataforseo-agent-tools` | `dataforseoApiLoginSecretRef`, `dataforseoApiPasswordSecretRef` | Astrogen-scoped active secrets |
| `paperclip.search-console-mcp-agent-tools` | `searchConsoleMcpTokenSecretRef` | Astrogen-scoped active secret |
| `paperclip.serper-agent-tools` | `serperApiKeySecretRef` | Astrogen-scoped active secret |
| `paperclip.semantic-core-mcp-agent-tools` | `semanticCoreMcpTokenSecretRef` | Active secret, but currently scoped under another company |
| `paperclip.exa-agent-tools` | `exaApiKeySecretRef` | Astrogen-scoped active secret |
| `paperclip.winning-structure-mcp-agent-tools` | `winningStructureMcpTokenSecretRef` | Shared active secret outside Astrogen scope |
| `paperclip.perfex-crm-agent-tools` | `perfexMcpTokenSecretRef` | Shared active secret outside Astrogen scope |
| `paperclip.diskinternals-bigquery-growth` | `bigQueryServiceAccountJsonSecretRef` | DiskInternals-specific; not Astrogen-owned |

## Required Changes

### 1. Do Not Move Plaintext

All migrations must preserve encrypted material or use the Paperclip Secrets API/UI to rotate values. Do not copy plaintext into:

- Git;
- planning docs;
- issue comments;
- Telegram;
- shell history summaries;
- logs.

### 2. Semantic Core MCP Secret Scope

Current problem: the Semantic Core MCP plugin uses instance-wide config, and the referenced secret is not Astrogen-scoped.

Do not simply switch the global plugin config to a new Astrogen secret unless all other companies using the same plugin are accounted for.

Preferred fix:

1. add company-aware plugin settings or a company-scoped secret resolution layer for MCP connector plugins;
2. create/rotate an Astrogen-scoped `semantic-core-mcp-token` secret;
3. store the Astrogen ref in company settings;
4. make tool execution resolve the secret based on `runCtx.companyId`;
5. keep the old ref only as a fallback during migration;
6. verify Astrogen and other companies independently.

### 3. External Provider Vault

No external provider vault is configured yet. Keep local encrypted secrets as the active model until the following are ready:

- provider config creation and health check path;
- remote import preview/commit tested on a non-critical secret;
- rotation story;
- rollback story;
- clear owner approval.

## Safe Migration Order

1. Keep current local-encrypted secrets active.
2. Implement company-scoped plugin settings for shared MCP/provider plugins.
3. Add Astrogen-scoped Semantic Core MCP token through Paperclip Secrets UI/API.
4. Switch only Astrogen execution to the Astrogen-scoped ref.
5. Run smoke without printing resolved values.
6. Only then evaluate AWS/GCP/external provider vault import.

## Verification

- Secret metadata query shows expected Astrogen-scoped records.
- Plugin config/company settings reference the expected secret owner scope.
- Plugin smoke resolves secrets successfully without logging values.
- `secret_access_events` records access after smoke.
- No plaintext secret appears in Git diff, planning docs, Paperclip comments, Telegram, or logs.
