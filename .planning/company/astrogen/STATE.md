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
Last activity: 2026-05-18 - Phase 20 live recovery pass applied: `SEO Blog Article Writer GPT` was added as fallback, specialist routine heartbeats were disabled, CMO/Validator/Writer contracts now include repeated-blocker recovery rules, `AST-774` completed through fallback with a verified canonical artifact, and `AST-772`/`AST-773` were reopened to fallback because their previous done state lacked canonical files.

## Current Focus

- Keep Astrogen planning, SEO/content work, image generation work, and Paperclip entity notes inside `.planning/company/astrogen/`.
- Keep reusable agent templates, shared plugins, and cross-client architecture inside `.planning/agency-core/`.
- Use shared Paperclip plugins where applicable, but configure Astrogen with its own company scope, secrets, budgets, project IDs, and data access.
- Current semantic-core/content focus: after Layer 3 validation, do not turn every accepted keyword into a page. Convert the semantic core into article opportunities, validate SERP-based clusters for the shortlist, then publish small continuous waves that feed performance data back into the backlog.
- Current article-production focus: owner approved the three Wave 1 articles on [AST-705](/AST/issues/AST-705). [AST-755](/AST/issues/AST-755) completed the article briefs. First-pass Stage 59 drafts were produced on [AST-757](/AST/issues/AST-757), [AST-758](/AST/issues/AST-758), and [AST-759](/AST/issues/AST-759). Stage 61 validation returned all three drafts for focused revision. Stage 59 revisions [AST-763](/AST/issues/AST-763), [AST-764](/AST/issues/AST-764), and [AST-765](/AST/issues/AST-765) were produced, but Stage 61 revalidation [AST-766](/AST/issues/AST-766), [AST-767](/AST/issues/AST-767), and [AST-768](/AST/issues/AST-768) returned them again. A stale HIA gate [AST-769](/AST/issues/AST-769) was cancelled. Recovery issue [AST-771](/AST/issues/AST-771) opened corrective Stage 59 reruns [AST-772](/AST/issues/AST-772), [AST-773](/AST/issues/AST-773), and [AST-774](/AST/issues/AST-774). [AST-774](/AST/issues/AST-774) now has a verified fallback-writer canonical artifact; [AST-772](/AST/issues/AST-772) and [AST-773](/AST/issues/AST-773) are reopened to fallback because their previous completion did not create canonical files. No owner decision is needed; the current blocker is internal article production and fresh Stage 61 acceptance.
- Phase 20 live first pass is applied to prevent repeated writer/validator loops: `SEO Blog Article Writer GPT` exists as a GPT fallback author, validator output must include structured blocker classes, CMO must route repeated same-class failures to the fallback writer, and routine LLM heartbeats are enabled only for CEO, CMO, and CTO.
- Current page-registry focus: Astrogen blog page registry is now seeded in live Postgres `seo_ops` from `https://astrogen.com.ua/sitemap.xml`. Initial import registered 40 blog-related URLs: 35 blog articles, 4 category pages, and 1 blog index page. The 35 article rows were enriched with title, meta description, category/tag metadata, content text, content hash, and content block counts from the public site data source. Keyword mapping remains pending.

## Known Active Workstreams

