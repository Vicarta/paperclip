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
