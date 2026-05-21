# Payload CMS Agent Tools

Server-side Paperclip plugin for Payload CMS blog operations.

## What It Does

- Reads Payload build state and access metadata.
- Finds blog posts by `id` or `slug`.
- Lists configured taxonomy collections: categories, tags, authors.
- Uploads media files to the configured media collection.
- Creates blog post drafts.
- Updates existing blog post drafts.
- Publishes existing blog posts only when `confirmPublish=true`.

The plugin keeps the Payload API key in Paperclip Secrets. Agents never receive
the plaintext key.

## Default Astrogen Settings

```json
{
  "payloadApiBaseUrl": "https://cms.astrogen.com.ua/api",
  "authCollectionSlug": "users",
  "blogPostsCollectionSlug": "blogPosts",
  "mediaCollectionSlug": "media",
  "categoriesCollectionSlug": "categories",
  "tagsCollectionSlug": "tags",
  "authorsCollectionSlug": "authors",
  "buildStateGlobalSlug": "buildState",
  "requestTimeoutMs": 60000
}
```

## Content Input

For `createBlogPostDraft` and `updateBlogPostDraft`, agents must pass article
text as `articleContent` with `schemaVersion: "articleContent.v1"`.

The plugin rejects raw Payload Lexical JSON, markdown, raw HTML, inline styles,
CSS classes, unsupported block types, and unsafe CTA URLs. Payload CMS performs
the final conversion from `articleContent.v1` into its visual Lexical content.

Allowed `articleContent.v1` block types:

- `paragraph`
- `heading` (`h2`, `h3`, `h4`)
- `list`
- `editorialCallout` (`soft`, `brand`, `situation`)
- `twoColumnText` (`text`, `list`)
- `quietCta`

## Safety

- Draft creation defaults to `_status: "draft"`.
- Updating a post also writes `_status: "draft"`.
- Draft creation and updates also force `workflowStatus: "draft"`.
- Publishing requires the separate `payload_cms_publish_blog_post` tool with
  `confirmPublish=true`.
- The plugin does not delete CMS content.
- The plugin does not write secrets to logs, issue comments, or Git.
