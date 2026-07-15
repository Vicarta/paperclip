# Astrogen Autonomous Growth OS Failure

**Status:** ROOT CAUSE FOUND

**Investigated:** 2026-07-14

**Scope:** `ops/paperclip-astrogen-clean` and the clean live deployment only

**Live evidence window:** through 2026-07-14 00:06 Europe/Kyiv

**Method:** repository inspection plus read-only SSH, API, PostgreSQL, container, routine, heartbeat, issue, plugin, and application-log inspection

## Safety Boundary

This investigation did not edit production files, mutate live database state,
run routines, wake agents, publish CMS content, enable Telegram proactive
watches, or touch the old Paperclip deployment. Existing unrelated worktree
changes were preserved.

## Expected Behavior

- CEO turns company goals into a prioritized portfolio and delegates management
  to CMO or other future department heads.
- CMO turns marketing goals into bounded specialist work and controls delivery.
- Article cadence produces verified CMS drafts and sends the CMS admin edit URL.
- Weekly SEO/GEO converts evidence into analysis and executable actions.
- Topic inventory refills before the article allocator runs out of safe topics.
- A blocked case affects that case, not unrelated productive capacity.
- Transient and contract failures retry or recover; external dependencies park
  with a review time; only true owner decisions escalate to the owner.
- Scheduled operation continues without manual pushes or continuous owner
  monitoring.

## Actual Behavior

- The scheduler fires and agents produce useful artifacts, but workflows can
  finish locally without delivering the business outcome.
- Article production is globally serialized by any open article parent.
- Assigned blocked issues are invisible to the leadership backlog routine.
- Weekly SEO can close after a report and recommendation without creating the
  execution work that implements the recommendation.
- Topic inventory is Markdown inside issues, not durable reservable state.
- CEO and CMO have no deterministic portfolio controller that wakes them when
  an outcome deficit appears.
- Similar external findings are recreated repeatedly instead of being merged
  into one durable finding/action lifecycle.
- Repository manifests, bootstrap logic, live routines, routine revisions, and
  generated agent instructions have drifted apart.

## Reproduction

1. Let scheduled routines run without manual pushes.
2. Allow one article child to fail or become blocked late in the chain.
3. The article parent remains open/blocked.
4. The next allocator sees an active article parent and skips unrelated topics.
5. Backlog triage sees the blocked work is assigned, processes zero items, and
   exits successfully.
6. Routine dashboards remain mostly green while no new owner-visible article is
   delivered.

The live AST-182 chain reproduced this sequence.

## Hypotheses

| Hypothesis | Verdict | Evidence |
| --- | --- | --- |
| Scheduler or clean containers are down | Rejected | Health was `ok`; app and DB containers were up; all eight enabled live schedules had recent firings. |
| Agents are not capable of producing useful work | Rejected as primary cause | Agents produced briefs, Claude drafts, validation, layout, image, SEO analysis, and CMS draft 124. Delivery orchestration failed after the work existed. |
| GSC, GA4, Payload, CrawlObserver, and SERP tools are all unavailable | Rejected as primary cause | Recent issue evidence confirms GSC/GA4, Payload, CrawlObserver, and Serper use. Semantic-core tooling is disabled and contributes to stale inventory, but does not explain the global stop. |
| Token cost or model limits stop the system | Rejected | The failures occur at state, authorization, completion-gate, and portfolio-control boundaries. |
| One strict deduplication rule is the only defect | Rejected | Deduplication and global WIP are faulty, but false completion, missing durable topic state, report-only SEO, blocked-work blindness, and config drift are independent failures. |
| Agent heartbeat should be enabled so managers keep thinking | Rejected | Paperclip is assignment/event/routine driven. Idle LLM polling would be costly and nondeterministic; continuity belongs in a deterministic controller. |
| Local issue retries will restore autonomy | Rejected | Historical retries repaired individual runs but did not change outcome semantics or cross-workflow capacity. |
| The system models orchestration completion instead of business delivery | Confirmed | Routine completion follows execution-issue status; the issue graph can close after routing/reporting while CMS/action/notification evidence is absent. |
| Prose contracts are being used as the workflow engine | Confirmed | Live has zero pipelines, stages, cases, or pipeline automation executions; agents manually interpret long instructions and create issue graphs. |
| Configuration drift makes fixes non-durable | Confirmed | Current repository rules, uncommitted proposed rules, bootstrap defaults, live rows, and routine revisions disagree. There is no fail-on-drift reconciliation. |

