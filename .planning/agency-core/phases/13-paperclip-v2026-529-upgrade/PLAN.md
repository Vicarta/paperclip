# Phase 13: Paperclip v2026.529.0 Upgrade And Future-Proof Update Structure

## Intent

Upgrade the live Paperclip deployment to the upstream `v2026.529.0` release line without losing current Astrogen/DiskInternals functionality, local plugins, production configuration, secrets references, routines, agent contracts, or operational fixes.

This phase is deliberately an upgrade-readiness and migration plan first. Do not deploy until the backup, drift, patch-port, and smoke gates below pass.

## Release Target

- Upstream release: `paperclipai/paperclip@v2026.529.0`
- Release commit: `911a1e8b0d24205acd5006e837a5c5e8c4bfb447`
- Release date: `2026-05-29`
- Current local source branch: `codex/upstream-v2026.403.0-convergence`
- Current local source HEAD: `324db68f2fee0b25437055c04f6ec48bb8cc69ed`
- Important Git fact: local convergence history and upstream `v2026.529.0` do not currently share a usable `git merge-base`; this must be treated as a controlled rebase/port operation, not a simple merge.

## Why This Upgrade Matters

The release brings features that directly match current Paperclip operating pain:

- Issue document inline annotations and comments for passage-specific review instead of detached issue comments.
- Company skills CLI/catalog management, making skills auditable and assignable instead of adapter-only mystery state.
- User-scoped sidebar membership for hiding irrelevant projects and agents.
- First-admin claim flow for fresh private deployments.
- Live Claude model discovery for Claude Local.
- Bundled plugins visible in the plugin manager.
- Tighter workspace lifecycle guarantees: finalize gates, no-remote-git enforcement, dependent wakes only after finalize.
- Accepted-plan decomposition exact-once guards, reducing duplicate child-task fan-out.

## Current Local Functionality That Must Survive

The upgrade must preserve or consciously replace these local capabilities:

- Telegram plugin behavior:
  - concise Ukrainian owner-facing messages;
  - no generic noisy `✅ Готово` fallbacks for internal/proof/diagnostic lanes;
  - escalation reply writeback and superseding;
  - attachment delivery groups;
  - delivery proof ledger with Telegram message ids.
- Payload CMS agent tools:
  - blog draft create/update;
  - media upload;
  - category/taxonomy ensure;
  - guarded publishing;
  - `articleContent.v1` ingestion.
- MCP plugin hardening:
  - Search Console MCP session close after Streamable HTTP calls;
  - shared MCP session close hygiene across plugins;
  - GA4/GSC allowlist additions;
  - request timeout settings;
  - provider cost ledger integration where present.
- SEO Ops schema and routines:
  - cost events;
  - indexing snapshots;
  - page findings;
  - weekly blog Telegram report;
  - CrawlObserver adapter.
- Agent/runtime fixes:
  - silent-noop detection;
  - deterministic stale actionable watchdog behavior;
  - child completion wakeups;
  - reassigned queued issue lock handling;
  - deferred wake/orphan handling;
  - AST-specific agent contracts and managed instruction bundles.
- UI removals/fixes:
  - legacy SEO Review UI removal;
  - current sidebar/project behavior should be reviewed against new membership features.

## Upgrade Strategy

### Track A — Freeze And Export Current Production State

1. Confirm live version and image:
   - app health;
   - Docker image tag;
   - server git/source path, if any;
   - plugin registry versions and package paths.
2. Export sanitized production config using `ops/paperclip-production/scripts/export-live-config.sh`.
3. Produce a full backup before deployment:
   - Postgres `pg_dump`;
   - Docker volume snapshot or tar of `/paperclip` data volume;
   - managed instruction bundle export;
   - plugin local package archive;
   - sanitized secret metadata only, never plaintext secrets.
4. Record backup locations and restore command in the phase execution log before proceeding.

### Track B — Reconcile Git, Production, And Upstream

1. Create a new upgrade branch from upstream tag:
   - `codex/paperclip-v2026.529.0-upgrade`
   - base: `v2026.529.0`
2. Because merge-base is missing/unusable, do not merge the old convergence branch directly.
3. Build a patch inventory from the current convergence branch:
   - classify each local commit as `already upstream`, `must port`, `replace with upstream feature`, `drop`, or `planning-only`;
   - pay special attention to Telegram, Payload CMS, MCP, SEO Ops, watchdog, and plugin runtime commits.
4. Port changes by topic in small commits:
   - one feature area per commit;
   - include tests/smoke notes per topic;
   - keep upstream directory layout intact.
5. Keep `.planning/`, `ops/`, and client planning assets outside the upstream source tree wherever possible so future upstream pulls do not conflict with local operating records.

### Track C — Future-Proof Project Structure

Prepare the repository so the next release is a predictable vendor-plus-overlay update:

1. Treat `local-paperclip/` as the upstream application source plus carefully reviewed local patches only.
2. Treat `ops/paperclip-production/` as the sanitized production source of truth:
   - compose template;
   - image tag;
   - plugin manifest;
   - routines manifest;
   - agent runtime manifest;
   - secret-reference manifest;
   - upgrade/rollback runbook.
