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
- added agent-facing plugin tool routes so authenticated agents can discover and execute plugin tools without caller-supplied run context:
  - `GET /api/agents/me/plugin-tools`
  - `POST /api/agents/me/plugin-tools/execute`
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
- authenticated agent requests can now reach plugin tools through the Paperclip API surface using actor-derived `agentId/companyId/runId`;
- plugin tool lookup and execution now work correctly when the caller filters by the plugin database UUID rather than the manifest key;
- live `web-search` execution succeeded through `POST /api/agents/me/plugin-tools/execute` after the secrets runtime was repaired;
- standard `tasks:assign` permissions remain unchanged.
- issue-summary fallback was verified on a real live run that failed before any agent-authored result comment:
  - smoke run `0ab25ea0-a034-4e5d-95fd-1e7e78fbe9e0`
  - smoke issue `609aba40-b776-4c62-b725-c002359776db`
  - agent adapter failure: `Process adapter missing command`
  - host-posted fallback comment: `I couldn't complete this request. Process adapter missing command`
- temporary smoke artifacts were cleaned after verification:
  - smoke issues `c4c6a2fe-aec2-4104-afdf-e1fd21f926a1` and `609aba40-b776-4c62-b725-c002359776db` are `cancelled`
  - smoke agents `78442d01-4039-4f85-9f80-ce26599cd70a` and `321bdf4a-cd36-465c-898a-fff51a9097c6` are `terminated`
- local-adapter authentication was repaired for live heartbeats by mirroring `BETTER_AUTH_SECRET` into `PAPERCLIP_AGENT_JWT_SECRET` in compose; this restored injected `PAPERCLIP_API_KEY` for `codex_local` assignment wakes
- live EXA smoke on `AST-35` confirmed the agent can now:
  - receive authenticated heartbeat env (`PAPERCLIP_API_KEY` present),
  - reach `GET /api/agents/me` and `GET /api/agents/me/inbox-lite`,
  - execute EXA plugin tools from a normal assignment wake
- the first live `crawl-url` attempts exposed a schema mismatch between the plugin's intuitive `url` parameter and Exa MCP's actual `urls[]` contract; the plugin was updated to accept both forms and normalize to `urls[]` before forwarding to Exa

Secrets runtime root cause and resolution:

- the live compose environment did not pass `PAPERCLIP_HOME` / `PAPERCLIP_INSTANCE_ID`, so the server process could not discover `/paperclip/instances/default/config.json` on its own;
- because of that, the running app did not inherit the correct `secrets.localEncrypted.keyFilePath`, and plugin secret resolution fell back to `/app/data/secrets/master.key`;
- the fallback path was both incorrect for the deployed instance and unwritable for the container user, which first surfaced as `EACCES` and then as undecryptable legacy ciphertext for the already-saved Exa secret;
- the rollout was fixed by passing the instance/secrets env vars explicitly in compose:
  - `PAPERCLIP_HOME=/paperclip`
  - `PAPERCLIP_INSTANCE_ID=default`
  - `PAPERCLIP_CONFIG=/paperclip/instances/default/config.json`
  - `PAPERCLIP_SECRETS_PROVIDER=local_encrypted`
  - `PAPERCLIP_SECRETS_STRICT_MODE=false`
  - `PAPERCLIP_SECRETS_MASTER_KEY_FILE=/paperclip/instances/default/secrets/master.key`
- after the env fix, the existing Exa secret was rotated again under the correct master key, restoring successful `ctx.secrets.resolve(...)` without changing the plugin config shape.

Operational caveat:

- the live source checkout remains intentionally dirty because it already carried unrelated local changes before rollout;
- the deployment was applied without resetting or stashing those unrelated edits;
- `server/src/services/heartbeat.ts.bak-20260327` is kept on the host as a rollback copy of the pre-merge heartbeat implementation.
