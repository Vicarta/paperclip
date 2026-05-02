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

## Canonical Action Types

These are routing categories, not human job titles. They exist so Paperclip can choose the right task template, validation checklist, assignee mapping, indexing behavior, and follow-up telemetry. They intentionally mirror the DiskInternals Growth OS opportunity-routing contract.

```text
seo_refresh
new_page_or_article
product_page_update
internal_linking
cro_experiment
localization_experiment
indexing_followup
tracking_or_data_quality_issue
```

Each action type can map to one or more Perfex assignee IDs through `assigneeByActionTypeJson`.
Legacy short aliases such as `localization`, `tracking`, `indexing`, and `data_quality` are accepted and normalized to the canonical names above.

## Discovered DiskInternals Defaults

Read-only MCP discovery found project `DiskInternals.SEO` as `project_id=1`.

Owner-approved setup routing:

```json
{
  "perfexProjectId": "1",
  "projectManagerId": "1",
  "assigneeByActionTypeJson": {
    "seo_refresh": ["1"],
    "new_page_or_article": ["1"],
    "product_page_update": ["1"],
    "internal_linking": ["1"],
    "cro_experiment": ["1"],
    "localization_experiment": ["1"],
    "indexing_followup": ["1"],
    "tracking_or_data_quality_issue": ["1"]
  }
}
```

This is a setup-stage mapping only. Final distribution to implementers should be approved later before `enableTaskWrites` is turned on.

## Verification

```bash
pnpm --filter @paperclipai/plugin-perfex-crm-agent-tools test
pnpm --filter @paperclipai/plugin-perfex-crm-agent-tools typecheck
pnpm --filter @paperclipai/plugin-perfex-crm-agent-tools build
```