## Confirmed Runtime Evidence

### Scheduler And Containers Are Healthy

- `paperclip-astrogen-clean-app-1` was up and served
  `http://127.0.0.1:3210/api/health` successfully.
- `paperclip-astrogen-clean-db-1` was healthy.
- Eight live routines were active and enabled: article allocator, daily evidence,
  daily GSC indexing, daily leadership triage, weekly CEO review, weekly CTO
  review, weekly SEO/GEO, and weekly release check.
- Recent application logs show the scheduler firing. There is no current
  scheduler outage that explains the missing business output.

### Green Routine Runs Are Not Delivery Proof

During the inspected 14-day window, active routines mostly completed. Paperclip
currently finalizes a routine run as `completed` when its execution issue becomes
`done`, and as `failed` when that issue becomes `blocked` or `cancelled`.
See `local-paperclip/server/src/services/routines.ts:2746`.

That rule is internally consistent, but the execution issue is an orchestration
container. It can be closed after routing a child, writing a report, or recording
no work. It does not prove that a CMS draft, Telegram delivery, or SEO action was
completed. The system therefore exposes activity health as business health.

### Company State Is Inert Between Schedules

At inspection time the company issue distribution was:

- 190 `done`
- 18 `blocked`
- 9 `cancelled`
- 0 `backlog`, `todo`, `in_progress`, or `in_review`

There were no active recovery actions and no active watchdog. Two stale wakeup
requests targeted issues that were already done. Consequently, the company had
no live execution path until another scheduled event happened.

### Leadership Triage Ignores Assigned But Stalled Work

The latest leadership triage issue, AST-214, processed and routed zero work. It
skipped 16 open items because they already had assignees and then exited as
healthy. This routine is an unassigned-backlog router, not a portfolio
reconciler. It does not own age, outcome deficit, stalled stages, recovery SLA,
or productive capacity.

### One Article Blocker Stops Unrelated Articles

AST-182 completed brief, Claude draft, validation, humanization, layout, layout
validation, and image stages. Its CMS child AST-217 then successfully created:

- Payload `blogPosts/124`
- draft status, not published
- cover and OG media 177 at 1472x822
- `articleContent.v1`
- early `Коротко` block
- CTA to `/experts/taro`
- exactly three related posts

AST-217 nevertheless became blocked after trying to write a `before-after-diff`
document on the CMO-owned parent. Paperclip correctly rejected the cross-owner
mutation. The operation was a new article create, so a before/after refresh
artifact should not have been required in the first place.

Because AST-217 did not become `done`, AST-182 did not advance to CMO
notification. The draft exists but the owner was not told. Allocator runs on
July 10, 11, 12, and 13 declined new articles while the same parent remained
active. This is direct evidence that a self-inflicted blocker in one case
consumes company-wide article capacity.

Only six CMS draft URLs were found in clean issue evidence since deployment:
116, 118, 121, 122, 123, and 124. The July 9-13 gap aligns with the serialized
AST-182 blocker, not a scheduler outage.

### Weekly SEO Is A Report Loop, Not An Action Loop

AST-115 produced useful weekly analysis and sent its detailed email. It found a
material Solar cluster decline and recommended action through Hermes/CMO. It
created no child execution issue for that recommendation. The weekly routine
could close on report, email, owner brief, watch, or cooldown evidence.

Because proactive Telegram watches are intentionally disabled, routing an
auto-executable recommendation through a communication-only path leaves no
execution path. Owner communication and specialist execution are currently
conflated. The weekly CEO review then saw the SEO routine as done rather than
checking whether its recommended growth action was implemented.

### Self-Learning Does Not Close Its Own Improvements

