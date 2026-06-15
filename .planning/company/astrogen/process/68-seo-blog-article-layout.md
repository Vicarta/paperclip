# Stage 68: SEO Blog Article Layout

## Purpose

Turn a validated Ukrainian SEO blog article into a Payload CMS `articleContent.v1` layout package before the draft is created or updated in CMS.

This stage is about editorial structure and reading rhythm. It is not a rewrite stage and it is not a publishing stage.

For existing-article audits, backfills, repairs, or clean republish batches,
Stage 68 is primarily a body/layout stage. Cover-image fixes may be discovered
and routed from this stage, but a cover-only update is not an editorial backfill.
Each affected article must have evidence of meaningful body/editorial structure
changes or an explicit no-body-change rationale.

## Pipeline

```text
Writer
-> Article Validator
-> SEO Blog Article Layout Editor
-> SEO Blog Article Layout Validator
-> Payload CMS draft/update
-> Telegram draft URL
```

## Input

- accepted article brief;
- validated article draft;
- SEO lock: title, slug, SEO title, SEO description, keyword intent, required internal links, CTA route, product/service framing;
- company/product reference documents.

If the validated article draft is missing, stop and return `missing_validated_article`.

## Layout Editor Output

The layout editor produces a CMS-ready `articleContent.v1` object:

```json
{
  "schemaVersion": "articleContent.v1",
  "blocks": []
}
```

The layout package must be stored as a reviewable issue document or referenced
from one. The document should include:

- exact article title and slug;
- source validated draft reference;
- `articleContent.v1` package or canonical file reference;
- cover-image concept and QA result;
- product/service link decisions;
- for editorial backfill batches, a per-article body/editorial change summary
  that names the CMS/article id, title, whether `articleContent` changed, which
  blocks/spans/CTA/product-link/final-section changes were added or improved,
  and why each change improves reading, scanning, conversion path, or editorial
  rhythm;
- any layout validator annotations or revision notes.

After the layout validator accepts the package and CMO routes it to Payload CMS,
the accepted layout document is frozen. If the CMS draft needs correction later,
create a revision document or child correction issue. Do not silently edit the
accepted layout package.

Allowed block types:

- `paragraph`
- `heading`
- `list`
- `editorialCallout`
- `iconList`
- `twoColumnText`
- `quietCta`

Use the exact Payload plugin field contract:

```json
{ "type": "paragraph", "text": "Plain text only." }
{ "type": "heading", "level": "h2", "text": "Heading text." }
{ "type": "list", "ordered": false, "items": ["Item 1", "Item 2"] }
{ "type": "editorialCallout", "variant": "soft", "title": "Short title", "body": "Short body." }
{ "type": "iconList", "style": "grid", "title": "Icon list title", "items": [{ "icon": "editorial-info", "label": "Label", "text": "Optional short text." }] }
{ "type": "twoColumnText", "mode": "text", "leftTitle": "Left", "leftBody": "Left text.", "rightTitle": "Right", "rightBody": "Right text." }
{ "type": "twoColumnText", "mode": "list", "leftTitle": "Left", "leftBody": ["Item 1"], "rightTitle": "Right", "rightBody": ["Item 1"] }
{ "type": "quietCta", "title": "Short CTA title", "text": "CTA body.", "linkLabel": "Button label", "linkUrl": "/internal-path" }
```

Structured inline links are supported only through safe spans:

- `paragraph.spans` for `paragraph.text`;
- `editorialCallout.bodySpans` for `editorialCallout.body`;
- `quietCta.textSpans` for `quietCta.text`;
- `twoColumnText.leftBodySpans` and `twoColumnText.rightBodySpans` only when `mode` is `text`.

When spans are used, concatenated `spans[].text` must exactly equal the parent
text field. `linkUrl` is allowed only on individual spans and must be either an
internal path beginning with `/` or an HTTPS URL. Each text block may contain at
most 5 linked spans, and the whole article may contain at most 20 inline links.

Do not use legacy or improvised field names such as `style`, `body` on paragraphs, `text` on `editorialCallout`, `leftText`, `rightText`, paragraph `links`, `links[]`, raw HTML link markup, Markdown links, or a `quietCta` without `title`. The Payload plugin rejects extra keys.

For `iconList`, use only the registry documented in `docs/article-content-v1.md`. Do not use emoji, raw SVG, image URLs, file names, CSS classes, or invented icon keys. Allowed styles are `grid`, `compact`, and `twoColumn`; each item requires `icon` and `label`, optional `text` should stay short, and one `iconList` may contain at most 40 items.

## Link Policy