- SEO content generation contracts for Ukrainian articles.
- Blog image generation requirements and one-article correction/test workflow.
- Semantic core planning for Ukrainian-language Astrogen content.
- Current Astrogen Semantic Core layer 1 gate: `run_20260506_111721_core_product_intent_454bf24d`; accepted 28, review 13, parked 252, rejected 1, clusters 27, SERP segments 3, SERP competitor candidates 210, recall ledger 210. Phase 23 `prepare_paperclip_import` reported `import_readiness=ready_after_review`, `policy_version=conservative_acceptance_v1`, and no `unsafe_reasons`.
- Current layer 1 review state is now stored in Postgres review batch `921494a2-3bf8-4aa5-9e4b-2685fea6f890` and available in the live GUI at `/AST/seo/semantic-core-review`. Imported normalized item counts: accepted 28, review 13, parked 252. Client-visible portal review completed on 2026-05-08 with 30/30 decisions: accepted 27, rejected 2, deferred 1. Batch state is `client_review_completed` with an accepted seed snapshot of 27 items.
- The workbook remains a historical/fallback artifact only: `outputs/astrogen-semantic-core-review/run_20260506_111721_core_product_intent_454bf24d/astrogen_core_product_intent_run_20260506_111721_core_product_intent_454bf24d_human_review.xlsx`.
- Edited owner workbook processed from `/path/to/local-downloads/astrogen_core_product_intent_run_20260506_111721_core_product_intent_454bf24d_human_review.xlsx`. MCP review artifact: `review_20260506_125938_5845be3c`; reviewed rerun: `run_20260506_130019_core_product_intent_8fa5e715`.
- Reviewed rerun is not importable: `import_readiness=unsafe_for_import`, `unsafe_reasons=["accepted_contains_locale_review_terms"]`. Do not run layer 2 until the locale-warning accepted terms are resolved by a policy fix or revised review decisions.
- Semantic-core review no longer depends on Excel as canonical state. Paperclip now has a deployed Postgres-backed review API and GUI route at `/AST/seo/semantic-core-review` with duplicate keyword grouping, decision audit log, policy guardrails, Astrogen-style decision-focused table/drawer UI, and MCP `conservative_acceptance_v2_locale_edge_case_override` field support.
- The Semantic Core Review GUI now separates `Потрібні рішення`, `Автоматично додане ядро`, and `Усі запити`; explains layer/stage context in Ukrainian; supports mouse-resizable columns and Paperclip dark mode; and lets the owner persist a human assessment that a keyword is tied to an Astrogen service, Astrogen brand, general topic, no match, or uncertain.
- Client portal semantic-core review must now evolve beyond a batch-only queue. The portal should expose a complete living semantic-core inventory where accepted keywords from all previous layers are visible under `Статус = Погоджено`, while the current decision queue contains only genuinely new/unresolved proposals. Already accepted Layer 1 keywords such as `Astrogen` must not reappear as pending Layer 2 decisions; later occurrences should attach as evidence/history to the canonical keyword.
- Astrogen needs manual semantic-core lifecycle controls in the portal: add keyword, soft-remove/exclude keyword, restore keyword, and change status with audit history. Future Google Search Console query suggestions should enter as deduplicated candidates, not as automatic accepted-core items.
- Semantic-core portal lifecycle V1 is live. Paperclip endpoint `/api/portal/companies/astrogen/semantic-core/review` returns 82 current review items and does not include `Astrogen`. Paperclip endpoint `/api/portal/companies/astrogen/semantic-core` returns 618 inventory items with lifecycle counts: accepted 27, candidate 588, deferred 1, rejected 2, removed 0. `status`/`lifecycleMembership=accepted` means active semantic core only; machine triage such as `currentMachineMembership=accepted` is exposed separately as `recommendation.sourceSignal=machine_recommended_accept` with the client label `Рекомендовано до погодження`.
- Astrogen traffic strategy clarification: all funnel stages are in scope. Broad astrology-related search demand, including daily horoscope and zodiac/date-sign queries, is target-audience traffic when it is a real query with demand. Layer 3 must not require product binding; layer 4 requires an astrology editorial bridge for broader audience interests. Live Astrogen CMO, SEO Semantic Core Strategist, SEO Semantic Core Validator, CTO, HIA, and Stage 53/54 process docs now carry this policy.
- Astrogen blog planning should follow Phase 14: semantic core -> article opportunities -> SERP-checked clusters for the shortlist -> human-adjustable priorities -> paced waves -> content plan validation -> article production -> performance loop feedback. The strategic sequence is reach first, then trust, then expertise, then objection handling, then conversion support; waves should mix roles progressively instead of producing only one role for months.
- Keyword/cluster LLM review must be batch-first. Agents should send the largest safe batch of keyword rows or article opportunities per prompt with stable IDs, compact evidence, and structured output; per-keyword LLM calls are allowed only for failed-row retries or exceptional ambiguity.
- Live Phase 14 contracts are now applied on `ubuntu-oc` to CMO, SEO Semantic Core Strategist, SEO Semantic Core Validator, SEO Blog Content Strategist, SEO Blog Content Plan Validator, SEO Blog Article Writer, SEO Blog Article Validator, SEO Performance Analyst, and process docs `56`, `58`, and `66`. Backup and before/after hashes: `/home/paperclip/astrogen/backups/agent-contracts-phase14-20260513T093510Z`.
- The next owner-facing direction is to move review/reporting out of internal Paperclip into a separate client portal. Agency-core Phase 5 now plans this as a reusable portal with Resend email-code auth, hash-only code/session storage, Ukrainian-first localization, sanitized dashboard views, and Astrogen as the first pilot.
- Previous Astrogen Semantic Core layer 1 run: `run_20260506_102105_core_product_intent_5c87d989`; accepted 28, review 11, parked 207, clusters 27, SERP segments 3, SERP competitor candidates 163, recall ledger 163. Treat this as structurally useful but stale for final import because it predates the Volume Contract update.
- Latest Astrogen Semantic Core layer 2 run: `run_20260506_073240_adjacent_use_case_intent_19554b8c`; accepted 53, review 93, parked 488, clusters 50, SERP segments 3, SERP competitor candidates 571, recall ledger 571. This supersedes the unusable 2026-05-05 layer 2 run: high-value adjacent terms such as `гороскоп`, `натальна карта`, and `гороскоп на сьогодні` now land in accepted, mixed-language `astrogen натальна карта` is held for `unsupported_locale` review, and competitor content-parsing terms are review/parked evidence instead of direct accepted keywords.
- Semantic Core MCP competitor SERP recall now supports opt-in competitor page content parsing; production Astrogen semantic-core runs should enable it for maximum recall, while smoke/quick/budget-sensitive runs should leave it disabled.
- Semantic-core generation must not create a `natal_chart` product binding because that product is not canonized yet; natal-card terms should remain brand/core-topic/review/opportunity evidence until Product Discovery or human approval.
- Semantic-core generation is now gated layer-by-layer: after each production layer, call `prepare-paperclip-import`, expose client-reviewable decisions, process decisions, then run internal import-readiness validation before the next layer. Layer 2 client review batch `53c2c939-a23a-4a86-87e3-da6371feecf1` is now `client_review_completed` with progress `82/82`: accepted 76, rejected 6, deferred 0. [AST-705](/AST/issues/AST-705) is `todo`; the next expected action is internal validation/import readiness and then layer 3 candidate generation if validation passes.
- Google Search Console MCP integration for Astrogen site data.
- SEO monitoring and article performance loop planning.
- Paperclip Telegram/HIA communication quality for human-facing Ukrainian updates. Issue-done notifications now go through the Telegram plugin and must avoid raw internal workflow labels; they should explain what changed and whether the owner needs to act now.
- Human Decision Needed cards now require self-contained owner-facing decision briefs. For Astrogen SEO/blog gates, the brief must explain the decision in Ukrainian without internal workflow labels and include proposed article titles, primary/supporting keywords, Ukraine/global demand, business role, next step, required inclusions, forbidden claims, and the exact answer format.
- Stage 15 strategic opportunity review for new/changed products and routes before downstream execution.

