# DiskInternals Google Docs News Article Workflow

## Goal

DiskInternals will use a future news/RSS scanning server to discover relevant
news signals, then Paperclip agents will create reviewable HTML-formatted
Google Docs articles and notify the chosen Telegram group through a specified
bot profile.

## Boundary

The future RSS/news server is the acquisition layer. It should expose normalized
news items; it should not make Paperclip issue lifecycle decisions.

Paperclip owns:

- deciding whether a news item becomes an article candidate;
- creating and routing issues;
- generating the article HTML;
- creating/updating the Google Doc;
- sending Telegram notification through a configured profile;
- preserving document and Telegram delivery proof on the issue.

## Expected Server Output

The future news server should return normalized items with at least:

- `source_url`
- `source_name`
- `published_at`
- `title`
- `summary`
- `canonical_dedupe_key`
- `topic_tags`
- `product_relevance`
- `risk_flags`
- `language`

## Paperclip Workflow

1. CMO or a news-content manager checks normalized news candidates.
2. Agent filters candidates by DiskInternals product relevance, business value,
   and risk flags.
3. Agent creates or updates a Paperclip article issue.
4. Article agent writes the article as safe HTML for Google Docs.
5. Google Docs plugin creates the document in the configured Drive folder.
6. Agent stores `documentId`, `documentUrl`, source news IDs, and source URLs on
   the issue.
7. Telegram plugin sends the human-facing message through the configured
   DiskInternals news-docs profile.

## Human Notification Requirements

Telegram message must include:

- short article title;
- why the topic matters for DiskInternals;
- Google Doc link;
- what action is expected from the owner, if any.

Telegram message must not include:

- raw provider JSON;
- internal Paperclip run IDs unless needed for support;
- credentials or private source payloads.

## Activation Requirements

Before live use:

- create a Google service account and store its JSON as a Paperclip secret;
- share the target Drive folder with the service account email;
- configure `paperclip.google-drive-docs-agent-tools`;
- configure a Telegram `deliveryProfiles` entry for the DiskInternals news docs
  bot/chat/topic;
- provide the RSS/news server API contract and credentials as a separate plugin
  or MCP adapter.
