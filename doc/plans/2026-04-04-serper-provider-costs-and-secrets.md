# 2026-04-04 Serper Provider Costs And Secrets Plan

## Goal

Add a server-side Serper connector for Google search-result retrieval, keep all third-party provider keys in Paperclip secrets rather than frontend-visible config, and extend Paperclip cost reporting so external provider spend appears alongside model spend.

## Requirements

- `Serper.dev` must be usable for Google SERP retrieval through Paperclip agent tools.
- The raw `Serper` API key must never be stored in client-visible config or repo-tracked files.
- The same secret-handling rule must apply to other third-party providers such as Bright Data and DataForSEO.
- Paperclip costs should support provider-attributed external spend, not only model/token spend.
- The live server is the canonical verification target for user-facing runtime behavior.

## Implementation

1. Add a bundled `plugin-serper-agent-tools` plugin:
- custom settings page;
- Company Secrets-backed API key storage;
- server-side HTTP calls to `Serper.dev`;
- agent tool for Google result retrieval.

2. Extend plugin host capabilities:
- allow plugins to report provider-attributed cost events;
- surface provider cost breakdown in the Costs page.

3. Instrument provider plugins:
- `Serper` reports optional flat marginal cost per search;
- `Bright Data` reports optional flat marginal cost per invocation;
- future provider plugins such as DataForSEO must follow the same pattern.

4. Update docs:
- third-party provider keys belong in Company Secrets;
- plugin settings should persist only secret refs;
- external provider spend belongs in the Costs view.

## Validation

Repo validation:
- targeted plugin tests pass;
- server and UI typecheck pass.

Live validation:
- plugin is present in the live server;
- operator can configure provider keys through plugin settings;
- provider keys are stored as secret refs;
- provider-attributed costs appear in the Costs page when emitted.
