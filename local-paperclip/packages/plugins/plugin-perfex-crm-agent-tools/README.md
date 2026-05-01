# Perfex CRM Agent Tools

Server-side Paperclip adapter for the Perfex CRM MCP endpoint used by DiskInternals human implementation handoff.

## Safety Defaults

- Task writes are disabled by default with `enableTaskWrites: false`.
- Create/comment tools dry-run by default with `defaultDryRun: true`.
- Real Perfex writes require both plugin config `enableTaskWrites: true` and tool input `dry_run: false`.
- No scheduled jobs are declared in the MVP, so deploying the plugin does not poll or create anything automatically.
- Status sync reads both `get_task` and `get_task_comments`.

## Endpoint

```text
transport: Streamable HTTP
url: https://pxmc.aibizmate.com/mcp
auth: Authorization: Bearer <MCP_TOKEN>
health: https://pxmc.aibizmate.com/healthz
```

The bearer token must be stored as a Paperclip encrypted secret and referenced by `perfexMcpTokenSecretRef`.

## Proposed Action Types

```text
seo_refresh
cro_experiment
internal_linking
localization
tracking
indexing
data_quality
```

Each action type can map to one or more Perfex assignee IDs through `assigneeByActionTypeJson`.

## Discovered DiskInternals Defaults

Read-only MCP discovery found project `DiskInternals.SEO` as `project_id=1`.

Proposed but not yet approved mapping:

```json
{
  "perfexProjectId": "1",
  "projectManagerId": "1",
  "assigneeByActionTypeJson": {
    "seo_refresh": ["13"],
    "internal_linking": ["13"],
    "indexing": ["13"],
    "cro_experiment": ["2"],
    "localization": ["5"],
    "tracking": ["3"],
    "data_quality": ["3"]
  }
}
```

## Verification

```bash
pnpm --filter @paperclipai/plugin-perfex-crm-agent-tools test
pnpm --filter @paperclipai/plugin-perfex-crm-agent-tools typecheck
pnpm --filter @paperclipai/plugin-perfex-crm-agent-tools build
```
