# Production Secret References Manifest

Last verified: 2026-05-15
Scope: metadata only. No plaintext secret values belong in Git.

## Astrogen Secret Names

| Secret name | Purpose |
| --- | --- |
| `bright-data-api-token` | Bright Data Agent Tools. |
| `dataforseo-api-login` | DataForSEO login. |
| `dataforseo-api-password` | DataForSEO password. |
| `exa-api-key` | Exa Agent Tools. |
| `openrouter-api-key` | OpenRouter adapter settings. |
| `search-console-mcp-astrogen-token` | Astrogen Search Console MCP tenant token. |
| `serper-api-key` | Serper Agent Tools. |
| `telegram.bot_token.astrogen_ai_bot` | Astrogen Telegram bot token. |

## Known Cleanup

`paperclip.semantic-core-mcp-agent-tools` currently uses instance-wide config and references a Semantic Core MCP token that is not Astrogen-scoped. Do not switch the global instance config directly. First implement company-aware plugin settings or company-scoped secret resolution, then add an Astrogen-scoped Semantic Core MCP token ref.

## Export Restrictions

The live export script must not export:

- `company_secret_versions.material`;
- secret hashes;
- plaintext secret values;
- local encrypted secret files;
- provider vault credentials.
