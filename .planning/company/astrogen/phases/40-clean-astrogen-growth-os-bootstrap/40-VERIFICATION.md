---
phase: 40
status: foundation_complete_activation_moved_to_41
updated: 2026-07-02
---

# Phase 40 Verification Plan

## Pre-Execution Gates

| Gate | Required Result |
| --- | --- |
| Clean health | `http://ubuntu-oc.tailbd4e1c.ts.net:3210/api/health` returns `status=ok` |
| Old live health | old live `127.0.0.1:3200` remains `status=ok` |
| Manifest safety | no plaintext secret material in Git/planning files |
| Dry-run support | manifest applier can run in export/diff mode before apply |
| Cycle safety | all recurring work starts paused with disabled triggers |

## Agent Verification

| Check | Required Result |
| --- | --- |
| Roster allowlist | active agents match Phase 40 allowlist |
| Exclusions | smoke/legacy/terminated agents are absent |
| Reporting chain | every specialist reports to CMO, CTO, HIA, or another named manager |
| Heartbeat policy | no active idle LLM timer polling |
| OpenRouter writer | no local tool claims; canonical artifact protocol documented |
| Paid/social | no active routine, no automatic campaign/social execution |

## Secret Verification

| Check | Required Result |
| --- | --- |
| Metadata | required secret keys exist in clean Astrogen company |
| Resolution | server-side smoke resolves each required secret without printing value |
| Scoping | plugin configs reference clean Astrogen secret refs |
| Legacy | disabled legacy `openrouter-api-key` is not active default |

## Plugin Verification

| Plugin | Required Smoke |
| --- | --- |
| Telegram | dry notification or config validation with Astrogen bot ref |
| Payload CMS | health/build-state or read-only collection smoke |
| GSC/Bing/GA4 | allowed tool call for Astrogen site/property |
| CrawlObserver | project/session read smoke |
| SEO Performance Loop | settings load with Ukrainian report policy |
| OpenRouter image | provider credential metadata smoke without paid image generation |
| Semantic Core MCP | connectivity or mock validation smoke |
| DataForSEO/Serper/Exa | enabled only after read/search smoke |
| Collaborator | enabled only after key/config smoke |

## Workflow Verification

| Workflow | Required Result |
| --- | --- |
| Semantic Core Lifecycle | state machine rejects import before readiness/review gate |
| SEO Performance Loop | report cannot close without action queue or watch/cooldown decisions |
| Article Cadence | parent cannot close before unique CMS draft or safe no-delivery disposition |
| Article Delivery | required artifacts: brief, draft, validation, layout, image, CMS URL, owner notification |
| Technical SEO Finding | finding is deduped, routed, fixed, verified, and monitored |
| Human Decision | decision brief and writeback/resume path exist |
| Product Launch SEO | discovery/strategy approval gates precede execution |
| Paid/Social | remains parked until explicit enablement decision |

## Cycle Safety Verification

| Check | Required Result |
| --- | --- |
| No idle polling | `agents.runtime_config->heartbeat->enabled` is not true for active LLM agents |
| No catch-up storm | no expensive routine uses `always_enqueue` or `enqueue_missed_with_cap` |
| Paused bootstrap | Phase 40 routines have `status=paused` and trigger `enabled=false` |
| Article cadence | cadence is an article slot allocator with `skip_if_active`, `skip_missed`, daily cap, and no automatic missed-slot backfill |
| Daily evidence | daily collection is deterministic/quota-bound before LLM review |
| SEO weekly | weekly analysis must produce action queue, watch/cooldown decisions, or explicit no-action evidence |
| Notifications | Telegram is used only for owner-facing decision/summary events |

## Transition Verification

| Check | Required Result |
| --- | --- |
| Current work audit | live `todo`, `in_progress`, `in_review`, and valid blocked work reviewed |
| Transition parent | clean instance has one parent issue for transition |
| Child issue set | only still-valid work recreated |
| Not migrated list | stale/obsolete categories recorded |
| Old live untouched | no old live DB mutation during transition planning |

## Final Pass Condition

Phase 40 is complete only when the clean Paperclip instance can perform a
bounded Astrogen growth cycle:

```text
collect evidence
-> classify SEO/GEO opportunity
-> route content or technical child issue
-> produce/validate an artifact
-> deliver or record owner-facing summary
-> leave monitoring state
```

without relying on old company data, idle LLM polling, global credentials, or
manual operator intervention.

## Execution Result - 2026-07-02

Foundation bootstrap passed:

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

Verified:

- clean health endpoint returns `ok`;
- old live health endpoint returns `ok`;
- 13 secret refs exist in clean Astrogen company;
- active plugin configs reference clean secret ids;
- active plugin loader result was `total=6`, `succeeded=6`, `failed=0`;
- routines are paused and all triggers are disabled;
- no routine uses `always_enqueue` or `enqueue_missed_with_cap`;
- no active agent has idle timer heartbeat enabled;
- transition issues are parked backlog, not active assigned work;
- Codex runtime auth/config exists in the clean runtime.

Post-bootstrap correction:

- old live Astrogen was cold-stopped before activation continued;
- Telegram proactive watches were disabled and `check-watches` was paused;
- clean read-only integration smoke moved to Phase 41 and passed for Payload,
  CrawlObserver, GSC/Bing/GA4 MCP, Telegram `getMe`, and OpenRouter `auth/key`;
- no clean routine was enabled during Phase 40 or the Phase 41 smoke.

Remaining activation gates:

- Semantic Core/DataForSEO/Serper/Exa remain disabled pending packaging smoke.
- Collaborator/Bright Data remain disabled pending access and budget approval.
- Workflow dry-runs remain pending before any routine is enabled.
