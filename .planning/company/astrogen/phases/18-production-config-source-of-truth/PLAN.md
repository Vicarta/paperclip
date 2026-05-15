# Phase 18: Production Config Source Of Truth

## Intent

Create a sanitized Git source of truth for the live Paperclip production deployment so code, operational templates, plugin inventory, scheduled jobs, and secret references are reviewable in GitHub without leaking secrets or runtime data.

## Scope

- Add `ops/paperclip-production/` as the production config source-of-truth directory.
- Include sanitized compose and environment templates.
- Record plugin/job/secret-reference manifests.
- Add a live export script that emits drift-review CSVs without secret material.
- Update Astrogen roadmap/state after completion.

## Non-Goals

- Do not export plaintext secrets.
- Do not commit generated live snapshots.
- Do not replace live production compose automatically.
- Do not migrate external provider vaults in this phase.
- Do not rerun semantic-core generation.

## Acceptance Criteria

- `ops/paperclip-production/README.md` explains the source-of-truth workflow.
- Compose/env templates are present and contain placeholders only.
- Plugin, job, and secret manifests match the Phase 17 production baseline.
- Export script passes `bash -n`.
- Generated live export directory is git-ignored.
- Changes are committed and pushed to `Vicarta/paperclip`.