`articleContent.v1` supports clickable article links through structured spans
and explicit link fields such as `quietCta.linkUrl`. Use spans for contextual
links inside body copy; use `quietCta.linkUrl` only for the CTA button.

Do not put raw URLs in visible article text. Text fields must not contain
`https://...`, `http://...`, or `www...` strings. A raw URL in a paragraph,
list, callout, icon-list item, two-column block, or CTA copy is a validation
failure because it will render as plain text.

Do not leak internal routing or task language into visible copy. Phrases such as
`Контекстний другий маршрут`, `CTA route`, `SEO lock`, `brief route`, run/stage
notes, or handoff instructions belong in Paperclip artifacts, not in the CMS
article.

Product/service mention link rule:

- If visible article copy names or clearly refers to an Astrogen product,
  service, route, offer, or commercial next step, the referenced thing must have
  a real supported link in the same article package.
- This includes exact product names and product-like paraphrases such as
  `персональний прогноз`, `персоналізований тижневий формат`,
  `фінансовий розбір`, `такий формат`, `м'який старт`,
  `персоналізований старт`, `каталог спеціалістів`, `розбір для фінансових тем`,
  or other wording that points to a concrete Astrogen offer.
- Do not rely on exact-name matching only. If the phrase points to a known
  Astrogen route/product/service by meaning, treat it as a product mention.
- Examples include the experts catalog, free/personal horoscope routes,
  natal-chart products, financial natal-chart products,
  compatibility/synastry products, and any canonical product route from
  company/product references.
- If the referenced product/offer is free, every visible mention, CTA title,
  CTA text, and link label that refers to it must explicitly say this with
  natural wording such as `безкоштовно`, `без оплати`, or `безкоштовний`.
- Do not hide the free nature of a free product behind neutral labels like
  `персональний прогноз`, `стартовий формат`, or `м'який вхід`.
- Do not leave product names as plain unlinked text merely because raw URLs are
  forbidden.
- Do not leave product-like paraphrases unlinked merely because the exact
  product name is absent.
- Do not write raw URLs into visible text to compensate for missing inline-link
  support.
- Use structured spans for contextual product/service/free-tool links in
  paragraphs, editorial callouts, quiet CTA body text, and text-mode two-column
  bodies. Do not move every product mention into CTA blocks merely to create a
  link.
- Do not remove a relevant product/service mention just to avoid linking it.
- If a required product/service link still cannot be represented within the
  span limits or allowed block fields, return a structured blocker instead of
  producing an unlinked product mention.
- Use blocker class `free_offer_not_labeled` when a free product/offer is not
  visibly labeled as free, and `product_like_reference_unlinked` when an
  indirect product/service reference lacks a supported link.

Next-step promise rule:

- Do not write visible copy that promises a `наступний крок`, `перехід`,
  `м'який вхід`, `доречний крок`, or similar action cue unless the same block or
  the immediately following block gives the reader a concrete supported action.
- A concrete supported action means a `quietCta` with a safe `linkUrl`, or a
  contextual inline link represented through structured spans when a button is
  not appropriate.
- A next-step sentence followed by an unrelated heading, a purely explanatory
  section, or a vague product hint without a link is a layout defect.
- If no supported action can be represented, rewrite the sentence as neutral
  editorial synthesis without promising an action, or return a structured
  blocker with class `dangling_next_step_promise`.

The editor should use blocks only when they clarify meaning. Strong default candidates:

- short summary callout after the intro;
- important caveat/warning callout;
- comparison block;
- icon list for controlled zodiac/editorial item lists where registry icons clarify meaning;
- practical example paragraph;
- two-column "enough / better with expert" block;
- calm inline CTA to `/experts` when relevant.

## Editorial Backfill Acceptance

When the task is to audit, repair, backfill, or republish existing articles for
missing editorial inserts, the accepted output must prove that the article body
was addressed. It is not enough to update the cover image, media metadata,
category, sitemap/indexability, or related posts.

For every article in the batch, the handoff and validation result must include
one of:

- `body_changed = true` with the exact `articleContent.v1` improvements, such
  as added `editorialCallout`, `twoColumnText`, `iconList`, `quietCta`,
  structured inline product links, a clearer summary/caveat block, or a revised
  final editorial CTA;
- `body_changed = false` with an explicit reason that the existing body already
  has sufficient editorial rhythm and no insert is appropriate.

Cover-image status is tracked separately. A required cover replacement can be a
parallel child lane, but it does not satisfy the editorial backfill acceptance
gate. Use blocker class `editorial_backfill_cover_only` when a package tries to
close an editorial backfill with cover/media changes only, and
`missing_editorial_change_evidence` when the body-change summary is absent.