The weekly CTO review identified duplicate repair loops and blocked work, but
lacked a normalized runtime evidence export. It created AST-122 for that export;
AST-122 remains blocked. The review can therefore diagnose the operating system
without ensuring the improvement reaches backup, change, verification, and
owner email. It is another report-producing loop without a delivery controller.

### Topic Inventory Is Not Operational State

There is no dedicated topic/content-plan table or lifecycle. Topic inventory
exists in issue documents such as AST-152, AST-163, and AST-175. Ready,
reserved, consumed, rejected, evidence freshness, and lease expiry are prose,
not transactional fields. The allocator must rediscover and interpret documents
on every run and cannot reserve a topic atomically.

The semantic-core plugin is disabled, although 887 imported semantic keyword
action entities exist. The source data was recovered, but the active read/write
tool lifecycle is not available to the agents. This weakens refill quality and
freshness, while the lack of durable topic state makes any refill fragile.

### Duplicate Findings Have No Durable Lifecycle

Blocked issues repeatedly target the same unresolved conditions:

- six `/horoscope` issues
- six metadata/canonical ownership issues

Daily collectors create a new task around the same external condition. There is
no stable finding fingerprint, cooldown, `nextReviewAt`, or single action ledger
that accumulates fresh evidence without reopening equivalent work.

### Configuration Has Multiple Sources Of Truth

The current worktree contains uncommitted attempts to improve WIP, catch-up,
SERP value-gap routing, CMS ownership, and a weekly CMO portfolio routine. These
were treated as evidence only and were not changed by this investigation.

Confirmed drift includes:

- Live article behavior still uses a global active-article skip, while
  `ops/paperclip-astrogen-clean/manifests/routines.yaml:86` describes productive
  WIP 3 and excludes blocked parents.
- Live has no weekly CMO portfolio routine, while the current dirty bootstrap
  defines one at `ops/paperclip-astrogen-clean/scripts/bootstrap-astrogen-growth-os.mjs:696`.
- Routine manifest status/trigger values disagree with bootstrap and live state.
- Live routine revision snapshots use heterogeneous generations and do not all
  match current rows.
- Article target previously existed as three drafts/day in the CMO prose while
  the routine target was one/day; the current dirty CMO contract proposes
  one/day plus bounded catch-up.
- `workflows.yaml`, routine descriptions, bootstrap string contracts, generated
  `AGENTS.md`, and live DB rows duplicate the same business rules.

There is no compiler/reconciler that can plan a change, apply it, and fail if
the resulting live state differs from the canonical specification.

### Native Pipelines Exist But Are Unused

Live counts for pipelines, stages, cases, and pipeline automation executions are
all zero. `ops/paperclip-astrogen-clean/manifests/workflows.yaml` is descriptive
documentation, not an executable state machine.

Paperclip already has typed pipeline stages, transition gates, child-terminal
requirements, review decisions, leases, version checks, and `onEnter` routine
automation in `local-paperclip/server/src/services/pipelines.ts:90`. However,
generic `autonomy: auto` transitions are deliberately rejected by the current
source at `local-paperclip/server/src/services/pipelines.ts:3186`. A migration
must therefore add a guarded system-owned transition reconciler or implement
and test constrained auto autonomy; changing YAML alone is insufficient.

## Root Cause

Astrogen clean is not yet an autonomous Growth OS. It is a collection of
scheduled prompts and issue conventions whose success is inferred from local
task status.

The primary architectural defect is that **business outcomes are not
first-class durable state with enforced transitions**. Routine completion means
an orchestration issue is done, not that an article was delivered or an SEO
action executed. Long prose contracts ask agents to maintain those invariants,
but the database and workflow engine do not enforce them.

Four coupled design failures make the defect persistent:

1. **False completion:** report/routing/local-child completion can satisfy a
   routine while the business outcome is absent.
2. **Global coupling:** one blocked article or external finding consumes the
   only effective work lane.
3. **No portfolio controller:** CEO/CMO are event-driven managers, but no
   deterministic service continuously reconciles goals, due outcomes, WIP,
   inventory, stalled cases, and recovery deadlines.
