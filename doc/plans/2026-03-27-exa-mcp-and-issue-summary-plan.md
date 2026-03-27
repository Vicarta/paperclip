# EXA MCP Plugin And Issue Summary Fallback

## Goal

Add two instance-level capabilities without weakening existing task governance:

1. an installable Paperclip plugin that exposes Exa-powered agent tools for web search, crawling, and code-context lookup;
2. a heartbeat-level fallback that posts a compact issue summary comment when an agent run worked on an issue but exited without leaving a meaningful result comment.

## Constraints

- Do not store the Exa API key in git-tracked files.
- Keep standard `tasks:assign` restrictions unchanged.
- Do not depend on task wording to force comment discipline.
- Keep the implementation isolated from the dirty `local-paperclip` worktree.

## Deliverable 1: Exa Plugin

### Product shape

- Package path: `packages/plugins/examples/plugin-exa-agent-tools`
- Plugin type: worker-only first-party development plugin
- Installation model:
  - local-path install in development;
  - later npm/private registry package if promoted from example status

### Tool surface

Register three agent tools:

- `web-search`
- `crawl-url`
- `code-context`

Each tool will proxy to the official hosted Exa MCP endpoint:

- `https://mcp.exa.ai/mcp`

### Auth model

- Plugin config stores a `exaApiKeySecretRef`
- Worker resolves it with `ctx.secrets.resolve(...)`
- The resolved key is used only at request time
- No secret value is written to logs, config snapshots, or committed files

### Technical approach

- Use the official MCP TypeScript client SDK against the remote Streamable HTTP endpoint.
- Keep a tiny helper around MCP connection and tool invocation so tests can stub it.
- Restrict the remote endpoint to only the tools we need.

### Verification

- plugin unit tests via `createTestHarness`
- plugin typecheck
- plugin build

## Deliverable 2: Issue Summary Fallback

### Problem statement

Today the Paperclip skill tells agents to comment before exit, but that rule is only effective when the agent runtime actually loads and follows the skill. We need a host-side backstop.

### Target behavior

When a heartbeat run has issue context and finishes without a meaningful agent-authored issue comment, the host posts a compact fallback summary comment derived from:

- `adapterResult.summary`, or
- summarized `resultJson`, or
- a compact failure/timed-out explanation

### Guardrails

- Skip cancelled runs.
- Skip if the run already produced a meaningful agent comment on that issue.
- Ignore purely technical/system comments when checking whether the agent already commented.
- Do not create duplicate fallback comments for the same run.
- Keep comment text compact and human-readable.

### Scope choice

Apply to issue-context runs generally, not only comment-triggered runs. Comment-thread auto-reply remains a special case, but the new fallback should cover normal assignment / issue work too.

### Verification

- service-level unit tests for summary extraction / comment eligibility
- heartbeat integration tests for:
  - posts fallback when no manual comment exists
  - does not duplicate when a meaningful comment already exists
  - handles success / failure / timeout

## Execution order

1. Build the Exa plugin package and tests.
2. Build the generic issue-summary fallback service.
3. Wire the fallback into heartbeat finalization.
4. Run targeted test suites.
5. Summarize local install and live deployment steps.
