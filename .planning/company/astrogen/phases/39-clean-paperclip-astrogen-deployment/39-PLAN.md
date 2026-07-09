---
phase: 39
name: clean-paperclip-astrogen-deployment
wave: 1
depends_on: []
autonomous: true
files_modified:
  - ops/paperclip-astrogen-clean/
  - ops/docker-maintenance/
  - .planning/company/astrogen/phases/39-clean-paperclip-astrogen-deployment/
requirements:
  - AST-GOV-01
  - AST-GOV-02
  - AST-GOV-03
  - AST-GOV-06
---

# Plan: Clean Paperclip Astrogen Deployment

<objective>
Create and smoke a clean Paperclip runtime for Astrogen on `ubuntu-oc`, isolated from the existing multi-company Paperclip deployment, and install repeatable Docker cache maintenance.
</objective>

<must_haves>
- Clean runtime uses separate compose project, volumes, env file, and loopback port.
- Existing live Paperclip on port 3200 is not modified or restarted.
- No plaintext secrets are committed to Git.
- Docker BuildKit prune policy is installed as an auditable systemd timer.
- Manual rebuild preflight script exists and runs successfully.
- Clean app health is verified from the server.
</must_haves>

<tasks>
<task id="1" name="Add GSD and ops artifacts">
Create Phase 39 planning files, a clean Paperclip compose template, sanitized env example, rebuild preflight script, and systemd unit templates for Docker BuildKit prune.
</task>

<task id="2" name="Install Docker cache maintenance">
Install the BuildKit prune service/timer on `ubuntu-oc`, enable the timer, and run the preflight script to confirm current disk/cache state.
</task>

<task id="3" name="Create clean server deployment directory">
Create `/home/paperclip/apps/paperclip-astrogen-clean`, copy the compose file, generate a server-only `.env` with fresh random secrets, and create the clean Astrogen workspace directory.
</task>

<task id="4" name="Start clean Paperclip">
Run `docker compose config`, start the clean compose project, wait for Postgres/app health, and verify `http://127.0.0.1:3210/api/health`.
</task>

<task id="5" name="Record verification">
Write Phase 39 summary and verification files with exact status, ports, timer state, and remaining manual onboarding steps.
</task>
</tasks>

<verification>
- `sudo systemctl is-enabled docker-buildkit-prune.timer`
- `sudo systemctl list-timers docker-buildkit-prune.timer`
- `sudo /usr/local/sbin/docker-rebuild-preflight`
- `sudo docker compose -p paperclip-astrogen-clean config`
- `sudo docker compose -p paperclip-astrogen-clean ps`
- `curl -fsS http://127.0.0.1:3210/api/health`
- `curl -fsS http://127.0.0.1:3200/api/health`
</verification>
