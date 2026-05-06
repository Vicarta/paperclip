# Project State

## Project Reference

See: `.planning/company/astrogen/README.md`

**Company:** Astrogen
**Company ID:** `c33f6b81-5ced-4270-9288-b46a32f6337a`
**Issue prefix:** `AST`
**Human-facing language:** Ukrainian

## Current Position

Phase: Astrogen growth/content operating system hardening
Status: Active
Last activity: 2026-05-06 - Updated/deployed the Paperclip Semantic Core MCP adapter for Phase 23 import readiness, then re-ran Astrogen layer 1 and produced a human review workbook.

## Current Focus

- Keep Astrogen planning, SEO/content work, image generation work, and Paperclip entity notes inside `.planning/company/astrogen/`.
- Keep reusable agent templates, shared plugins, and cross-client architecture inside `.planning/agency-core/`.
- Use shared Paperclip plugins where applicable, but configure Astrogen with its own company scope, secrets, budgets, project IDs, and data access.

## Known Active Workstreams

- SEO content generation contracts for Ukrainian articles.
- Blog image generation requirements and one-article correction/test workflow.
- Semantic core planning for Ukrainian-language Astrogen content.
- Latest Astrogen Semantic Core layer 1 run: `run_20260506_102105_core_product_intent_5c87d989`; accepted 28, review 11, parked 207, clusters 27, SERP segments 3, SERP competitor candidates 163, recall ledger 163. Phase 23 `prepare_paperclip_import` reports `import_readiness=ready_after_review`, `policy_version=conservative_acceptance_v1`, and no `unsafe_reasons`.
- Layer 1 human review workbook: `outputs/astrogen-semantic-core-review/run_20260506_102105_core_product_intent_5c87d989/astrogen_core_product_intent_run_20260506_102105_core_product_intent_5c87d989_human_review.xlsx`. Do not run the next layer until this workbook is reviewed and decisions are submitted or accepted-only import is explicitly approved.
- Latest Astrogen Semantic Core layer 2 run: `run_20260506_073240_adjacent_use_case_intent_19554b8c`; accepted 53, review 93, parked 488, clusters 50, SERP segments 3, SERP competitor candidates 571, recall ledger 571. This supersedes the unusable 2026-05-05 layer 2 run: high-value adjacent terms such as `гороскоп`, `натальна карта`, and `гороскоп на сьогодні` now land in accepted, mixed-language `astrogen натальна карта` is held for `unsupported_locale` review, and competitor content-parsing terms are review/parked evidence instead of direct accepted keywords.
- Semantic Core MCP competitor SERP recall now supports opt-in competitor page content parsing; production Astrogen semantic-core runs should enable it for maximum recall, while smoke/quick/budget-sensitive runs should leave it disabled.
- Semantic-core generation must not create a `natal_chart` product binding because that product is not canonized yet; natal-card terms should remain brand/core-topic/review/opportunity evidence until Product Discovery or human approval.
- Semantic-core generation is now gated layer-by-layer: after each production layer, call `prepare-paperclip-import`, generate a human review workbook, process decisions, then run the next layer. Current gate is layer 1 review; layer 2 should be rerun under the same Phase 23 workbook workflow after layer 1 approval.
- Google Search Console MCP integration for Astrogen site data.
- SEO monitoring and article performance loop planning.
- Paperclip Telegram/HIA communication quality for human-facing Ukrainian updates.
- Stage 15 strategic opportunity review for new/changed products and routes before downstream execution.

## Guardrails

