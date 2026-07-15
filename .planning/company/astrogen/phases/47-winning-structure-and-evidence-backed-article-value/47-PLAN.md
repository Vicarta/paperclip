---
phase: 47
name: winning-structure-and-evidence-backed-article-value
status: completed
created: 2026-07-14
depends_on: [14, 23, 33, 44, 45, 46]
requirements: [AST-CONTENT-12, AST-CONTENT-13, AST-CONTENT-14, AST-CONTENT-15, AST-SEO-20, AST-SEO-21, AST-SEO-22, AST-SEO-23, AST-SEO-24, AST-INT-06]
subsystem: paperclip-astrogen-clean
tags: [paperclip, astrogen, winning-structure, mcp, content-quality, geo]
---

# Phase 47: Winning Structure And Evidence-Backed Article Value

## Objective

Make evidence-backed ownership and reader value a durable native Paperclip
contract from topic selection through CMS draft delivery, while preserving
bounded execution and independent work when one run pauses.

## Wave 1: Five-Operation MCP Adapter

1. Upgrade `plugin-winning-structure-mcp-agent-tools` to v0.2.0.
2. Add `submit-run-decisions` and verify all five remote tools through `tools/list`.
3. Replace loose wrapper schemas with operation-specific namespace, run lookup,
   decision, and task-payload schemas without attempting to duplicate every
   forward-compatible nested MCP field.
4. Preserve `structuredContent`, return a compact agent summary, classify remote
   error states, and never expose authorization headers.
5. Add provider-reported cost accounting from completed results/status metadata.
6. Cover missing tool, invalid namespace, allowlist, paused run, stale decision,
   transport retry boundary, cost and result normalization in tests.

## Wave 2: Stateful Native Article Pipeline

Replace:

`opportunity -> serp_check -> brief`

with:

`opportunity -> strategy_input -> winning_structure -> structure_decision
 -> winning_structure | structure_review -> brief`

Then extend:

`validate -> humanize -> mc_quality -> layout`

Required case fields include namespace, stable idempotency key, run ID, original
and effective hashes, decision version, status, retention expiry, imported result
document, quality requirements, publication requirements, article type, selected
value units and their evidence/commitment references.

Rules:

- `strategy_input` builds one complete payload from CMS, semantic core, GSC/GA4,
  ownership inventory, CTA routes and first-party value evidence.
- `winning_structure` validates, starts once, polls with bounded backoff, imports
  completed results, and never restarts a paused run.
- `structure_decision` submits one exact pending decision only within explicit
  authority. High-risk decisions create a human review path and park only this case.
- `structure_review` verifies imported structure, evidence and publication requirements.
- Old Serper may collect supporting evidence but cannot mark the gate complete.
- Expired temporary artifacts are recoverable only from an already imported result
  or an explicitly new revision.

## Wave 3: Astrogen Value Generation And Quality Prompts

1. Add the eight-type article classifier and an approved value-generator catalog.
2. Select two to four value units by reader problem, evidence availability and
   sibling differentiation; do not select by desired layout component.
3. Carry accepted Winning Structure section IDs, writer instructions, evidence,
   claim boundaries and examples-to-avoid into the brief without concatenating prose.
4. Add the post-humanizer MC audit with `pass`, `revise_surface`,
   `revise_substantive`, and `reject_unsafe` outcomes.
5. Add one bounded editorial-naturalness pass with no AI score or invented persona.
6. Enable optional GEO/retrievability checks only for explanatory and refresh
   cases marked `geoRetrievabilityRequired`.

## Wave 4: Periodic Discovery And Portfolio Protection

1. Add monthly Trend Discovery to the CMO portfolio path. It produces typed
   hypotheses, not article tasks.
2. Add monthly scaled-content audit after deterministic similarity candidate selection.
3. Route keep/differentiate/consolidate/refresh/park recommendations into native
   growth cases with stable fingerprints.
4. Ensure shared layout components are excluded from substantive similarity evidence.

## Wave 5: Clean Activation And Canary

1. Create a fresh DB/config backup.
2. Store the MCP bearer token as an Astrogen company secret and configure the
   private Tailscale endpoint without printing the value.
3. Build/deploy the plugin and verify all five tools before enabling pipeline stages.
4. Sync agent contracts and native pipeline idempotently.
5. Run one new-article and one refresh canary without publishing; reuse the refresh image.
6. Verify paused-run recovery, independent-case continuity, imported retention data,
   MC quality result, CMS draft proof and no technical Telegram noise.
7. Send the owner a Ukrainian change report by email with backup, verification,
   rollback image/config and remaining risks.

## Acceptance Criteria

- The clean plugin exposes and verifies all five MCP operations.
- One task revision maps to one MCP run and preserves both hashes.
- Paused decisions resume the same run; stale or unauthorized decisions do not mutate it.
- Every accepted article has non-SERP evidence or a fulfilled publication-blocking commitment.
- Value units vary by article type and are checked against sibling repetition.
- Final MC audit runs after humanizer and before layout.
- Trend, GEO and scaled-content prompts operate only in their intended scopes.
- One paused article does not freeze unrelated cases or consume productive WIP.
- Canary outputs are CMS drafts only; no automatic publish or unnecessary image generation occurs.
- Source, clean production contract and verification evidence converge in the same phase.
