---
phase: 11
plan: 11-02
title: "Human Implementation Task Payload And QA Contract"
status: planned
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
<done>Every task has affected URLs, exact requested changes, source evidence, QA checklist, acceptance criteria, and related `DIS` issue.</done>
</task>

<task id="2" type="implementation">
<action>Implement `perfex-create-implementation-task` and optional comment/update tools against the MCP capabilities discovered in 11-01.</action>
<done>Agents can create a task from a Paperclip opportunity without raw MCP access.</done>
</task>

<task id="3" type="agent-contract">
<action>Update live DiskInternals CMO/Growth Opportunity/Specialist routing contracts so implementation means Perfex task payload, not website PR, unless future source access is explicitly granted.</action>
<done>Agents stop treating website repository access as a prerequisite for production handoff.</done>
</task>

## Verification

- Fixture payloads validate for SEO refresh, CRO experiment, internal linking, localization, tracking, and indexing.
- Human-readable task body is understandable without agent jargon.
- A live or mock task creation returns a Perfex task identifier and Paperclip issue link.
