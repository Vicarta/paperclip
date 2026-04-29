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

## Current Paperclip Entities Created

- Project: `Growth OS Launch`
- Root issue: `DIS-14`
- Phase issues: `DIS-15` through `DIS-22`
- Active manager routines:
  - `CMO Growth Backlog Review`
  - `CTO Data QA And Attribution Review`
  - `CEO Growth Impact Review`

## Pending Governance Items

The following specialist agents were submitted as hire requests and require board approval before they can run:

- `DATA Growth Analytics Agent`
- `CRO Funnel Experiment Agent`
- `SEO Internal Linking Indexation Agent`
- `MKT Localization Opportunity Agent`
- `QA Recovery Compliance Agent`
