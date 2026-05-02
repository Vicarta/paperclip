---
phase: 11
plan: 11-03
title: "Perfex Status Sync, Indexing Trigger, And Follow-Up Telemetry"
status: complete
requirements: ["PERFEX-05"]
deliverables:
  - ".planning/company/diskinternals/deliverables/PERFEX_CRM_HANDOFF_PLUGIN.md"
  - ".planning/company/diskinternals/deliverables/BIGQUERY_GROWTH_OPERATING_ALGORITHM.md"
---

# 11-03: Perfex Status Sync, Indexing Trigger, And Follow-Up Telemetry

## Goal

Close the loop after human implementation by syncing Perfex task state into Paperclip/BigQuery and triggering the appropriate indexing and measurement follow-up.

## Tasks

<task id="1" type="data-contract">
<action>Add or extend BigQuery/Paperclip status fields for Perfex task ID, task URL, task status, implementation date, verification status, and follow-up windows.</action>
<done>Plugin entity storage is implemented for task/status sync and records normalized follow-up decisions. BigQuery marts remain gated until real Perfex writes and final implementer mapping are approved.</done>
</task>

<task id="2" type="implementation">
<action>Implement `perfex-get-task-status` and `perfex-sync-task-status` using allowlisted MCP calls.</action>
<done>Status sync reads `get_task` and `get_task_comments` and stores plugin entities without arbitrary MCP access.</done>
</task>

<task id="3" type="workflow">
<action>Define when implemented tasks enter indexing candidate and 7/14/28 day follow-up queues.</action>
<done>Only `verified` tasks with changed URLs enter indexing/follow-up eligibility. `implemented`, `needs_clarification`, `rejected`, Perfex-only done, and unknown status paths are parked.</done>
</task>

## Verification

- Unit tests exercise verified success, implemented-pending-verification, rejection, needs-clarification, and unknown-status paths.
- Unknown status never marks implementation complete automatically.
- Follow-up reports can join Perfex task IDs to affected URLs and source Paperclip opportunities after BigQuery follow-up fields are added and real Perfex task writes are approved.
