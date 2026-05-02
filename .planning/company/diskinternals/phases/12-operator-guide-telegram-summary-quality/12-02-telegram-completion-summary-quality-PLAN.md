---
phase: 12
plan: 12-02
title: "Telegram Completion Summary Rich Resolver And Quality Gate"
status: complete
requirements: ["NOTIF-01"]
deliverables:
  - "local-paperclip/server/src/services/issue-telegram-notifications.ts"
  - "local-paperclip/server/src/__tests__/issue-telegram-notifications.test.ts"
  - "ops/paperclip/telegram-plugin-issue-done-hotfix.md"
---

# 12-02: Telegram Completion Summary Rich Resolver And Quality Gate

## Goal

Make issue completion notifications useful for humans. The `Що зроблено` section must explain the actual completion in human language and avoid collapsing to generic one-line fallback text.

## Tasks

<task id="1" type="implementation">
<action>Add a richer server-side completion resolver that uses the explicit status-change summary, recent issue comments, and issue update activity as evidence.</action>
<done>The notifier now ranks explicit completion summaries, same-run/same-agent/latest issue comments, and recent issue.updated comment evidence.</done>
</task>

<task id="2" type="implementation">
<action>Add a completion summary quality gate: if the resolved text is too short, generic, or agent-facing, expand it into a 150-250 word Ukrainian human-readable explanation.</action>
<done>Server-side summaries are expanded when they are generic, technical, too short, or not human-readable enough.</done>
</task>

<task id="3" type="telegram-delivery">
<action>Send the rich human summary as a Telegram text message so it is not constrained by attachment caption limits; keep attachment captions compact.</action>
<done>The notifier sends a rich text message first and keeps attachment captions compact for document delivery.</done>
</task>

<task id="4" type="live-plugin-hardening">
<action>Keep the installed Telegram plugin hotfix documented and, where needed, patch the live plugin formatter so `issue.updated` forwarding follows the same quality rule.</action>
<done>The live installed plugin formatter was patched and the operational hotfix document was updated.</done>
</task>

<task id="5" type="tests">
<action>Add regression coverage for short/generic completion comments and for separately posted rich comments before marking an issue done.</action>
<done>Regression tests cover rich messages, caption behavior, technical/agent-facing sanitization, and latest-comment fallback when the done summary is generic.</done>
</task>

## Verification

- Targeted Telegram notification tests pass.
- Server typecheck passes.
- A completion notification with `Done`, `Completed`, or an empty status-change comment produces a human-readable `Що зроблено` section rather than `Задачу завершено`.
- The rich message is not truncated by the 1024-character document-caption limit.
