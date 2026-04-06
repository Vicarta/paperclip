# Adapters Catalog And OpenRouter Plan

Date: 2026-04-06

## Goal

Add a first-class adapter catalog/settings surface to the Paperclip UI and add a first-class `openrouter_local` adapter without breaking the current adapter architecture.

## Constraints

- Do not hide adapter configuration behind per-agent pages only.
- Do not store provider keys in the frontend.
- Do not create a semantic-only UI shell with no server reflection behind it.
- Do not duplicate a whole runtime stack if the existing `opencode_local` runtime can be reused safely.

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

## Deliverables

1. Instance-level adapters catalog/settings UI.
2. Structured server API for adapter reflection suitable for UI consumption.
3. First-class `openrouter_local` adapter wired into server, UI, onboarding, and validation.
4. Tests covering adapter reflection and OpenRouter adapter basics.

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

### Phase 5 — Testing
- [x] Add unit coverage for adapter reflection API.
- [x] Add unit coverage for OpenRouter model filtering / discovery behavior.
- [x] Run targeted typecheck/build for touched packages.
- [ ] Run at least one UI-level smoke test for the adapters page.

## Current Status

- Local implementation is complete for the new adapter catalog surface and first-class `openrouter_local` adapter.
- Targeted local tests/builds/typechecks are green for shared/server/ui/openrouter-local.
- Live server rebuild is complete and the new reflection routes exist (`/api/adapters`, `/api/adapters/:type`), but direct curl verification without session returns `403`, which is expected for authenticated deployments.
- Remaining verification work:
  - authenticated UI smoke on `/AST/instance/settings/adapters`;
  - regression check that existing adapters (`Exa`, `Bright Data`, `Serper`, `DataForSEO`) still behave correctly after the new packaging changes.

## Definition Of Done

- There is a visible `Adapters` section in `Instance Settings`.
- The UI no longer forces operators to discover adapter config only through a specific agent page.
- `openrouter_local` can be selected as a first-class adapter in the UI.
- Structured adapter reflection comes from the server registry, not a duplicated hardcoded list.
- Tests pass for the touched platform surfaces.
