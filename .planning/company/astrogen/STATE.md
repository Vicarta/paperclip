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
Last activity: 2026-05-13 - Defined Astrogen Phase 14 for converting a validated semantic core into paced SEO blog content waves with SERP-checked clusters, human-adjustable priorities, batch-first LLM evaluation, validation, and performance feedback.

## Current Focus

- Keep Astrogen planning, SEO/content work, image generation work, and Paperclip entity notes inside `.planning/company/astrogen/`.
- Keep reusable agent templates, shared plugins, and cross-client architecture inside `.planning/agency-core/`.
- Use shared Paperclip plugins where applicable, but configure Astrogen with its own company scope, secrets, budgets, project IDs, and data access.
- Current semantic-core/content focus: after Layer 3 validation, do not turn every accepted keyword into a page. Convert the semantic core into article opportunities, validate SERP-based clusters for the shortlist, then publish small continuous waves that feed performance data back into the backlog.

## Known Active Workstreams

- SEO content generation contracts for Ukrainian articles.
- Blog image generation requirements and one-article correction/test workflow.
- Semantic core planning for Ukrainian-language Astrogen content.
- Current Astrogen Semantic Core layer 1 gate: `run_20260506_111721_core_product_intent_454bf24d`; accepted 28, review 13, parked 252, rejected 1, clusters 27, SERP segments 3, SERP competitor candidates 210, recall ledger 210. Phase 23 `prepare_paperclip_import` reported `import_readiness=ready_after_review`, `policy_version=conservative_acceptance_v1`, and no `unsafe_reasons`.
- Current layer 1 review state is now stored in Postgres review batch `921494a2-3bf8-4aa5-9e4b-2685fea6f890` and available in the live GUI at `/AST/seo/semantic-core-review`. Imported normalized item counts: accepted 28, review 13, parked 252. Client-visible portal review completed on 2026-05-08 with 30/30 decisions: accepted 27, rejected 2, deferred 1. Batch state is `client_review_completed` with an accepted seed snapshot of 27 items.
- The workbook remains a historical/fallback artifact only: `outputs/astrogen-semantic-core-review/run_20260506_111721_core_product_intent_454bf24d/astrogen_core_product_intent_run_20260506_111721_core_product_intent_454bf24d_human_review.xlsx`.
- Edited owner workbook processed from `/Users/savitsky/Downloads/astrogen_core_product_intent_run_20260506_111721_core_product_intent_454bf24d_human_review.xlsx`. MCP review artifact: `review_20260506_125938_5845be3c`; reviewed rerun: `run_20260506_130019_core_product_intent_8fa5e715`.
- Reviewed rerun is not importable: `import_readiness=unsafe_for_import`, `unsafe_reasons=["accepted_contains_locale_review_terms"]`. Do not run layer 2 until the locale-warning accepted terms are resolved by a policy fix or revised review decisions.
- Semantic-core review no longer depends on Excel as canonical state. Paperclip now has a deployed Postgres-backed review API and GUI route at `/AST/seo/semantic-core-review` with duplicate keyword grouping, decision audit log, policy guardrails, Astrogen-style decision-focused table/drawer UI, and MCP `conservative_acceptance_v2_locale_edge_case_override` field support.
- The Semantic Core Review GUI now separates `Потрібні рішення`, `Автоматично додане ядро`, and `Усі запити`; explains layer/stage context in Ukrainian; supports mouse-resizable columns and Paperclip dark mode; and lets the owner persist a human assessment that a keyword is tied to an Astrogen service, Astrogen brand, general topic, no match, or uncertain.
- Client portal semantic-core review must now evolve beyond a batch-only queue. The portal should expose a complete living semantic-core inventory where accepted keywords from all previous layers are visible under `Статус = Погоджено`, while the current decision queue contains only genuinely new/unresolved proposals. Already accepted Layer 1 keywords such as `Astrogen` must not reappear as pending Layer 2 decisions; later occurrences should attach as evidence/history to the canonical keyword.
- Astrogen needs manual semantic-core lifecycle controls in the portal: add keyword, soft-remove/exclude keyword, restore keyword, and change status with audit history. Future Google Search Console query suggestions should enter as deduplicated candidates, not as automatic accepted-core items.
- Semantic-core portal lifecycle V1 is live. Paperclip endpoint `/api/portal/companies/astrogen/semantic-core/review` returns 82 current review items and does not include `Astrogen`. Paperclip endpoint `/api/portal/companies/astrogen/semantic-core` returns 618 inventory items with lifecycle counts: accepted 27, candidate 588, deferred 1, rejected 2, removed 0. `status`/`lifecycleMembership=accepted` means active semantic core only; machine triage such as `currentMachineMembership=accepted` is exposed separately as `recommendation.sourceSignal=machine_recommended_accept` with the client label `Рекомендовано до погодження`.
- Astrogen traffic strategy clarification: all funnel stages are in scope. Broad astrology-related search demand, including daily horoscope and zodiac/date-sign queries, is target-audience traffic when it is a real query with demand. Layer 3 must not require product binding; layer 4 requires an astrology editorial bridge for broader audience interests. Live Astrogen CMO, SEO Semantic Core Strategist, SEO Semantic Core Validator, CTO, HIA, and Stage 53/54 process docs now carry this policy.
- Astrogen blog planning should follow Phase 14: semantic core -> article opportunities -> SERP-checked clusters for the shortlist -> human-adjustable priorities -> paced waves -> content plan validation -> article production -> performance loop feedback. The strategic sequence is reach first, then trust, then expertise, then objection handling, then conversion support; waves should mix roles progressively instead of producing only one role for months.
- Keyword/cluster LLM review must be batch-first. Agents should send the largest safe batch of keyword rows or article opportunities per prompt with stable IDs, compact evidence, and structured output; per-keyword LLM calls are allowed only for failed-row retries or exceptional ambiguity.
- The next owner-facing direction is to move review/reporting out of internal Paperclip into a separate client portal. Agency-core Phase 5 now plans this as a reusable portal with Resend email-code auth, hash-only code/session storage, Ukrainian-first localization, sanitized dashboard views, and Astrogen as the first pilot.
- Previous Astrogen Semantic Core layer 1 run: `run_20260506_102105_core_product_intent_5c87d989`; accepted 28, review 11, parked 207, clusters 27, SERP segments 3, SERP competitor candidates 163, recall ledger 163. Treat this as structurally useful but stale for final import because it predates the Volume Contract update.
- Latest Astrogen Semantic Core layer 2 run: `run_20260506_073240_adjacent_use_case_intent_19554b8c`; accepted 53, review 93, parked 488, clusters 50, SERP segments 3, SERP competitor candidates 571, recall ledger 571. This supersedes the unusable 2026-05-05 layer 2 run: high-value adjacent terms such as `гороскоп`, `натальна карта`, and `гороскоп на сьогодні` now land in accepted, mixed-language `astrogen натальна карта` is held for `unsupported_locale` review, and competitor content-parsing terms are review/parked evidence instead of direct accepted keywords.
- Semantic Core MCP competitor SERP recall now supports opt-in competitor page content parsing; production Astrogen semantic-core runs should enable it for maximum recall, while smoke/quick/budget-sensitive runs should leave it disabled.
- Semantic-core generation must not create a `natal_chart` product binding because that product is not canonized yet; natal-card terms should remain brand/core-topic/review/opportunity evidence until Product Discovery or human approval.
- Semantic-core generation is now gated layer-by-layer: after each production layer, call `prepare-paperclip-import`, expose client-reviewable decisions, process decisions, then run internal import-readiness validation before the next layer. Layer 2 client review batch `53c2c939-a23a-4a86-87e3-da6371feecf1` is now `client_review_completed` with progress `82/82`: accepted 76, rejected 6, deferred 0. [AST-705](/AST/issues/AST-705) is `todo`; the next expected action is internal validation/import readiness and then layer 3 candidate generation if validation passes.
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
- Review the Astrogen Semantic Core layer 1 GUI batch from [AST-708](/AST/issues/AST-708) in the deployed web UI; do not run layer 2 until accepted/review decisions are made or accepted-only import is explicitly approved.
- Execute the Client Portal Foundation before making owner review a regular process outside Paperclip.
- Execute agency-core Phase 7 and Astrogen Phase 12 so the client portal becomes the canonical living semantic-core management surface, not only a layer review form.
- Monitor [AST-717](/AST/issues/AST-717) through strategist result and validator handoff. Fresh Layer 3 run `run_20260511_163753_audience_need_intent_6b089606` preliminarily returned `import_readiness=ready_after_review`, `prior_final_keyword_suppressed_count=98`, and `net_new_review_count=3490`; do not expose that full set to the client portal without validation/filtering.
- Update live `SEO Blog Content Strategist` and `SEO Blog Content Plan Validator` contracts from Phase 14 before creating the first Astrogen blog wave from the validated semantic core.

## Blockers/Concerns

- Local `.planning/company/astrogen/` previously had only README, so historical Astrogen state must be reconstructed incrementally from conversation history and Paperclip issues.
- Some shared plugins have been live-tested in DiskInternals context first; Astrogen enablement should be verified separately before agents rely on them.
- The legacy Astrogen workspace is mounted directly as `/astrogen`; future company workspaces should prefer `/home/paperclip/companies/{client_key}` and must pass cross-runtime write verification before agent execution.

## Session Continuity

Last session: 2026-04-29
Stopped at: Astrogen context restored locally; ready for Astrogen-specific planning/execution.
Resume file: None
