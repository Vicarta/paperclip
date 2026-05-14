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
- `AST-SEO-05`: Production semantic-core runs should use Semantic Core MCP competitor SERP recall with content parsing enabled when maximum recall matters; smoke, quick, and budget-sensitive runs should leave content parsing disabled.
- `AST-SEO-06`: Competitor parsed content terms are candidates only; acceptance still depends on normal MCP gates, layer membership, review status, and relevance.
- `AST-SEO-07`: Semantic Core review escalation must consider topical fit and domain/result-type confidence, not only search volume. High-volume off-topic terms should be parked or rejected rather than routed to human review.
- `AST-SEO-08`: Do not canonize a new product binding during semantic-core generation. If a product does not exist yet, keep the term as a topic/review/opportunity until Product Discovery or a human decision approves product canonization.
- `AST-SEO-09`: Later semantic-core layers must not be treated as ready for content planning just because a run completed. If accepted keywords are too sparse, mixed-language, or dominated by review/parked conflicts, run a policy/review pass before importing the layer or moving to downstream planning.
- `AST-SEO-10`: Astrogen semantic-core work is traffic-first across all funnel stages. Broad astrology, horoscope, zodiac, natal-chart, synastry, compatibility, and other astrology-related search demand can be valid target-audience traffic even without direct product binding.
- `AST-SEO-11`: Astrogen layer 3 broad astrology traffic must not be filtered out solely because of missing product/entity anchor. Product binding is required for direct product layers, not for configured broad traffic layers.
- `AST-SEO-12`: Astrogen layer 4 can include broader audience interests only when the query is a real search query and has a credible astrology editorial bridge; raw content-plan topics remain non-keywords.
- `AST-SEO-13`: Blog planning must work from article opportunities, not individual keywords. Each opportunity should include a primary query, SERP-checked supporting query cluster, normalized Ukraine/global cluster demand, content role, internal-linking role, and lifecycle status.
- `AST-SEO-14`: Blog content should be released in paced waves rather than creating all possible pages at once. Wave selection must balance reach, trust, expertise, objection handling, conversion support, seasonality, topical authority, cannibalization risk, and human priority.
- `AST-SEO-15`: Human priority controls must be available at the article opportunity or topic-family level: high, normal, low, do not plan, pinned to next wave, or temporarily paused. Humans should steer rules and exceptions, not manually sort thousands of keywords.
- `AST-SEO-16`: LLM evaluation of keyword sets must be batch-first. Agents must evaluate the largest safe batch of keywords/clusters per prompt with stable row IDs and compact evidence, and must not call an LLM once per keyword unless a narrow retry or exception explicitly requires it.

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

- `AST-HIA-01`: Human-facing Telegram messages must be Ukrainian, simple, concise, no-nonsense, and explain the useful outcome rather than internal technical details. Prefer short sentences and reduce verbose update text by at least 30% versus internal Paperclip comments.
- `AST-HIA-02`: Human approval flows should use Paperclip task cards when Telegram interactive reply is unreliable.
- `AST-HIA-03`: Issue lifecycle Telegram notifications must have one canonical delivery path owned by the Telegram plugin. Do not run a parallel server-side issue notification sender for the same lifecycle event.
