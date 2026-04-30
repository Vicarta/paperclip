# DiskInternals Paperclip Guardrails

## Hard Context

- Paperclip URL: `https://ubuntu-oc.tailbd4e1c.ts.net:4447`
- Company: DiskInternals
- Company ID: `969d66ff-d77e-4dbf-8759-1a17c2bb17c2`
- Issue prefix: `DIS`
- Astrogen company ID to refuse: `c33f6b81-5ced-4270-9288-b46a32f6337a`

## Mandatory Preflight For Every Paperclip API Action

1. Explicitly set `companyId = 969d66ff-d77e-4dbf-8759-1a17c2bb17c2`.
2. Refuse if the target company ID equals `c33f6b81-5ced-4270-9288-b46a32f6337a`.
3. Fetch the company and verify:
   - `name = DiskInternals`
   - `issuePrefix = DIS`
4. Use company-prefixed links in comments:
   - Issues: `/DIS/issues/DIS-123`
   - Agents: `/DIS/agents/<agent-url-key>`
   - Projects: `/DIS/projects/<project-url-key-or-id>`
   - Approvals: `/DIS/approvals/<approval-id>`
5. Do not rely on local `~/.paperclip/context.json`, because it points to Astrogen by default.

## Operating Guardrails

- `CMO` is acting Growth PM. Do not create a separate Growth PM.
- Blog work belongs to SEO agents.
- Social content planning belongs to a future SOC lane.
- Specialists stay wake-on-demand unless a manager routine is explicitly approved.
- Agents may prepare patches and PRs.
- Agents may not publish production changes, tracking changes, popup experiments, or indexing batches without approval.
- GA4/GSC MCP is the current operational data source.
- BigQuery export works, but agent access is deferred until data and access are ready.
- Product attribution gaps must be fixed or proxied before scaling content.

## Human Decision Closure Guardrail

- A human-decision flow is not complete when the answer is written only on a child card.
- `OPS Human Interaction Agent` must write the owner answer back to the source issue and execute the requested post-answer unblock action.
- If the answer resolves the only blocker, the source issue must leave `blocked`, return to `todo`, and include an @-mention of the current assignee so a wake is queued.
- Stale `Human Decision Needed` issues with recorded answers are treated as workflow reliability defects, not new owner questions.
- `CTO Stale Human Decision Blocker Audit` is the fallback routine for finding and clearing these stale blockers.

## Child Completion Handoff Guardrail

- Child issue completion alone must not be treated as a parent-manager wakeback.
- Any agent completing a child issue must comment on the parent issue before ending the heartbeat.
- The parent comment must link the completed child issue, name the produced artifact or decision, state the recommended next manager action, and @-mention the current parent assignee.
- The child agent must not close or reassign the parent unless the parent explicitly granted that authority.
- This rule exists to prevent completed specialist work from leaving the manager-owned parent issue idle.

## Paperclip Plugin Discovery Guardrail

- Agents must discover Paperclip plugin tools through the live Paperclip agent endpoint `GET /api/agents/me/plugin-tools`.
- Agents must execute Paperclip plugin tools through `POST /api/agents/me/plugin-tools/execute`.
- Codex desktop/session tools, local MCP resource discovery, GitHub plugin listings, and Figma plugin listings are not evidence for Paperclip company plugin availability.
- For semantic-core work, expected Paperclip tools include:
  - `paperclip.semantic-core-mcp-agent-tools:list-tools`
  - `paperclip.semantic-core-mcp-agent-tools:register-project`
  - `paperclip.semantic-core-mcp-agent-tools:run-layer`
  - `paperclip.semantic-core-mcp-agent-tools:run-layer-and-wait`
  - `paperclip.semantic-core-mcp-agent-tools:prepare-paperclip-import`
  - `paperclip.semantic-core-mcp-agent-tools:smoke-test`
- A semantic-core task may be blocked for plugin unavailability only after `/api/agents/me/plugin-tools` does not list the required tool or `/api/agents/me/plugin-tools/execute` returns a real configuration or execution error.

## Workspace Root Policy

- Local Codex planning lives in this repository under `.planning/company/diskinternals/`.
- Paperclip agent company artifacts live under the server-side canonical root `/companies/diskinternals`.
- `Growth OS Launch` primary project workspace is `/companies/diskinternals`.
- `/clients/diskinternals` is legacy read-only compatibility for old artifact links, not a root for new work.
- `/company/diskinternals` is not approved and must not be used.
- `/paperclip/instances/default/workspaces` is internal Paperclip execution workspace storage, not the DiskInternals company knowledge base.

## Current Paperclip Entities Created

- Project: `Growth OS Launch`
- Root issue: `DIS-14`
- Phase issues: `DIS-15` through `DIS-22`
- Active manager routines:
  - `CMO Growth Backlog Review`
  - `CTO Data QA And Attribution Review`
  - `CTO Stale Human Decision Blocker Audit`
  - `CEO Growth Impact Review`

## Pending Governance Items

The following specialist agents were submitted as hire requests and require board approval before they can run:

- `DATA Growth Analytics Agent`
- `CRO Funnel Experiment Agent`
- `SEO Internal Linking Indexation Agent`
- `MKT Localization Opportunity Agent`
- `QA Recovery Compliance Agent`
