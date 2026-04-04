# 2026-04-03 Bright Data Social Plugin Plan

## Goal

Add a dedicated server-side Paperclip plugin for Bright Data MCP so agents can analyze social accounts without storing the Bright Data token in client-visible code or repo-tracked config.

## Non-Goals

- Do not treat Bright Data as a generic web-search replacement.
- Do not collapse Bright Data and Exa into one connector.
- Do not store a raw Bright Data token in plugin config, UI state exports, repo files, or browser-visible payloads.

## Current Constraints

- Paperclip already supports trusted plugin workers with:
  - server-side outbound HTTP;
  - secret-reference resolution through `ctx.secrets.resolve(...)`;
  - agent tool registration;
  - custom plugin settings pages.
- The existing Exa plugin is a useful implementation pattern for:
  - Streamable HTTP MCP transport;
  - secret-backed API auth;
  - installable agent tools.
- Bright Data remains a separate social-data provider and must stay semantically separate from Exa.

## Plugin Scope

Create a new bundled example plugin:
- package: `@paperclipai/plugin-bright-data-agent-tools`
- plugin id: `paperclip.bright-data-agent-tools`

Capabilities:
- `http.outbound`
- `secrets.read-ref`
- `agent.tools.register`
- `instance.settings.register`

Instance config:
- `brightDataTokenSecretRef`
- `brightDataMcpUrl`
- `brightDataGroups`

Default MCP URL:
- `https://mcp.brightdata.com/mcp`

Default groups:
- `social`
- `advanced_scraping`
- `app_stores`

## Tool Surface

Expose a narrow agent-facing tool surface:

1. `list-tools`
- list the remote Bright Data MCP tools actually available through the configured endpoint/groups
- return name, description, and input schema summary

2. `call-tool`
- call one allowed remote Bright Data MCP tool by name
- parameters:
  - `remoteToolName`
  - `arguments`

This keeps the plugin usable even if Bright Data changes or expands its remote tool names.

## Security Rules

- The settings UI may accept a token value from a trusted operator, but must immediately store it as a Paperclip secret and only persist the resulting secret UUID in plugin config.
- The worker resolves the token only at execution time.
- The worker builds the tokenized MCP URL server-side only.
- No resolved secret value may be logged or returned in tool output.

## Validation Plan

Repo checks:
- typecheck
- test
- build

Behavior checks:
- config stores only secret ref, MCP URL, and groups
- `list-tools` uses resolved secret server-side
- `call-tool` forwards allowed tool calls and normalizes output
- bundled examples list includes the new plugin

## Follow-On Live Test

After repo validation:
- install the plugin in the live Paperclip instance
- configure the Bright Data token through company secrets
- verify an authenticated agent can call `list-tools`
- verify at least one social/account-oriented Bright Data tool call succeeds
- then wire the Astrogen Instagram agents to prefer this plugin-backed tool path