## Final Section Policy

The final part of an article must close the editorial argument before it asks for action.

After the last major explanatory section:

- use at most one special CTA block;
- do not stack repeated pink/brand CTA cards;
- do not repeat the same offer under labels such as "next step", "catalog experts", "personal weekly forecast";
- keep the in-article CTA lighter than the large global site CTA that appears below the article;
- prefer a final heading such as `Підсумок і чесний наступний крок`, one short synthesis paragraph, and one compact `quietCta`.

If two next steps are relevant but `quietCta` supports only one button, choose
the primary next step for the button and represent the secondary route through a
natural inline span link when editorially useful. Do not create a second CTA card
to compensate for the one-button schema.

## Image Direction Policy

Every article package must include a cover/hero image that clearly matches the article topic and search intent. A generic lifestyle consultation image is not enough when the article is about a specific conceptual comparison, cycle, checklist, or decision framework.

Cover images must not contain rendered text, words, letters, numbers, labels, UI captions, or text-like decoration. The cover should communicate through scene, symbols, composition, color, and CMS alt text. If explanatory text is needed, it belongs in the article body, not on the cover image.

Payload CMS metadata for cover images has a stricter rule than ordinary media:

- `alt` must be the exact article title;
- `caption` must be empty or omitted;
- `credit` must be empty or omitted;
- `sourceUrl` must be empty or omitted.

This metadata rule applies only to `coverImage`/hero assets. Future inline explanatory images may use descriptive metadata when the CMS schema supports them.

Cover images must meet Astrogen editorial quality, not just "have an image". The target is a premium designer visual comparable to a strong editorial photo or campaign hero: precise topic signal, polished lighting, clean composition, natural depth, refined detail, and no obvious AI artifacts.

When the live Astrogen reference layer is available, use `/astrogen/docs/reference/ARTICLE_IMAGE_DESIGN_SYSTEM.md` as the canonical art-direction source for blog imagery. The shorter rules in this process are mandatory gates; the reference document is the richer style system for prompt construction and QA.

Astrogen visual direction:

- calm, modern, expert, emotionally warm, and lightly esoteric;
- white or soft neutral base, deep burgundy/wine accents, warm gold detail, deep green or subtle mint/teal glow only where useful;
- refined editorial styling, not mystical clutter, neon-purple astrology, cheap stock-photo consultation, generic laptop/coffee, tarot/crystal decoration unless the article truly needs it, or stereotyped cultural props;
- for articles about human experience, decisions, relationships, family, children, career, money, emotions, consultation, or a personal life context, prefer a photorealistic premium editorial scene with real-looking people in a specific lived moment;
- human scenes must feel observed, not posed: the person or people should be thinking, choosing, discussing, preparing, reading notes, working, holding a phone, sitting with a child, or otherwise doing something that makes the article topic legible without text;
- human cover photography should show natural micro-emotions and concrete context such as a home, work desk, consultation setting, family moment, conversation, uncertainty, trust, relief, surprise, recognition, or decision point; it may feel like a cinematic still from a short video, with a believable unexpected facial reaction, but not theatrical acting, panic, tears, melodrama, or direct-to-camera posing;
- when the topic implies reading, comparing, ordering, checking results, choosing an expert, or reviewing a forecast, prefer a smartphone, tablet, or laptop over paper/card props; device screens must be unreadable and non-specific, with no text, UI, icons, numbers, charts, percentages, notifications, or pseudo-text;
- avoid paper/cards/notes unless genuinely needed; if used, they must be blank, out of focus, or positioned so no generated marks are visible. Reject unclear symbols, drawings, pseudo-writing, or artifacts on either side of a paper/card;
- avoid generic smiling models, direct-to-camera posing, glossy stock-photo perfection, and lifeless "person with laptop/coffee" scenes;
- use realistic human imagery when the human situation is central to the article meaning; otherwise prefer a high-end symbolic still life, refined diagram-like composition, or premium editorial illustration;
- the image should answer "what is this article about?" within two seconds without relying on the article title.
- cover images must also pass a series-variation check. Before accepting a
  cover, compare it with nearby published/draft Astrogen blog covers in the same
  category/product lane and with recently generated covers. Reject near-duplicate
  compositions even when the CMS media ids or filenames differ. A cover is a
  near-duplicate when it repeats the same room, window/table setup, seated
  posture, solitary woman-at-notebook/device scene, wardrobe color, camera angle,
  prop cluster, or emotional beat closely enough that two article cards look like
  the same photo at a glance.
- when two articles are adjacent in the blog grid, their covers must be visually
  distinguishable by scene concept, action, crop, subject arrangement, and
  emotional moment. Brand consistency is required, but template repetition is a
  blocking defect.

