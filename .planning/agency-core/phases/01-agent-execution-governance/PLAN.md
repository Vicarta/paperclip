# Phase 01: Agent Execution Governance

## Goal

Create a reusable agency-core governance contract that makes Paperclip agent execution explicit, observable, and safe across client companies.

## Scope

- Define the distinction between `parentId`, blockers/dependencies, assignee ownership, and execution state.
- Define the required non-silent task states for agent work.
- Define the Paperclip plugin/capability access rule.
- Define SEO/MCP child-issue lane separation.
- Record how Astrogen adopts the shared rule without making the rule Astrogen-specific.

## Tasks

1. Add `AGENT_EXECUTION_GOVERNANCE.md` under agency-core governance.
2. Link the new governance contract from agency-core README.
3. Add Astrogen requirement/state/log entries showing adoption of the shared contract.

## Verification

- Governance document exists and covers task hierarchy, blockers, assignee state, plugin usage, SEO/MCP child issues, human blockers, and cost/provenance.
- Agency-core README lists the document as reusable governance.
- Astrogen planning files reference the shared rule without duplicating the full contract.
