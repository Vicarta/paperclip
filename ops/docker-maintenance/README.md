# Docker Maintenance

This directory records the server-side Docker cache policy used by Paperclip deployments.

## BuildKit Prune Policy

The timer runs:

```bash
docker buildx prune --force --reserved-space 10GB --filter until=168h
```

Rationale:

- Paperclip builds are large because they include monorepo Node dependency layers, build outputs, Docker image layers, and plugin package builds.
- BuildKit cache can grow into tens of gigabytes after repeated production builds.
- Keeping 10GB preserves useful recent cache while preventing disk exhaustion.

## Manual Preflight

Before a large rebuild, run:

```bash
sudo /usr/local/sbin/docker-rebuild-preflight
```

The preflight reports disk capacity, Docker image/container/volume/cache usage, compose projects, and the largest Docker volumes. It fails if root free space is below the configured floor.
