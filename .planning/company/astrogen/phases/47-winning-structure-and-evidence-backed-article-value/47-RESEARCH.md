# Phase 47 Research

## Service Boundary

Winning Structure MCP owns SERP/competitor collection, ownership analysis,
reader-value validation, structure synthesis, quality requirements, temporary
artifacts, cache and provider cost. Paperclip owns authority, durable state,
evidence truth, writer work, review, CMS delivery and publication gates.

The production MCP is available only on the server Tailscale address
`http://100.98.5.50:8000/mcp` and requires bearer authentication. The token must
be copied server-side into a company-scoped Paperclip secret without printing it.

## Current Gaps

- The Paperclip adapter is version 0.1.0 and exposes four tools; it lacks
  `submit_run_decisions`.
- Tool schemas are loose objects and startup does not verify the remote contract.
- The adapter has no provider-reported cost write path.
- The clean Astrogen plugin is parked and has no company secret/config.
- The article pipeline still uses `serp_check` and has no durable MCP run fields,
  paused-decision stage, retention import gate, or post-humanizer MC audit.

## Value-System Design

Use eight article types:

1. `zodiac_profile`
2. `product_education`
3. `expert_method_selection`
4. `life_situation_decision`
5. `concept_explainer`
6. `relationship_compatibility`
7. `forecast_cycle`
8. `historical_cultural_explainer`

Each type has allowed value generators, evidence requirements, forbidden claims,
and anti-repetition checks. Candidate units are hypotheses until Winning
Structure accepts their evidence or commitment. Presentation devices such as a
table, FAQ or checklist do not count as value by themselves.

## Prompt Adoption

- Condense `Asessor-MC-Quality-Audit-full` into a typed final quality contract.
- Reuse only editorial anti-patterns from `AI-detect-v-3-6`; do not retain scores,
  model attribution or recursive rewriting.
- Reuse only answer-first/entity/self-contained-fragment checks from LSI 2.0,
  and only when `geoRetrievabilityRequired=true`.
- Convert Trend Discovery into an evidence-backed periodic hypothesis workflow.
- Convert scaled-content audit into a periodic cluster audit after deterministic
  similarity screening.

## Validation Architecture

- Unit: five tool registrations, argument wrapping, namespace enforcement,
  tools/list contract check, cost extraction, compact result normalization.
- Contract: validate/start/status/decision/result fixtures, stale decision,
  paused run, idempotent retry, expired artifacts and missing tool.
- Manifest: pipeline graph, required fields, stage owners, failure-isolation and
  no-publish invariants.
- Live smoke: private endpoint auth, tools/list, validation-only payload, no paid
  start before explicit canary.
- Canary: one new article and one existing refresh, CMS draft-only, image reused
  for refresh, imported structure/evidence/MC audit and no duplicated run.
