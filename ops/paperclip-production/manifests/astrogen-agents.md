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
| `SEO Blog Article Writer` | `openrouter` / `anthropic/claude-sonnet-4.6` | Primary first-pass SEO blog article author. |
| `SEO Blog Article Writer GPT` | `codex_local` / `gpt-5.4` | Fallback/rescue author for repeated same-class validation failures, protocol/runtime failures, or missing canonical artifacts. |

## Recovery Rules

- Do not passively monitor the same stalled Paperclip condition more than three times.
- After the third unchanged check, switch to system recovery: update the contract, reassign the work, create a concrete recovery issue, or fix the configuration.
- Validator returns must include structured blocker classes so CMO can count repeated same-class failures.
- CMO must switch a Stage 59 article task to `SEO Blog Article Writer GPT` instead of changing the model inside the primary writer.
- Technical writer/validator failures must not be labeled as owner decisions.

## Canonical Artifact Rule

Stage 59 article writer issues may be marked `done` only when a verified non-empty canonical markdown file exists under:

```text
/astrogen/work/59-seo-blog-article-drafts/active/
```

Attachments, comments, or legacy issue-document placeholders do not satisfy the canonical artifact contract by themselves.
