# Reference Profile: Astrogen On Content Production Service

Status: Draft configuration mapping

Product contract: `.planning/agency-core/CONTENT_PRODUCTION_SERVICE_PRD.md`

Purpose: Preserve Astrogen-specific behavior outside the reusable service core

## 1. Boundary

This document is a reference project profile, not runtime configuration and not
part of the Content Production Service product defaults.

Astrogen settings must be created and versioned through the service REST API or
MCP tools. The running service must not read this file directly.

Paperclip uses a separate adapter to:

- bootstrap or update the Astrogen project through public service contracts;
- submit content-plan and job requests;
- project job states, decisions, artifacts, and costs into Paperclip;
- communicate outcomes to the owner outside the service.

## 2. Project Identity

- Tenant: Astrogen company tenant
- Project: Astrogen Ukraine content project
- Primary language: `uk-UA`
- Primary market: Ukraine
- Default timezone: `Europe/Kyiv`
- Primary output: CMS-ready articles
- Default delivery boundary: verified CMS draft
- Automatic publication: disabled

## 3. Content Portfolio

Target planning mix:

| Track | Target topics |
|---|---:|
| Western astrology as a learning system | 12 |
| Applied audience life questions | 5 |
| Audience-first trend topics | 3 |
| Trust, expert choice, and method boundaries | 3 |
| Product/commercial topics with uncovered demand | 2 |

These are content-plan policy values, not service constants.

Additional rules:

- date-specific and "today" horoscope topics are excluded;
- trend topics stay on the audience discussion theme and cannot be narrowed to
  product terms in title, H1, slug, primary query, or topic key;
- product mentions may appear only as natural contextual body links when they
  help the reader;
- duplicate and cannibalization decisions precede reservation;
- one blocked topic or article cannot stop unrelated work.

## 4. Production Capacity

- Daily target: three complete CMS drafts.
- Three-day dispatchable topic buffer target: nine.
- Jobs run independently with productive WIP of three.
- Capacity shortfalls start the appropriate refill lane without weakening
  editorial policy.

The exact schedule is configured in the service scheduler and may be changed
through API/MCP.

## 5. Pipeline Profiles

### 5.1 SEO Acquisition Article

- Operation: `create`
- SEO: enabled
- SERP Winning Structure: `required` or `conditional` according to topic policy
- Evidence: topic inventory, ownership, semantic/search evidence, internal-link
  plan, reader-value evidence
- Writer: Claude
- Review: OpenAI-capable validation and quality stages
- Image: required unless explicitly waived by project policy
- Delivery: Payload `create_draft`

### 5.2 SEO Refresh Or Substantive Rewrite

- Operation: `refresh` or `rewrite`
- SERP Winning Structure: `conditional`
- Run when competitor/SERP evidence is required for the stated change
- Skip for style-only, formatting-only, or narrowly scoped non-substantive work
- Preserve accepted media unless an image defect is explicitly in scope
- Require a before/after change report

### 5.3 Western Astrology Curriculum

- One article teaches exactly one new primary concept.
- Prerequisite order and links are required.
- One necessary supporting term may be allowed only when immediately explained
  in plain language and not taught as a separate concept.
- SERP Winning Structure:
  - `conditional` for search-acquisition pages;
  - `off` when a prerequisite article is required by the approved curriculum
    graph but competitor-led structure would distort the learning sequence.

### 5.4 Audience-First Trend Article

- Title, H1, slug, and primary theme remain audience-first.
- Existing Astrogen products do not own the topic merely because a contextual
  body link is possible.
- SERP Winning Structure:
  - `conditional`;
  - run when the article targets an established search opportunity;
  - skip for explicitly editorial discussion where search acquisition is not
    the goal.

### 5.5 Non-SEO Editorial Article

- SEO optimization: disabled or metadata-only according to job configuration.
- SERP Winning Structure: `off`.
- Core quality, evidence, editorial, formatting, and cost gates still apply.

### 5.6 Repair

- Operation: `repair`.
- SERP Winning Structure: `off`.
- Repair only the typed defect.
- Do not regenerate the article for CMS schema, relation, image-registration,
  or formatting defects.

## 6. Writer And Model Routing

- Primary article writer: Claude CLI/local subscription adapter.
- Claude is not used for planning, management, validation, formatting, image,
  CMS, or notification work.