4. **Configuration drift:** fixes are copied into prose, manifests, bootstrap,
   and live rows without a canonical build-and-verify path.

This explains why many local fixes improved an individual issue but did not make
the company dependable. The transition guarantees remained unchanged.

## Fix Recommendations

### P0: Define Business Delivery Ledgers

Create durable outcome records independent of issue status:

- `article_delivery`: due date, topic, pipeline case, CMS draft id/admin URL,
  quality gates, notification proof, delivered timestamp
- `seo_cycle`: evidence window, findings, accepted actions, execution cases,
  report/email proof
- `topic_inventory`: status, fingerprint, cluster, evidence, freshness,
  reservation lease, consuming case
- `growth_action`: type, owner, execution class, outcome, value metric,
  blocker class, next review

A routine may be operationally complete while its outcome remains due, but the
portfolio controller must keep the deficit visible and actionable.

### P0: Replace Article Issue Choreography With A Typed Case

Implement an article pipeline with explicit fields and stages:

`topic -> SERP -> brief -> Claude draft -> validate -> humanize -> layout -> image -> CMS draft -> CMO notification -> delivered`

Required rules:

- `operation=create|refresh|repair` is mandatory.
- `before-after-diff` applies only to `refresh` or `repair` of existing content.
- Each stage owns a typed artifact; comments are not work products.
- Transient errors get two bounded retries with backoff.
- One contract/schema correction is allowed before CTO escalation.
- Provider failure opens a circuit breaker for that provider, not the portfolio.
- Productive article WIP is 3; blocked/external cases do not consume it.
- Normal target is one verified draft/day; explicit catch-up may allocate up to
  three while respecting productive WIP and per-topic idempotency.
- CMS remains draft-only and owner delivery contains the CMS admin edit URL.

Use Paperclip pipeline gates and `onEnter` routine execution. Add a narrowly
scoped system reconciler for safe stage transitions because current generic
auto autonomy is disabled.

### P0: Add A Deterministic Growth Portfolio Reconciler

Run a small deterministic service every 15-30 minutes. It should not ask an LLM
to browse all work. It should query outcome ledgers and enforce:

- article due versus delivered
- productive article WIP and per-stage age
- ready topic low-water mark
- weekly SEO actions proposed versus instantiated versus completed
- blocked-case review deadlines
- stale wakeups and missing next-stage execution
- manifest/live drift

It wakes CMO or CEO only with a bounded management issue when judgment or
delegation is required. CEO remains the company portfolio manager; CMO remains
the marketing portfolio manager. Neither should execute specialist work.

### P1: Make Topic Inventory Transactional

Use a table or company-scoped plugin entities with states such as:

`candidate -> evidence_ready -> ready -> reserved -> consumed`

and terminal/side states:

`rejected_duplicate`, `needs_owner_direction`, `waiting_evidence`, `expired`.

Add atomic reservation, lease expiry, topic fingerprint, source evidence date,
and consuming article case. Refill at fewer than three ready topics and target
ten. Import the accepted AST-175 plan and the existing semantic-core entities,
then restore a tested semantic-core read/write tool path.

### P1: Turn Weekly SEO Into An Execution Pipeline

Classify every accepted finding as:

- `auto_execute`
- `requires_owner_decision`
- `monitor_with_date`
- `external_dependency`

The weekly cycle cannot reach business-complete while an `auto_execute` finding
lacks an execution case. Only genuine business choices go to Hermes. Technical
or content work goes directly to CMO/CTO and specialists. Email/report proof is
a delivery artifact, not a substitute for execution.

Deduplicate recurring findings using a stable fingerprint such as
`route + issue_type + normalized_target`. Repeated evidence updates the same
finding and review date instead of creating another blocked task.

### P1: Introduce Typed Recovery Semantics

Every nonterminal stop must have `blockerClass`, `nextReviewAt`, `escalateAt`,
and a continuation owner:

