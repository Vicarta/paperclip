# Phase 16: Paperclip Plugin Compatibility Upgrade

## Problem

The live Paperclip update attempt to upstream `v2026.513.0` was rolled back because the new Paperclip runtime is not compatible with the current live plugin ecosystem.

Observed blockers from the 2026-05-14 deployment attempt:

- upstream release source does not include the local/custom plugin package roots required by the live deployment;
- plugin secret references are disabled in the release runtime until company-scoped plugin config lands;
- legacy plugin manifests use capability values that the new runtime rejects, for example `costs.write`;
- copied legacy plugin workers cannot resolve `@paperclipai/plugin-sdk` in the new release image layout;
- the running app still lacks deterministic release provenance, so the CTO release-check routine cannot compare live vs GitHub releases reliably.

This phase exists to make the plugin/runtime contract explicit and testable before the next production deploy.

## Goal

Prepare Paperclip so the next server update can move to the selected upstream release without breaking plugins, Telegram notifications, semantic-core MCP integration, or client portal APIs.

Success means:

- all live plugins have a known packaging path for the new release image/runtime;
- all plugin manifests validate against the new runtime schema;
- all required plugin secrets/config values resolve through an approved model;
- the new app image exposes deterministic release provenance;
- a staging/smoke boot proves `plugin-loader` succeeds for all live plugins before production cutover;
- the next production deploy has a smaller, explicit go/no-go checklist.

## Scope

In scope:

- live Paperclip app on `ubuntu-oc.tailbd4e1c.ts.net`;
- `/home/paperclip/apps/paperclip`;
- current 12 live Paperclip plugins;
- plugin manifests, package roots, worker build outputs, and runtime resolution;
- plugin secret/config reference handling;
- deterministic health/provenance fields;
- pre-production plugin boot smoke;
- GSD/Paperclip issue evidence for the compatibility gate.

Out of scope:

- changing Astrogen semantic-core policy or client decisions;
- changing the standalone client portal except smoke-testing its Paperclip API reads;
- updating MCP server behavior unless a plugin adapter contract requires a small compatibility change;
- modifying `/path/to/seo-dashboard`;
- storing plaintext secrets in Git, planning docs, logs, or issue comments.

## Current Plugin Inventory To Audit

The last post-rollback smoke showed 12 ready plugins:

- `paperclip-file-browser-example`
- `paperclip-plugin-telegram`
- `paperclip.bright-data-agent-tools`
- `paperclip.dataforseo-agent-tools`
- `paperclip.diskinternals-bigquery-growth`
- `paperclip.exa-agent-tools`
- `paperclip.perfex-crm-agent-tools`
- `paperclip.search-console-mcp-agent-tools`
- `paperclip.semantic-core-mcp-agent-tools`
- `paperclip.seo-performance-loop`
- `paperclip.serper-agent-tools`
- `paperclip.winning-structure-mcp-agent-tools`

Each plugin needs a compatibility record with:

- plugin key and current DB id;
- source/package root on the current image;
- whether it is upstream, local/custom, or legacy-copied;
- manifest file path and declared capabilities;
- worker entrypoint and runtime dependencies;
- config keys used;
- secret references used, without secret values;
- external services touched;
- company scope expectations;
- expected boot log line or health behavior;
- smoke command or endpoint, where safe.

## Execution Plan

### 1. Reconfirm Baseline

1. Verify live app is still healthy after the rollback:
   - `/api/health`;
   - app container image;
   - DB status;
   - active heartbeat runs;
   - plugin registry.
2. Confirm there are no active semantic-core/import runs that would make a staging smoke noisy.
3. Record current DB migration state and whether migrations `0049`-`0084` are considered accepted baseline or require DB restore before the next deploy.

Deliverable:

```text
.planning/company/astrogen/phases/16-paperclip-plugin-compatibility-upgrade/PLUGIN_BASELINE.md
```

### 2. Build The Plugin Compatibility Matrix

For each live plugin:

1. Read plugin DB row and current registry metadata.
2. Inspect current package root in the old image.
3. Inspect release runtime expectations in the selected upstream source.
4. Classify the plugin:
   - works as-is;
   - needs manifest migration;
   - needs package inclusion;
   - needs secret/config migration;
   - needs worker dependency/layout fix;
   - should be disabled or replaced.
5. Document a per-plugin go/no-go decision.

Deliverable:

```text
.planning/company/astrogen/phases/16-paperclip-plugin-compatibility-upgrade/PLUGIN_COMPATIBILITY_MATRIX.md
```

### 3. Decide Plugin Packaging Model

Choose one production model and document the reason.

Preferred direction:

- build-time inclusion of local/custom plugins into the Paperclip production image;
- no ad hoc copying into containers after build;
- versioned plugin source roots or release overlay directory;
- plugin boot test runs against the final image layout.

Alternative allowed only with explicit reason:

- runtime-mounted plugin directory with checksum/version manifest.

Reject:

- manually copying legacy plugin roots into a release source without dependency and manifest validation.

Deliverable:

```text
.planning/company/astrogen/phases/16-paperclip-plugin-compatibility-upgrade/PLUGIN_PACKAGING_DECISION.md
```

### 4. Migrate Plugin Manifests

