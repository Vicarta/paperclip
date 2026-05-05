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
Last activity: 2026-05-05 - Re-ran Astrogen Semantic Core MCP layer 1 after MCP query-shape fixes; analyzed accepted/review/parked output and recorded that review escalation must consider topical/domain confidence, not volume alone.

## Current Focus

- Keep Astrogen planning, SEO/content work, image generation work, and Paperclip entity notes inside `.planning/company/astrogen/`.
- Keep reusable agent templates, shared plugins, and cross-client architecture inside `.planning/agency-core/`.
- Use shared Paperclip plugins where applicable, but configure Astrogen with its own company scope, secrets, budgets, project IDs, and data access.

## Known Active Workstreams

- SEO content generation contracts for Ukrainian articles.
- Blog image generation requirements and one-article correction/test workflow.
- Semantic core planning for Ukrainian-language Astrogen content.
- Latest Astrogen Semantic Core layer 1 run: `run_20260505_163254_core_product_intent_9b8d4983`; accepted 38, review 51, parked 257, clusters 38, SERP segments 5. Query-shape gates removed email/legal/UI/price/count/numbered-label junk, but review escalation still needs topical/domain confidence to avoid high-volume off-topic review noise.
- Semantic Core MCP competitor SERP recall now supports opt-in competitor page content parsing; production Astrogen semantic-core runs should enable it for maximum recall, while smoke/quick/budget-sensitive runs should leave it disabled.
- Semantic-core generation must not create a `natal_chart` product binding because that product is not canonized yet; natal-card terms should remain brand/core-topic/review/opportunity evidence until Product Discovery or human approval.
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

## Blockers/Concerns

- Local `.planning/company/astrogen/` previously had only README, so historical Astrogen state must be reconstructed incrementally from conversation history and Paperclip issues.
- Some shared plugins have been live-tested in DiskInternals context first; Astrogen enablement should be verified separately before agents rely on them.
- The legacy Astrogen workspace is mounted directly as `/astrogen`; future company workspaces should prefer `/home/paperclip/companies/{client_key}` and must pass cross-runtime write verification before agent execution.

## Session Continuity

Last session: 2026-04-29
Stopped at: Astrogen context restored locally; ready for Astrogen-specific planning/execution.
Resume file: None
