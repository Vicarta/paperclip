---
phase: 11
plan: 11-01
title: "Perfex CRM MCP Plugin Adapter MVP"
status: planned
requirements: ["PERFEX-01", "PERFEX-02", "PERFEX-03"]
deliverables:
  - ".planning/company/diskinternals/deliverables/PERFEX_CRM_HANDOFF_PLUGIN.md"
---

# 11-01: Perfex CRM MCP Plugin Adapter MVP

## Goal

Create a Paperclip plugin adapter that connects server-side to the Perfex CRM MCP endpoint and exposes only stable, allowlisted task-handoff tools to DiskInternals agents.

## Tasks

<task id="1" type="implementation">
<action>Scaffold `paperclip.perfex-crm-agent-tools` or equivalent bundled plugin using the current Paperclip plugin SDK conventions.</action>
<done>Plugin can be built, tested, configured, and loaded by Paperclip without exposing secrets.</done>
</task>

<task id="2" type="implementation">
<action>Add Streamable HTTP MCP client configuration for `https://pxmc.aibizmate.com/mcp` and bearer-token secret resolution.</action>
<done>Token is read only from Paperclip encrypted secret config and sent as `Authorization: Bearer <MCP_TOKEN>`.</done>
</task>

<task id="3" type="implementation">
<action>Implement healthcheck/tool-discovery smoke path using the same bearer token and no Bridge Shared Secret.</action>
<done>Healthcheck and list-tools style smoke tests pass without leaking credentials.</done>
</task>

## Verification

- Unit tests cover secret resolution, header construction, and no-token logging.
- Plugin build and server typecheck pass.
- Live Paperclip plugin registry shows the adapter tools only for configured companies.
