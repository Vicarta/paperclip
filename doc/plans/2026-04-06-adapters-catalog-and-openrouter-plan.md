# Adapters Catalog And OpenRouter Plan

Date: 2026-04-06

## Goal

Add a first-class adapter catalog/settings surface to the Paperclip UI, keep `openrouter_local` as a clearly labeled OpenCode-backed local preset, and add a separate first-class external `openrouter` adapter for direct HTTP execution against OpenRouter. Provider credentials must remain server-side and reusable through company-level adapter settings.

## Constraints

- Do not hide adapter configuration behind per-agent pages only.
- Do not store provider keys in the frontend.
- Do not create a semantic-only UI shell with no server reflection behind it.
- Do not duplicate a whole runtime stack if the existing `opencode_local` runtime can be reused safely.
- Do not mislabel a local CLI wrapper as if it were already a direct external HTTP adapter.
- Do not collapse runtime adapters and model providers into one ambiguous label.

## Diagnosis

- Paperclip already has strong adapter internals:
  - server adapter registry;
  - model discovery endpoints;
  - environment test endpoints;
  - adapter configuration docs via `/llms/agent-configuration/:adapterType.txt`.
- Paperclip does **not** currently expose a dedicated adapter catalog/settings page in the UI.
- Agent-level adapter configuration exists, but it is discoverable only through the agent detail page.
- `opencode_local` already provides the best current runtime shape for multi-provider `provider/model` routing.
- There is no first-class `openrouter_local` adapter today.
- There is no company-level adapter settings persistence layer today, so provider auth has to be duplicated in agent configs.
- A direct external OpenRouter HTTP adapter is architecturally different from an OpenCode-backed local wrapper and should not be faked by naming alone.
- Model discovery and environment tests must also honor company-level adapter settings; otherwise saved provider credentials do not affect the adapter settings page where operators expect them to work.

## Deliverables

1. Instance-level adapters catalog/settings UI.
2. Structured server API for adapter reflection suitable for UI consumption.
3. First-class `openrouter_local` adapter wired into server, UI, onboarding, and validation.
4. Company-level adapter settings persistence and UI for provider-backed adapters, starting with OpenRouter credentials.
5. Tests covering adapter reflection, adapter settings persistence, and OpenRouter adapter basics.
6. Adapter settings behavior that actually affects model discovery and adapter environment tests.
7. A true external `openrouter` adapter separated from `openrouter_local` in server registry, UI, onboarding, and labels.

## Execution Plan

### Phase 1 — Adapter Reflection API
- [x] Add a structured API endpoint for listing installed adapters.
- [x] Add a structured API endpoint for adapter detail by type.
- [x] Include at minimum:
  - `type`
  - `label`
  - `supportsLocalAgentJwt`
  - `agentConfigurationDoc`
  - static/fallback models when present
- [x] Reuse existing registry as the single source of truth.

### Phase 2 — Instance Settings UI
- [x] Add an `Adapters` entry under `Instance Settings`.
- [x] Add a catalog page that lists adapters with:
  - label
  - type key
  - short runtime classification
  - quick navigation into adapter detail
- [x] Add an adapter detail page that shows:
  - configuration doc
  - available models
  - whether local JWT support exists
  - links/actions to create or reconfigure agents with that adapter
- [x] Make this page clearly separate from plugin settings.

### Phase 3 — OpenRouter Adapter
- [x] Create `@paperclipai/adapter-openrouter-local`.
- [x] Reuse `opencode_local` execution/session/parsing behavior where safe.
- [x] Make the adapter first-class in:
  - shared adapter enums
  - server registry
  - UI registry
  - onboarding/new-agent flows
  - agent labels/maps
  - issue override support where appropriate
- [x] Limit model discovery to `openrouter/*` models from the underlying OpenCode discovery path.
- [x] Provide adapter-specific docs and labels so this is not merely an alias in the UI.

