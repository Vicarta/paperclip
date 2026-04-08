---
title: Local Development
summary: Set up Paperclip for local development
---

Run Paperclip locally with zero external dependencies.

## Prerequisites

- Node.js 20+
- pnpm 9+

## Start Dev Server

```sh
pnpm install
pnpm dev
```

This starts:

- **API server** at `http://localhost:3100`
- **UI** served by the API server in dev middleware mode (same origin)

No Docker or external database required. Paperclip uses embedded PostgreSQL automatically.

## One-Command Bootstrap

For a first-time install:

```sh
pnpm paperclipai run
```

This does:

1. Auto-onboards if config is missing
2. Runs `paperclipai doctor` with repair enabled
3. Starts the server when checks pass

## Tailscale/Private Auth Dev Mode

To run in `authenticated/private` mode for network access:

```sh
pnpm dev --tailscale-auth
```

This binds the server to `0.0.0.0` for private-network access.

Alias:

```sh
pnpm dev --authenticated-private
```

Allow additional private hostnames:

```sh
pnpm paperclipai allowed-hostname dotta-macbook-pro
```

For full setup and troubleshooting, see [Tailscale Private Access](/deploy/tailscale-private-access).

## Health Checks

```sh
curl http://localhost:3100/api/health
# -> {"status":"ok"}

curl http://localhost:3100/api/companies
# -> []
```

## Reset Dev Data

To wipe local data and start fresh:

```sh
rm -rf ~/.paperclip/instances/default/db
pnpm dev
```

## Data Locations

| Data | Path |
|------|------|
| Config | `~/.paperclip/instances/default/config.json` |
| Database | `~/.paperclip/instances/default/db` |
| Storage | `~/.paperclip/instances/default/data/storage` |
| Secrets key | `~/.paperclip/instances/default/secrets/master.key` |
| Logs | `~/.paperclip/instances/default/logs` |

Override with environment variables:

```sh
PAPERCLIP_HOME=/custom/path PAPERCLIP_INSTANCE_ID=dev pnpm paperclipai run
```

## Canonical Worktree

The canonical local Paperclip tree is:

- `/Users/savitsky/CodexProjects/paper-clip/local-paperclip`

If an auxiliary worktree exists for feature isolation, treat it as temporary. Merge the branch back into the canonical tree and remove the extra worktree when the feature line is consolidated.

## Server-First Verification For User-Facing Changes

For user-facing Paperclip changes in this environment, local success is not sufficient.

Rules:

- Treat the live server as the canonical verification target for UI and plugin behavior.
- Commit the source change in the canonical local tree and push it to GitHub.
- If the user needs to verify the change immediately, deploy the built runtime artifact to the live server in the same work session.
- Do not report a Files plugin or similar UI fix as complete until the live server runtime has been updated.

Current deployment facts for this environment:

- The live Paperclip stack runs from `/home/paperclip/apps/paperclip/docker-compose.yml`.
- The canonical server checkout is `/home/paperclip/apps/paperclip/paperclip-src`.
- SSH access via the normal operator account does not have direct access to that tree; use `sudo bash -lc 'cd /home/paperclip/apps/paperclip/... && ...'` for checkout inspection, file sync, and `docker compose` actions.
- The app container is `paperclip-app-1`.
- The running Files plugin bundle is loaded from `/paperclip/plugins/plugin-file-browser-example/...` inside that container.

Implication:

- Updating `/home/paperclip/.../paperclip-src` alone does not guarantee that the already-running plugin bundle has changed.
- For urgent live verification, update the running plugin bundle in the container or its mounted Paperclip volume, then verify the served behavior on the server.

## Canonical Server Tree

For this server environment, keep exactly one active Paperclip source tree:

- `/home/paperclip/apps/paperclip/paperclip-src`

Operational rules:

- `docker-compose.yml` must build from `./paperclip-src`.
- Do not keep a second active deploy checkout such as `paperclip-src-*` alongside the canonical tree.
- Do not rely on a persistent Compose override file to point the app at an alternate source tree for normal operation.
- If you need temporary isolation for risky work, create a temporary checkout only long enough to validate the change, then either:
  - merge it back into the canonical branch and promote it to `/home/paperclip/apps/paperclip/paperclip-src`, or
  - archive it outside the active deploy path.

