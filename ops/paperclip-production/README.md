# Paperclip Production Source Of Truth

This directory is the sanitized Git source of truth for the live Paperclip deployment.

It records deployable structure, plugin inventory, scheduled jobs, company-visible config shape, and secret references. It must not contain plaintext secrets, runtime dumps, caches, database backups, or generated artifacts.

## Current Baseline

- Production host: `ubuntu-oc.tailbd4e1c.ts.net`
- Compose directory: `/home/paperclip/apps/paperclip`
- App image: `paperclip-app:v2026.529.0-vicarta.38-openrouter-provider-routing`
- App health endpoint: `http://127.0.0.1:3200/api/health`
- Runtime exposure: private/Tailscale for Paperclip admin; client portal is separate.
- Database: `postgres:17-alpine`
- Plugin status at last smoke: `14` loaded, `14` succeeded, `0` failed.
- Current Git revision: `local-openrouter-provider-routing`

## Files

- `docker-compose.template.yml` - sanitized production compose template.
- `.env.example` - required environment variable names with placeholder values only.
- `manifests/plugins.md` - expected live plugin inventory.
- `manifests/jobs.md` - expected plugin-owned scheduled jobs.
- `manifests/secrets.md` - expected secret names/refs only, no values.
- `manifests/astrogen-agents.md` - sanitized Astrogen runtime policy for heartbeats and SEO blog article writer fallback.
- `scripts/export-live-config.sh` - exports a sanitized live snapshot for drift review.

## Update Rule

After production changes:

1. Update the relevant template or manifest in this directory.
2. Run `scripts/export-live-config.sh` and compare the generated snapshot manually.
3. Do not commit generated snapshot files unless explicitly requested.
4. Commit and push the source-of-truth update to `Vicarta/paperclip`.

## Secret Rule

Git may contain:

- secret names;
- secret reference keys;
- provider names;
- rotation requirements.

Git must not contain:

- secret material;
- token values;
- password values;
- private keys;
- DB backups;
- Paperclip local encrypted secret files;
- Docker volumes or cache files.

## Drift Review

The export script intentionally omits secret versions and encrypted material. If drift is found, decide whether Git or production is authoritative before changing either side.
