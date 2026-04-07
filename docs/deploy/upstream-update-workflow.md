---
title: Upstream Update Workflow
summary: Standard workflow for syncing the Vicarta fork with paperclipai/paperclip
---

This repository should track three git remotes:

- `upstream` -> `git@github.com:paperclipai/paperclip.git`
- `origin` -> the main Vicarta fork
- `public-gh` -> the alternate Vicarta push remote when needed

Use this workflow whenever Paperclip must absorb a newer upstream release or upstream `master`.

## Principles

- Treat `upstream` as the canonical source for new Paperclip releases.
- Keep Vicarta-specific changes as an explicit patch layer on top of upstream.
- Do not deploy server-only hotfixes without landing the same change in git first.
- Run schema migrations and deploy only after the integration branch is green locally.

## Standard Flow

1. Fetch the latest upstream state:

```sh
git fetch upstream --tags
git fetch origin
```

2. Create a dedicated integration branch from the current Vicarta default branch:

```sh
git checkout main
git pull --ff-only origin main
git checkout -b codex/upstream-sync-YYYYMMDD
```

3. Merge the target upstream state into the integration branch:

```sh
git merge --no-ff upstream/master
```

If a tagged upstream release is the review anchor, inspect it first:

```sh
git tag -l "v*"
git show vX.Y.Z --stat
```

4. Resolve conflicts while reviewing Vicarta-specific features explicitly:

- adapters catalog UI
- direct `openrouter` adapter
- plugin/provider billing attribution
- prompt-template policy and heartbeat protocol hardening
- workspace/file-tree hygiene changes

5. Run the verification gate before any deploy:

```sh
pnpm --filter @paperclipai/shared typecheck
pnpm --filter @paperclipai/db typecheck
pnpm --filter @paperclipai/server typecheck
pnpm --filter @paperclipai/ui typecheck
pnpm --filter @paperclipai/plugin-serper-agent-tools exec vitest run --config ./vitest.config.ts
pnpm --filter @paperclipai/plugin-bright-data-agent-tools exec vitest run
pnpm --filter @paperclipai/plugin-dataforseo-agent-tools exec vitest run --config ./vitest.config.ts
pnpm exec vitest run server/src/__tests__/heartbeat-run-summary.test.ts ui/src/lib/inbox.test.ts
```

6. Inspect pending DB migrations before deploy:

```sh
pnpm --filter @paperclipai/db exec tsx src/migration-status.ts
```

7. Deploy from the canonical server checkout only after the integration branch is green:

- sync the repo to the canonical server tree
- apply pending DB migrations
- rebuild and restart `paperclip-app`
- run smoke tests for health, adapters, plugins, and billing

8. After validation:

- push the integration branch to `origin`
- open a PR
- merge into `main`
- fast-forward the server checkout to the merged commit

## Deploy Smoke Checklist

- `/api/health` returns `ok`
- adapter catalog loads
- plugin settings pages load and save
- `Costs` page shows USD values consistently
- a heartbeat run can create a `cost_event` with `costUsd`
- budget enforcement still pauses agents when monthly USD budgets are exceeded

## Notes

- If `origin` push is blocked by key permissions, use `public-gh` temporarily for branch publication, but keep `origin` as the intended default remote.
- This document is for integrating upstream into the Vicarta fork. Release publishing still follows [doc/RELEASING.md](/Users/savitsky/CodexProjects/paper-clip/local-paperclip/doc/RELEASING.md).