- OpenAI/Codex may be configured for bounded:
  - strategy judgment;
  - article validation;
  - humanization;
  - main-content quality review.
- No timer LLM heartbeats.
- No OpenRouter/OpenCode fallback for normal article writing.
- Provider authentication failures pause only affected stages and are surfaced
  through service events to Paperclip.

## 7. Editorial Policy

Astrogen policy versions must capture:

- natural Ukrainian;
- gender-neutral owner-facing and editorial wording where applicable;
- non-fatalistic interpretation;
- no diagnostic or scientific-proof claims for interpretive systems;
- evidence-backed additional reader value;
- no process, prompt, route, or technical handoff language in the article;
- contextual internal links;
- quiet, non-repetitive CTA;
- project-approved terminology;
- one-concept curriculum rules;
- title and metadata locks when supplied.

## 8. Formatting Policy

- Portable Markdown, sanitized HTML, and structured content are required.
- Astrogen CMS mapping uses `articleContent.v1` in the Payload connector.
- The first editorial callout is `Коротко` with variant `soft`.
- One quiet CTA appears near the end.
- Exactly three eligible related-content items are required.
- Paragraph text/span consistency, icon registry, block completeness, metadata,
  and links are validated before delivery.

These are project formatting policies. Other projects may choose different
blocks, labels, CTA counts, or related-content rules.

## 9. Image Policy

- Default target: 1472x822.
- Per-axis dimension tolerance: 20 percent.
- A within-tolerance visually valid image is accepted without regeneration.
- Default provider model is project-configurable.
- One normal paid generation is allowed.
- One corrective generation requires a proven hard visual defect and the
  configured bounded decision authority.
- Refresh/repair jobs reuse a valid existing image unless replacement is in
  scope.
- Recent visual history must reduce repetitive scenes.
- Human scenes require specific action, visible emotion, and varied
  composition.
- Abstract imagery remains valid where it explains the topic better.
- Readable text, fabricated UI, and pseudo-writing are prohibited.

## 10. SERP Winning Structure Profile

Astrogen uses the generic modes without changing their meaning:

- `off`: non-SEO editorial work, repairs, and approved curriculum prerequisites
  where search-led structure is not required;
- `required`: search-acquisition articles with target-query and competitor
  evidence requirements;
- `conditional`: SEO refreshes, rewrites, trend articles, and mixed-intent
  content evaluated by deterministic rules;
- `provided_result`: import of a compatible precomputed result; not a synonym
  for rewrite;
- `on_demand`: explicit client-controlled research before structure freeze.

The project stores the exact deterministic `conditional` rules as a versioned
`SerpWinningStructurePolicy`.

## 11. Payload Delivery Profile

- Connector: first-party Payload connector.
- Mode: `create_draft` or `update_draft`.
- Publish: disabled.
- CMS base URL and credentials: secret-backed connector configuration.
- Connector responsibilities:
  - map portable structured content to `articleContent.v1`;
  - resolve author/category/tags;
  - upload accepted media;
  - create or update one draft idempotently;
  - resolve exactly three eligible related posts;
  - read back and verify content, media, metadata, CTA, and relations;
  - return the exact CMS admin edit URL and delivery receipt.

The generic service core stores only opaque external resource and receipt
references.

## 12. Human Communication

Content Production Service sends no Telegram or email.

The Paperclip adapter may:

- send one concise gender-neutral Ukrainian Telegram message after a verified
  draft;
- include only the article title and CMS admin edit URL;
- send plain-language HTML email for sustained incidents or owner decisions;
- keep technical diagnostics inside Paperclip.

## 13. Cost Policy

The project must configure:

- token budgets per LLM capability;
- monetary budgets per provider and stage;
- daily and monthly project ceilings;
- one normal image generation plus one bounded corrective allowance;
- actual/estimated/partial cost handling;
- cached versus uncached token reporting.

Every job and Content Package returns its cost summary.

## 14. Bootstrap And Verification

The Paperclip adapter or an operator bootstrap client must:

1. create or resolve the Astrogen tenant and project;
2. upload project context;
3. create and validate all policy versions;
4. bind secret references;
5. configure provider and Payload profiles;
6. import current content plan and existing-content inventory;
7. activate pipeline templates;
8. run one export-only canary;
9. run one Payload draft canary;
10. run a three-article draft-only canary;
11. verify artifacts, quality, costs, delivery receipts, log redaction, and
    Sentry traces.
