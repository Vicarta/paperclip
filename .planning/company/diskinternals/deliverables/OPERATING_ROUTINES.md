# Operating Routines

## Active Routines Created

| Routine | Agent | Schedule | Purpose |
|---------|-------|----------|---------|
| CMO Growth Backlog Review | CMO | Monday 09:00 Europe/Kiev | Convert data and priorities into backlog |
| CTO Data QA And Attribution Review | CTO | Monday 10:00 Europe/Kiev | Check MCP contracts, tracking, attribution, BigQuery readiness |
| CTO Stale Human Decision Blocker Audit | CTO | 09:20, 13:20, 17:20, 21:20 Europe/Kiev | Detect resolved owner decisions that did not unblock source issues |
| CEO Growth Impact Review | CEO | Friday 16:00 Europe/Kiev | Review impact, blockers, approvals, and next priorities |

## Budget Rule

Only `CEO`, `CMO`, and `CTO` have scheduled routines. Specialist agents remain wake-on-demand unless a specific routine is approved.

## CMO Growth Backlog Review

Inputs:
- GA4/GSC MCP reports;
- product and URL scoring;
- previous PRs and changed URLs;
- pending approvals;
- open blockers.

Outputs:
- ranked backlog;
- delegated issues;
- approval requests;
- CEO summary when needed.

## CTO Data QA And Attribution Review

Inputs:
- MCP report health;
- GA4 parameter coverage;
- ecommerce product attribution status;
- BigQuery export maturity;
- tracking PR needs.

Outputs:
- data QA findings;
- attribution fix tasks;
- BigQuery readiness notes;
- blockers for CMO.

## CTO Stale Human Decision Blocker Audit

Inputs:
- blocked DiskInternals issues with `Human Decision Needed`;
- linked owner-decision child cards;
- recent source-issue comments and handoff comments.

Outputs:
- source issues returned to `todo` when a sufficient owner answer already exists;
- assignee mentions so the workflow resumes;
- handoff defects recorded for HIA/manager follow-up;
- unresolved decision requests left blocked with clear links.

## CEO Growth Impact Review

Inputs:
- CMO backlog summary;
- CTO data QA summary;
- PR/release/indexing outcomes;
- downloads/order/purchase movement;
- pending approvals.

Outputs:
- strategic decisions;
- approved/blocked scope;
- manager escalations.
