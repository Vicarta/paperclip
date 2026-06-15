# Astrogen Agent Runtime Manifest

Last verified: 2026-05-22
Scope: production runtime policy and sanitized agent identities only. No secrets or private prompt bodies belong here.

## Heartbeat Policy

Routine LLM timer heartbeat is disabled by default for Astrogen managers and specialists.

| Agent | Purpose |
| --- | --- |
| `CEO` | `wakeOnDemand=true`, `heartbeat.enabled=false`; wake only for concrete governance/escalation events. |
| `Chief Marketing Officer` | `wakeOnDemand=true`, `heartbeat.enabled=false`; wake for assignments, comments, approvals, child-completion handoffs, routines, or deterministic watchdog findings. |
| `Chief Technical Officer` | `wakeOnDemand=true`, `heartbeat.enabled=false`; wake for explicit technical incidents/routines only, not for passive intervention in other agents' work. |

All specialist agents should remain `wakeOnDemand=true` with `heartbeat.enabled=false` unless a human explicitly approves a temporary exception with an expiry. Recovery should use deterministic watchdog/routine checks that enqueue concrete work, not frequent idle LLM polling.

## SEO Blog Article Writers

| Agent | Runtime path | Role |
| --- | --- | --- |
| `SEO Blog Article Writer (ChatGPT)` | `codex_local` / `gpt-5.4` | Primary first-pass SEO blog article author and normal deterministic correction author. |
| `SEO Blog Article Writer (Claude)` | `openrouter` / `anthropic/claude-sonnet-4.6` | Reserve author only for explicit CMO-approved recovery when the ChatGPT lane is unavailable or repeatedly blocked. |
| `SEO Blog Article Layout Editor` | `codex_local` / `gpt-5.4` | Converts validated article drafts into `articleContent.v1` with meaningful editorial blocks and calm CTA placement. |
| `SEO Blog Article Layout Validator` | `codex_local` / `gpt-5.4` | Validates `articleContent.v1` schema, visual rhythm, CTA safety, SEO-lock preservation, and absence of raw HTML/Lexical/CSS. |

Reserve OpenRouter writer runtime policy:

- `requireArtifactOnDone=true`.
- `promptTemplate` is filled with the OpenRouter-specific Stage 59 operating rules.
- `paperclipSkillSync.desiredSkills=[]`; OpenRouter must not be presented as having local Paperclip skill tools.
- The prompt explicitly tells the agent it has no shell, filesystem, browser, or Paperclip tool access and must return the canonical markdown artifact through the issue protocol.
- An issue-bound OpenRouter run that returns unparsable protocol output, or `done` without a canonical artifact, must block internally with a diagnostic comment. It must not create a human decision gate.
- Routine Stage 59 first-pass drafts should not be routed to OpenRouter/Claude while the ChatGPT writer lane is healthy.

## Recovery Rules

- Do not passively monitor the same stalled Paperclip condition more than three times.
- After the third unchanged check, switch to system recovery: update the contract, reassign the work, create a concrete recovery issue, or fix the configuration.
- Validator returns must include structured blocker classes so CMO can count repeated same-class failures.
- CMO must route normal Stage 59 article drafting and ordinary corrections to `SEO Blog Article Writer (ChatGPT)`.
- CMO must not switch the model inside an existing writer agent as a workaround. If the ChatGPT lane is explicitly blocked, choose a concrete recovery path or deliberately assign the reserve `SEO Blog Article Writer (Claude)` lane.
- Technical writer/validator failures must not be labeled as owner decisions.

## CMO Blog Scope Rule

When the owner asks to write, create, generate, or prepare a new blog article, CMO must not reinterpret the request as importing an already accepted or already written package unless the owner explicitly approves that substitution.

