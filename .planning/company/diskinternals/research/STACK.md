# Research: Operational Stack

**Scope:** DiskInternals Paperclip Growth OS setup.
**Source:** Operator-provided context, Paperclip API read-only state, and DiskInternals launch recommendations.

## Current Stack

| Layer | Current State | Planning Decision |
|-------|---------------|-------------------|
| Paperclip instance | `https://ubuntu-oc.tailbd4e1c.ts.net:4447` | Use only explicit DiskInternals company ID. |
| Company | DiskInternals, `969d66ff-d77e-4dbf-8759-1a17c2bb17c2`, prefix `DIS` | Do not rely on local default context. |
| Default local context | Points to Astrogen | Add guardrail to every Paperclip action. |
| Agent adapters | `codex_local`, model `gpt-5.4` across current agents | Keep unless there is a targeted reason to change. |
| GA4/GSC | Ready through MCP | Use MCP-first normalized report contracts. |
| BigQuery | Export works, access later | Prepare mart specs now; defer agent operation until data/access mature. |
| Website changes | Agents may prepare patches/PRs | Require QA and approval before production publication. |
| Plugins | Exa, Serper, DataForSEO, Bright Data, Telegram, SEO performance loop, file browser | Use provider-cost tools only with explicit scope; avoid large Bright Data jobs without approval. |

## Agent Stack Implication

- `CEO`, `CMO`, and `CTO` remain the only scheduled heartbeat managers.
- Specialist agents stay wake-on-demand unless a routine is approved.
- `CMO` acts as Growth PM and owns weekly backlog decisions.
- `CTO` owns data plumbing, MCP/BigQuery readiness, tracking, and attribution fix streams.
- SEO agents own blog and organic-search work.
- MKT agents own audience, market, offer, funnel, and product discovery work, not blog ownership.
- SOC is not installed yet and should be created later for social content operations.

## Recommendation

Start with Paperclip issue/agent configuration and normalized data contracts, not code changes. Once Phase 5 is reached, agents can prepare patches/PRs for website changes, with QA and approval gates.
