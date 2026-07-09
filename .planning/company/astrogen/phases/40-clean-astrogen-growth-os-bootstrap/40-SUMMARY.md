---
phase: 40-clean-astrogen-growth-os-bootstrap
plan: 40
subsystem: paperclip-ops
tags: [paperclip, astrogen, bootstrap, secrets, agents, plugins, routines]
requires:
  - phase: 39-clean-paperclip-astrogen-deployment
    provides: isolated clean Paperclip compose runtime
provides:
  - clean Astrogen Growth OS manifests
  - encrypted secret migration into clean company
  - active SEO/GEO/content agent roster
  - allowlisted plugin registry and parked unsafe plugins
  - paused routine definitions with disabled triggers
  - parked transition pack issues
affects: [astrogen-clean, seo-performance-loop, article-cadence, telegram, payload-cms]
tech-stack:
  added: []
  patterns:
    - manifest-first Paperclip bootstrap
    - paused-first recurring cycles
    - encrypted-to-encrypted secret migration
key-files:
  created:
    - ops/paperclip-astrogen-clean/manifests/astrogen-company.yaml
    - ops/paperclip-astrogen-clean/manifests/secrets.yaml
    - ops/paperclip-astrogen-clean/manifests/plugins.yaml
    - ops/paperclip-astrogen-clean/manifests/agents.yaml
    - ops/paperclip-astrogen-clean/manifests/workflows.yaml
    - ops/paperclip-astrogen-clean/manifests/routines.yaml
    - ops/paperclip-astrogen-clean/manifests/transition-pack.yaml
    - ops/paperclip-astrogen-clean/scripts/bootstrap-astrogen-growth-os.mjs
  modified:
  - ops/paperclip-astrogen-clean/README.md
    - .planning/company/astrogen/phases/40-clean-astrogen-growth-os-bootstrap/40-PLAN.md
    - .planning/company/astrogen/phases/40-clean-astrogen-growth-os-bootstrap/40-RESEARCH.md
    - .planning/company/astrogen/phases/40-clean-astrogen-growth-os-bootstrap/40-VERIFICATION.md
key-decisions:
  - "Recurring cycles are paused-first and deterministic-first; no expensive always_enqueue or missed catch-up."
  - "Semantic Core/DataForSEO/Serper/Exa/Bright Data/Collaborator remain parked until packaging, budget, or access gates pass."
  - "Transition issues are parked backlog, not active assigned work, to avoid accidental LLM execution."
patterns-established:
  - "Clean Paperclip company bootstrap is driven from ops manifests plus an idempotent server-side script."
  - "Runtime credentials are copied as runtime state only, never into source-controlled manifests."
requirements-completed:
  - AST-GOV-01
  - AST-GOV-02
  - AST-GOV-03
  - AST-GOV-04
  - AST-GOV-06
  - AST-GOV-07
  - AST-SEO-04
  - AST-SEO-10
  - AST-SEO-13
  - AST-SEO-16
  - AST-SEO-18
  - AST-INT-01
  - AST-INT-02
  - AST-INT-03
  - AST-INT-05
  - AST-HIA-01
  - AST-HIA-03
duration: 1h
completed: 2026-07-02
---

# Phase 40: Clean Astrogen Growth OS Bootstrap Summary

**Manifest-driven clean Astrogen Paperclip foundation with encrypted secrets, active agent roster, allowlisted plugins, paused routines, and parked transition issues**

## Performance

- **Started:** 2026-07-02T17:20:00Z
- **Completed:** 2026-07-02T18:20:05Z
- **Tasks:** 5
- **Files modified:** 12

## Accomplishments

- Created source-controlled clean Astrogen manifests and an idempotent bootstrap script.
- Applied the bootstrap on `ubuntu-oc` after a dry run and clean DB backup.
- Migrated 13 active/parked secret refs encrypted-to-encrypted without printing values.
- Registered 6 active plugins and 10 disabled/parked plugins.
- Created 23 active Astrogen agents with idle heartbeat polling disabled.
- Created 5 routines as `paused` with disabled triggers, `skip_missed`, and safe concurrency.
- Created parked transition issues `AST-1` through `AST-5` instead of bulk-importing old live work.
- Synced Codex runtime auth/config into the clean runtime as server-side runtime state only.

## Server Result

- Clean URL: `http://ubuntu-oc.tailbd4e1c.ts.net:3210`
- Backup files:
  - `/home/paperclip/backups/astrogen-clean-phase40-20260702T181255Z.dump`
  - `/home/paperclip/backups/astrogen-clean-phase40-20260702T181328Z.dump`
- Clean health: ok on loopback and Tailscale IP with MagicDNS Host header.
- Old live health: ok on `127.0.0.1:3200`.

## Verification Snapshot

```text
agents=23
active_secrets=13
ready_plugins=6
disabled_plugins=10
paused_routines=5
enabled_triggers=0
idle_heartbeat_agents=0
active_transition_issues=0
```

Plugin loader reported `total=6`, `succeeded=6`, `failed=0` for active plugins.

## Deviations from Plan

### Corrected Cycle Architecture

The initial plan still allowed recurring work to look like manager wakeups. The
plan was corrected before apply: article cadence is now a slot allocator,
missed article slots are not automatically backfilled, and all routines start
paused with disabled triggers.

### Codex Runtime Auth

After the first clean app restart, assigned transition issues attempted to run
and failed because the clean Codex home had no auth. I copied the existing old
Astrogen Codex runtime auth/config into the clean runtime without printing it,
then parked the transition issues as unassigned backlog.

## Issues Encountered

- First apply attempt stopped after one secret metadata row because `psql`
  returned command tags after `RETURNING id`; fixed by adding quiet mode and
  reran idempotently.
- End-to-end article/SEO/agent smoke was not run to avoid spending tokens and
  creating live work before the owner explicitly enables the clean cycles.

## Post-Bootstrap Activation Correction

After owner correction, old live Astrogen was cold-stopped before clean
activation work continued:

```text
agents_not_paused_or_terminated=0
hb_enabled=0
wake_on_demand=0
active_routines=0
enabled_triggers=0
scheduled_triggers=0
queued_or_running_runs=0
active_wakeup_requests=0
```

Telegram proactive watches were disabled and `check-watches` was paused. Clean
read-only integration smoke moved into Phase 41 and passed for Payload CMS,
CrawlObserver, GSC/Bing/GA4 MCP, Telegram `getMe`, and OpenRouter `auth/key`.
No clean routine was enabled.

## Next Phase Readiness

Ready for Phase 41 remaining gates:

- run one manual SEO evidence workflow dry run;
- run one bounded article dry run to CMS draft;
- only then enable selected routines one by one.
