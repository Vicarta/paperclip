# Phase 15: Paperclip Server Release Update

## Problem

The Astrogen Paperclip server is not running the latest upstream Paperclip release.

Current evidence from 2026-05-14:

- live health endpoint: `/api/health` returns `version: 0.3.1`;
- live Docker image digest: `sha256:8dbdc26ee03c673a2e88532a01f0eaaa97fc9e25df4444f13b50cc60b66553f7`;
- live image created at: `2026-05-11T21:26:26Z`;
- local release notes in the deployed source end at `v2026.403.0`;
- latest upstream GitHub release is `v2026.513.0`, published `2026-05-13T22:24:48Z`;
- the running server does not expose the deployed Git tag or commit SHA, so future release checks cannot be fully deterministic.

The server also hosts active Astrogen work: Paperclip app/API, agents, routines, semantic-core review APIs, Telegram notification paths, and client portal integration. Updating without a rollback plan would be unsafe.

## Goal

Update the live Paperclip server to the latest approved GitHub release while preserving Astrogen work continuity.

The update must:

- make the deployed Paperclip version and provenance deterministic;
- back up all state needed for rollback before changing the app;
- deploy the selected release in a controlled maintenance window;
- verify Paperclip app, agents, routines, semantic-core APIs, Telegram notifications, and client portal read-through behavior;
- leave clear evidence in Paperclip issues and Astrogen GSD docs.

## Scope

In scope:

- server `ubuntu-oc.tailbd4e1c.ts.net`;
- Docker Compose project `paperclip`;
- source/build directory `/home/paperclip/apps/paperclip`;
- Postgres container `paperclip-db-1`;
- app container `paperclip-app-1`;
- Paperclip data volume `paperclip_paperclip_data`;
- Paperclip database volume `paperclip_paperclip_pgdata`;
- Astrogen Paperclip company data, agents, routines, and semantic-core APIs;
- CTO release-check routine and provenance follow-up `[AST-726](/AST/issues/AST-726)`.

Out of scope:

- updating MCP servers unless Paperclip compatibility requires it;
- changing client portal code unless smoke tests prove a Paperclip API contract regression;
- changing Astrogen semantic-core lifecycle decisions;
- auto-deploying future releases without explicit owner approval;
- modifying `/Users/savitsky/CodexProjects/seo-dashboard`.

## Release Target

Default target:

```text
paperclipai/paperclip release: v2026.513.0
release URL: https://github.com/paperclipai/paperclip/releases/tag/v2026.513.0
```

Before execution, re-check GitHub releases. If a newer stable release exists, stop and ask whether to target the newer release or stay pinned to `v2026.513.0`.

## Execution Plan

### 1. Preflight And Freeze

1. Announce an Astrogen/Paperclip maintenance window in the working thread before making changes.
2. Verify Tailscale access and server identity:
   - `hostname`;
   - `date -Is`;
   - `docker ps`;
   - `docker compose ls`.
3. Confirm there are no critical active Paperclip runs that should not be interrupted:
   - active `heartbeat_runs` with `status in ('queued','running')`;
   - open routine executions;
   - active semantic-core imports or client review decision writes.
4. If active runs exist:
   - wait when safe;
   - or explicitly pause the update and report the blocker.
5. Record current release facts:
   - `/api/health`;
   - image digest;
   - container start time;
   - compose file path;
   - current source directory listing and release notes tail.

### 2. Provenance Fix Gate

This update should close the current release-check weakness, not preserve it.

Before or during the release build, ensure the deployed app can expose at least one deterministic provenance field:

- release tag, for example `v2026.513.0`;
- git commit SHA;
- image build timestamp;
- image source URL.

Preferred outcome:

```json
{
  "version": "v2026.513.0",
  "commit": "...",
  "buildTime": "...",
  "releaseUrl": "https://github.com/paperclipai/paperclip/releases/tag/v2026.513.0"
}
```

If upstream already supports provenance, configure it through build args or environment variables. If it does not, create a minimal local deployment-level provenance file or env-backed health extension and document the deviation.

Do not close `[AST-726](/AST/issues/AST-726)` until a post-deploy `/api/health` or equivalent endpoint proves deterministic provenance.

### 3. Backup

Create a timestamped backup root:

```text
/home/paperclip/backups/paperclip-update-YYYYMMDDTHHMMSSZ/
```

Required backup artifacts:

- `docker-compose.yml`;
- `.env` metadata checksum only, not plaintext copy into Git or planning docs;
- current Paperclip image digest and `docker inspect` output;
- `paperclip-src` source directory archive or filesystem snapshot;
- Postgres logical dump:
  - custom format `pg_dump -Fc`;
  - plain schema-only dump;
  - role/database metadata if needed for restore;
- Paperclip data volume archive or at least targeted archive of:
  - `/paperclip/instances/default/config.json`;
  - `/paperclip/instances/default/data/run-logs`;
  - local encrypted secret provider metadata excluding plaintext secret values;
- current active issue/routine snapshot from DB:
  - companies;
  - agents;
  - routines and triggers;
  - open issues;
  - recent heartbeat runs;
  - semantic-core review batches/items summary.

Backup verification:

- `pg_restore --list` succeeds on the dump;
- archive files are non-empty;
- checksums are written to a local `BACKUP_MANIFEST.md`;
- restore notes are written before deployment begins.

### 4. Build Preparation

The current Compose setup builds from:

```text
/home/paperclip/apps/paperclip/paperclip-src
```

This directory is not currently a Git checkout. Therefore the update must use one of these controlled source paths:

