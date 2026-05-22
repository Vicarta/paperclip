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

The current `articleContent.v1` contract supports clickable links only through
explicit link fields such as `quietCta.linkUrl`.

Do not place raw URLs in visible article text. Paragraphs, headings, lists,
callouts, icon-list labels/text, two-column text, and CTA copy must not contain
`https://...`, `http://...`, or `www...` strings.

If the article needs a clickable next step, use one supported `quietCta` block
with a safe internal path or HTTPS URL. If more than one route is relevant,
choose the primary next step for the CTA and keep secondary route discussion as
editorial text without raw URLs until the CMS schema supports inline links.

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