- Do not write Astrogen-specific state into DiskInternals planning files.
- Do not reuse DiskInternals live agents, project IDs, budgets, or client config for Astrogen work.
- Do not store MCP/GSC tokens in source, prompts, docs, or planning files.
- Human-facing messages for Astrogen should be Ukrainian, simple, and understandable for a non-technical human.
- Human decision requests should stay on the blocked source issue: use the `Human Decision Needed` label and a clear Ukrainian comment. Do not create separate owner-assigned decision issues by default.
- HIA liaison issues, when explicitly requested for internal tracking, must not carry `Human Decision Needed`; that label belongs only on the blocked source issue that needs the owner answer. Because Paperclip auto-labels blocked issues as `Human Decision Needed`, HIA liaison issues should be closed/cancelled after posting the source-issue question instead of remaining `blocked`.
- Backlog must not contain execution-ready work. Old or obsolete backlog issues should be cancelled with a reason; current work should be `todo`, active work should have run evidence, and waiting work should be `blocked` with `Human Decision Needed` when owner input is required.
- Do not leave stale `Human Decision Needed` labels on technical blockers, obsolete watch tasks, or issues where the owner already answered. Remove/close them after writing a clear reason, so the human-decision queue contains only real current owner questions.
- New/free routes that may affect acquisition, conversion, lead capture, monetization, offer architecture, or positioning should not jump directly from Product Discovery into execution; run Stage 15 Strategic Opportunity Brief and require human approval first.
- Agent tasks must follow agency-core `AGENT_EXECUTION_GOVERNANCE`: no silent hanging `in_progress` work, explicit blockers, clear parent/child handoffs, and plugin use only through Paperclip capabilities.
- Manager-created execution child issues must be `todo`, not `backlog`, unless intentionally parked. Managers must verify assignee availability and wakeup/active-run evidence after delegation. Recovery checks must re-read child status/comments first and must not move `done` or `cancelled` children back to `todo` unless explicit rework is requested.
- Manager parent issues should remain `in_progress` while execution children are running; do not use `blocked` to mean "waiting for child", because Paperclip treats `blocked` as a human-decision gate.
- SEO monitoring and growth should follow agency-core `SEO_PERFORMANCE_LOOP`: pages can be discovered outside Paperclip, GSC queries feed keyword candidates and new-page opportunities, and rank tracking follows company/project tier policies.
- Semantic-core agents should follow agency-core `SEMANTIC_CORE_MCP_AGENT_INSTRUCTIONS`: parsed competitor content terms are candidate evidence only, `recall_ledger` should be preserved, and `competitor_expansion_endpoint`/`serp_result_classification_reason` should be visible in review when returned.
- Live Astrogen workspace permissions must follow `ops/paperclip/company-workspace-permissions.md`: `/home/paperclip/astrogen` is shared by Paperclip app/agents (`oc`/uid 1000) and File Browser (`paperclip`/uid 1002), so ACL/default ACL must keep both runtimes writable.
- Paperclip runtime now treats issue-assigned successful runs with no meaningful issue-side effect as `failed/silent_noop`, writes a diagnostic comment, releases the issue lock, and sends a Telegram alert with responsible agent attribution.

## Pending Todos

- Rebuild a compact Astrogen roadmap from the existing conversation history and Paperclip issues.
- Verify which shared plugins are installed/enabled for Astrogen company specifically.
- Decide whether Semantic Core MCP should be enabled for Astrogen immediately or after the next semantic-core workflow pass.
- Keep future commits scoped and documented.
- Add direct references to agency-core execution governance in live CEO/CMO/CTO/HIA/Observability contracts during the next live contract maintenance pass.
- Build SEO Performance Loop ingestion/runners on top of the implemented shared `seo_ops` schema when SEO monitoring work resumes.
- Recover [AST-708](/AST/issues/AST-708): the system now detects the validator no-op, but the Stage 54 validation result still needs to be produced by a corrected contract or a different working agent.
- Review Astrogen Semantic Core layer 1 workbook for `run_20260506_102105_core_product_intent_5c87d989`; do not run layer 2 until accepted/review decisions are made or accepted-only import is explicitly approved.

## Blockers/Concerns

- Local `.planning/company/astrogen/` previously had only README, so historical Astrogen state must be reconstructed incrementally from conversation history and Paperclip issues.
- Some shared plugins have been live-tested in DiskInternals context first; Astrogen enablement should be verified separately before agents rely on them.
- The legacy Astrogen workspace is mounted directly as `/astrogen`; future company workspaces should prefer `/home/paperclip/companies/{client_key}` and must pass cross-runtime write verification before agent execution.

## Session Continuity

Last session: 2026-04-29
Stopped at: Astrogen context restored locally; ready for Astrogen-specific planning/execution.
Resume file: None
