# Telegram Plugin Issue-Done Hotfix

Operational hotfix applied on 2026-04-30 to the live `paperclip-plugin-telegram`
bundle installed under the Paperclip data volume:

`/paperclip/.paperclip/plugins/node_modules/paperclip-plugin-telegram/dist/`

Reason:
- The server-side issue completion notifier already used `Компанія`,
  `Проєкт`, and `Що зроблено`.
- The Telegram plugin also forwards `issue.updated` events independently and
  still used the older `Суть` field plus raw agent summaries such as
  `Done Completed...`.

Live files patched:
- `dist/formatters.js`
- `dist/worker.js`

Behavior after the patch:
- `formatIssueDone` includes company name when available.
- `formatIssueDone` includes project name when available.
- `Суть` is replaced with `Що зроблено`.
- Repeated English status prefixes such as `Done Completed` are stripped.
- Known agent-facing summaries such as review-lane decisions and stale
  human-decision blocker audits are rewritten as short Ukrainian summaries.
- Final semantic-core manager decisions are summarized from the full completion
  comment, not only the first sentence. This prevents comments that start with
  headings such as `Final Manager Decision` from collapsing to the generic
  `Задачу завершено` fallback.
- 2026-05-02 update: `readableCompletionSummary` now has the same human-facing
  quality rule as the server-side notifier. If the source completion comment is
  generic, too short, technical, or agent-facing, the plugin expands
  `Що зроблено` into a 150-250 word Ukrainian explanation and filters raw
  phrases such as `Review Decision`, `Final Manager Decision`, artifact paths,
  and `global_search_volume` from the Telegram text.
- 2026-05-18 update: `formatIssueDone` no longer exposes the raw issue title as
  `Задача` for internal workflow issues. It now sends short Ukrainian
  human-facing fields `Тема`, `Що сталося`, and `Далі`, with explicit mappings
  for owner approval gates, article briefing, article draft, and article
  validation issues. This prevents messages such as `HIA: owner approval gate
  for Stage 55...` and `Stage 55 briefing...` from reaching Telegram.
- `worker.js` enriches issue-done events from `ctx.companies.get(...)` and
  `ctx.issues.get(...)` so the formatter has `companyName` and `projectName`.

Current smoke examples:

```text
✅ Готово: AST-754
Компанія: Astrogen
Тема: Погодження статей
Що сталося: Ваше рішення зафіксовано. Погоджені теми можна передавати в роботу.
Далі: Команда готує матеріали для написання статей. Від вас зараз нічого не потрібно.
```

```text
✅ Готово: AST-755
Компанія: Astrogen
Тема: Підготовка статей
Що сталося: Підготовлено робочі брифи для погоджених статей: що писати, під які запити, з якою логікою сторінки.
Далі: Автори готують тексти, потім вони проходять перевірку перед вашим переглядом.
```

Deployment note:
- This is a live installed-plugin override, not a change in the main Paperclip
  server bundle.
- Reinstalling or upgrading `paperclip-plugin-telegram` may overwrite the
  patched `dist` files.
- When the Telegram plugin source is moved into the main repo, port this
  hotfix into source and remove this operational override.
