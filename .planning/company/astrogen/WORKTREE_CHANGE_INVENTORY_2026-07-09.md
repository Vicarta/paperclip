# Worktree Change Inventory - 2026-07-09

Purpose: make the current dirty workspace understandable before committing,
reverting, or doing more live Paperclip changes.

## Current Snapshot

- Branch: `codex/upstream-v2026.403.0-convergence`.
- Git status after removing empty accidental root files:
  - `local-paperclip`: 2093 status entries.
  - `.planning`: 41 status entries.
  - `ops`: 7 top-level status entries, including untracked directories.
  - `AGENTS.md`: 1 modified file.
  - `raid_recovery_revised_with_hero_v2a.md`: 1 untracked root content artifact.
- `local-paperclip` diff size, excluding untracked files:
  - 830 files changed.
  - 173809 insertions.
  - 50042 deletions.

## Intentional Astrogen Clean Source Changes

These files/directories are part of the Astrogen clean Paperclip operating
system work and should be reviewed/committed together as the Astrogen package,
not mixed with old production or DiskInternals work:

- `.planning/company/astrogen/`
- `ops/paperclip-astrogen-clean/`
- `ops/docker-maintenance/`

Current tracked Astrogen planning modifications:

- `.planning/company/astrogen/EXECUTION_LOG.md`
- `.planning/company/astrogen/PAPERCLIP_USER_GUIDE.md`
- `.planning/company/astrogen/REQUIREMENTS.md`
- `.planning/company/astrogen/ROADMAP.md`
- `.planning/company/astrogen/STATE.md`
- `.planning/company/astrogen/agent-contracts/seo-blog-article-layout-editor/AGENTS.md`
- `.planning/company/astrogen/agent-contracts/seo-blog-article-layout-validator/AGENTS.md`
- `.planning/company/astrogen/phases/14-seo-blog-content-waves/SUMMARY.md`
- `.planning/company/astrogen/phases/34-gsc-crawlobserver-seo-decision-queue/PLAN.md`
- `.planning/company/astrogen/process/68-seo-blog-article-layout.md`

Current untracked Astrogen planning additions include phases 35-45, CMO and
SEO CMS Technical Fixer agent contracts, content/audience planning documents,
and the pending LLM-routine context-efficiency todo.

## Live Runtime Changes Already Made

These live clean Paperclip changes were intentional and should remain
source-backed:

- Clean Paperclip app: `paperclip-astrogen-clean-app-1`.
- Clean Paperclip URL: `http://127.0.0.1:3210` and Tailscale exposure on port
  `3210`.
- Live app image observed on 2026-07-09:
  `paperclip-app:v2026.626.0-vicarta.49-portal-semantic-core-20260708T1555Z`.
- `ops/paperclip-astrogen-clean/.env.example` was updated to match that live
  image tag.
- Production DB backup before Phase 45 live edits:
  `/home/paperclip/backups/phase45-serp-refresh-20260709T104754Z/paperclip.dump`.
- Live routine revisions updated for:
  - `Astrogen article slot allocator`.
  - `Weekly Astrogen SEO/GEO action cycle`.
- Live agent instructions updated for Phase 45 SERP/value-gap workflow.
- Live health check after restart was OK.

Source backing for these live changes should be:

- `ops/paperclip-astrogen-clean/manifests/agents.yaml`
- `ops/paperclip-astrogen-clean/manifests/routines.yaml`
- `ops/paperclip-astrogen-clean/manifests/workflows.yaml`
- `ops/paperclip-astrogen-clean/scripts/bootstrap-astrogen-growth-os.mjs`
- `.planning/company/astrogen/phases/45-serp-value-gap-content-refresh/`

## Paperclip Source Drift

`local-paperclip` is not a small live hotfix. It is a large upstream convergence
state on the `codex/upstream-v2026.403.0-convergence` branch:

- 764 modified files.
- 66 deleted files.
- 1263 untracked files.
- Major affected areas: `ui`, `server`, `packages`, `cli`, `docs`, `scripts`.

Do not treat this as routine Astrogen runtime noise. It needs its own review and
commit strategy as a Paperclip upstream upgrade/convergence change set.

Known source-backed hotfix inside this larger drift:

- `local-paperclip/server/src/services/documents.ts` now exposes legacy aliases
  for issue documents:
  - `content`
  - `revisionId`

This matches the clean app live hotfix that restored compatibility for agents
reading document artifacts. Because this file sits inside the large upstream
convergence diff, do not commit it casually as an isolated Astrogen change
without reviewing the surrounding document-service changes.

## Other Non-Astrogen Changes

These are real changes but should not be mixed into the Astrogen clean package:

- `.planning/agency-core/`
  - Durable no-LLM heartbeat preflight.
  - Paperclip v2026.618/v2026.626 upgrade migration planning.
  - SEO performance loop shared process updates.
- `.planning/company/diskinternals/`
  - DiskInternals internal-linking and news/Google Docs planning.
- `ops/paperclip-production/`
  - Old production deployment/manifests updates.
- `ops/paperclip/Dockerfile.paperclip`
  - Shared/old Paperclip image build changes.
- `raid_recovery_revised_with_hero_v2a.md`
  - Untracked DiskInternals content artifact currently at repo root.

## Cleanup Already Done

Removed empty accidental root files:

- `404`
- `Stage`
- `validation`

Closed source/runtime drift:

- Updated `ops/paperclip-astrogen-clean/.env.example` from the old clean image
  tag to the live clean image tag.

No tracked files were reverted.

## Ordering Rules From Here

1. Keep Astrogen clean changes, old production changes, DiskInternals changes,
   and Paperclip upstream convergence in separate commits or separate review
   batches.
2. Do not patch live containers without recording the source-of-truth change in
   manifests, bootstrap scripts, or Paperclip source.
3. Do not commit runtime/cache/secret-risk artifacts from `.tmp/`,
   `.playwright-cli/`, `.screenshots/`, `output/`, `node_modules/`, or plaintext
   secret files.
4. Do not stage `local-paperclip` wholesale until the upstream convergence set
   is reviewed as its own workstream.
5. If a live DB setting is changed manually, record the backup path, exact target
   routine/agent/plugin, and source-backed file that makes the change durable.

## Recommended Next Cleanup Batches

1. Astrogen clean package review:
   `.planning/company/astrogen/`, `ops/paperclip-astrogen-clean/`,
   `ops/docker-maintenance/`, and this inventory.
2. Paperclip source convergence review:
   all `local-paperclip` changes, including the document-service alias hotfix.
3. Old production review:
   `ops/paperclip-production/` and `ops/paperclip/Dockerfile.paperclip`.
4. DiskInternals planning/content review:
   `.planning/company/diskinternals/` and
   `raid_recovery_revised_with_hero_v2a.md`.
