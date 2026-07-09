# Phase 39: Clean Paperclip Astrogen Deployment - Context

**Gathered:** 2026-07-02
**Status:** Ready for planning and execution
**Source:** Owner request in Codex thread

<domain>
## Phase Boundary

Deploy a clean Paperclip instance for Astrogen on the existing `ubuntu-oc` server, independent from the current multi-company Paperclip runtime.

The new instance should be suitable for rebuilding Astrogen from scratch, without preserving old companies, historical issue chains, old agent contracts, or stale plugin configuration.

</domain>

<decisions>
## Implementation Decisions

### Locked Decisions

- The current Astrogen production copy does not need to remain the operational source while the new architecture is created.
- The clean Paperclip instance should ignore previously created companies and contain only the new Astrogen tenant after onboarding.
- The clean deployment must be isolated from the existing Paperclip runtime by compose project, volumes, environment, and host port.
- The existing server is acceptable if rights and disk capacity are sufficient.
- Docker build cache must have a regular pruning policy.
- Large rebuilds must have a manual preflight check before execution.
- Do not store plaintext secrets, runtime dumps, DB backups, Docker volumes, or generated cache artifacts in Git.

### Claude's Discretion

- Use a loopback-only app port for the first clean instance smoke, then expose over Tailnet/reverse proxy only after health and onboarding are verified.
- Use the current known-good Paperclip image already present on the server for the first clean runtime, instead of rebuilding during the initial smoke.
- Add ops templates to Git and keep live `.env` values on the server only.

</decisions>

<specifics>
## Specific Ideas

- Target server access alias: `oc_hermes`.
- Server OS baseline observed: Ubuntu 24.04.3 LTS.
- Docker is usable through `sudo`; `oc_hermes` has passwordless sudo.
- Post-cleanup disk baseline observed: `/` has 48G free.
- Existing live Paperclip compose project: `paperclip`, host port `127.0.0.1:3200`.
- Clean Astrogen target: compose project `paperclip-astrogen-clean`, host port `127.0.0.1:3210`.
- Docker BuildKit prune policy: `docker buildx prune --keep-storage 10GB --filter until=168h`.

</specifics>

<deferred>
## Deferred Ideas

- Tailnet/public reverse proxy exposure for the clean instance.
- Importing old Astrogen data.
- Installing/configuring production provider secrets.
- Creating the final Astrogen agent roster and workflows.
- Migrating owner traffic from old Paperclip to clean Paperclip.

</deferred>

---

*Phase: 39-clean-paperclip-astrogen-deployment*
*Context gathered: 2026-07-02 via GSD manual express path*
