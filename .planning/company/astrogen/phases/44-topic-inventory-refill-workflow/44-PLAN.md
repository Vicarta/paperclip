---
phase: 44
name: topic-inventory-refill-workflow
status: executed
created: 2026-07-08
depends_on: [41, 34, 35, 42]
subsystem: paperclip-astrogen-clean
tags: [paperclip, astrogen, seo, content, routines, workflow-contracts]
---

# Phase 44: Topic Inventory Refill Workflow

## Objective

Make Astrogen article cadence reliable when approved article topics are exhausted.

`no-safe-topic` must not close article cadence as a successful final state. It must
transition into a bounded topic inventory refill workflow, or into a concrete
technical blocker if required evidence tools are unavailable.

## Incident Evidence

The clean Astrogen article catch-up run on 2026-07-08 produced two CMS drafts
and then stopped:

- `AST-123` consumed the accepted topic `Матриця долі онлайн`.
- `AST-134` consumed the accepted topic `Родові практики`.
- `AST-133` closed with no third article slot.
- `AST-146` returned `ready_for_brief_creation: no`.
- The remaining topics were rejected for duplication/cannibalization risk:
  `астролог онлайн` overlapped service/expert listing pages and the fresh
  `Таролог чи астролог` draft; `соляр` overlapped an existing draft.
- `AST-146` also recorded that the GSC/GA4 wrapper was unavailable because a
  plugin secret reference had no agent binding.

This was a correct safety gate, but an incomplete operating loop.

## Architecture Decision

Do not turn the article allocator into an ad hoc topic generator.

The article allocator should allocate article-production slots from a small,
validated topic inventory. When inventory is empty or unsafe, it should start or
wait on a separate bounded refill workflow owned by CMO/SEO strategy.

The refill workflow is the place where agents gather evidence, dedupe, assess
cannibalization, and create the next ready topics. The article workflow remains
focused on brief -> draft -> validation -> layout -> image -> CMS draft ->
CMO Telegram notification.

## Target Operating Model

```text
Daily/weekly evidence
-> topic inventory refill
-> validated topic records
-> article slot allocator
-> normal article pipeline
-> CMS draft and CMO Telegram notification
-> consumed topic ledger
-> performance feedback into next refill
```

## Scope

1. Add a first-class `topic_inventory_refill` workflow contract.
2. Bind required evidence plugins to the agents that need them.
3. Add typed topic inventory statuses and required evidence fields.
4. Update article allocator behavior for `no-safe-topic`.
5. Connect weekly SEO/GEO output to the topic inventory.
6. Add smoke tests and live verification on `paperclip-astrogen-clean-app`.

## Non-Scope

- Do not publish CMS content.
- Do not enable Telegram proactive watches.
- Do not run broad semantic-core rebuilds from article cadence.
- Do not create public-web-only topics when first-party evidence is unavailable.
- Do not ask the owner to solve technical plugin/configuration problems.
- Do not revive or modify the old Paperclip instance.

## Required Agent Ownership

| Responsibility | Owner |
| --- | --- |
| Business priority and routing | Chief Marketing Officer |
| Topic evidence and shortlist | SEO Blog Content Strategist |
| SEO-level owner communication | Roger / Hermes channel, routed by CMO |
| Topic validation and cannibalization gate | SEO Blog Content Plan Validator |
| Runtime/plugin binding fixes | Chief Technical Officer |
| Executive prioritization if marketing-only view is insufficient | Chief Executive Officer |

CEO and CMO assign and control work. They should not personally perform writer,
image, CMS, or technical evidence collection tasks.

## Topic Inventory State Machine

Each topic record must have one stable `topicKey` and one current status.