## Guardrails

- Do not write Astrogen-specific state into DiskInternals planning files.
- Do not reuse DiskInternals live agents, project IDs, budgets, or client config for Astrogen work.
- Do not store MCP/GSC tokens in source, prompts, docs, or planning files.
- Human-facing messages for Astrogen should be Ukrainian, simple, and understandable for a non-technical human.
- Human Decision Needed comments must be complete enough for the owner to decide from the card itself. Do not ask the owner to infer meaning from stage numbers, agent names, MCP labels, run ids, or issue chains.
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
- Article writer heartbeat cost guardrail: do not enable frequent 5-15 minute LLM heartbeats for expensive writer agents. Current primary writer uses `anthropic/claude-sonnet-4.6`; use wake-on-demand plus article-production transition checks layered onto existing Paperclip runtime recovery. Routine LLM heartbeat is allowed only for CEO, CMO, and CTO unless a human explicitly approves a temporary exception.
- Astrogen monitoring/recovery rule: do not passively check the same stalled Paperclip condition more than three times. If three checks show no progress, stop monitoring and make a system-level recovery change: update contracts, reassign work, create a concrete recovery issue, or fix the configuration causing the stall.
- Paperclip release-check routine exists for Astrogen CTO and is scheduled weekly on Tuesday at 06:00 Europe/Kiev. Manual test created `[AST-725](/AST/issues/AST-725)`, which was blocked because live `/api/health` exposes only `version=0.3.1` and no Git tag/commit provenance. CTO opened `[AST-726](/AST/issues/AST-726)` for deterministic runtime provenance. Phase 15 now plans the full server update to upstream `v2026.513.0` or a newer owner-approved release.
- Phase 15 update attempt proved that `v2026.513.0` cannot be deployed safely over the current live runtime without a plugin compatibility phase. The release omits local/custom plugin package roots, disables plugin secret references, and rejects at least one legacy plugin capability shape. The app runtime has been rolled back; do not retry the release directly until plugin packaging, secret config migration/compatibility, manifest capability migration, and provenance are solved together.
- Phase 16 compatibility gate and production cutover are complete. Deliverables are in `.planning/company/astrogen/phases/16-paperclip-plugin-compatibility-upgrade/`: `PLUGIN_BASELINE.md`, `PLUGIN_COMPATIBILITY_MATRIX.md`, `PLUGIN_PACKAGING_DECISION.md`, `UPDATE_READINESS.md`, and `SUMMARY.md`. Backup and rollback evidence are on the server at `/home/oc/paperclip-backups/phase16-prod-deploy-20260514T192917Z` and `/home/oc/paperclip-backups/phase16-agent-api-url-20260514T195650Z`.
- Phase 17 first production pass completed. Deliverables are in `.planning/company/astrogen/phases/17-plugin-standardization-and-secrets-vault-migration/`: `PLUGIN_INVENTORY.md`, `STANDARDIZATION_DECISIONS.md`, `SECRET_MIGRATION_PLAN.md`, `SMOKE.md`, and `SUMMARY.md`.
- Phase 18 production source-of-truth pass completed. Deliverables are in `.planning/company/astrogen/phases/18-production-config-source-of-truth/`; sanitized production templates/manifests are in `ops/paperclip-production/`.
- Live Astrogen CTO, Observability, CMO, SEO Semantic Core Strategist, and SEO Semantic Core Validator contracts were updated so CTO/Observability do not manually push stalled work as a substitute for Paperclip recovery actions, and CMO/SEO agents use company search before creating duplicate semantic-core/content/remediation issues.
- Production now runs `paperclip-app:v2026.513.0-phase17.1`; old server-side issue completion Telegram sender source/tests were removed; health, plugin loader `12/12`, Telegram jobs, and Astrogen portal semantic-core endpoints were smoke-checked.

