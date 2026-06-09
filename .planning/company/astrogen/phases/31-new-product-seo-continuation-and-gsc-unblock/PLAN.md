# Phase 31: New Product SEO Continuation And GSC Unblock

## Why

The `/solar` product workflow produced one CMS draft and then the parent issue
was closed. That is not the intended product SEO lifecycle. A new product should
produce the full owner-approved starter article package, then continue into
traffic-oriented semantic-core/blog expansion unless the owner explicitly
defers it.

Separately, GSC indexing audit issues accumulated as long-lived blocked tasks.
Blocked issues are acceptable only for a specific missing tool, credential, API,
or runtime capability. Once URL Inspection snapshots or compact audit artifacts
exist, the system should either route concrete URL-level fixes or close the
aggregate audit as done/superseded.

## Goals

- Prevent CMO from closing a new-product SEO parent after only one article.
- Make beginner/starter package completion explicit.
- Require a follow-up traffic expansion lane after starter content unless the
  owner explicitly defers it.
- Prevent GSC indexing audits from becoming a pile of stale blocked issues.
- Make URL-level indexing fix routing deduped and executable.

## Changes

1. CMO contract
   - Add a New Product SEO Completion Rule.
   - First article delivery closes only its child issue, not the product parent.
   - Parent closes only after all approved starter articles are CMS drafts, or
     after an explicit owner-approved reduction.
   - After starter completion, CMO opens the next product traffic-expansion lane.

2. Shared CMO contract
   - Mirror the independent channel continuation and new-product SEO completion
     rule in the reusable agency-core CMO contract.

3. SEO GSC Indexing Auditor contract
   - Add a Blocked Exit Rule.
   - Add URL-level follow-up issue routing with
     `originKind=seo_technical_finding` and
     `originId={normalized_url}::{problem_class}`.
   - Aggregate audits close after routing URL-level fixes.
   - Duplicate/stale audit issues are cancelled or superseded, not kept blocked.

4. SEO CMS Technical Fixer contract
   - Accept concrete GSC URL Inspection findings as in-scope technical SEO work.
   - Treat duplicate URL/problem class tasks as superseded instead of leaving
     them blocked.

5. Live sync
   - Sync the updated Astrogen contracts to the Paperclip runtime checkout.
   - Wake/create manager work to continue `/solar` starter package and traffic
     expansion through agents, not manual operator execution.
   - Clean stale `/solar` and GSC blocked issue state only as workflow routing,
     not by doing the domain work manually.

## Completion Addendum

This phase is complete only when contracts make the continuation states
unambiguous.

New-product SEO parent states:

| State | Meaning | Next action |
|---|---|---|
| `starter_package_in_progress` | Owner-approved beginner/how-to/helpful articles are not all CMS drafts yet. | Continue article/image/layout/CMS child lanes. |
| `starter_package_complete` | All approved starter articles are CMS drafts with cover images and owner notification. | Open traffic-expansion lane unless owner explicitly deferred it. |
| `starter_package_reduced_by_owner` | Owner explicitly approved a smaller starter set. | Record what is parked, then open traffic-expansion unless deferred. |
| `traffic_expansion_in_progress` | Semantic-core/blog planning is expanding beyond exact product terms. | Validate Stage 53 artifact, then produce Stage 56 blog plan/waves. |
| `monitoring_enrolled` | Published/draft URLs and planned opportunities are enrolled in the SEO monitoring loop. | Parent can close with a human-readable summary. |
| `system_gap` | Tool/credential/runtime/contract gap prevents the next state. | Block with owner of the gap and recovery path. |

CMO must not close a product parent in any earlier state. One delivered article
is not enough unless the owner explicitly approved a one-article starter package
and explicitly deferred traffic expansion.

GSC aggregate audit exit states:

| State | Meaning | Next action |
|---|---|---|
| `routed_url_findings` | URL-level findings were deduped and child fix issues were created/linked. | Close aggregate audit as done. |
| `all_findings_resolved_or_ignored` | Current findings are resolved, stale, duplicate, or policy-ignored. | Close aggregate audit as done with summary. |
| `provider_or_permission_gap` | MCP/API/plugin/permission prevents acquisition or issue routing. | Block with concrete missing capability. |
| `superseded_by_new_audit` | A fresher audit owns the same scope. | Cancel/supersede the stale issue. |

Aggregate GSC audit issues must not remain blocked after actionable URL-level
findings exist. Paperclip should route URL-level work, close the aggregate, and
let the regular SEO loop monitor the result.

## Acceptance Criteria

- CMO contract states that one CMS draft is not enough to complete a new-product
  SEO parent.
- CMO contract requires all owner-approved starter articles or explicit owner
  reduction before closeout.
- CMO contract requires traffic-expansion follow-up after starter package.
- GSC Indexing Auditor contract requires done/cancelled/system-gap exits instead
  of indefinite duplicate blocked issues.
- GSC URL-level technical findings route to SEO CMS Technical Fixer with stable
  dedupe keys.
- Live Astrogen contract files match the source-controlled contract files.
- A live Paperclip task exists for continuing `/solar` beyond the first article.
- New-product parent issues cannot close before `monitoring_enrolled`,
  `starter_package_reduced_by_owner`, or `system_gap`.
- GSC aggregate audit issues end as `done`, `cancelled`, or a named
  permission/runtime gap; they do not stay blocked merely because child
  technical fixes are pending.