| Status | Meaning | Next allowed states |
| --- | --- | --- |
| `candidate` | Discovered but not evidence-ready. | `evidence_ready`, `parked_insufficient_evidence`, `reject_duplicate` |
| `evidence_ready` | Has enough GSC/GA4/CMS/semantic-core/CrawlObserver context for validation. | `ready_for_brief_creation`, `needs_owner_direction`, `reject_cannibalization`, `reject_duplicate` |
| `ready_for_brief_creation` | Safe to give to article allocator. | `reserved`, `consumed`, `parked_by_cmo` |
| `reserved` | Allocator selected it for one active article lane. | `consumed`, `ready_for_brief_creation`, `blocked_runtime` |
| `consumed` | A CMS draft was created from this topic. | terminal |
| `needs_owner_direction` | Business/positioning decision is needed, not technical work. | `ready_for_brief_creation`, `parked_by_cmo`, `reject_business` |
| `parked_insufficient_evidence` | Evidence is not enough to act safely. | `candidate`, `evidence_ready` |
| `reject_duplicate` | Duplicates existing or active content. | terminal unless reopened with new evidence |
| `reject_cannibalization` | Would likely compete with a priority page/draft. | terminal unless page strategy changes |
| `blocked_runtime` | Evidence/plugin/tooling path is broken. | previous actionable state after CTO fix |

## Required Topic Record Fields

Every `ready_for_brief_creation` topic must include:

- `topicKey`
- Ukrainian working title
- primary query
- supporting queries
- search intent
- funnel role
- target audience segment
- target service/product/route relationship, if any
- evidence references from GSC/GA4/CMS/semantic-core/CrawlObserver
- CMS duplicate check
- active Paperclip issue duplicate check
- cannibalization assessment
- proposed CTA target
- proposed internal link targets
- forbidden claims and tone constraints
- reason it is safe now
- freshness/cooldown notes

`needs_owner_direction` topics must include a short Ukrainian decision brief
that explains the business choice without internal workflow labels.

## Workflow Contract

### Trigger Conditions

The refill workflow must start when any of these are true:

1. Article allocator sees fewer than 3 `ready_for_brief_creation` topics.
2. Article allocator receives `no-safe-topic` from bounded expansion.
3. Weekly SEO/GEO cycle identifies a content gap with enough evidence.
4. CMO or Hermes-routed owner direction asks for a new SEO topic area.

### Input Contract

The refill issue must receive:

- current article inventory from Payload CMS;
- sitemap/public URL evidence;
- GSC query/page evidence for the completed evidence window;
- GA4 engagement/conversion context when available;
- semantic-core inventory/review state;
- CrawlObserver rendered page/internal-link evidence;
- active Paperclip article/backlog issue list;
- consumed topic ledger.

### Output Contract

The refill workflow returns one compact topic inventory packet:

- 3-10 candidate records total;
- 1-3 `ready_for_brief_creation` records when evidence supports them;
- explicit rejected/parked records with reasons;
- zero broad "maybe" topics without evidence;
- one summary comment on the refill issue;
- machine-readable work product or issue document for allocator consumption.

### Failure Contract

If evidence tools are unavailable:

- create or reuse one CTO-owned technical blocker;
- mark refill issue `blocked` by that blocker;
- do not close article allocator as `done`;
- do not ask the owner to choose topics from incomplete data;
- send an email only when human/developer action is genuinely needed and state
  the technical request in non-technical Ukrainian.

## Article Allocator Changes

The article allocator must:

1. Query the current topic inventory before creating article slots.
2. Reserve exactly one `ready_for_brief_creation` topic per article lane.
3. Mark a topic `consumed` only after CMS draft creation is verified.
4. If no safe topic exists, create or wait on `topic_inventory_refill`.
5. Stay `blocked` by the refill issue, not `done`, while refill is active.
6. Resume automatically when the refill issue completes.
7. Allocate at most one new article pipeline after each refill completion.
8. Record a clear no-slot reason only when refill completed and still returned
   zero ready topics with durable evidence.

## Evidence Plugin Binding Gate

Before activating the workflow, verify bindings for:

- SEO Blog Content Strategist;
- SEO Blog Content Plan Validator;
- Chief Marketing Officer;
- Chief Technical Officer where technical smoke or repair is needed.

Required tool families:

- Payload CMS read-only inventory and draft lookup;
- GSC/Bing/GA4 evidence wrapper;
- semantic-core inventory/review API/tools;
- CrawlObserver read endpoints;
- email notifications for technical/request reports;
- Telegram plugin only for final CMO owner notifications.

If a plugin supports cost accounting, verify that calls write cost usage events.

## Implementation Plan

### 1. Baseline Audit

- Capture current clean app health, image tag, and DB backup.
- Export active routines, triggers, agents, plugin installations, and secret
  bindings from clean Paperclip.
- Capture `AST-133`, `AST-146`, and current article routine evidence as the
  regression fixture.

### 2. Contract Design

