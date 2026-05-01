# Perfex CRM Human Implementation Handoff Plugin

## Purpose

DiskInternals website source code is not available to Paperclip agents. The production implementation path is therefore:

```text
BigQuery opportunity -> Paperclip approval -> Perfex CRM task -> human website change -> status sync -> indexing/follow-up telemetry
```

Agents should not promise patches, pull requests, or direct publishing for DiskInternals website changes unless a separate source-code workspace is explicitly provided later.

## MCP Connection

Use Streamable HTTP:

```json
{
  "type": "streamable-http",
  "url": "https://pxmc.aibizmate.com/mcp",
  "headers": {
    "Authorization": "Bearer <MCP_TOKEN>"
  }
}
```

Rules:

- Store `MCP_TOKEN` only as a Paperclip encrypted secret.
- Pass `Authorization: Bearer <MCP_TOKEN>` from server-side plugin code.
- Do not hardcode or expose the token in prompts, logs, UI, artifacts, or planning files.
- Do not require `Bridge Shared Secret`; Perfex authorization and acting user are handled server-side by the MCP service.
- Healthcheck uses the same bearer token: `GET https://pxmc.aibizmate.com/healthz`.

## Plugin Surface

MVP tools should be allowlisted and domain-specific:

```text
perfex-healthcheck
perfex-list-tools
perfex-create-implementation-task
perfex-add-task-comment
perfex-get-task-status
perfex-sync-task-status
```

If the MCP server exposes different exact tool names, the adapter should map those raw MCP tools into the stable Paperclip tool names above. Agents should not call arbitrary MCP tools directly.

## Task Payload Contract

Every implementation task should include:

```text
company: DiskInternals
paperclip_company_id: 969d66ff-d77e-4dbf-8759-1a17c2bb17c2
paperclip_issue_key: DIS-...
source_opportunity_id: ...
affected_urls: [...]
product_lane: ...
action_type: seo_refresh | cro_experiment | internal_linking | localization | tracking | indexing | data_quality
priority: ...
requested_changes: exact human-readable instructions
source_evidence: BigQuery/plugin report links or summarized rows
qa_checklist: recovery/product/compliance checks
acceptance_criteria: how a human and agent can verify completion
indexing_recommendation: submit | do_not_submit | defer
followup_windows: 7/14/28 days when applicable
```

## Status Loop

Minimum states:

```text
approved_in_paperclip
sent_to_perfex
in_progress_in_perfex
implemented
rejected_or_needs_clarification
verified
indexed_if_needed
followup_pending
followup_complete
```

The plugin should write Perfex task IDs and statuses back to Paperclip and BigQuery follow-up state so the Growth OS can measure whether the human change affected GSC clicks, GA4 sessions, downloads, order visits, and purchases.

## Agent Rules

- `CMO` approves backlog priority, but should not manually format every Perfex task.
- Growth Opportunity Strategist routes the opportunity type.
- Specialist agents prepare the implementation payload.
- `OPS Human Interaction Agent` can help with human-facing clarification and escalation.
- `CTO` owns plugin health, MCP token handling, BigQuery status persistence, and failure monitoring.

## Failure Handling

- If healthcheck fails, create a blocked Paperclip issue with owner `CTO`, not a silent in-progress task.
- If task creation fails, keep the source opportunity queued with retry metadata.
- If Perfex returns an unknown status, park the item for OPS/CTO review instead of marking implementation complete.
- If a human marks a task complete without enough evidence, request verification before indexing or follow-up measurement starts.
