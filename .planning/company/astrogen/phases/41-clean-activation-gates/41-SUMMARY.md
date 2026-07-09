---
phase: 41-clean-activation-gates
status: passed-current-activation-set
updated: 2026-07-02
---

# Phase 41: Clean Activation Gates Summary

Old live Astrogen was stopped before clean activation work continued. The old
company now has no active agents, no heartbeat polling, no wake-on-demand, no
active routines, no enabled or scheduled triggers, no queued/running runs, and
no active wakeup requests.

After clean routine activation passed, the old Docker-level runtime was also
stopped. Compose projects `paperclip` and `astrogen-files` are exited, their
containers have `restart=no`, and ports `3200`/`8088` are intentionally
unreachable. Volumes were preserved and a fresh DB dump was saved before stop.

Telegram proactive watches are disabled in both the clean activation path and
old live operational state. The `check-watches` job is paused, watch state is
empty, and max suggestions are set to zero. Telegram escalation timeout handling
remains active.

Clean read-only smoke passed for the required integration set:

- Payload CMS read access;
- CrawlObserver health;
- GSC/Bing/GA4 MCP `tools/list`;
- Telegram `getMe`;
- OpenRouter key metadata.

The GSC smoke required an ops fix: the clean compose network uses bridge
`172.18.0.1`, so a separate `paperclip-gsc-mcp-proxy-clean.service` now forwards
`172.18.0.1:3002` to the Tailnet MCP listener.

Activation then proceeded one routine at a time through the Paperclip harness:

- `Weekly Paperclip clean release check` fired and completed on AST-6; CTO
  follow-up AST-7 confirmed the `0.3.1` health version is package semver, not a
  stale upstream release.
- `Daily Astrogen deterministic evidence collection` was tightened after an
  initial target-drift proof, then completed on AST-9 with GSC/CMS/CrawlObserver
  evidence for `astrogen.com.ua`.
- `Daily Astrogen due-URL GSC indexing audit` completed on AST-10 and created
  backlog finding AST-11 for four fresh blog URLs unknown to Google.
- `Weekly Astrogen SEO/GEO action cycle` completed on AST-12 and created
  backlog opportunity AST-13 for `/experts/astrologiya` low CTR on “астрологи”.

Runtime contract corrections applied during activation:

- canonical Astrogen scope: `https://astrogen.com.ua`,
  `sc-domain:astrogen.com.ua`, and `https://cms.astrogen.com.ua/api`;
- agent plugin access through `/api/agents/me/plugin-tools`;
- no board-only plugin/admin routes from agent heartbeats;
- max 10 rows/source and no raw plugin JSON dumps in routine output.

The article slot allocator remains intentionally parked because
`paperclip.seo-performance-loop` has `articleCadenceEnabled=false` and
`articleCadenceTargetPerDay=0`. Enabling it now would create three daily LLM
allocation checks without an approved article-to-CMS activation gate.
