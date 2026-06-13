# Google Docs Document Delivery Contract

This contract is reusable across companies.

## Purpose

Agents may create reviewable or publishable documents in Google Drive when the
company workflow needs a human-friendly artifact outside Paperclip issues. The
plugin is a delivery layer, not a content strategy or acquisition engine.

## Allowed Flow

1. A manager or specialist issue defines the document purpose, audience, source
   evidence, and destination profile.
2. A specialist agent prepares final HTML content.
3. The agent calls `google_doc_create_from_html`.
4. The agent records `documentId` and `documentUrl` on the Paperclip issue.
5. If sharing is needed, the agent calls `google_doc_share` using configured
   defaults or explicit approved parameters.
6. The agent sends a concise Telegram notice with `telegram_send_message`,
   including the Google Doc URL and issue ID for proof writeback.

## RSS/News Workflows

RSS/news scanning belongs to a separate acquisition service or plugin. That
service should return normalized news items with source URLs, timestamps,
dedupe keys, summaries, and any risk/compliance flags.

The Google Docs plugin must not:

- crawl RSS feeds;
- decide whether a news item is worth publishing;
- create Paperclip issues by itself;
- store long-term editorial state.

Paperclip owns orchestration, decisions, issue lifecycle, document URLs, and
Telegram delivery proof.

## Agent Rules

- Never paste Google service-account JSON, OAuth tokens, Telegram bot tokens, or
  private RSS credentials into prompts, comments, issue documents, or Telegram.
- Use safe HTML only. Do not include scripts, inline tracking snippets, or
  JavaScript URLs.
- Store the Google Doc URL as a durable issue artifact.
- Telegram must be written for the business owner, not for a Paperclip engineer.
- If the document is a decision package, keep the durable review surface in the
  Google Doc or issue document; Telegram is only the short notification channel.
