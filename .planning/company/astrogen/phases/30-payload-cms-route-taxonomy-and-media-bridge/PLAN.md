# Phase 30: Payload CMS Route Taxonomy And Media Bridge

## Problem

The `/solar` article delivery reached accepted text, layout, and image artifacts, but no CMS draft or Telegram draft-link notification was produced.

Root causes:
- Payload CMS has no `solar` blog category yet.
- The Payload CMS plugin's media upload used the generic plugin HTTP bridge, which serializes multipart `FormData` incorrectly and makes Payload report `No files were uploaded`.
- Agents need a supported path for newly approved product routes instead of blocking routine CMS delivery.

## Scope

- Add a Payload CMS plugin tool to find or create category/tag taxonomy terms.
- Let blog draft create/update resolve `categorySlug` / `categoryTitle` and optionally create the category with `ensureCategory=true`.
- Fix media upload so local cover images arrive as multipart files.
- Update Astrogen Stage 64/65 contracts so agents use the supported CMS path for new product routes.
- Deploy the plugin and rerun the blocked delivery through Paperclip agents, not by manually creating the draft outside the workflow.

## Acceptance Criteria

- `payload_cms_ensure_taxonomy_term` is available to agents.
- `payload_cms_create_blog_post_draft` can create a draft using a route category by slug/title when `ensureCategory=true`.
- `payload_cms_upload_media` uploads a real image file and returns a Payload media document.
- `/solar` delivery can proceed from prepared artifacts to a Payload CMS draft with cover image.
- Telegram receives only the CMS draft/admin URL and article title, not markdown/html/image attachments.
