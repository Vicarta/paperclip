# Google Drive Docs Agent Tools

Server-side Paperclip adapter for Google Drive and Google Docs.

Agents use this plugin to create or update Google Docs without seeing OAuth
credentials. The intended workflow is:

1. Agent prepares a final HTML document body.
2. Agent calls `google_doc_create_from_html`.
3. Plugin imports the HTML as a Google Docs document in an allowed Drive folder.
4. Agent stores the returned `documentId` and `documentUrl` on the issue.
5. Agent sends a short Telegram or email notification through the configured channel.

## Configuration

Required:

- `googleServiceAccountJsonSecretRef` - Paperclip secret with Google service
  account JSON.

Recommended:

- `defaultFolderId` - Drive folder where documents are created.
- `allowedFolderIds` - folder allowlist. If present, agents cannot write outside
  these folders.
- `defaultShareType`, `defaultShareRole`, `defaultShareEmailAddress`,
  `defaultShareDomain` - controlled sharing defaults.

The target Drive folder must be shared with the service account email.

## Tools

- `google_drive_docs_health_check`
- `google_doc_create_from_html`
- `google_doc_get`
- `google_doc_share`
- `google_doc_replace_all_text`
- `google_doc_batch_update`
- `google_doc_export`

## Agent Rules

- Do not put service-account JSON, OAuth tokens, or Drive secrets in prompts,
  comments, issue documents, or Telegram messages.
- Use `google_doc_create_from_html` for newly generated articles and reports.
- Store the returned `documentId` and `documentUrl` on the issue as delivery
  evidence.
- For RSS/news workflows, keep RSS acquisition in a separate provider adapter.
  This plugin is only the document delivery layer.
- HTML must not include scripts, JavaScript URLs, or tracking snippets.
