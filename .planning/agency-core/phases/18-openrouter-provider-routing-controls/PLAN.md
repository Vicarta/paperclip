# Phase 18: OpenRouter Provider Routing Controls

## Objective

Let Paperclip OpenRouter agents configure provider routing explicitly, so a company can set model `z-ai/glm-5.2` and force a specific OpenRouter provider such as `cloudflare` without relying on default provider selection.

## Scope

- Add OpenRouter adapter runtime support for a sanitized `provider` request body object.
- Add create/edit UI controls for provider-only routing and fallback behavior.
- Preserve existing behavior when provider routing is not configured.
- Verify with adapter tests and TypeScript build.

## Acceptance Criteria

- An OpenRouter agent can be configured with:
  - `model: "z-ai/glm-5.2"`
  - `provider.only: ["cloudflare"]`
  - `provider.allow_fallbacks: false`
- Runtime sends the OpenRouter chat completion payload with that `provider` object.
- Runtime omits `provider` when no supported provider routing fields are configured.
- UI can set provider-only slugs and fallback behavior without raw JSON.
- Tests cover forced provider routing.

## Verification

- `pnpm --filter @paperclipai/adapter-openrouter test`
- `pnpm --filter @paperclipai/adapter-openrouter build`
- UI TypeScript coverage via package or app build if required by compiler.

## Result

- Implemented and deployed to production image `paperclip-app:v2026.529.0-vicarta.38-openrouter-provider-routing`.
- Local verification passed:
  - `pnpm --filter @paperclipai/adapter-openrouter test`
  - `pnpm --filter @paperclipai/adapter-openrouter build`
  - `pnpm --filter @paperclipai/ui typecheck`
- Production smoke passed:
  - app health `ok`;
  - plugin loader `total=14`, `succeeded=14`, `failed=0`;
  - built UI assets contain the `Provider only` OpenRouter field.
