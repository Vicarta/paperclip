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

For `createBlogPostDraft` and `updateBlogPostDraft`, agents can pass either:

- `content`: Payload Lexical JSON, passed through as-is;
- `markdown`: simple Markdown converted into a conservative Lexical document.

The Markdown converter intentionally supports only safe common structure:
headings, paragraphs, ordered lists, and unordered lists. More complex content
should be passed as Payload-ready `content`.

## Safety

- Draft creation defaults to `_status: "draft"`.
- Updating a post also writes `_status: "draft"`.
- Publishing requires the separate `payload_cms_publish_blog_post` tool with
  `confirmPublish=true`.
- The plugin does not delete CMS content.
- The plugin does not write secrets to logs, issue comments, or Git.
