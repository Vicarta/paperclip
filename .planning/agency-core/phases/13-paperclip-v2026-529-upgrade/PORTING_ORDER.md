# Phase 13 Porting Order

Last updated: 2026-06-02

This file turns `PATCH_INVENTORY.md` into execution waves for the upgrade
worktree at:

`/Users/savitsky/CodexProjects/paperclip-v2026.529.0-upgrade`

## Rule

Do not port everything chronologically. Port by operating surface, because each
surface has its own tests and can be accepted or replaced by upstream behavior
independently.

## Wave 0: Baseline And Build

Goal: prove the upstream release branch builds cleanly before local patches.

Actions:

- inspect upstream package layout;
- install dependencies;
- run server/UI builds;
- run upstream test baseline;
- record failures caused by local machine/runtime only.

Exit criteria:

- upstream `v2026.529.0` baseline state is known;
- no local patches are applied yet.

## Wave 1: Runtime, Issue Wakeups, And Workspace Lifecycle

Why first: upstream `v2026.529.0` changes workspace finalize gates,
continuation recovery, accepted-plan decomposition, and no-remote-git behavior.
Our local issue/heartbeat fixes may already be covered or may conflict.

Inventory focus:

- silent-noop recovery;
- child completion parent wakeups;
- active issue run following;
- reassigned queued issue locks;
- deferred/orphaned wakeups;
- plugin comment wakeups;
- workspace/session/finalize behavior;
- file-link opening behavior.

Decision:

- prefer upstream when equivalent;
- port only missing production behavior.

Smoke:

- create issue -> child issue -> child done -> parent wakes;
- reassigned queued issue does not stay locked;
- blocked issue dedup still works;
- inline file links open correctly.

## Wave 2: Telegram Plugin And Human-Facing Notifications

Why second: Telegram is owner-facing and regression is highly visible.

Inventory focus:

- concise Ukrainian messages;
- no noisy generic completion fallbacks;
- escalation reply writeback;
- superseding old HIA messages;
- attachment delivery groups;
- delivery proof ledger;
- message-only CMS draft notifications.

Decision:

- retain local behavior unless upstream has an exact replacement and smoke proves it.

Smoke:

- CMS draft-ready notification includes draft/admin URL;
- internal diagnostic/proof tasks do not send noisy `Готово`;
- Telegram reply writes back to the source issue;
- delivery groups send multiple files without hitting attachment limits.

## Wave 3: Payload CMS Plugin And Article Delivery

Why third: Astrogen blog production depends on this path.

Inventory focus:

- Payload build state;
- media upload;
- taxonomy/category ensure;
- blog draft create/update;
- guarded publish;
- `articleContent.v1`;
- cover metadata rules;
- iconList support if it lives in Paperclip-side shared contracts.

Smoke:

- create/update draft with `articleContent.v1`;
- upload cover image;
- ensure `solar` category;
- attach cover image;
- do not publish unless explicitly confirmed.

## Wave 4: MCP And Provider Plugins

Why fourth: provider calls are expensive and must not leak sessions/memory.

Inventory focus:

- Search Console MCP;
- Semantic Core MCP;
- Winning Structure MCP;
- GSC/GA4 allowlists;
- CrawlObserver adapter;
- Serper/DataForSEO/Exa/Bright Data plugins;
- Streamable HTTP session close hygiene;
- request timeouts;
- provider cost ledger events.

Smoke:

- each MCP call closes transport/session;
- GSC async inspection tools are visible;
- CrawlObserver health works;
- cost event writes for paid provider calls;
- no plaintext tokens in logs.

## Wave 5: SEO Ops Schema And Routines

Why fifth: schema/routine changes require DB migration caution.

Inventory focus:

- `seo_ops` schema;
- indexing snapshots;
- page findings;
- weekly blog report;
- provider cost accounting ledger;
- routines and plugin jobs.

Smoke:

- migrations apply once on a production-like DB copy;
- weekly report can read CMS/GSC/GA4 state;
- indexing snapshots and findings deduplicate.

## Wave 6: UI And Operator Experience

Why after core runtime: upstream adds document annotations, sidebar membership,
plugin manager visibility, and first-admin claim flow.

Inventory focus:

- legacy SEO Review UI removal;
- plugin manager changes;
- projects/agents sidebar visibility;
- document annotations;
- first-admin claim flow;
- model discovery UI.

Smoke:

- Astrogen board loads;
- DiskInternals board loads;
- sidebar does not show irrelevant clutter;
- plugin manager shows bundled/local plugins;
- document annotation UI does not break existing documents.

## Wave 7: Planning/Ops Overlay Alignment

Why last: these files should not be mixed into upstream app source.

Inventory focus:

- `.planning`;
- `ops/paperclip-production`;
- company manifests;
- runbooks;
- sanitized live export shape.

Smoke:

- source-of-truth manifests match production after cutover;
- no secret material enters Git;
- future update runbook remains accurate.

## Deployment Gate

No production deployment before Waves 0-6 pass in staging or a production-like
copy. Wave 7 is updated after successful cutover.
