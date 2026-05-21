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

The editor should use blocks only when they clarify meaning. Strong default candidates:

- short summary callout after the intro;
- important caveat/warning callout;
- comparison block;
- practical example paragraph;
- two-column "enough / better with expert" block;
- calm inline CTA to `/experts` when relevant.

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
- `claim_added_without_validation`

## Completion

The stage is complete only when the layout validator accepts the `articleContent.v1` package and CMO can safely route it to Payload CMS as an unpublished draft/update.
