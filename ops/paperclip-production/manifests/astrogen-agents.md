# Astrogen Agent Runtime Manifest

Last verified: 2026-05-18
Scope: production runtime policy and sanitized agent identities only. No secrets or private prompt bodies belong here.

## Heartbeat Policy

Routine LLM heartbeat is enabled only for:

| Agent | Purpose |
| --- | --- |
| `CEO` | Top-level governance and escalation. |
| `Chief Marketing Officer` | Marketing/content pipeline management. |
| `Chief Technical Officer` | Technical recovery and system health. |

All specialist agents should remain `wakeOnDemand=true` with `heartbeat.enabled=false` unless a human explicitly approves a temporary exception.

## SEO Blog Article Writers

| Agent | Runtime path | Role |
| --- | --- | --- |
| `SEO Blog Article Writer (Claude)` | `openrouter` / `anthropic/claude-sonnet-4.6` | Primary first-pass SEO blog article author. |
| `SEO Blog Article Writer (ChatGPT)` | `codex_local` / `gpt-5.4` | Fallback/rescue author for repeated same-class validation failures, protocol/runtime failures, or missing canonical artifacts. |
| `SEO Blog Article Layout Editor` | `codex_local` / `gpt-5.4` | Converts validated article drafts into `articleContent.v1` with meaningful editorial blocks and calm CTA placement. |
| `SEO Blog Article Layout Validator` | `codex_local` / `gpt-5.4` | Validates `articleContent.v1` schema, visual rhythm, CTA safety, SEO-lock preservation, and absence of raw HTML/Lexical/CSS. |

Primary OpenRouter writer runtime policy:

- `requireArtifactOnDone=true`.
- `promptTemplate` is filled with the OpenRouter-specific Stage 59 operating rules.
- `paperclipSkillSync.desiredSkills=[]`; OpenRouter must not be presented as having local Paperclip skill tools.
- The prompt explicitly tells the agent it has no shell, filesystem, browser, or Paperclip tool access and must return the canonical markdown artifact through the issue protocol.
- An issue-bound OpenRouter run that returns unparsable protocol output, or `done` without a canonical artifact, must block internally with a diagnostic comment. It must not create a human decision gate.

## Recovery Rules

- Do not passively monitor the same stalled Paperclip condition more than three times.
- After the third unchanged check, switch to system recovery: update the contract, reassign the work, create a concrete recovery issue, or fix the configuration.
- Validator returns must include structured blocker classes so CMO can count repeated same-class failures.
- CMO must switch a Stage 59 article task to `SEO Blog Article Writer GPT` instead of changing the model inside the primary writer.
- Technical writer/validator failures must not be labeled as owner decisions.

## CMO Blog Scope Rule

When the owner asks to write, create, generate, or prepare a new blog article, CMO must not reinterpret the request as importing an already accepted or already written package unless the owner explicitly approves that substitution.

For a new blog article request, CMO keeps the parent issue open until the requested chain is complete: topic selection, new article drafting, validation, layout editing, layout/schema validation, topic-specific premium cover image generation/replacement, Payload CMS draft creation, and Telegram notification with the draft or admin URL. Generic consultation/lifestyle cover images are blocking defects for specific article topics. Cover images must not contain rendered text, words, letters, numbers, labels, UI captions, or text-like decoration. Covers must match Astrogen's visual standard: premium editorial/photo-quality design, calm modern expertise, soft neutral base, deep burgundy/wine and warm gold accents, restrained esoteric signal, clear topic meaning within two seconds, no cheap stock feel, no neon/mystical clutter, no random symbols, and no visible AI artifacts. Normal Payload CMS draft/update delivery should use the Payload CMS agent-tools plugin through an available CMS-capable execution lane; CTO is only for plugin/runtime/schema/deployment failures, not routine draft delivery.

Existing accepted article packages may still be imported as additional CMS operations, but that does not satisfy a request for a new article.

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
- unsafe CTA links;
- layout that drops SEO locks, required links, or validated claims;
- decorative blocks that do not clarify the article.

## Canonical Artifact Rule

Stage 59 article writer issues may be marked `done` only when a verified non-empty canonical markdown file exists under:

```text
/astrogen/work/59-seo-blog-article-drafts/active/
```

Attachments, comments, or legacy issue-document placeholders do not satisfy the canonical artifact contract by themselves.
