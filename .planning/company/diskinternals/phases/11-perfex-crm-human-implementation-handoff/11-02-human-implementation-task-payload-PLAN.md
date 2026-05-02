---
phase: 11
plan: 11-02
title: "Human Implementation Task Payload And QA Contract"
status: complete
requirements: ["PERFEX-04"]
deliverables:
  - ".planning/company/diskinternals/deliverables/PERFEX_CRM_HANDOFF_PLUGIN.md"
  - ".planning/company/diskinternals/deliverables/PR_QA_INDEXING_WORKFLOW.md"
---

# 11-02: Human Implementation Task Payload And QA Contract

## Goal

Standardize the human-facing task payload so agents can hand off SEO, CRO, localization, tracking, internal-linking, and indexing work to people without source-code access.

## Tasks

<task id="1" type="contract">
<action>Define the Perfex task payload fields, required/optional validation, and action-type-specific templates.</action>
<done>Every task has affected URLs, exact requested changes, source evidence, QA checklist, acceptance criteria, related `DIS` issue, and a canonical Growth OS action type.</done>
</task>

<task id="2" type="implementation">
<action>Implement `perfex-create-implementation-task` and optional comment/update tools against the MCP capabilities discovered in 11-01.</action>
<done>Agents can create a task from a Paperclip opportunity without raw MCP access.</done>
</task>

<task id="3" type="agent-contract">
<action>Update live DiskInternals CMO/Growth Opportunity/Specialist routing contracts so implementation means Perfex task payload, not website PR, unless future source access is explicitly granted.</action>
<done>All 30 live DiskInternals agent contracts include the Perfex CRM handoff rule. Project manager ID is approved as `1`; setup-stage assignment routes all action types to `1`. Live task creation remains disabled pending final implementer assignment approval and explicit activation.</done>
</task>

## Verification

- Fixture payloads validate for SEO refresh, legacy action-type aliases, and write-gate behavior.
- Preview-only smoke returned a human-readable payload with project `1`, project manager `1`, assignee `1`, and `wrote_to_perfex=false`.
- Live task creation remains disabled until final implementer assignment and explicit write activation are approved.
