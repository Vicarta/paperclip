# Phase 2 Summary: SEO Ops Postgres Schema

## Status

Implemented on 2026-05-05.

## What Changed

- Added the shared `seo_ops` Postgres schema to Paperclip DB through Drizzle.
- Added migration `0050_stale_black_cat.sql`.
- Added durable tables for:
  - sites, project scopes, discovered pages, project pages, scope conflicts;
  - semantic-core runs, keywords, observations, clusters, memberships, semantic segments;
  - page keyword targets and rank tracking policies/targets;
  - Serper-backed SERP snapshots, top-result rows, and rank observations;
  - GSC/page performance snapshots;
  - new-page opportunities;
  - AI answer-engine visibility targets and observations;
  - page action events.
- Exported the new schema from the DB package.
- Updated backup/restore logic so `seo_ops` is included with `public` and optional `drizzle` data.
- Added backup test coverage proving `seo_ops` schema data is restored.

## Critical Notes

- Google SERP position collection is modeled as Serper-backed provider evidence, but this phase does not implement the Serper runner itself.
- Canonical SERP rank rows live in `seo_ops.serp_rank_observations`, not in GSC performance snapshots.
- Rank tracking frequency is policy-driven and supports company/project/tier contexts.
- Nullable uniqueness is handled with explicit `identity_key` columns where plain Postgres unique constraints would be unsafe.
- AI visibility storage is present, but answer-engine provider collection is intentionally out of scope for this phase.

## Verification

- `pnpm --filter @paperclipai/db typecheck`
- `pnpm --filter @paperclipai/db build`
- `pnpm --filter @paperclipai/db exec vitest run src/backup-lib.test.ts`
- `pnpm --filter @paperclipai/db exec vitest run`

All passed.
