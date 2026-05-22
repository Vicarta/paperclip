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
- `AST-CONTENT-07`: Blog article endings must stay editorial. After the last major explanatory section, use at most one compact in-article CTA block; do not stack repeated CTA cards, and keep the in-article CTA lighter than the global site CTA below the article.

## Images

- `AST-IMG-01`: Blog images should use psychologically recognizable lifestyle-cinematic realism with brand discipline.
- `AST-IMG-02`: People shown should generally match the target audience age range 28-45 unless the topic requires otherwise.
- `AST-IMG-03`: Images should carry hope, clarity, support, calm confidence, or positive movement toward a better state.
- `AST-IMG-04`: Avoid dead, sculptural, repetitive, over-template-looking images; vary clothing, scenes, emotional tone, and composition.
- `AST-IMG-05`: Telegram delivery should send images without compression when the workflow supports it.
- `AST-IMG-06`: A blog article package is not complete until it has the publishable markdown, publishable HTML, and a Stage 65 hero image bundle, unless the owner explicitly waives image generation for that article.
- `AST-IMG-07`: Article package delivery to Telegram must include the article text artifact, HTML artifact, and hero image together, with an audit trail on the related Paperclip issue. Article text must not be regenerated during image-only recovery.
- `AST-IMG-08`: Blog cover/hero images must be specific to the article topic and search intent. Generic consultation/lifestyle imagery is not acceptable for article packages about specific comparisons, cycles, checklists, or decision frameworks. A generic cover blocks editorial delivery until a topic-specific image is generated/uploaded and set as the CMS `coverImage`. Internal non-photo illustrations or diagrams may be recommended when they improve comprehension, but only embedded when the CMS content schema supports them.
- `AST-IMG-09`: Blog cover images must not contain rendered text, words, letters, numbers, labels, UI captions, or text-like decoration. Meaning should come from the image concept, composition, and CMS alt text.
- `AST-IMG-10`: Payload CMS metadata for blog cover/hero images must be deterministic: `alt` equals the exact article title, while `caption`, `credit`, and `sourceUrl` are empty or omitted. This rule applies only to cover/hero images; future inline explanatory images may use descriptive metadata when the CMS schema supports them.

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
- `AST-SEO-17`: Astrogen blog URLs discovered from the public sitemap must be registered in the Postgres `seo_ops` page registry, including canonical URL, page type, sitemap lastmod, live title/H1/meta, content snapshot when available, and monitoring status.
- `AST-SEO-18`: After a human manually publishes a new article on the site, Paperclip must detect it through sitemap/page discovery, register the page, connect it to the approved article opportunity and keyword targets, and then start the post-publication telemetry/rank monitoring loop.

## Growth Strategy

- `AST-GROWTH-01`: New or changed products/routes that may affect acquisition, conversion, lead capture, monetization, offer architecture, or positioning require Stage 15 Strategic Opportunity Brief after accepted Product Discovery.
- `AST-GROWTH-02`: Free tools, free entry routes, quizzes, tests, calculators, and horoscope-like acquisition routes must explicitly evaluate lead-magnet, entry-product, upsell-bridge, segmentation, trust-building, and lifecycle-capture potential.
- `AST-GROWTH-03`: Stage 15 outputs are strategy recommendations only; downstream execution requires explicit human approval.
- `AST-GROWTH-04`: Strategic briefs must separate observed product facts, strategic inference, hypotheses, risks, and human decision requests.
- `AST-GROWTH-05`: Stage 15 artifacts, issue comments, plan documents, decision packets, and handoff summaries must use the resolved human-facing output language by default; for Astrogen Ukraine this is Ukrainian unless explicitly overridden.

## Integrations

- `AST-INT-01`: MCP/GSC/Semantic Core tokens must remain server-side secrets.
- `AST-INT-02`: Paperclip plugins may be shared, but Astrogen enablement must be verified in Astrogen company context.
- `AST-INT-03`: Astrogen CMS integration targets Payload CMS at `https://cms.astrogen.com.ua/api`. Paperclip must use a secret-backed service user API key, create/update drafts by default, upload media through Payload media APIs, and require explicit human approval before direct publish actions.
- `AST-INT-04`: Live Astrogen plugins should use the current Paperclip plugin contract rather than long-lived compatibility bridges, unless a bridge has an explicit owner and expiry condition.
- `AST-INT-05`: Provider, notification, portal, and MCP credentials should be migrated to Paperclip Secrets/provider-vault records where supported, with auditability and without plaintext values in Git, planning docs, issue comments, Telegram, or logs.

## Human Communication

- `AST-HIA-01`: Human-facing Telegram messages must be Ukrainian, simple, concise, no-nonsense, and explain the useful outcome rather than internal technical details. Prefer short sentences and reduce verbose update text by at least 30% versus internal Paperclip comments.
- `AST-HIA-02`: Human approval flows should use Paperclip task cards when Telegram interactive reply is unreliable.
- `AST-HIA-03`: Issue lifecycle Telegram notifications must have one canonical delivery path owned by the Telegram plugin. Do not run a parallel server-side issue notification sender for the same lifecycle event.
- `AST-HIA-04`: CTO and Observability must not manually push, wake, reopen, reassign, unblock, or complete another agent's work as a substitute for Paperclip system recovery actions.
- `AST-HIA-05`: Human Decision Needed cards must include a self-contained Ukrainian decision brief that assumes the owner knows nothing about Paperclip internals. For SEO/content choices, include titles, primary/supporting keywords, Ukraine/global demand, business role, next step, required inclusions, forbidden claims, and a simple answer format.
- `AST-HIA-06`: Telegram article-package messages should be short Ukrainian package summaries. They should not expose internal stage labels in the chat text; detailed artifact paths and workflow diagnostics belong in Paperclip.
- `AST-HIA-07`: Normal article/file package delivery to Telegram must be performed by the Telegram plugin, not by ad hoc operator-side direct Bot API calls. Emergency direct Bot API recovery is allowed only with an issue audit comment and Paperclip Secrets.
- `AST-HIA-08`: Keep the existing `attach_files` contract limit. Large Telegram file packages must use delivery groups, where each group selects up to the existing per-group attachment limit and the plugin sends groups sequentially with idempotency.
- `AST-HIA-09`: Telegram package delivery must be source-controlled and deployable through the normal Paperclip plugin packaging path. Do not rely on live installed `dist` patches as the durable solution because future upstream updates may overwrite them.
