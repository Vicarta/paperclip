# Phase 39: Clean Paperclip Astrogen Deployment - Research

**Date:** 2026-07-02
**Status:** Complete

## What Matters

The clean instance should not be a copy of the current Astrogen production database. The goal is to establish a fresh Paperclip runtime where Astrogen can be rebuilt around deterministic workflows, company-scoped configuration, and strict token-cost controls.

## Server Baseline

- SSH access works through `oc_hermes`.
- `oc_hermes` is in the `sudo` group and has passwordless sudo.
- Docker Engine and Docker Compose are installed.
- Docker daemon access requires `sudo`.
- After BuildKit cleanup, `/` has 48G free out of 150G.
- Active Docker volumes are about 24.4G.
- Build cache is currently 0B.

## Existing Runtime

The existing live Paperclip runtime remains under:

- Compose project: `paperclip`
- Compose directory: `/home/paperclip/apps/paperclip`
- Host app port: `127.0.0.1:3200`
- Current image observed on server: `paperclip-app:v2026.626.0-vicarta.15-runtime-guards-telegram-20260701T095624Z`

This phase must not modify the existing compose project except for system-wide Docker maintenance policy.

## Clean Runtime Shape

Use a separate deployment directory and compose project:

- Directory: `/home/paperclip/apps/paperclip-astrogen-clean`
- Compose project: `paperclip-astrogen-clean`
- Host app port: `127.0.0.1:3210`
- Dedicated Postgres named volume.
- Dedicated Paperclip data named volume.
- Dedicated company workspace path under `/home/paperclip/companies/astrogen-clean`.

This isolates DB state, secrets, attachments, workspace files, and runtime data from the current multi-company Paperclip instance.

## Docker Cache Policy

BuildKit cache can grow quickly because Paperclip builds include Node package layers, monorepo build outputs, plugin builds, and repeated image tags. The observed 32G build cache is plausible and should be controlled rather than treated as exceptional.

Recommended policy:

```bash
sudo docker buildx prune --force --keep-storage 10GB --filter until=168h
```

Use a systemd timer so it is visible, auditable, and easy to disable.

## Manual Preflight

Before large rebuilds:

- show disk capacity;
- show Docker system usage;
- show BuildKit cache usage;
- list running compose projects;
- show largest Docker volumes;
- fail if free root disk is below the required threshold.

## Validation Architecture

Automated validation should verify:

- systemd timer is installed and enabled;
- preflight script runs successfully;
- clean compose validates;
- clean app and DB containers start;
- `/api/health` returns `status=ok` from `127.0.0.1:3210`;
- existing `paperclip` project remains running on `127.0.0.1:3200`;
- disk free space remains above a practical deployment floor after startup.

Human verification remains needed for:

- first board login/claim;
- creating the final single Astrogen company;
- deciding when to expose the clean instance through Tailnet/reverse proxy.