### Phase 4 — Packaging And Runtime Wiring
- [x] Add workspace importer coverage.
- [x] Update lockfile/package references if needed.
- [x] Update Docker deps-stage so the adapter is available in container builds.
- [ ] Verify no activation regression for existing adapters.

### Phase 5 — Adapter Settings Layer
- [x] Add a persistent company-level adapter settings layer in the backend.
- [x] Merge company-level adapter settings into runtime adapter config before agent-specific overrides.
- [x] Add an adapter settings API under the authenticated board/company surface.
- [x] Add a concrete settings form for OpenRouter credential binding on the adapter detail page.
- [x] Keep OpenRouter credentials server-side via Paperclip secrets, not plain frontend persistence.
- [x] Clarify in labels/docs that `openrouter_local` is an OpenCode-backed local wrapper, not yet a direct HTTP adapter.

### Phase 5.1 — Settings-Aware Discovery And Diagnostics
- [x] Feed company-level adapter settings into server-side model discovery routes.
- [x] Feed company-level adapter settings into adapter environment tests before per-request overrides.
- [x] Tighten UI copy so `openrouter_local` reads as a local OpenCode runtime preset, not a direct external HTTP runtime.
- [x] Add regression coverage for company adapter settings affecting models/test-environment routes.

### Phase 6 — Testing
- [x] Add unit coverage for adapter reflection API.
- [x] Add unit coverage for adapter settings persistence route.
- [x] Add unit coverage for adapter-config merge semantics.
- [x] Add unit coverage for OpenRouter model filtering / discovery behavior.
- [x] Run targeted typecheck/build for touched packages.
- [x] Run at least one authenticated UI-level smoke test for the adapters page.

### Phase 7 — Direct External OpenRouter Adapter
- [x] Create `@paperclipai/adapter-openrouter` as a direct HTTP adapter.
- [x] Keep `openrouter_local` as a separate OpenCode-backed local runtime.
- [x] Add `openrouter` to shared adapter enums, labels, creation flows, and adapter registry.
- [x] Classify `openrouter` as `Remote API` in the adapter catalog/detail UI.
- [x] Reuse company-level `OPENROUTER_API_KEY` settings for both `openrouter` and `openrouter_local`.
- [x] Add direct OpenRouter model discovery/tests using raw provider/model identifiers (no `openrouter/` prefix).
- [x] Deploy and smoke-test both adapter detail pages live.

## Current Status

- Local and live implementation is complete for:
  - the adapter catalog/detail UI;
  - the company-level adapter settings layer;
  - the direct external `openrouter` adapter;
  - the legacy-but-explicit `openrouter_local` OpenCode wrapper.
- Saved OpenRouter provider auth now affects the adapter page's model discovery and environment testing flows instead of only heartbeat execution.
- Targeted local tests/builds/typechecks are green for the touched server/ui/shared surfaces.
- Live server now has:
  - `/api/adapters` and `/api/adapters/:type`
  - `/api/companies/:companyId/adapters/:type/settings`
  - the `adapter_company_settings` table migrated in Postgres
- Remaining verification work:
  - regression check that existing adapters (`Exa`, `Bright Data`, `Serper`, `DataForSEO`) still behave correctly after the new packaging changes.
  - decide whether provider credentials should graduate from adapter-specific settings into a broader provider catalog/settings surface.

## Definition Of Done

- There is a visible `Adapters` section in `Instance Settings`.
- The UI no longer forces operators to discover adapter config only through a specific agent page.
- `openrouter` is available as a first-class external HTTP adapter.
- `openrouter_local` can be selected as a first-class adapter in the UI.
- `openrouter_local` is clearly labeled as a local OpenCode-backed wrapper.
- `openrouter` and `openrouter_local` are clearly distinguished in labels, descriptions, and detail-page copy.
- OpenRouter provider auth can be configured once at the adapter/company layer and inherited by agents.
- Structured adapter reflection comes from the server registry, not a duplicated hardcoded list.
- Tests pass for the touched platform surfaces.
