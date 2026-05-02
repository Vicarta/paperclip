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

`projectManagerId=1` is owner-approved for setup-stage routing. During setup, all handoff task types should also assign to `1` until the final human implementer mapping is explicitly approved.

## Action Types And Setup Assignment Mapping

Action types are routing categories, not job titles and not agent roles. They exist for five practical reasons:

- choose the correct human task template;
- choose the correct QA checklist;
- decide whether indexing follow-up is allowed;
- preserve comparable telemetry in BigQuery/Paperclip after the human change;
- route to the right Perfex assignee once final implementer ownership is approved.

Canonical action types mirror the Growth OS opportunity-routing contract:

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

Short aliases are accepted only for compatibility and are normalized by the plugin:

```text
content_update -> seo_refresh
new_page -> new_page_or_article
product_update -> product_page_update
localization -> localization_experiment
tracking -> tracking_or_data_quality_issue
data_quality -> tracking_or_data_quality_issue
indexing -> indexing_followup
```

Owner-approved setup mapping:

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

Open decision before enabling writes: approve the final implementer assignment mapping. Until then, keep `enableTaskWrites=false` and use previews/dry-runs only.

## Task Payload Contract

Every implementation task should include:

```text
company: DiskInternals
paperclip_company_id: 969d66ff-d77e-4dbf-8759-1a17c2bb17c2
paperclip_issue_key: DIS-...
source_opportunity_id: ...
affected_urls: [...]
product_lane: ...
action_type: seo_refresh | new_page_or_article | product_page_update | internal_linking | cro_experiment | localization_experiment | indexing_followup | tracking_or_data_quality_issue
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

Read-only sync classification:

```text
verified -> indexing/follow-up eligible only when changed URLs are present
implemented -> implementation exists but needs Paperclip verification before indexing/follow-up
needs_clarification -> parked, ask human/manager for missing input
rejected -> parked, do not index or measure as a release
Perfex done without structured Paperclip result -> implemented_needs_evidence
unknown/unsupported status -> unknown_status, OPS/CTO review
```

This prevents a generic Perfex "done" or unstructured comment from triggering indexing or 7/14/28 day measurement.

## Result Collection

The MVP does not schedule automatic polling. The intended operating model after owner approval:

- `perfex-sync-task-status` runs on approved task IDs every 60 minutes while a task is open.
- For tasks due within 48 hours or already overdue, run every 15 minutes during working hours.
- Stop polling when the task is verified, rejected, or parked as needs-clarification.
- Each sync reads both `get_task` and `get_task_comments`.

Human implementers should report completion in comments using a stable structure:

```text
Paperclip result:
status: implemented | verified | needs_clarification | rejected
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

`implemented` means the human says the work is done. `verified` means Paperclip/owner QA accepted the changed URLs and the change can enter indexing and measurement follow-up.

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
