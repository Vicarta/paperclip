# Phase 23: Blog Article Layout Pipeline

## Problem

Astrogen blog drafts can be technically correct but still read as static AI-generated text. The CMS now supports structured visual/editorial blocks through `articleContent.v1`, but Paperclip still treats article text mostly as markdown/HTML/Lexical delivery.

## Goal

Add a layout layer after article validation:

```text
Writer
-> Article Validator
-> Layout Editor
-> Layout/schema validation
-> Payload CMS draft
-> Telegram draft URL
```

The result should be a CMS draft that is still safe, unpublished, and SEO-locked, but has human-readable visual rhythm: summary callouts, comparison blocks, examples, calm CTA, and scan-friendly structure.

## Implementation

### Payload CMS Tool Contract

- Accept `articleContent.schemaVersion = "articleContent.v1"`.
- Allow only these block types:
  - `paragraph`
  - `heading`
  - `list`
  - `editorialCallout`
  - `twoColumnText`
  - `quietCta`
- Reject raw Lexical JSON, raw HTML, inline styles, CSS classes, `javascript:` URLs, and unsupported blocks.
- Always force `_status=draft` and `workflowStatus=draft`.

### New Agents

- `SEO Blog Article Layout Editor`
  - Converts validated article markdown into `articleContent.v1`.
  - Adds editorial blocks only when they clarify meaning.
  - Does not rewrite the article's SEO lock, factual claims, slug, CTA route, or product/service framing.

- `SEO Blog Article Layout Validator`
  - Checks `articleContent.v1` schema, layout rhythm, CTA correctness, SEO lock preservation, and absence of raw HTML/Lexical/CSS.
  - Returns structured revision notes to the layout editor when needed.

### CMO Contract

For new blog drafts and revision of existing drafts:

```text
validated article
-> layout editor
-> layout validator
-> Payload CMS draft/update
-> Telegram with CMS draft/admin URL
```

CMO must not skip layout validation for owner-visible CMS drafts unless the owner explicitly asks for a fast technical update only.

## First Smoke

Update the existing draft:

```text
Китайський гороскоп: як він працює і чим відрізняється від західного
```

The updated draft should include, where appropriate:

- a short summary callout after the intro;
- a scan-friendly 12-year cycle list;
- a warning callout that the Chinese year does not always start on January 1;
- a comparison block for Chinese horoscope vs western zodiac;
- a practical example;
- a two-column "general explanation is enough / expert is better" block;
- a calm inline CTA to `/experts`.

Do not publish. Keep `_status=draft` and `workflowStatus=draft`.

## Verification

- Payload CMS plugin tests cover valid `articleContent.v1`.
- Tests reject raw Lexical `content`, `markdown`, raw HTML text, unsupported blocks, and unsafe `quietCta.linkUrl`.
- Live plugin health remains OK after deploy.
- New Astrogen layout agents exist, report to CMO, have routine heartbeat disabled, and `wakeOnDemand=true`.
- The Chinese horoscope draft is updated through Payload CMS and Telegram receives the draft/admin URL.
