# Phase 21: Blog Image And Telegram Package Delivery

## Goal

Make blog article delivery complete by default: every owner-ready article package should include publishable markdown, publishable HTML, and a Stage 65 hero image before Telegram/editorial delivery.

## Context

Wave 1 articles reached Stage 64 packaging on [AST-788](/AST/issues/AST-788), but images were not generated. Older Astrogen workflows had Stage 64/65/Telegram delivery tasks, so this was a workflow regression rather than a missing capability.

## Decisions

1. Do not regenerate article text when only images are missing.
2. Treat Stage 65 hero image generation as part of the article package, not as an optional future enhancement.
3. Keep Telegram lifecycle notifications short and plugin-owned.
4. Treat article package delivery as an explicit package-delivery step with an audit trail.
5. Use Paperclip Secrets for bot/provider credentials; never place token values in planning, comments, logs, or Git.

## Implemented Recovery

- Updated the live Stage 64, Stage 65, and CMO contracts so article packaging requires a Stage 65 image bundle unless waived by the owner.
- Generated three Stage 65 image bundles for Wave 1 from existing Stage 64 markdown files.
- Created [AST-791](/AST/issues/AST-791) as the delivery issue.
- Attached markdown, HTML, and image artifacts for all three articles.
- Delivered the packages to Telegram with one summary message and three article media groups.

## Required Hardening

1. Move file bundle sending fully into the Telegram plugin or a dedicated package-delivery plugin path.
2. Ensure a Stage 64 issue cannot close as owner-ready when image generation is still missing.
3. Add a deterministic check for article packages:
   - markdown exists;
   - HTML exists;
   - Stage 65 image exists;
   - image QA status is `pass`;
   - delivery issue contains all expected attachments.
4. Add a clean operator-facing error when Telegram delivery is prepared but not actually sent.

## Acceptance Criteria

- A future blog wave produces article text, HTML, and images before owner editorial delivery.
- Telegram receives concise Ukrainian package messages with files attached.
- No image-only recovery regenerates article text.
- Paperclip issue comments contain the audit trail; Telegram messages remain short.