- `transient_runtime`: retry with backoff
- `contract_or_schema`: one correction, then CTO
- `provider_or_tool`: circuit break provider; continue other lanes
- `external_dependency`: park and review later; send one technical handoff
- `owner_decision`: ask one understandable question through Hermes
- `content_quality`: bounded correction or approved fallback

Plain indefinite `blocked` must not be a normal workflow state.

### P1: Establish One Canonical Company Specification

Choose one structured Astrogen spec for agents, routines, plugins, pipelines,
policies, and outcome SLOs. Generate bootstrap payloads, agent instructions, and
verification expectations from it.

Required deployment workflow:

1. `sync --plan`
2. database/config backup
3. apply generated changes
4. `verify --fail-on-drift`
5. smoke tests
6. owner change email with rollback details

Do not treat direct live edits or manually synchronized prose as durable
configuration.

### P2: Measure Outcomes, Not Run Color

Expose and alert on:

- daily drafts due, CMS-created, and owner-notified
- article stage age and productive WIP
- ready topic count and inventory days remaining
- weekly SEO actions accepted, instantiated, completed, and measured
- duplicate findings suppressed
- external blockers by age and next review
- configuration drift

Send owner email for missed SLOs or required technical action. Keep Telegram
free of technical routine noise and keep proactive watches disabled.

## What Not To Do

- Do not solve this with another manual wake or per-issue retry.
- Do not add more broad permissions or cross-owner authorization exceptions.
- Do not make CEO or CMO perform specialist work.
- Do not enable idle agent heartbeat polling as the continuity mechanism.
- Do not keep adding invariants only to `AGENTS.md` prose.
- Do not deploy all current dirty runtime changes as one unreviewed patch.

## Migration Sequence

1. Freeze and inventory the current clean configuration; take a backup.
2. Define canonical outcome schemas and the Astrogen company spec.
3. Implement article and topic pipelines in shadow mode.
4. Import AST-182/CMS 124 as one existing case and AST-175 topics as inventory
   records without creating or publishing content.
5. Add the portfolio reconciler and stage-transition controller.
6. Implement the weekly SEO action pipeline and finding deduplication.
7. Run failure-injection tests for writer, image, CMS, notification, provider,
   authorization, and external-dependency failures.
8. Verify that an unrelated article and SEO action continue while one case is
   blocked.
9. Reconcile live state from the canonical spec and fail on any drift.
10. Activate only after shadow acceptance; retain rollback and owner email.

## Acceptance Criteria For The Future Fix

- Seven consecutive scheduled days require no manual push.
- Every due article has either verified CMS draft plus CMS admin notification,
  or a typed nonterminal state with automatic continuation.
- A deliberately blocked article does not prevent another safe topic from
  entering production within one reconciler interval.
- `no-safe-topic` triggers refill; refill creates transactional ready inventory;
  cadence resumes automatically when topics become ready.
- A weekly SEO `auto_execute` finding creates and advances an execution case
  before the weekly outcome is complete.
- A genuine owner decision produces one clear Ukrainian request; technical
  details are packaged as a developer handoff.
- Duplicate external findings update one durable record instead of opening
  repeated blocked issues.
- Injected writer, image, CMS, and notification failures follow their retry,
  fallback, or escalation policy while unrelated lanes continue.
- CEO and CMO dashboards show portfolio outcomes and deficits, not only task
  statuses.
- `verify --fail-on-drift` passes for agents, routines, plugins, pipelines,
  secrets bindings, and generated contracts.
- CMS remains draft-only, old Paperclip remains untouched, and Telegram
  proactive watches remain disabled.

## Conclusion

The problem is not that CEO, CMO, or specialist models are insufficiently
intelligent. Paperclip currently gives them a weak operating substrate: prose
instead of enforced workflow state, issue completion instead of outcome
completion, global blocking instead of isolated capacity, and no deterministic
portfolio reconciler.

The durable fix is to make Astrogen a typed, outcome-driven operating system on
top of Paperclip's native pipeline primitives, with a small deterministic
controller for continuity and one canonical configuration compiler. Until those
transition guarantees exist, further agent-prompt refinements will remain local
repairs rather than autonomy.
