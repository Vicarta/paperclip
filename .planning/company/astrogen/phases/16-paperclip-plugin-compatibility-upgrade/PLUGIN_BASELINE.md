# Plugin Baseline

Date: 2026-05-14  
Host: `ubuntu-oc.tailbd4e1c.ts.net`  
App path: `/home/paperclip/apps/paperclip`

## Production Baseline Before Phase 16 Cutover

Production started this phase on the post-rollback image while the candidate release was built and smoke-tested separately.

- Health endpoint: `GET http://127.0.0.1:3200/api/health`
- Reported live version: `0.3.1`
- Live app container: `paperclip-app-1`
- Live app image digest: `sha256:8dbdc26ee03c673a2e88532a01f0eaaa97fc9e25df4444f13b50cc60b66553f7`
- Plugin registry: `12` total, `12` ready, `0` not ready
- Active heartbeat runs at baseline check: `0`
- Public portal state was not modified by the staging smoke.

Production health evidence after the staging smoke:

```text
{"status":"ok","version":"0.3.1","deploymentMode":"authenticated","deploymentExposure":"private","authReady":true,"bootstrapStatus":"ready","bootstrapInviteActive":false,...}
12|12|0
```

## Production State After Phase 16 Cutover

Production was promoted after the staging gate passed.

- Live app image: `paperclip-app:v2026.513.0-phase16`
- Live app image digest: `sha256:035cdccbc45c52b304f9425d3a61b1c5bdaeb4c506c9466e8194d1a7c5066daf`
- Live health release tag: `v2026.513.0`
- Live source URL: `https://github.com/paperclipai/paperclip/releases/tag/v2026.513.0`
- Plugin registry after cutover: `12` total, `12` ready, `0` not ready
- Backup directory: `/home/oc/paperclip-backups/phase16-prod-deploy-20260514T192917Z`

Production health evidence after cutover:

```text
{"status":"ok","version":"0.3.1","build":{"releaseTag":"v2026.513.0","gitRevision":"f4bed4a70f34551ffd4c7c76cf8d8be2ae761d74","buildTime":"20260514T192917Z","sourceUrl":"https://github.com/paperclipai/paperclip/releases/tag/v2026.513.0"},"deploymentMode":"authenticated","bootstrapStatus":"ready","bootstrapInviteActive":false}
```

## Production State After Agent API URL Fix

The CTO release-check routine found a local heartbeat URL mismatch after the production promotion. A follow-up fix was built into `paperclip-app:v2026.513.0-phase16.1`.

- Live app image: `paperclip-app:v2026.513.0-phase16.1`
- Live app image digest: `sha256:d74930d4412cc8cc19701eead60e75050614319a6020f10b6372c906a316c6a2`
- Live health release tag: `v2026.513.0`
- Agent-local API override: `PAPERCLIP_AGENT_API_URL=http://127.0.0.1:3100`
- Plugin registry after cutover: `12` total, `12` ready, `0` not ready
- Backup directory: `/home/oc/paperclip-backups/phase16-agent-api-url-20260514T195650Z`

Production health evidence after the agent API URL fix:

```text
{"status":"ok","version":"0.3.1","build":{"releaseTag":"v2026.513.0","gitRevision":"f4bed4a70f34551ffd4c7c76cf8d8be2ae761d74","buildTime":"20260514T195650Z","sourceUrl":"https://github.com/paperclipai/paperclip/releases/tag/v2026.513.0"},"deploymentMode":"authenticated","bootstrapStatus":"ready","bootstrapInviteActive":false}
```

## Live Plugin Inventory

| Plugin key | Package | Status |
| --- | --- | --- |
| `paperclip-file-browser-example` | `@paperclipai/plugin-file-browser-example` | ready |
| `paperclip-plugin-telegram` | `paperclip-plugin-telegram` | ready |
| `paperclip.bright-data-agent-tools` | `@paperclipai/plugin-bright-data-agent-tools` | ready |
| `paperclip.dataforseo-agent-tools` | `@paperclipai/plugin-dataforseo-agent-tools` | ready |
| `paperclip.diskinternals-bigquery-growth` | `@paperclipai/plugin-diskinternals-bigquery-growth` | ready |
| `paperclip.exa-agent-tools` | `@paperclipai/plugin-exa-agent-tools` | ready |
| `paperclip.perfex-crm-agent-tools` | `@paperclipai/plugin-perfex-crm-agent-tools` | ready |
| `paperclip.search-console-mcp-agent-tools` | `@paperclipai/plugin-search-console-mcp-agent-tools` | ready |
| `paperclip.semantic-core-mcp-agent-tools` | `@paperclipai/plugin-semantic-core-mcp-agent-tools` | ready |
| `paperclip.seo-performance-loop` | `@paperclipai/plugin-seo-performance-loop` | ready |
| `paperclip.serper-agent-tools` | `@paperclipai/plugin-serper-agent-tools` | ready |
| `paperclip.winning-structure-mcp-agent-tools` | `@paperclipai/plugin-winning-structure-mcp-agent-tools` | ready |

## Schema Notes

- `plugins` stores `plugin_key`, `package_name`, `package_path`, `manifest_json`, `status`, and `last_error`.
- `plugin_config` stores global plugin `config_json`.
- `plugin_company_settings` stores company-scoped `settings_json`.
- `companies` uses `name` and `issue_prefix`; it does not expose a `slug` column.

## Secret Handling

Only config key names were inventoried. Secret values were not copied into planning docs or logs.
