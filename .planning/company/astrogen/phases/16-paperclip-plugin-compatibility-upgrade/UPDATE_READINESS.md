# Update Readiness

Date: 2026-05-14  
Target release: `v2026.513.0`  
Candidate tag: `paperclip-app:v2026.513.0-phase16`

## Status

Phase 16 compatibility gate is green in staging and the candidate image has been promoted to production.

## Candidate Image Evidence

```text
Image ID: sha256:035cdccbc45c52b304f9425d3a61b1c5bdaeb4c506c9466e8194d1a7c5066daf
org.opencontainers.image.version: v2026.513.0-phase16
org.opencontainers.image.revision: f4bed4a70f34551ffd4c7c76cf8d8be2ae761d74
org.opencontainers.image.source: https://github.com/paperclipai/paperclip/releases/tag/v2026.513.0
```

## Green Checks

- Candidate image builds successfully.
- Server package builds successfully.
- DB package builds successfully with the live `seo_ops` schema forward-ported.
- Live plugin packages build successfully.
- Staging app boots against a copied production DB and isolated staging volume.
- Staging plugin loader reports `12` total, `12` succeeded, `0` failed.
- Staging Astrogen portal semantic-core endpoints return 200.
- Unauthenticated/private health now exposes deterministic build provenance.
- Temporary staging DB/env/volume were removed after smoke.
- Production app was promoted to `paperclip-app:v2026.513.0-phase16`.
- Production health now exposes `build.releaseTag=v2026.513.0`.
- Production plugin loader reports `12` total, `12` succeeded, `0` failed.
- Production Astrogen portal semantic-core endpoints return 200.

## Known Carry-Forwards

- The release source was patched with local Paperclip portal and SEO ops code that existed in the live source tree but not in the upstream release source. This needs to remain part of the production deploy artifact or be upstreamed before future release updates.
- The `ctx.costs.createEvent` compatibility bridge is intentionally temporary.
- The app package version still reports `version=0.3.1`; release comparison should use `build.releaseTag`, not package version.
- CTO weekly release checks can now use `build.releaseTag`, `build.gitRevision`, and `build.sourceUrl` instead of Docker timestamps.

## Production Deploy Completed

Completed production deploy sequence:

1. Reconfirm production health and plugin readiness.
2. Take a fresh DB backup and record current app image digest.
3. Promoted the verified candidate image from the patched release source.
4. Preserved a rollback anchor for the old image.
5. Verified health provenance, plugin loader `12/12`, Telegram readiness, and Astrogen portal endpoints.

Rollback remains available if delayed issues appear.

## Production Rollback Anchor

Previous production app image digest:

```text
sha256:8dbdc26ee03c673a2e88532a01f0eaaa97fc9e25df4444f13b50cc60b66553f7
```
