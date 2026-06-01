# Phase 32: Image Runtime Executor And Company Settings

## Goal

Make Astrogen blog cover-image generation a reliable agent-owned runtime lane:

- image provider/model are configured at company level;
- provider execution has a dedicated specialist agent;
- `prepared_only` provider requests cannot be mistaken for generated images;
- ordinary image-runtime gaps are not routed to the owner, CTO, or CMS fixer.

## Problem

The Tarot beginner article lane produced a valid Stage 65 prompt and
`provider-request.json`, but no `hero-image.png`. The downstream route sent the
failure to unrelated agents because there was no narrow runtime owner with the
OpenRouter secret injected.

Existing successful Stage 65 bundles prove the intended provider path:

- provider: `openrouter`;
- model: `google/gemini-3.1-flash-image-preview`;
- endpoint: OpenRouter chat completions image mode.

The missing piece is configuration ownership and runtime assignment.

## Scope

1. Add company-level image generation settings to Astrogen reference files.
2. Let the image execution helper read credential env from the settings file.
3. Add `SEO Blog Image Runtime Executor` as the narrow execution role.
4. Update CMO/Stage 65 contracts so cover image generation routes to that role.
5. Live-sync the updated contracts and create/configure the live Paperclip agent.
6. Create a live issue to execute the pending Tarot Stage 65 bundle through the
   new agent.

## Out Of Scope

- Manually generating the Tarot image outside Paperclip.
- Changing article text.
- Changing Payload CMS content directly.
- Moving provider secrets into Git.

## Acceptance

- `docs/reference/image-generation-settings.json` defines the default image
  provider/model/credential env without secret material.
- The execution helper supports `credentialEnv` in settings JSON.
- Local provider-execution regression test passes.
- Live Paperclip has a `SEO Blog Image Runtime Executor` with
  `OPENROUTER_API_KEY` injected from the existing `openrouter-api-key` company
  secret.
- Current Tarot image bundle is assigned to that agent for execution, not to
  CTO, CMS fixer, or the owner.
