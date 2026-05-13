# Astrogen Semantic Core Review GUI - Design Context

## Source

Checked live site `https://astrogen.com.ua/` on 2026-05-06.

Fetched assets:

- HTML: `https://astrogen.com.ua/`
- CSS: `https://astrogen.com.ua/assets/index-I0eQLnTs.css`

Local fetched copies were stored under `.tmp/` for inspection only and must not be committed.

## Verified Tokens

Typography:

- Primary web font: Montserrat, weights 300/400/500/600/700.

Color:

- Primary / accent: `hsl(345 80% 28%)`
- Approx primary hex from CSS opacity variants: `#810e2b`
- Gold accent: `#C69C6D`
- Background: `hsl(0 0% 100%)`
- Foreground: `hsl(0 0% 10%)`
- Muted surface: `hsl(0 0% 96%)`
- Muted text: `hsl(0 0% 45%)`
- Ring/accent support: `hsl(36 55% 60%)`

## UI Tone

Astrogen's live UI is calm, restrained, service-oriented, and mostly light themed. The semantic-core review tool should feel like a professional internal Astrogen admin surface, not like a public marketing page and not like a generic Paperclip table.

Use:

- white/light surfaces;
- burgundy for primary actions and serious status;
- gold for selected highlights, evidence emphasis, or safe-ready states;
- muted neutral panels for filters/details;
- Montserrat for labels, controls, and table text;
- compact spacing and clear information hierarchy.

Avoid:

- decorative hero sections;
- gradient backgrounds;
- ornamental astrology visuals in the operational tool;
- exposing raw MCP payload fields by default;
- dense icon decoration that does not carry decision meaning.

## Decision UI Implication

The core interaction is not data browsing. It is controlled decision-making.

Default table should show:

1. Keyword
2. Current status
3. Suggested decision
4. Human decision
5. Warning/reason
6. Product binding
7. Topic match
8. Confidence
9. Geo/global volume
10. Evidence summary

Full MCP detail belongs in a drawer opened per row.