- Add `topic_inventory_refill` workflow manifest.
- Add canonical topic inventory schema and status machine.
- Add allocator handoff contract: `no-safe-topic -> refill issue -> blocker ->
  automatic resume`.
- Update CMO, SEO Blog Content Strategist, SEO Blog Content Plan Validator, and
  article allocator AGENTS.md/contracts.

### 3. Evidence Access Repair

- Verify all required plugin secret refs are bound to the right agents.
- Fix missing bindings for GSC/GA4 and Payload CMS where needed.
- Run low-cost smoke checks for each tool family.
- Record smoke evidence in Paperclip issues or phase summary.

### 4. Topic Inventory Storage

- Choose the minimal durable Paperclip-native storage path:
  issue document or artifact work product first; custom DB table only if the
  existing document/work-product path cannot support stable consumption.
- Store records with stable IDs and status transitions.
- Preserve consumed topic history to avoid duplicate future allocation.

### 5. Refill Workflow Activation

- Create the refill routine or manager-triggered workflow.
- Connect weekly SEO/GEO output to refill.
- Connect article allocator empty-inventory path to refill.
- Enforce bounded limits: max 10 candidates, max 3 ready topics, one allocator
  continuation per completed refill.

### 6. Article Allocator Integration

- Update allocator prompt/contract/code path so it consumes topic inventory.
- Prevent allocator from closing `done` on empty inventory unless refill has
  completed with durable zero-ready evidence.
- Ensure parent/child blockers use first-class `blockedByIssueIds`.
- Ensure existing active article lanes prevent duplicate slot creation.

### 7. Verification

- Replay the `AST-133/AST-146` scenario in clean staging/current clean runtime.
- Expected result: allocator creates or waits on refill instead of closing done.
- Force a missing-plugin-binding scenario.
- Expected result: refill is blocked by CTO technical issue, not by owner input.
- Force a successful refill with 1-3 safe topics.
- Expected result: allocator reserves one topic and launches one normal article
  pipeline.

### 8. Owner-Facing Communication Rules

- CMO final article notifications must remain gender-neutral.
- CMO final article notifications must include CMS admin draft edit URLs only.
- Hermes is used for SEO-level owner questions.
- Email is used for technical action requests only when developer/human action
  is required.

## Acceptance Criteria

- A clean article allocator run with no ready topics does not silently finish
  as `done`.
- A refill issue is created or reused with deterministic idempotency.
- The allocator is blocked by the refill issue and auto-resumes when refill is
  done.
- Refill returns a durable topic inventory packet with typed statuses.
- `ready_for_brief_creation` topics include duplicate and cannibalization
  evidence.
- Missing evidence tools produce a CTO-owned technical blocker.
- Owner is not asked to make technical architecture/plugin-binding decisions.
- At least one end-to-end smoke produces a CMS draft from a refill-created topic.
- Telegram message after CMS draft uses gender-neutral Ukrainian and CMS admin
  draft URL only.
- No old Paperclip containers, DBs, routines, or agents are touched.

## Verification Commands / Checks

Run these only during execution, not during planning:

```bash
ssh oc_hermes "curl -fsS http://127.0.0.1:3210/api/health"
ssh oc_hermes "sudo docker ps --filter name=paperclip-astrogen-clean-app-1"
ssh oc_hermes "sudo docker exec paperclip-astrogen-clean-db-1 pg_dump -U paperclip -d paperclip --schema-only >/tmp/astrogen-clean-schema-before-phase44.sql"
```

Paperclip checks:

- active routines include article allocator and weekly SEO/GEO;
- topic refill workflow exists and is bounded;
- relevant agents have required plugin bindings;
- `AST-133/AST-146` evidence is represented as a regression fixture;
- no Telegram proactive watches are enabled.

## Rollback

- Restore clean DB backup if schema/config changes break routine execution.
- Disable only the new `topic_inventory_refill` routine/trigger if it loops.
- Revert allocator contract to previous behavior only as an emergency, while
  leaving a visible blocker explaining that article cadence cannot safely choose
  topics.

## Completion Summary Template

When executed, close the phase with:

- backup path;
- changed contracts/manifests;
- plugin binding smoke results;
- topic refill regression result;
- article allocator regression result;
- live issue IDs used for proof;
- whether a new CMS draft was created;
- remaining risks and follow-up tasks.
