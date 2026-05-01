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
perfex-preview-implementation-task
perfex-create-implementation-task
perfex-add-task-comment
perfex-get-task-status
perfex-get-task-comments
perfex-sync-task-status
```

If the MCP server exposes different exact tool names, the adapter should map those raw MCP tools into the stable Paperclip tool names above. Agents should not call arbitrary MCP tools directly.

Discovered read-only MCP surface on 2026-05-01:

```text
add_task_comment
create_task
get_task
get_task_comments
list_projects
list_staff
list_project_tasks
list_open_tasks
get_due_soon_tasks
get_overdue_tasks
get_stale_tasks
...
```

The plugin maps the MVP write/read tools to:

```text
create task -> create_task
add comment -> add_task_comment
status read -> get_task
comment read -> get_task_comments
```

Task writes are disabled by default and task/comment tools return dry-run previews unless `enableTaskWrites = true` and the tool call passes `dry_run = false`.

## Discovered Perfex IDs

Read-only MCP discovery returned:

```text
project_id: 1
project_name: DiskInternals.SEO
client_name: DiskInternals
status: In Progress
```

Available staff IDs:

```text
1  Oleh Savytskyi       admin
2  Roman E              staff
3  Artem B              staff
5  Volodymyr G          staff
6  Service Service      admin
13 SEO Bot              staff
```

These IDs are not yet approved as the final assignment mapping.

## Proposed Action Types And Assignment Mapping

Action types implemented in the plugin:

```text
seo_refresh
cro_experiment
internal_linking
localization
tracking
indexing
data_quality
```

Proposed mapping for owner approval:

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

Open decision: confirm whether `projectManagerId` should be `1` or `6`, and whether the proposed assignee IDs match the real human/team ownership.

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

## Result Collection

The MVP does not schedule automatic polling. The intended operating model after owner approval:

- `perfex-sync-task-status` runs on approved task IDs every 60 minutes while a task is open.
- For tasks due within 48 hours or already overdue, run every 15 minutes during working hours.
- Stop polling when the task is verified, rejected, or parked as needs-clarification.
- Each sync reads both `get_task` and `get_task_comments`.

Human implementers should report completion in comments using a stable structure:

```text
Paperclip result:
status: implemented | needs_clarification | rejected
changed_urls:
- https://...
summary:
...
evidence:
...
questions:
...
```

Paperclip should not trigger indexing or 7/14/28 follow-up only from a generic "done" status. It needs a task status plus a useful comment/evidence trail.

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
