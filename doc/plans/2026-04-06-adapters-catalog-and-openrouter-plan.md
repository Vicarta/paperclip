# Adapters Catalog And OpenRouter Plan

Date: 2026-04-06

## Goal

Add a first-class adapter catalog/settings surface to the Paperclip UI, add a first-class `openrouter_local` adapter without breaking the current adapter architecture, and introduce a real company-level adapter settings layer so provider credentials do not have to live in per-agent configs.

## Constraints

- Do not hide adapter configuration behind per-agent pages only.
- Do not store provider keys in the frontend.
- Do not create a semantic-only UI shell with no server reflection behind it.
- Do not duplicate a whole runtime stack if the existing `opencode_local` runtime can be reused safely.
- Do not mislabel a local CLI wrapper as if it were already a direct external HTTP adapter.

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

## Deliverables

1. Instance-level adapters catalog/settings UI.
2. Structured server API for adapter reflection suitable for UI consumption.
3. First-class `openrouter_local` adapter wired into server, UI, onboarding, and validation.
4. Company-level adapter settings persistence and UI for provider-backed adapters, starting with OpenRouter credentials.
5. Tests covering adapter reflection, adapter settings persistence, and OpenRouter adapter basics.

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

### Phase 6 — Testing
- [x] Add unit coverage for adapter reflection API.
- [x] Add unit coverage for adapter settings persistence route.
- [x] Add unit coverage for adapter-config merge semantics.
- [x] Add unit coverage for OpenRouter model filtering / discovery behavior.
- [x] Run targeted typecheck/build for touched packages.
- [ ] Run at least one authenticated UI-level smoke test for the adapters page.

## Current Status

- Local implementation is complete for the adapter catalog, the first-class `openrouter_local` wrapper, and the new company-level adapter settings layer.
- Targeted local tests/builds/typechecks are green for the touched server/ui/shared surfaces.
- Live server now has:
  - `/api/adapters` and `/api/adapters/:type`
  - `/api/companies/:companyId/adapters/:type/settings`
  - the `adapter_company_settings` table migrated in Postgres
- The current UI smoke gap is specifically authenticated browser verification. Browser automation opened a separate unauthenticated profile and was redirected to `/auth`, so visual confirmation still requires a real board session in that browser context.
- Remaining verification work:
  - authenticated UI smoke on `/AST/instance/settings/adapters/openrouter_local`;
  - regression check that existing adapters (`Exa`, `Bright Data`, `Serper`, `DataForSEO`) still behave correctly after the new packaging changes.
  - design and implement a future true external `openrouter` HTTP adapter instead of overloading the semantics of `openrouter_local`.

## Definition Of Done

- There is a visible `Adapters` section in `Instance Settings`.
- The UI no longer forces operators to discover adapter config only through a specific agent page.
- `openrouter_local` can be selected as a first-class adapter in the UI.
- `openrouter_local` is clearly labeled as a local OpenCode-backed wrapper.
- OpenRouter provider auth can be configured once at the adapter/company layer and inherited by agents.
- Structured adapter reflection comes from the server registry, not a duplicated hardcoded list.
- Tests pass for the touched platform surfaces.
