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
Last activity: 2026-05-01 - Added agency-core Agent Execution Governance and adopted it for Astrogen planning.

## Current Focus

- Keep Astrogen planning, SEO/content work, image generation work, and Paperclip entity notes inside `.planning/company/astrogen/`.
- Keep reusable agent templates, shared plugins, and cross-client architecture inside `.planning/agency-core/`.
- Use shared Paperclip plugins where applicable, but configure Astrogen with its own company scope, secrets, budgets, project IDs, and data access.

## Known Active Workstreams

- SEO content generation contracts for Ukrainian articles.
- Blog image generation requirements and one-article correction/test workflow.
- Semantic core planning for Ukrainian-language Astrogen content.
- Google Search Console MCP integration for Astrogen site data.
- SEO monitoring and article performance loop planning.
- Paperclip Telegram/HIA communication quality for human-facing Ukrainian updates.
- Stage 15 strategic opportunity review for new/changed products and routes before downstream execution.

## Guardrails

- Do not write Astrogen-specific state into DiskInternals planning files.
- Do not reuse DiskInternals live agents, project IDs, budgets, or client config for Astrogen work.
- Do not store MCP/GSC tokens in source, prompts, docs, or planning files.
- Human-facing messages for Astrogen should be Ukrainian, simple, and understandable for a non-technical human.
- New/free routes that may affect acquisition, conversion, lead capture, monetization, offer architecture, or positioning should not jump directly from Product Discovery into execution; run Stage 15 Strategic Opportunity Brief and require human approval first.
- Agent tasks must follow agency-core `AGENT_EXECUTION_GOVERNANCE`: no silent hanging `in_progress` work, explicit blockers, clear parent/child handoffs, and plugin use only through Paperclip capabilities.
- Manager-created execution child issues must be `todo`, not `backlog`, unless intentionally parked. Managers must verify assignee availability and wakeup/active-run evidence after delegation. Recovery checks must re-read child status/comments first and must not move `done` or `cancelled` children back to `todo` unless explicit rework is requested.
- SEO monitoring and growth should follow agency-core `SEO_PERFORMANCE_LOOP`: pages can be discovered outside Paperclip, GSC queries feed keyword candidates and new-page opportunities, and rank tracking follows company/project tier policies.

## Pending Todos

- Rebuild a compact Astrogen roadmap from the existing conversation history and Paperclip issues.
- Verify which shared plugins are installed/enabled for Astrogen company specifically.
- Decide whether Semantic Core MCP should be enabled for Astrogen immediately or after the next semantic-core workflow pass.
- Keep future commits scoped and documented.
- Add direct references to agency-core execution governance in live CEO/CMO/CTO/HIA/Observability contracts during the next live contract maintenance pass.
- Convert `SEO_PERFORMANCE_LOOP` into concrete Astrogen Phase 5 implementation tasks when SEO monitoring work resumes.

## Blockers/Concerns

- Local `.planning/company/astrogen/` previously had only README, so historical Astrogen state must be reconstructed incrementally from conversation history and Paperclip issues.
- Some shared plugins have been live-tested in DiskInternals context first; Astrogen enablement should be verified separately before agents rely on them.

## Session Continuity

Last session: 2026-04-29
Stopped at: Astrogen context restored locally; ready for Astrogen-specific planning/execution.
Resume file: None