The image generation handoff must include:

- article title and search intent;
- visual concept in one or two sentences;
- two or three concrete semantic anchors from the article topic;
- Astrogen style anchors from the visual direction above;
- hard negatives: no text, no letters, no numbers, no readable UI, no fake glyphs, no distorted hands/faces, no random symbols, no pseudo-writing on paper/screens, no generic stock scene;
- series negatives: do not reuse the same window, same table, same seated pose,
  same solitary woman writing/looking down, same cup/notebook/device arrangement,
  same clothing color, or same camera angle as nearby Astrogen article covers;
- aspect ratio and crop safety for CMS cover usage;
- a short reason why the image fits the article.

A generic or weakly connected cover is a blocking package defect, not a cosmetic note. CMO should route a cover-generation/replacement step before Payload CMS draft delivery or Telegram/editorial notification. The final CMS draft must have the topic-specific image set as `coverImage`.

Generated images should be rejected and regenerated when they contain visible text, text-like pseudo-glyphs, readable or fake screen UI, ambiguous marks on paper/cards, malformed hands/faces, warped symbols, plastic/uncanny faces, muddy edges, incoherent astrology marks, or a scene that could fit almost any wellness article.

Generated images should also be rejected and regenerated when they are visually
too similar to another Astrogen blog cover, especially in the same category or
product lane. This includes cases where two different CMS media records look
like the same generated photo. Treat this as `cover_image_near_duplicate`, not
as an optional taste preference.

When useful, the layout handoff may recommend an internal non-photo illustration, diagram, or simple editorial visual. Internal visuals should explain the article, not decorate it. Do not add unsupported inline image blocks to `articleContent.v1`; keep the recommendation in the handoff until the CMS schema explicitly supports inline illustrations.

## Hard Limits

Do not output or send:

- raw Payload Lexical JSON;
- raw HTML;
- raw URLs inside visible text fields;
- internal routing/task notes inside visible text fields;
- markdown as the CMS body format;
- inline styles;
- CSS classes;
- unsupported block types;
- unsafe CTA links such as `javascript:...`;
- unsafe inline span links such as `javascript:...`, `data:...`, protocol-relative `//example.com`, or empty span text;
- raw visible URLs used instead of structured spans;
- publication state changes.

CMS draft/update calls must keep:

```json
{
  "_status": "draft",
  "workflowStatus": "draft"
}
```

## Layout Validator Decision

The validator returns one of:

- `accepted`
- `returned_for_revision`
- `blocked`

Use `blocked` only when the missing/contradictory source material needs human or upstream resolution. Normal layout problems should be `returned_for_revision` with blocker classes.

Expected blocker classes:

- `schema_invalid`
- `unsupported_block`
- `icon_registry_invalid`
- `unsafe_cta_url`
- `raw_format_detected`
- `raw_url_in_visible_text`
- `internal_routing_note_leaked`
- `required_link_not_representable`
- `required_inline_product_link_not_supported`
- `free_offer_not_labeled`
- `product_like_reference_unlinked`
- `dangling_next_step_promise`
- `seo_lock_drift`
- `layout_overdecorated`
- `layout_too_static`
- `cta_overstacked`
- `final_section_too_promotional`
- `generic_cover_image`
- `cover_image_contains_text`
- `cover_image_metadata_invalid`
- `cover_image_off_brand`
- `cover_image_weak_topic_signal`
- `cover_image_ai_artifacts`
- `cover_image_quality_below_brand_standard`
- `inline_illustration_not_supported`
- `article_content_schema_field_mismatch`
- `claim_added_without_validation`
- `editorial_backfill_cover_only`
- `missing_editorial_change_evidence`

## Completion

The stage is complete only when the layout validator accepts the `articleContent.v1` package and CMO can safely route it to Payload CMS as an unpublished draft/update.

## Related Posts

Related articles are not an `articleContent.v1` block and must not be embedded
inside article body content.

When the layout handoff has enough topical context to recommend related
articles, record the recommendation separately for the CMS delivery/fix lane.
The Payload CMS field is top-level `blogPosts.relatedPosts` and accepts 0 to 3
existing numeric blog post IDs.

Selection rules:

- closest topic and reader intent first;
- same category or useful supporting explanation second;
- CrawlObserver internal PageRank and internal-link evidence only as a
  tie-breaker between already relevant candidates;
- no current article ID;
- no duplicate IDs;
- no slugs, URLs, titles, search terms, or generated recommendation copy.

Adding or changing only related-post relationships is a deterministic
internal-linking/CMS SEO fix and does not require owner approval.