Applied remediation on `2026-04-04`:

- The temporary deploy tree `paperclip-src-codex-serper` was promoted into the canonical path `/home/paperclip/apps/paperclip/paperclip-src`.
- The previously active dirty tree was preserved at:
  - `/home/paperclip/apps/paperclip/archived-checkouts/paperclip-src-pre-single-tree-20260404-184348`
- The temporary override file was archived at:
  - `/home/paperclip/apps/paperclip/archived-checkouts/docker-compose.codex-serper.override-20260404-184348.yml`
- The live app was rebuilt and restarted with plain:
  - `docker compose -f docker-compose.yml up -d --build app`
- The canonical Compose service name for the Paperclip web/server container is `app`.

Verification target after this remediation:

- `paperclip-app-1` should report Compose config files:
  - `/home/paperclip/apps/paperclip/docker-compose.yml`

Implication:

- If a future deploy requires an alternate checkout, treat that as an exceptional migration step, not as a steady-state deployment model.
- When consolidating, preserve the displaced tree under `archived-checkouts/` before replacing the canonical path so no in-progress work is lost.

## Live Server Backup Growth

For the current Paperclip server environment, large growth in `paperclip_paperclip_data` is expected unless backup retention is tuned.

Observed on `2026-04-03`:

- Docker volume `paperclip_paperclip_data` was about `15.85GB`.
- Almost all of that space lived under `/paperclip/instances/default/data/backups`.
- The live instance `config.json` had no explicit `backup` block, so backup cadence was coming from runtime defaults.
- The live server had about `205` SQL backup files in that directory.
- `docker builder prune` reclaimed about `11.3GB` of build cache outside the named volume.

Applied remediation on `2026-04-03`:

- Added an explicit live config block:
  - `backup.intervalMinutes = 180`
  - `backup.retentionDays = 7`
- Restarted `paperclip-app-1` so the new policy was loaded.
- Pruned backup files older than 7 days.
- Thinned the remaining 7-day backlog to one snapshot per 3-hour bucket so the existing backup set matched the new cadence.

After remediation:

- `paperclip_paperclip_data` dropped from about `15G` to about `6.0G`.
- `/paperclip/instances/default/data/backups` dropped to about `5.5G`.
- Total backup file count dropped to `76`.
- Docker build cache dropped to `0B`.

Implication:

- The main volume growth source is scheduled SQL backups, not plugin files, logs, or workspace directories.
- If the instance stores rich conversation history and artifacts, hourly backups with 30-day retention can grow quickly.

Operational guidance:

- When server disk usage looks unexpectedly high, inspect `/paperclip/instances/default/data/backups` before blaming the main Paperclip runtime.
- If the current recovery target does not require 30 days of hourly snapshots, add an explicit `backup` block in the live instance config instead of relying on hidden defaults.
- After changing retention policy, prune old backups explicitly or wait for the next backup cycle to prune files older than the new window.
- If you change cadence from hourly to a wider interval, consider thinning the recent backlog too; otherwise disk usage will stay inflated until enough time passes naturally.

## Upstream Sync

For integrating newer changes from the original `paperclipai/paperclip` repository into this fork, follow
[Upstream Update Workflow](/Users/savitsky/CodexProjects/paper-clip/local-paperclip/docs/deploy/upstream-update-workflow.md).

## Live App Memory Headroom

Observed on `2026-04-04` during a live Astrogen SEO workflow test:

- `paperclip-app-1` restarted unexpectedly while `CMO` and `Semantic Core Strategist` runs were active.
- The server log showed:
  - `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory`
- The crash happened around the default Node heap ceiling of roughly `2GB`, which caused active heartbeat runs to be reaped as orphaned with `process_lost`.

Applied remediation:

- Set `NODE_OPTIONS=--max-old-space-size=4096` for the Paperclip server container in `docker-compose.yml`.

Implication:

- Long-running live agent tests, especially when the UI is polling multiple company pages and logs at once, need more headroom than the default Node heap.
- If `process_lost` appears on otherwise healthy runs after heavy UI activity, check for an app-container OOM before blaming the agent contract or plugin tooling.
