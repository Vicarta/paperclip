# Phase 18 Summary: Production Config Source Of Truth

## Done

- Added `ops/paperclip-production/` as the sanitized production source-of-truth package.
- Added production compose and env templates with placeholders only.
- Added manifests for plugins, plugin jobs, and secret references.
- Added `scripts/export-live-config.sh` for sanitized live drift exports.
- Protected generated `live-export/` output from accidental Git commits.

## Important Boundaries

- Git stores secret names and refs only, not secret values.
- Live DB rows are still production state. The export script is for review and drift detection, not automatic apply.
- Generated snapshots are intentionally not committed by default.

## Next Follow-Up

Implement company-aware plugin settings / secret resolution before changing shared MCP plugin secret refs, especially Semantic Core MCP.
