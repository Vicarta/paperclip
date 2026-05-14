# Phase 17: Plugin Standardization And Secrets Vault Migration

Date: 2026-05-15  
Status: Completed first production pass

## Goal

Move Astrogen's live Paperclip plugin layer from the Phase 16 compatibility patch state to the current Paperclip plugin standard, and move operational secrets into the Paperclip Secrets/provider-vault model where supported.

This phase must not change semantic-core business policy, client portal UX, or content strategy. It is a technical foundation phase.

## Context

Phase 16 made the `v2026.513.0` runtime safe for production by forward-porting live code and validating live plugin compatibility:

- live/custom plugin packages were included in the production image build;
- live plugins that write provider costs still use canonical `costs.write`;
- Bright Data tool shape was adjusted for the new runtime;
- portal and SEO ops code was forward-ported into the release source;
- all 12 live plugins booted successfully.

That is compatibility, not full modernization. Phase 17 should remove avoidable compatibility debt without weakening cost attribution.

## Scope

### 1. Plugin Inventory And Ownership

Create a current plugin inventory for Astrogen production:

- plugin key;
- package name/path;
- owner/use case;
- enabled company settings;
- secrets/config references;
- capabilities;
- database/schema usage;
- managed agents/routines/folders, if any;
- UI/API surfaces;
- current compatibility exceptions.

Do not print or store secret values.

### 2. New Plugin Contract Target

Define the target standard for live plugins:

- use current capability names correctly: `costs.write` for canonical cost ledger rows, `metrics.write` for operational plugin metrics;
- use documented SDK worker entrypoints and validators;
- declare scoped API/UI/database surfaces explicitly;
- use plugin-managed resources where the plugin owns agents, routines, folders, or local project folders;
- use scoped database namespaces/migrations where plugin-owned persistence is needed;
- avoid host-level ad hoc route patches unless the route is intentionally core Paperclip;
- keep client-safe API contracts separated from internal agent/plugin payloads.

### 3. Compatibility Bridge Removal Plan

For each plugin that still depends on compatibility behavior, decide:

- keep as-is temporarily;
- migrate plugin source now;
- replace bridge with a narrower adapter;
- upstream the local change;
- retire unused plugin surface.

Priority order:

1. `paperclip.semantic-core-mcp-agent-tools`
2. `paperclip.dataforseo-agent-tools`
3. `paperclip.serper-agent-tools`
4. `paperclip.search-console-mcp-agent-tools`
5. `paperclip-plugin-telegram`
6. `paperclip.seo-performance-loop`
7. remaining provider/integration plugins

### 4. Secrets And Vault Migration

Map operational secrets to Paperclip Secrets/provider-vault records:

- DataForSEO credentials;
- Serper API key;
- Semantic Core MCP service token/config;
- Search Console/GSC credentials and service bindings;
- Resend API key and sender config for portal auth;
- Telegram bot token/config;
- any portal service tokens used by Paperclip-owned APIs.

For each secret:

- identify current source (`.env`, plugin config, company setting, server env, external provider);
- identify desired Paperclip secret key;
- define company scope and plugin/agent access;
- verify access events/audit behavior;
- define rotation plan;
- preserve a rollback path.

Never copy plaintext secrets into Git, planning docs, issue comments, Telegram, or logs.

### 5. Staging Migration

Use a staging copy first:

1. backup production DB/config;
2. run plugin config migration against staging;
3. boot app with staging plugin volume;
4. verify all 12 plugins load;
5. verify secret resolution without printing values;
6. run semantic-core/DataForSEO/Serper/GSC dry-smoke where possible;
7. verify Telegram notification path remains single-owner and concise.

### 6. Production Rollout

Production rollout requires:

- DB backup;
- plugin volume/config backup;
- current image digest and rollback image recorded;
- no active critical heartbeat runs unless explicitly accepted;
- deployment window noted in the issue;
- post-deploy smoke for health, plugins, portal semantic-core endpoints, Telegram, and provider plugin config resolution.

## Out Of Scope

- Re-running semantic-core layers.
- Changing keyword acceptance/review policy.
- Changing client portal UI.
- Publishing new articles.
- Moving secrets to a third-party vault before Paperclip Secrets usage is stable.

## Acceptance Criteria

- Current plugin inventory exists and does not contain plaintext secrets.
- Every live plugin has a target-standard decision.
- Cost ledger writes are explicitly classified: keep `costs.write`/`ctx.costs.createEvent(...)` where the plugin reports billable provider spend; use `metrics.write` only for non-billing operational metrics.
- Astrogen provider and notification secrets have a Paperclip Secrets/provider-vault migration plan.
- Staging or production smoke, depending on mutation risk, proves plugin boot `12/12` and secret metadata/config resolution without exposing values. Separate staging remains mandatory before config model, schema, or secret-reference mutations.
- Production rollout checklist is ready before any live mutation.
- CTO/Observability contracts do not manually push stalled work; they rely on system recovery actions and create only technical remediation issues when needed.

## Verification

- `GET /api/health` returns `status=ok` and build provenance.
- Plugin loader reports `total=12`, `succeeded=12`, `failed=0`.
- DB query confirms plugin statuses are `ready`.
- Grep live contracts for forbidden manual recovery language.
- Secret smoke verifies presence/permission, not values.
- Semantic-core portal endpoints return 200 after rollout.
- Telegram plugin has one lifecycle notification path and no daily digest job.

## Rollback

Rollback must restore:

- previous app image;
- previous plugin volume/config;
- previous DB snapshot if schema/config migration is not backward-compatible;
- prior AGENTS.md contracts only if the new contract blocks valid technical work.

Do not roll back by editing secrets into plaintext env files unless explicitly approved as emergency remediation.

## Execution Notes

The first Phase 17 pass did not migrate provider vaults or company-scoped plugin settings. It completed the inventory, standardization decision, source cleanup, production deploy, and smoke checks.

Production image after this pass: `paperclip-app:v2026.513.0-phase17.1`.
