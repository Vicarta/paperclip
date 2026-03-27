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
- Plugin type: worker + settings UI first-party development plugin
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
- Operators enter the Exa API key only through the plugin settings page
- The settings page seals the key into Company Secrets and persists only the secret ref
- Once saved, the current key is never shown again; operators can only replace/rotate it

### Technical approach

- Use the official MCP TypeScript client SDK against the remote Streamable HTTP endpoint.
- Keep a tiny helper around MCP connection and tool invocation so tests can stub it.
- Restrict the remote endpoint to only the tools we need.
- Use a custom plugin settings page instead of the generic auto-form so the API key can be replace-only in the UI.

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

1. Build the Exa plugin package, settings page, and tests.
2. Build the generic issue-summary fallback service.
3. Wire the fallback into heartbeat finalization.
4. Run targeted test suites.
5. Summarize local install and live deployment steps.

## Live rollout status

Completed on the live Paperclip instance:

- rebuilt the authenticated private Paperclip app from the patched source checkout;
- installed `paperclip.exa-agent-tools` from the local package path;
- stored the Exa API key in Company Secrets and saved only `exaApiKeySecretRef` in plugin config;
- confirmed the plugin manifest exposes a custom `settingsPage` slot and `format: "secret-ref"` for the key field;
- confirmed the live plugin loader activated the worker and registered 3 tools:
  - `paperclip.exa-agent-tools:web-search`
  - `paperclip.exa-agent-tools:crawl-url`
  - `paperclip.exa-agent-tools:code-context`
- merged the broader issue-summary fallback into the live `heartbeat.ts` on top of the already-diverged `issue-auto-reply` runtime branch.

Verified properties:

- plugin config does not store the plaintext Exa API key;
- the Company Secrets list returns metadata only for the Exa key secret;
- the running app logs show successful activation of the Exa plugin and agent-tool registration;
- standard `tasks:assign` permissions remain unchanged.

Operational caveat:

- the live source checkout remains intentionally dirty because it already carried unrelated local changes before rollout;
- the deployment was applied without resetting or stashing those unrelated edits;
- `server/src/services/heartbeat.ts.bak-20260327` is kept on the host as a rollback copy of the pre-merge heartbeat implementation.
