# Plugin Compatibility Matrix

Date: 2026-05-14  
Target release source: `v2026.513.0`  
Candidate image tag: `paperclip-app:v2026.513.0-phase16`

## Release Runtime Fixes Applied For Compatibility

- Added all live plugin package roots to the production image build dependency stage.
- Built all live plugin workspaces before building the server.
- Forward-ported the live portal and SEO ops routes/schema into the candidate release source.
- Migrated legacy `costs.write` plugin manifests to the newer `metrics.write` capability.
- Added a narrow compatibility bridge so legacy `ctx.costs.createEvent(...)` calls still route through the host cost service while capability gating uses `metrics.write`.
- Removed unsupported `executionTimeoutMs` from the Bright Data plugin tool declaration.
- Added deterministic health provenance fields for release tag, revision, build time, and source URL.

## Matrix

| Plugin key | Compatibility decision | Phase 16 action | Staging result |
| --- | --- | --- | --- |
| `paperclip-file-browser-example` | works as-is | included through existing runtime | ready |
| `paperclip-plugin-telegram` | works with existing secret refs | config copied only into isolated staging DB/env; notifications disabled for smoke | ready |
| `paperclip.bright-data-agent-tools` | needs manifest/tool-shape migration | removed unsupported `executionTimeoutMs`; included package root | ready |
| `paperclip.dataforseo-agent-tools` | needs manifest and SDK compatibility | `costs.write` -> `metrics.write`; `ctx.costs.createEvent` bridge | ready |
| `paperclip.diskinternals-bigquery-growth` | needs package inclusion | included package root and build step | ready |
| `paperclip.exa-agent-tools` | needs package inclusion | included package root and build step | ready |
| `paperclip.perfex-crm-agent-tools` | needs package inclusion | included package root and build step | ready |
| `paperclip.search-console-mcp-agent-tools` | needs package inclusion | included package root and build step | ready |
| `paperclip.semantic-core-mcp-agent-tools` | needs manifest and SDK compatibility | `costs.write` -> `metrics.write`; `ctx.costs.createEvent` bridge | ready |
| `paperclip.seo-performance-loop` | works with live package inclusion | included through workspace | ready |
| `paperclip.serper-agent-tools` | needs package inclusion | included package root and build step | ready |
| `paperclip.winning-structure-mcp-agent-tools` | needs package inclusion | included package root and build step | ready |

## Build Verification

The following candidate workspace builds passed before image smoke:

- `@paperclipai/plugin-sdk`
- `@paperclipai/plugin-dataforseo-agent-tools`
- `@paperclipai/plugin-semantic-core-mcp-agent-tools`
- all live provider/MCP plugin packages
- `@paperclipai/db`
- `@paperclipai/server`

## Staging Boot Evidence

Staging app container:

```text
paperclip-app-stage-phase16 paperclip-app:v2026.513.0-phase16
```

Staging health:

```text
{"status":"ok","version":"0.3.1","build":{"releaseTag":"v2026.513.0-phase16","gitRevision":"f4bed4a70f34551ffd4c7c76cf8d8be2ae761d74","buildTime":"2026-05-14T19:21:15Z","sourceUrl":"https://github.com/paperclipai/paperclip/releases/tag/v2026.513.0"},"deploymentMode":"authenticated","bootstrapStatus":"ready","bootstrapInviteActive":false}
```

Plugin loader:

```text
plugin-loader: loadAll complete {"total":12,"succeeded":12,"failed":0}
```

Staging plugin DB:

```text
12|12|0
```

Astrogen portal API smoke against staging:

```text
/api/portal/companies/astrogen/semantic-core 200 ok=true count=2666
/api/portal/companies/astrogen/semantic-core/review 200 ok=true count=1918
/api/portal/companies/astrogen/semantic-core/review-groups 200 ok=true count=12
```

## Production Smoke Evidence

After production promotion:

```text
APP_IMAGE=paperclip-app:v2026.513.0-phase16 sha256:035cdccbc45c52b304f9425d3a61b1c5bdaeb4c506c9466e8194d1a7c5066daf running
PLUGIN_COUNT=12|12|0
plugin-loader: loadAll complete {"total":12,"succeeded":12,"failed":0}
/api/portal/companies/astrogen/semantic-core ok=true count=2666
/api/portal/companies/astrogen/semantic-core/review ok=true count=1918
/api/portal/companies/astrogen/semantic-core/review-groups ok=true count=12
```
