---
phase: 41
name: clean-activation-gates
status: active
updated: 2026-07-02
depends_on: [40]
subsystem: paperclip-ops
tags: [paperclip, astrogen, activation, routines, smoke]
---

# Plan: Clean Astrogen Activation Gates

## Objective

Activate the clean Astrogen Paperclip instance without recreating the old
runaway-cycle failure mode. Old live Astrogen must be cold before any clean
routine is enabled. Telegram proactive watches stay off until explicitly
re-enabled.

## Gate Order

1. **Old live cold stop** - pause old Astrogen agents, disable heartbeat and
   wake-on-demand, pause routines, disable triggers, clear scheduled trigger
   timestamps, cancel queued wakeup requests, and disable Telegram proactive
   watches.
2. **Clean safety check** - verify clean routines/triggers/runs/wakeup requests
   are all zero and Telegram `check-watches` is paused.
3. **Read-only integration smoke** - verify Payload, CrawlObserver, GSC/Bing/GA4
   MCP, Telegram token, and OpenRouter key metadata without creating issues,
   agent runs, CMS drafts, Telegram messages, or paid image requests.
4. **Workflow dry-runs** - run one bounded SEO evidence dry run and one bounded
   article-to-CMS draft dry run with explicit token/cost ceilings.
5. **Routine activation** - enable routines one at a time only after the
   matching dry run passes.

## Routine Enablement Policy

| Routine | Activation Rule |
| --- | --- |
| Daily deterministic evidence collection | Enable first only after joined Payload/GSC/CrawlObserver evidence dry run creates a compact action packet or explicit no-action packet. |
| Daily due-URL GSC indexing audit | Enable after URL quota/cooldown ledger is verified and a micro-batch inspection dry run passes. |
| Weekly SEO/GEO action cycle | Enable after daily evidence collection has at least one clean run and produces bounded output. |
| Astrogen article slot allocator | Enable last, after article brief/draft/layout/image/CMS/owner-notification dry run proves safe and cost-bounded. |
| Weekly clean release check | Enable when deterministic build provenance is confirmed for the clean runtime. |

## Non-Negotiables

- Do not enable any routine during read-only smoke.
- Do not enable Telegram proactive watches in this phase.
- Do not run paid image generation as a smoke test.
- Do not create catch-up behavior for missed cron slots.
- Do not treat a direct plugin health check as proof that the workflow is safe.
- If a dry run fails, fix the integration/configuration before enabling any
  dependent routine.