3. Add or update an upgrade runbook under `ops/paperclip-production/` with:
   - preflight checklist;
   - backup commands;
   - patch inventory template;
   - test matrix;
   - staging deploy steps;
   - production deploy steps;
   - rollback steps;
   - post-deploy smoke.
4. Keep company-specific contracts in company repos (`astrogen-ukraine`, DiskInternals planning) and sync them through managed instruction bundles or documented deployment steps, not by hiding them inside ad hoc runtime state.
5. Keep local/custom plugins as explicit packages with manifests and tests. Do not patch plugin behavior only in production containers.

### Track D — Build And Test Gates

Run these before any production cutover:

1. Install/build:
   - package install from clean checkout;
   - server build;
   - UI build;
   - plugin package build.
2. Core tests:
   - unit tests for server services touched by local patches;
   - plugin tests for Telegram, Payload CMS, MCP connectors;
   - migration tests if DB schema changed.
3. Regression smoke:
   - health endpoint;
   - login/auth;
   - issue create/update/comment;
   - agent wake-on-demand;
   - child completion parent wake;
   - silent-noop recovery;
   - managed instruction bundle read/write;
   - project/agent sidebar membership basics;
   - document annotation creation/read if enabled.
4. Plugin smoke:
   - Telegram message-only issue notification;
   - Telegram escalation reply writeback;
   - Telegram delivery group with multiple files;
   - Payload CMS build state;
   - Payload media upload;
   - Payload draft create/update with `articleContent.v1`;
   - Search Console MCP call with session close;
   - CrawlObserver health/list/start dry-run if available;
   - Serper/DataForSEO cost event write where applicable.
5. Data safety smoke:
   - migrations apply once;
   - no secrets appear in logs or Git;
   - existing companies, agents, routines, plugins, and issue counts still load.

### Track E — Staging Cutover

1. Build image from the upgrade branch with an explicit tag, for example:
   - `paperclip-app:v2026.529.0-vicarta.1`
2. Run against a restored copy of production DB.
3. Verify:
   - migrations;
   - plugin registry;
   - routines;
   - managed instruction bundles;
   - Astrogen and DiskInternals issue boards;
   - no duplicate Telegram noise.
4. Run the smoke matrix.
5. Create a concise staging report with:
   - passed checks;
   - failed checks;
   - local patches retained/replaced/dropped;
   - release features enabled;
   - rollback readiness.

### Track F — Production Cutover

Proceed only after staging passes.

1. Put routine-heavy agents in a quiet window if needed; do not disable inbound Telegram unless testing requires it.
2. Take final DB/volume backup.
3. Update production compose image tag.
4. Pull/start new image.
5. Watch logs during startup and migrations.
6. Smoke:
   - health;
   - UI board load;
   - plugin manager;
   - Telegram non-noisy message;
   - Payload CMS draft/update;
   - MCP call session close;
   - agent assignment/wakeup.
7. Update `ops/paperclip-production/README.md`, manifests, and live-export baseline after successful cutover.

### Track G — Rollback

Rollback must be executable without improvisation:

1. Stop app container.
2. Restore previous image tag in compose.
3. If migrations are backward-compatible, start old image against current DB.
4. If not backward-compatible, restore DB backup and `/paperclip` data volume snapshot.
5. Verify health/UI/plugin load.
6. Record rollback reason and open a follow-up issue for the failed gate.

## Acceptance Criteria

- Upgrade branch exists and is based on `v2026.529.0`.
- Patch inventory documents every local commit/feature as retained, replaced, or dropped.
- Production config and plugin state are exported before deployment.
- Full DB and data-volume backups are recorded before deployment.
- Staging upgrade passes the smoke matrix.
- Production upgrade passes the smoke matrix.
- Astrogen active workflows still work:
  - CMO wake-on-demand;
  - Telegram owner-facing messages;
  - Payload CMS blog draft delivery;
  - GSC/GA4/CrawlObserver SEO operations;
  - new product SEO continuation.
- DiskInternals active workflows still load and do not lose routines/plugins.
- `ops/paperclip-production` is updated as source of truth after cutover.
- Future update runbook exists and describes the next release process without relying on memory.

## Non-Goals

- Do not redesign Astrogen content workflows in this phase.
- Do not migrate the client portal.
- Do not rotate secrets unless the smoke reveals a credential problem.
- Do not publish live CMS content as part of Paperclip upgrade testing.
- Do not expose the admin Paperclip deployment publicly.

## Known Risks

- Local convergence history does not merge cleanly into upstream tag.
- Production may already run a custom image whose source differs from the local branch and from upstream.
- Local plugins may depend on SDK internals changed by upstream.
- New workspace finalize gates may change timing for child issue wakeups.
- Company skills CLI may overlap with existing managed instruction bundle behavior; skill provenance must be audited before use.
- Release introduces sidebar membership behavior that may affect operator visibility of projects/agents.

## First Execution Step

Before touching code, create the patch inventory:

1. List local commits since the old convergence base.
2. For each commit, assign one of:
   - `already upstream`;
   - `port required`;
   - `replace by upstream feature`;
   - `drop`;
   - `planning/ops only`.
3. Only then create the upgrade branch from `v2026.529.0`.

