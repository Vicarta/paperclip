# Payload CMS Agent Tools

Server-side Paperclip plugin for Payload CMS blog operations.

## What It Does

- Reads Payload build state and access metadata.
- Finds blog posts by `id` or `slug`.
- Lists configured taxonomy collections: categories, tags, authors.
- Finds or creates blog authors by `name`/`slug` before draft delivery.
- Uploads media files to the configured media collection with a unique uploaded
  filename, so Payload-generated responsive image variants do not collide when
  agents reuse generic local names like `hero-image-6.jpg`.
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
- `iconList` (`grid`, `compact`, `twoColumn`)
- `twoColumnText` (`text`, `list`)
- `quietCta`

`iconList` uses registry keys only. Do not send emoji, SVG, image URLs, file names,
or CSS classes as icons. See `docs/article-content-v1.md` for the registry and
examples.

## Safety

- Draft creation defaults to `_status: "draft"`.
- Updating a post also writes `_status: "draft"`.
- Draft creation and updates also force `workflowStatus: "draft"`.
- Publishing requires the separate `payload_cms_publish_blog_post` tool with
  `confirmPublish=true`.
- The plugin does not delete CMS content.
- The plugin does not write secrets to logs, issue comments, or Git.

## Author Mapping

Use `payload_cms_ensure_author` when an owner-provided or expert-authored
article must keep a specific CMS author. The tool searches by slug first, then
by name. If no author exists, it creates one using only supported Payload author
fields: `name`, `slug`, `bio`, `photo`, `roleTitle`, and `socialLinks`.

If `expertUrl` is provided, it is stored as a normal social link labeled
`Профіль експерта Astrogen`. Do not substitute a different author when the issue
requires a named expert author.
