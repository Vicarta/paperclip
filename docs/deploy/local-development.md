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
- The app container is `paperclip-app-1`.
- The running Files plugin bundle is loaded from `/paperclip/plugins/plugin-file-browser-example/...` inside that container.

Implication:

- Updating `/home/paperclip/.../paperclip-src` alone does not guarantee that the already-running plugin bundle has changed.
- For urgent live verification, update the running plugin bundle in the container or its mounted Paperclip volume, then verify the served behavior on the server.