For a new blog article request, CMO keeps the parent issue open until the requested chain is complete: topic selection, new article drafting, validation, layout editing, layout/schema validation, topic-specific premium cover image generation/replacement, Payload CMS draft creation, and Telegram notification with the draft or admin URL. Generic consultation/lifestyle cover images are blocking defects for specific article topics. Cover images must not contain rendered text, words, letters, numbers, labels, UI captions, or text-like decoration. Cover-image metadata must be deterministic: `alt` equals the exact article title, while `caption`, `credit`, and `sourceUrl` are empty/omitted. This metadata rule is for cover/hero images only, not future inline media. Covers must match Astrogen's visual standard: premium editorial/photo-quality design, calm modern expertise, soft neutral base, deep burgundy/wine and warm gold accents, restrained esoteric signal, clear topic meaning within two seconds, no cheap stock feel, no neon/mystical clutter, no random symbols, and no visible AI artifacts. For articles about human experience, decisions, relationships, family, children, career, money, emotions, consultation, or personal life context, the cover should normally be a photorealistic premium editorial scene with real-looking people in a specific lived moment. Human covers must feel observed rather than posed: show concrete action, conversation, preparation, uncertainty, trust, relief, surprise, recognition, or a decision point, and may feel like a cinematic still from a short video when the emotion stays believable. Avoid direct-to-camera models, generic smiles, theatrical acting, panic, tears, melodrama, glossy stock-photo perfection, and lifeless laptop/coffee scenes. When the scene implies reading, comparing, ordering, checking results, choosing an expert, or reviewing a forecast, prefer a smartphone, tablet, or laptop over paper/card props; device screens must be unreadable and non-specific, with no text, UI, icons, numbers, charts, percentages, notifications, or pseudo-text. Paper/cards/notes must not show unclear symbols, drawings, pseudo-writing, or artifacts. Normal Payload CMS draft/update delivery should use the Payload CMS agent-tools plugin through an available CMS-capable execution lane; CTO is only for plugin/runtime/schema/deployment failures, not routine draft delivery.

Related posts are part of normal Payload CMS delivery and internal linking. For
each Astrogen blog draft/update, agents should set top-level `relatedPosts` with
0 to 3 existing numeric blog post IDs when relevant public/indexable articles
exist. Related posts must never be placed inside `articleContent.v1`. Selection
uses topic/intent relevance first, same category/supporting explanation second,
and CrawlObserver internal PageRank only as a tie-breaker. Routine
related-post additions or edits do not require HIA/owner approval; published
articles may be updated/rebuilt by the CMS technical fix lane when the only
change is `relatedPosts`.

Contextual product/service links inside article body are part of normal
`articleContent.v1` delivery. The Layout Editor should use structured span
fields only: `paragraph.spans`, `editorialCallout.bodySpans`,
`quietCta.textSpans`, and `twoColumnText.leftBodySpans` /
`rightBodySpans` when `mode` is `text`. Each linked span uses `linkUrl` with an
internal `/...` path or HTTPS URL. Do not use raw HTML anchors, Markdown links,
`links[]`, raw Lexical JSON, CSS classes, inline styles, or raw URLs in visible
copy. When an Astrogen product, service, or free tool is mentioned naturally,
add a contextual inline link through spans; do not remove the mention to avoid a
link and do not move every mention into CTA blocks. Free products should
preserve wording like `безкоштовно`, `без оплати`, or equivalent when relevant.

Existing accepted article packages may still be imported as additional CMS operations, but that does not satisfy a request for a new article.

## Document Review Policy

Astrogen owner decisions, article review packets, detailed SEO reports, and
technical-finding batches should be document-backed, not comment-only.

Required issue documents:

- owner decision brief when a human approval or choice is needed;
- article brief and validation packet;
- layout handoff / `articleContent.v1` package;
- CMS draft delivery summary when a draft is created or materially updated;
- weekly detailed SEO report and experiment recommendation;
- GSC/CrawlObserver finding batch summary.

Use comments for short handoffs, status changes, and one-step fix closeouts.
Use document annotations when the feedback concerns an exact paragraph, KPI row,
URL, CMS field, title/meta pair, product mention, CTA, or image-quality defect.

After CMO accepts a document-backed artifact, the accepted document is frozen.
Later edits require a new revision document or child correction issue. Agents
must not silently rewrite accepted artifacts and then continue as if the same
document had always been approved.

## Blog Layout Pipeline

Validated article drafts must flow through:

```text
Writer
-> Article Validator
-> SEO Blog Article Layout Editor
-> SEO Blog Article Layout Validator
-> Payload CMS draft
-> Telegram draft URL
```

The layout editor must not rewrite the article SEO lock, factual claims, slug, CTA route, product/service framing, or approved title. Its job is editorial structure: scan-friendly summary blocks, comparison blocks, examples, lists, and quiet CTAs that make the article feel useful rather than static.

The layout validator must reject:

- raw Payload Lexical JSON;
- raw HTML or CSS;
- unsupported `articleContent.v1` blocks;
- unsafe CTA links or unsafe structured span links;
- layout that drops SEO locks, required links, or validated claims;
- decorative blocks that do not clarify the article.

## Canonical Artifact Rule

Stage 59 article writer issues may be marked `done` only when a verified non-empty canonical markdown file exists under:

```text
/astrogen/work/59-seo-blog-article-drafts/active/
```

Attachments, comments, or legacy issue-document placeholders do not satisfy the canonical artifact contract by themselves.