1. Preferred: replace `paperclip-src` with a clean checkout/archive of the selected release tag.
2. Acceptable: create `paperclip-src-v2026.513.0`, build from it, then atomically repoint Compose build context.
3. Not acceptable: mutate the existing source tree without a full backup and without knowing the release provenance.

Build steps:

- fetch selected release source from GitHub;
- verify tag name and source checksum where possible;
- install/build with the repo's documented package manager;
- run available migration/typecheck/build smoke if feasible within the server environment;
- build Docker image with labels:
  - `org.opencontainers.image.version`;
  - `org.opencontainers.image.revision`;
  - `org.opencontainers.image.source`;
  - `org.opencontainers.image.created`.

### 5. Deployment

Deployment must be app-first and database-aware.

1. Stop only the Paperclip app container first if possible; keep Postgres running.
2. Build the new app image.
3. Start the app container.
4. Watch startup logs for:
   - migration execution;
   - auth/bootstrap readiness;
   - plugin loading;
   - workspace/runtime errors.
5. If migrations fail:
   - stop app;
   - preserve logs;
   - do not retry blindly;
   - decide rollback vs fix-forward based on the error.

### 6. Smoke Tests

Minimum server smoke:

- `GET /api/health` returns `status=ok`;
- health/provenance shows selected release or commit;
- board UI loads through Tailscale URL;
- database connection healthy;
- no app restart loop;
- no new fatal logs in first 5 minutes.

Paperclip control-plane smoke:

- list Astrogen company;
- list Astrogen agents;
- verify CEO, CTO, CMO not paused;
- verify CTO release-check routine exists and next run remains Tuesday 06:00 Europe/Kiev;
- create or read a harmless test context without changing semantic-core decisions.

Agent runtime smoke:

- trigger a safe CTO or Observability heartbeat if appropriate;
- confirm heartbeat moves from queued/running to succeeded or explicit blocked;
- ensure no silent-noop regression.

Semantic-core API smoke:

- `GET /api/portal/companies/astrogen/semantic-core`;
- `GET /api/portal/companies/astrogen/semantic-core/review`;
- `GET /api/portal/companies/astrogen/semantic-core/review-groups`;
- counts should remain explainable against pre-update snapshot;
- no internal labels or raw MCP payloads should leak through portal endpoints.

Client portal smoke:

- portal can call Paperclip read-through API;
- semantic-core page loads;
- counts match Paperclip API or any known UI-side grouping logic;
- no auth/session regression in the portal.

Telegram smoke:

- do not send noisy release notification unless the update routine requires it;
- verify notification path through an existing safe Paperclip notification route or inspect recent notification logs;
- if a test message is needed, mark it clearly as a test.

### 7. Rollback Plan

Rollback must be possible without guessing.

Fast rollback:

1. Stop new app container.
2. Restore previous Compose build context or retag/start previous image digest:
   `sha256:8dbdc26ee03c673a2e88532a01f0eaaa97fc9e25df4444f13b50cc60b66553f7`.
3. Start previous app.
4. Verify `/api/health`, UI, agents, and DB connectivity.

Database rollback:

- Use only if migrations or app behavior corrupt state or make old app incompatible.
- Stop app before DB restore.
- Restore from the timestamped `pg_dump -Fc`.
- Preserve failed-upgrade DB dump before overwriting for forensic comparison.

Rollback decision points:

- migration failure;
- app boot loop;
- auth broken;
- Paperclip cannot access companies/issues;
- agents cannot start;
- semantic-core portal endpoints broken;
- data integrity discrepancy after update.

### 8. Post-Deploy Closure

After successful update:

- update `[AST-726](/AST/issues/AST-726)` with provenance evidence and close it;
- rerun the weekly release-check routine once manually;
- if no newer release exists after update, no Telegram message is needed;
- if GitHub has advanced again during the maintenance window, send the configured Telegram update or ask before another update cycle;
- write final evidence into this GSD phase summary.

## Acceptance Criteria

- Paperclip app runs the selected release or newer owner-approved release.
- `/api/health` or an equivalent endpoint exposes deterministic release provenance.
- PostgreSQL backup and restore instructions exist before deployment.
- Previous Docker image/source path can be restored.
- Astrogen agents, routines, issues, and semantic-core APIs survive the update.
- Client portal read-through still works.
- CTO release-check routine can make a deterministic current-vs-latest comparison after the update.
- No plaintext secrets are written into Git or planning docs.

## Commands To Prepare During Execution

These are examples; fill timestamps and paths during execution.

```bash
BACKUP_ROOT=/home/paperclip/backups/paperclip-update-$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$BACKUP_ROOT"

docker inspect paperclip-app-1 > "$BACKUP_ROOT/paperclip-app.inspect.json"
cp /home/paperclip/apps/paperclip/docker-compose.yml "$BACKUP_ROOT/docker-compose.yml"

docker exec paperclip-db-1 pg_dump -U paperclip -d paperclip -Fc > "$BACKUP_ROOT/paperclip.pg_dump"
docker exec paperclip-db-1 pg_dump -U paperclip -d paperclip --schema-only > "$BACKUP_ROOT/paperclip.schema.sql"

pg_restore --list "$BACKUP_ROOT/paperclip.pg_dump" > "$BACKUP_ROOT/paperclip.pg_dump.list"
```

## Risks

- New migrations may be non-backward-compatible with the old app.
- Existing `paperclip-src` is not a Git checkout, so provenance must be restored deliberately.
- Agents may be interrupted if active heartbeat runs are not drained first.
- Client portal may depend on Paperclip portal API DTO details.
- Telegram notifications may be noisy if release-check logic is triggered at the wrong time.

## Required Human Gate

Do not start deployment until the owner explicitly approves:

- selected release tag;
- maintenance window;
- backup location;
- rollback approach.

