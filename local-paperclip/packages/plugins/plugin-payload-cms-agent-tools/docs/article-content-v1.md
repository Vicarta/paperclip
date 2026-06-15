# articleContent.v1

Payload CMS blog text must be sent as `articleContent` with
`schemaVersion: "articleContent.v1"`.

Do not send raw Payload Lexical JSON, markdown, raw HTML, inline styles, CSS
classes, SVG, emoji, or image URLs as content blocks.

## Supported Blocks

- `paragraph`
- `heading`
- `list`
- `editorialCallout`
- `iconList`
- `twoColumnText`
- `quietCta`

## Links

`articleContent.v1` supports contextual inline links only through structured
`spans`. Do not send raw HTML anchors, Markdown links, raw Lexical JSON, CSS
classes, inline styles, or `links[]`.

Do not place raw URLs in visible article text. Paragraphs, headings, lists,
callouts, icon-list labels/text, two-column text, and CTA copy must not contain
`https://...`, `http://...`, or `www...` strings.

Canonical span format:

```json
{
  "type": "paragraph",
  "text": "Якщо потрібен персональний розбір, можна перейти до фінансової натальної карти або безкоштовного персонального тижневого гороскопа.",
  "spans": [
    { "text": "Якщо потрібен персональний розбір, можна перейти до " },
    { "text": "фінансової натальної карти", "linkUrl": "/money" },
    { "text": " або " },
    { "text": "безкоштовного персонального тижневого гороскопа", "linkUrl": "/free-horoscope" },
    { "text": "." }
  ]
}
```

Supported span fields:

- `paragraph.spans` for `paragraph.text`.
- `editorialCallout.bodySpans` for `editorialCallout.body`.
- `quietCta.textSpans` for `quietCta.text`.
- `twoColumnText.leftBodySpans` and `twoColumnText.rightBodySpans` only when
  `mode` is `text` and the body fields are strings.

Rules:

- Concatenated `spans[].text` must match the parent text field after whitespace
  normalization.
- Linked spans use `linkUrl`; unlinked spans omit `linkUrl`.
- `linkUrl` must be an internal path starting with `/` or an HTTPS URL.
- Reject `javascript:`, `data:`, protocol-relative `//...`, raw HTML,
  Markdown links, empty span text, and unsafe URLs.
- Maximum linked spans per text block: 5.
- Maximum inline links per article: 20.
- Do not use `links[]`; it is intentionally unsupported.

When an Astrogen product, service, or free tool is mentioned naturally in
article body, the Layout Editor should add a contextual inline link through
structured spans. Do not remove the mention to avoid a link. Do not move every
mention into CTA blocks. Free products should preserve wording like
`безкоштовно`, `без оплати`, or equivalent when relevant.

`quietCta.linkUrl` remains the supported link field for the CTA button itself,
but product/service mentions inside CTA body copy can also use `textSpans`.

Do not leak internal route/task notes such as "contextual second route",
"CTA route", or "SEO lock" into visible copy.

## iconList

Use `iconList` for short, scannable lists where a controlled icon improves
comprehension. The icon value must come from the registry below. If a new icon is
needed, add it to the registry first; do not invent keys.

```json
{
  "type": "iconList",
  "style": "grid",
  "title": "Знаки китайського гороскопу",
  "items": [
    {
      "icon": "chinese-rat",
      "label": "Щур",
      "text": "Перший знак китайського циклу."
    },
    {
      "icon": "chinese-ox",
      "label": "Бик"
    }
  ]
}
```

Allowed `style` values:

```text
grid
compact
twoColumn
```

Rules:

- `icon` is required and must be from the registry.
- `label` is required.
- `text` is optional and should be short.
- Maximum: 40 items per `iconList`.
- Do not pass emoji, SVG, file names, image URLs, HTML, or CSS class names.

## Chinese Zodiac Icons

```text
chinese-rat
chinese-ox
chinese-tiger
chinese-rabbit
chinese-dragon
chinese-snake
chinese-horse
chinese-goat
chinese-monkey
chinese-rooster
chinese-dog
chinese-pig
```

## Western Zodiac Icons

```text
zodiac-aries
zodiac-taurus
zodiac-gemini
zodiac-cancer
zodiac-leo
zodiac-virgo
zodiac-libra
zodiac-scorpio
zodiac-sagittarius
zodiac-capricorn
zodiac-aquarius
zodiac-pisces
```

## Editorial Icons

```text
editorial-check
editorial-info
editorial-calendar
editorial-money
editorial-heart
editorial-star
editorial-people
editorial-chat
editorial-target
editorial-book
```

## Forbidden

```json
{ "icon": "🐀", "label": "Щур" }
```

```json
{ "icon": "rat-icon.svg", "label": "Щур" }
```

```json
{ "icon": "<svg>...</svg>", "label": "Щур" }
```

```json
{ "type": "paragraph", "text": "Open https://astrogen.com.ua/free-horoscope" }
```

```json
{ "type": "paragraph", "text": "Contextual second route: /money" }
```

```json
{ "type": "paragraph", "text": "Open [money](/money)." }
```

```json
{ "type": "paragraph", "text": "Open <a href=\"/money\">money</a>." }
```

```json
{ "type": "paragraph", "text": "Open money.", "links": [{ "text": "money", "url": "/money" }] }
```
