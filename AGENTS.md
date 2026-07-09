Створюючи SSH ключ завжди використовуй passphrase.

Не патчити файли через складні inline shell-команди з вкладеними `ssh`, `docker exec`, `sh -lc`, Markdown/backticks, `<...>` або `$VAR`. Для таких змін спочатку скопіюй файл локально або відкрий його, внеси зміну через `apply_patch`, потім поверни файл назад; так уникаєш shell-quoting помилок і випадкового розкриття змінних.

Репозиторій має верхньорівневий workspace root:

- `local-paperclip/` - Paperclip source tree.
- `.planning/` - agency-core and per-client planning state.
- `ops/` - operational deployment snippets and examples.

Не додавай у Git runtime/cache/secret-risk артефакти з `.tmp/`, `.playwright-cli/`, `.screenshots/`, `output/`, `node_modules/` або plaintext secrets.
