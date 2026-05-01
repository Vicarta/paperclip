---
phase: 11
plan: 11-03
title: "Perfex Status Sync, Indexing Trigger, And Follow-Up Telemetry"
status: planned
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
<done>Growth opportunity and follow-up marts can distinguish approved, sent, implemented, verified, indexed, and measured items.</done>
</task>

<task id="2" type="implementation">
<action>Implement `perfex-get-task-status` and `perfex-sync-task-status` using allowlisted MCP calls.</action>
<done>Status sync can update Paperclip/BigQuery without arbitrary MCP access.</done>
</task>

<task id="3" type="workflow">
<action>Define when implemented tasks enter indexing candidate and 7/14/28 day follow-up queues.</action>
<done>Only verified meaningful changes enter manual indexing; small or unverified changes are parked.</done>
</task>

## Verification

- Mock status transitions exercise success, rejection, needs-clarification, and unknown-status paths.
- Unknown status never marks implementation complete automatically.
- Follow-up reports can join Perfex task IDs to affected URLs and source Paperclip opportunities.
