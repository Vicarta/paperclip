Створюючи SSH ключ завжди використовуй passphrase.

Репозиторій має верхньорівневий workspace root:

- `local-paperclip/` - Paperclip source tree.
- `.planning/` - agency-core and per-client planning state.
- `ops/` - operational deployment snippets and examples.

Не додавай у Git runtime/cache/secret-risk артефакти з `.tmp/`, `.playwright-cli/`, `.screenshots/`, `output/`, `node_modules/` або plaintext secrets.

