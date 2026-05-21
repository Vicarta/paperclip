# Stage 68: SEO Blog Article Layout

## Purpose

Turn a validated Ukrainian SEO blog article into a Payload CMS `articleContent.v1` layout package before the draft is created or updated in CMS.

This stage is about editorial structure and reading rhythm. It is not a rewrite stage and it is not a publishing stage.

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

Allowed block types:

- `paragraph`
- `heading`
- `list`
- `editorialCallout`
- `twoColumnText`
- `quietCta`

Use the exact Payload plugin field contract:

```json
{ "type": "paragraph", "text": "Plain text only." }
{ "type": "heading", "level": "h2", "text": "Heading text." }
{ "type": "list", "ordered": false, "items": ["Item 1", "Item 2"] }
{ "type": "editorialCallout", "variant": "soft", "title": "Short title", "body": "Short body." }
{ "type": "twoColumnText", "mode": "text", "leftTitle": "Left", "leftBody": "Left text.", "rightTitle": "Right", "rightBody": "Right text." }
{ "type": "twoColumnText", "mode": "list", "leftTitle": "Left", "leftBody": ["Item 1"], "rightTitle": "Right", "rightBody": ["Item 1"] }
{ "type": "quietCta", "title": "Short CTA title", "text": "CTA body.", "linkLabel": "Button label", "linkUrl": "/internal-path" }
```

Do not use legacy or improvised field names such as `style`, `body` on paragraphs, `text` on `editorialCallout`, `leftText`, `rightText`, paragraph `links`, or a `quietCta` without `title`. The Payload plugin rejects extra keys.

The editor should use blocks only when they clarify meaning. Strong default candidates:

- short summary callout after the intro;
- important caveat/warning callout;
- comparison block;
- practical example paragraph;
- two-column "enough / better with expert" block;
- calm inline CTA to `/experts` when relevant.

## Final Section Policy

The final part of an article must close the editorial argument before it asks for action.

After the last major explanatory section:

- use at most one special CTA block;
- do not stack repeated pink/brand CTA cards;
- do not repeat the same offer under labels such as "next step", "catalog experts", "personal weekly forecast";
- keep the in-article CTA lighter than the large global site CTA that appears below the article;
- prefer a final heading such as `Підсумок і чесний наступний крок`, one short synthesis paragraph, and one compact `quietCta`.

If two next steps are relevant but `quietCta` supports only one button, choose the primary next step from the accepted brief/SEO lock. Mention the secondary option in body text only if it is genuinely helpful; do not create a second CTA card to compensate for the one-button schema.

## Image Direction Policy

Every article package must include a cover/hero image that clearly matches the article topic and search intent. A generic lifestyle consultation image is not enough when the article is about a specific conceptual comparison, cycle, checklist, or decision framework.

Cover images must not contain rendered text, words, letters, numbers, labels, UI captions, or text-like decoration. The cover should communicate through scene, symbols, composition, color, and CMS alt text. If explanatory text is needed, it belongs in the article body, not on the cover image.

A generic or weakly connected cover is a blocking package defect, not a cosmetic note. CMO should route a cover-generation/replacement step before Payload CMS draft delivery or Telegram/editorial notification. The final CMS draft must have the topic-specific image set as `coverImage`.

When useful, the layout handoff may recommend an internal non-photo illustration, diagram, or simple editorial visual. Do not add unsupported inline image blocks to `articleContent.v1`; keep the recommendation in the handoff until the CMS schema explicitly supports inline illustrations.

## Hard Limits

Do not output or send:

- raw Payload Lexical JSON;
- raw HTML;
- markdown as the CMS body format;
- inline styles;
- CSS classes;
- unsupported block types;
- unsafe CTA links such as `javascript:...`;
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
- `unsafe_cta_url`
- `raw_format_detected`
- `seo_lock_drift`
- `layout_overdecorated`
- `layout_too_static`
- `cta_overstacked`
- `final_section_too_promotional`
- `generic_cover_image`
- `cover_image_contains_text`
- `inline_illustration_not_supported`
- `article_content_schema_field_mismatch`
- `claim_added_without_validation`

## Completion

The stage is complete only when the layout validator accepts the `articleContent.v1` package and CMO can safely route it to Payload CMS as an unpublished draft/update.