1. Validate every plugin manifest against the new runtime.
2. Replace unsupported capability values such as `costs.write` with the supported new capability model.
3. Preserve the intended permission boundary; do not broaden plugin capabilities just to pass validation.
4. Add a local manifest validation command/script if the release runtime does not expose one directly.

Acceptance criteria:

- manifest validation passes for all plugins intended to remain enabled;
- unsupported capability values are gone;
- disabled/deferred plugins have an explicit reason.

### 5. Resolve Plugin Secrets And Config

1. Inventory secret references by path/key only, never secret values.
2. Determine whether the upstream company-scoped plugin config model is available and sufficient.
3. If available:
   - migrate plugin config to company-scoped records;
   - verify no plaintext exposure in logs or issues.
4. If not available:
   - implement or carry a narrow compatibility layer for existing secret refs;
   - restrict it to server-side plugin config resolution;
   - document sunset conditions.

Acceptance criteria:

- Telegram can resolve bot credentials without plaintext logging;
- provider plugins can resolve API credentials without plaintext logging;
- plugin boot no longer fails because secret references are disabled;
- the selected approach is documented as permanent or temporary.

### 6. Fix Worker Dependency Resolution

1. Ensure each plugin worker can resolve `@paperclipai/plugin-sdk` and its runtime dependencies in the final image layout.
2. Prefer workspace-aware build/install over copied `dist` folders without dependencies.
3. Add a worker import smoke where possible:

```text
node -e "import('<worker-entrypoint>')"
```

Acceptance criteria:

- every enabled plugin worker imports in the release image environment;
- plugin package roots are present in the final image or mounted runtime path;
- no plugin depends on accidental node_modules state from the old image.

### 7. Add Deterministic Runtime Provenance

The live app must expose enough data for CTO release checks.

Required fields, via `/api/health` or equivalent:

- release tag;
- git commit SHA;
- build time;
- source URL;
- image digest or OCI labels if practical.

Acceptance criteria:

- CTO can compare live release vs GitHub release without inference from Docker timestamps;
- `[AST-726](/AST/issues/AST-726)` can be closed only after live or staging evidence proves the endpoint.

### 8. Staging Or Pre-Production Boot Test

Before touching production app again:

1. Build the candidate image.
2. Start a staging/smoke container against a copied or explicitly safe DB strategy.
3. Verify:
   - app boots;
   - migrations behavior is known;
   - `plugin-loader` reports all intended plugins succeeded;
   - plugin registry has no unexpected `error`;
   - Telegram starts or safe dry-run validates config;
   - Semantic Core, DataForSEO, Serper, Search Console, Winning Structure, Exa, Bright Data, Perfex, File Browser, SEO Performance Loop load as expected.
4. If using production DB for smoke, do not run destructive or client-visible actions.

Acceptance criteria:

- staging/smoke produces `plugin-loader: loadAll complete` with expected plugin count and zero failures;
- smoke artifacts are recorded in the phase folder;
- production deploy is not attempted if staging plugin boot fails.

### 9. Production Update Readiness Gate

Create a final go/no-go checklist before another production deploy:

- fresh backup plan;
- DB migration/rollback decision;
- app image tag and digest;
- plugin matrix green for all enabled plugins;
- secret/config model verified;
- health provenance verified;
- portal API smoke list ready;
- Telegram smoke approach ready;
- rollback commands verified.

Deliverable:

```text
.planning/company/astrogen/phases/16-paperclip-plugin-compatibility-upgrade/UPDATE_READINESS.md
```

## Required Verification

Run these checks before marking the phase complete:

- live baseline: app health ok, 12/12 plugins ready, no active heartbeat runs;
- release image build succeeds;
- manifest validation succeeds for every enabled plugin;
- worker import smoke succeeds for every enabled plugin;
- secret/config resolution smoke succeeds without printing secrets;
- staging/smoke app boot succeeds;
- `plugin-loader` succeeds for all enabled plugins in the candidate image;
- health/provenance endpoint returns deterministic release data;
- semantic-core portal endpoints return client-safe payloads;
- Telegram plugin starts or passes safe dry-run;
- final local repo state is clean after committing planning/code changes.

## Risks

- Some plugin incompatibilities may require upstream Paperclip changes rather than deployment overlay patches.
- Company-scoped plugin config migration may require DB/schema work and careful secret handling.
- Old app is currently running against migrations `0049`-`0084`; full DB rollback might become riskier as new live data accumulates.
- A plugin may be technically loadable but semantically incompatible with the newer runtime API.
- A staging container against production DB can accidentally mutate state if not constrained.

## Non-Negotiables

- Do not store plaintext secrets in Git, planning docs, issue comments, shell history summaries, or logs.
- Do not modify the `seo-dashboard` project.
- Do not disable production plugins silently to make the release look green.
- Do not re-run production deploy until plugin boot is proven before cutover.
- Do not close `[AST-726](/AST/issues/AST-726)` until deterministic live or staging provenance is observable.

## Completion Criteria

This phase is complete when there is a documented, tested, and reproducible path to run the selected upstream Paperclip release with the current plugin set, or when a smaller explicitly approved plugin set is documented with business impact and rollback plan.

After completion, create or reopen a production deploy phase that reuses the Phase 16 artifacts instead of repeating discovery during maintenance.
