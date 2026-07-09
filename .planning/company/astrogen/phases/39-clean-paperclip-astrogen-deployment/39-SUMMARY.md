# Phase 39: Clean Paperclip Astrogen Deployment - Summary

**Date:** 2026-07-02
**Status:** Complete

## Completed

- Added GSD planning artifacts for the clean Astrogen Paperclip deployment.
- Added sanitized ops templates under `ops/paperclip-astrogen-clean/`.
- Added Docker maintenance artifacts under `ops/docker-maintenance/`.
- Installed `/usr/local/sbin/docker-rebuild-preflight` on `ubuntu-oc`.
- Installed and enabled `docker-buildkit-prune.timer`.
- Created clean deployment directory:
  - `/home/paperclip/apps/paperclip-astrogen-clean`
- Created clean Astrogen workspace directory:
  - `/home/paperclip/companies/astrogen-clean`
- Generated server-only `.env` with fresh random Postgres/Auth secrets.
- Started separate compose project:
  - `paperclip-astrogen-clean`
- Verified clean Paperclip health:
  - `http://127.0.0.1:3210/api/health`
- Opened clean Paperclip on Tailscale MagicDNS:
  - `http://ubuntu-oc.tailbd4e1c.ts.net:3210`
- Verified old live Paperclip remains healthy:
  - `http://127.0.0.1:3200/api/health`
- Created and accepted a one-time bootstrap CEO invite for the clean instance.
- Created the single clean company:
  - Name: `Astrogen`
  - Prefix: `AST`
- Created one usable admin/owner login for the clean instance.
- Removed the temporary bootstrap user with unknown password so the clean instance has one user and one company.

## Runtime

- Existing Paperclip:
  - Project: `paperclip`
  - Port: `127.0.0.1:3200`
  - Health: `ok`
- Clean Astrogen Paperclip:
  - Project: `paperclip-astrogen-clean`
  - Ports: `127.0.0.1:3210`, `100.98.5.50:3210`
  - Browser URL: `http://ubuntu-oc.tailbd4e1c.ts.net:3210`
  - Health: `ok`
  - Bootstrap: `ready`
  - Bootstrap invite active: `false`
  - Company count: `1`
  - User count: `1`
  - Astrogen owner count: `1`

## Docker Maintenance

- Timer: `docker-buildkit-prune.timer`
- State: enabled and active
- Next run observed: 2026-07-05 03:30 UTC
- Policy:
  - `docker buildx prune --force --keep-storage 10GB --filter until=168h`

## Login

Access directly from a Tailscale-connected device:

```text
http://ubuntu-oc.tailbd4e1c.ts.net:3210
```

The raw Tailnet IP is bound at `100.98.5.50:3210`, but the browser URL should use MagicDNS because Paperclip host/origin guards are configured around the public URL.

SSH tunnel fallback:

```bash
ssh -L 3210:127.0.0.1:3210 oc_hermes
```

Then open:

```text
http://127.0.0.1:3210
```

Do not expose the clean instance publicly before a separate public exposure review.
