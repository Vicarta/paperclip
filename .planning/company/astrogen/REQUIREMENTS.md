# Requirements: Astrogen

## Governance

- `AST-GOV-01`: Astrogen-specific planning state must stay under `.planning/company/astrogen/`.
- `AST-GOV-02`: Shared reusable logic belongs in `.planning/agency-core/` or Paperclip source, not in a client-only planning file.
- `AST-GOV-03`: Astrogen must use separate company/project/budget context from DiskInternals.
- `AST-GOV-04`: Astrogen agent workflows must follow agency-core `AGENT_EXECUTION_GOVERNANCE`: explicit parent/child handoff, named blockers, current assignee ownership, plugin access through Paperclip capabilities, and separate SEO/MCP child lanes.

## Content

- `AST-CONTENT-01`: Articles must not leak route names, technical handoff terms, checklist artifacts, or internal process language into reader-facing HTML.
- `AST-CONTENT-02`: Ukrainian articles must use natural Ukrainian wording and avoid machine-translation calques.
- `AST-CONTENT-03`: Financial product articles should increase product confidence and purchase desire without making unsupported guarantees.
- `AST-CONTENT-04`: Articles should use product synonyms and variants, not repeat one exact term mechanically.
- `AST-CONTENT-05`: Articles should include contextual internal links to relevant product pages, not only a final CTA.
- `AST-CONTENT-06`: If birth place is required, use the modern settlement name, not only the historical name at time of birth.

## Images

- `AST-IMG-01`: Blog images should use psychologically recognizable lifestyle-cinematic realism with brand discipline.
- `AST-IMG-02`: People shown should generally match the target audience age range 28-45 unless the topic requires otherwise.
- `AST-IMG-03`: Images should carry hope, clarity, support, calm confidence, or positive movement toward a better state.
- `AST-IMG-04`: Avoid dead, sculptural, repetitive, over-template-looking images; vary clothing, scenes, emotional tone, and composition.
- `AST-IMG-05`: Telegram delivery should send images without compression when the workflow supports it.

## SEO

- `AST-SEO-01`: Semantic core collection for Astrogen content must be aligned to the article language and not mix languages unless intentionally parked/reviewed.
- `AST-SEO-02`: Zero/unknown search volume keywords should not be discarded automatically; long-tail relevance can matter.
- `AST-SEO-03`: Content planning should preserve topical authority: start focused, build pillar-cluster depth, then expand.
- `AST-SEO-04`: SEO monitoring should combine GSC, rank position, SERP competitor analysis, and content refresh decisions.

## Growth Strategy

- `AST-GROWTH-01`: New or changed products/routes that may affect acquisition, conversion, lead capture, monetization, offer architecture, or positioning require Stage 15 Strategic Opportunity Brief after accepted Product Discovery.
- `AST-GROWTH-02`: Free tools, free entry routes, quizzes, tests, calculators, and horoscope-like acquisition routes must explicitly evaluate lead-magnet, entry-product, upsell-bridge, segmentation, trust-building, and lifecycle-capture potential.
- `AST-GROWTH-03`: Stage 15 outputs are strategy recommendations only; downstream execution requires explicit human approval.
- `AST-GROWTH-04`: Strategic briefs must separate observed product facts, strategic inference, hypotheses, risks, and human decision requests.
- `AST-GROWTH-05`: Stage 15 artifacts, issue comments, plan documents, decision packets, and handoff summaries must use the resolved human-facing output language by default; for Astrogen Ukraine this is Ukrainian unless explicitly overridden.

## Integrations

- `AST-INT-01`: MCP/GSC/Semantic Core tokens must remain server-side secrets.
- `AST-INT-02`: Paperclip plugins may be shared, but Astrogen enablement must be verified in Astrogen company context.
- `AST-INT-03`: CMS adapter work remains paused until the CMS is selected.

## Human Communication

- `AST-HIA-01`: Human-facing Telegram messages must be Ukrainian, simple, concise, and explain the useful outcome rather than internal technical details.
- `AST-HIA-02`: Human approval flows should use Paperclip task cards when Telegram interactive reply is unreliable.
