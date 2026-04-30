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
- `worker.js` enriches issue-done events from `ctx.companies.get(...)` and
  `ctx.issues.get(...)` so the formatter has `companyName` and `projectName`.

Deployment note:
- This is a live installed-plugin override, not a change in the main Paperclip
  server bundle.
- Reinstalling or upgrading `paperclip-plugin-telegram` may overwrite the
  patched `dist` files.
- When the Telegram plugin source is moved into the main repo, port this
  hotfix into source and remove this operational override.