## Roadmap Evolution

- Phase 15 executed with rollback: Paperclip Server Release Update.
- Phase 16 executed: Paperclip Plugin Compatibility Upgrade staging gate and production cutover.
- Phase 17 first pass executed: Plugin Standardization And Secrets Vault Migration.
- Phase 18 executed: Production Config Source Of Truth.
- Phase 20 live first pass applied: Article Writer Fallback And Cost-Controlled Recovery.
- CTO weekly release-check routine verified against live `build.releaseTag`; no newer release was found.

## Pending Todos

- Rebuild a compact Astrogen roadmap from the existing conversation history and Paperclip issues.
- Verify which shared plugins are installed/enabled for Astrogen company specifically.
- Decide whether Semantic Core MCP should be enabled for Astrogen immediately or after the next semantic-core workflow pass.
- Keep future commits scoped and documented.
- Add direct references to agency-core execution governance in live CEO/CMO/CTO/HIA/Observability contracts during the next live contract maintenance pass.
- Build SEO Performance Loop ingestion/runners on top of the implemented shared `seo_ops` schema when SEO monitoring work resumes.
- Add a scheduled Astrogen blog sitemap discovery job that detects manually published articles, registers new/changed/removed blog pages in `seo_ops`, enriches content snapshots, links the page to the approved article opportunity when possible, and starts the post-publication GSC/rank monitoring loop.
- Review the Astrogen Semantic Core layer 1 GUI batch from [AST-708](/AST/issues/AST-708) in the deployed web UI; do not run layer 2 until accepted/review decisions are made or accepted-only import is explicitly approved.
- Execute the Client Portal Foundation before making owner review a regular process outside Paperclip.
- Execute agency-core Phase 7 and Astrogen Phase 12 so the client portal becomes the canonical living semantic-core management surface, not only a layer review form.
- Monitor [AST-717](/AST/issues/AST-717) through strategist result and validator handoff. Fresh Layer 3 run `run_20260511_163753_audience_need_intent_6b089606` preliminarily returned `import_readiness=ready_after_review`, `prior_final_keyword_suppressed_count=98`, and `net_new_review_count=3490`; do not expose that full set to the client portal without validation/filtering.

## Blockers/Concerns

- Local `.planning/company/astrogen/` previously had only README, so historical Astrogen state must be reconstructed incrementally from conversation history and Paperclip issues.
- Some shared plugins have been live-tested in DiskInternals context first; Astrogen enablement should be verified separately before agents rely on them.
- The legacy Astrogen workspace is mounted directly as `/astrogen`; future company workspaces should prefer `/home/paperclip/companies/{client_key}` and must pass cross-runtime write verification before agent execution.

## Session Continuity

Last session: 2026-04-29
Stopped at: Astrogen context restored locally; ready for Astrogen-specific planning/execution.
Resume file: None
