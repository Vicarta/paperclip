---
phase: 46
name: autonomous-growth-execution-kernel
status: in_progress
created: 2026-07-14
depends_on: [27, 35, 40, 41, 44, 45]
requirements: [AST-GOV-08, AST-GOV-09, AST-GOV-10, AST-GROWTH-06, AST-GROWTH-07, AST-GROWTH-08]
subsystem: paperclip-astrogen-clean
tags: [paperclip, astrogen, autonomy, pipelines, recovery, ceo, cmo, growth]
---

# Phase 46: Autonomous Growth Execution Kernel

## Objective

Make Astrogen continue producing useful growth outcomes without operator pushes
when one task, agent, provider, permission, or website dependency fails.

CEO and CMO remain reasoning managers. Paperclip owns deterministic process
state, transitions, retries, liveness, WIP, idempotency, and durable handoffs.

## Confirmed Failure Modes

1. Article production is called a typed pipeline but live Paperclip has zero
   native pipelines and zero pipeline cases. State exists only in prompt text.
2. The allocator uses a global one-open-article lock. One blocked article stops
   all unrelated topics.
3. CMS child completion required mutation of the CMO-owned parent. Authorization
   correctly rejected it, creating a child-parent deadlock after CMS success.
4. Routine `completed` is treated as operating success even when the linked
   issue becomes blocked or no business output is produced.
5. Daily technical collectors repeatedly create blockers for the same root
   cause instead of updating one canonical remediation.
6. CEO daily triage checks assignment hygiene, not portfolio continuity.
7. There is no CMO weekly growth-portfolio routine between SEO analysis and CEO
   direction review.

## Architecture Decisions

### Native Pipeline Control

Create native Paperclip pipelines for:

- `astrogen-article-production`;
- `astrogen-topic-inventory`;
- `astrogen-growth-actions`.

Article stages:

`opportunity -> serp_check -> brief -> draft -> validate -> humanize -> layout
-> layout_validate -> image -> cms_draft -> cmo_delivery -> delivered`

Each stage automation has one assigned owner and one typed output contract.
Pipeline cases carry topic key, CMS id, evidence references, media policy,
attempt count, current blocker class, and outcome timestamps. Prompt text may
explain judgment but is not the source of transition truth.

### Failure Isolation

- A blocker affects only its case and explicit dependents.
- Productive article WIP cap is 3 non-blocked cases.
- Blocked/external-wait cases remain visible but do not consume productive WIP.
- Per-topic idempotency remains strict across all statuses.
- Retry resumes the same case/stage with bounded attempts.
- Exhausted recovery moves to a manager decision or external handoff while
  unrelated work continues.

### Handoff Ownership

- Specialist writes artifacts/documents only on the assigned child/case.
- Stage completion exposes those outputs through the pipeline output summary.
- Full linked documents are read through the case-scoped output route, never by
  granting a manager broad read access to the specialist's foreign issue.
- Parent/portfolio manager aggregates evidence into manager-owned documents.
- No specialist is required to mutate another owner's parent.

### Executive Operating Layer

- Wednesday 09:00: SEO/GEO evidence and action queue.
- Wednesday 10:15: CMO growth portfolio plan and delegation.
- Wednesday 11:00: CEO company direction review.
- Wednesday 12:30: CTO Paperclip self-improvement review.
- Daily 06:40: CEO continuity/dedup/blocker triage.
- Daily 10:00: bounded article allocation from validated inventory.

CEO and CMO never do specialist work. Their completion gate is delegated,
executable work with outcome targets and review dates, not a narrative report.

### Outcome Ledger And SLO

Record at minimum:

- validated ready topics;
- productive and blocked article WIP;
- CMS drafts delivered and median lead time;
- completed SEO actions and verified implementation;
- repeated/canonical blocker count and blocker age;
- weekly traffic, search visibility, conversion, and revenue evidence;
- number of accepted growth actions with a live execution path.

An operating cycle is degraded when scheduler health is green but outcome SLO
is missed.

## Execution Waves

### Wave 1: Stop Current Deadlocks

- Replace cross-owner parent writes with child-owned evidence and manager-owned
  aggregation.
- Remove the global article lock and enforce productive WIP cap 3.
- Align routine revision snapshots with actual catch-up variables/policy.
- Repair AST-217/AST-182 from existing CMS draft evidence without creating a
  duplicate article or regenerating content/image.

### Wave 2: Leadership Portfolio Control

- Activate CMO weekly growth portfolio routine.
- Harden CEO daily triage and weekly direction review.
- Add canonical finding dedup and external-wait classification.
- Add outcome/SLO evidence to weekly documents and owner reporting.

### Wave 3: Native Pipeline Cutover

- Add source-controlled pipeline manifest and idempotent bootstrap/sync.
- Create stage automation routines with specialist owners.
- Ingest one existing ready topic as a canary.
- Verify stage output handoff, bounded retry, blocker isolation, CMS draft, and
  CMO notification.
- Stop legacy issue-tree orchestration only after canary success.

### Wave 4: Continuous Verification

- Add deterministic checks for due triggers, orphaned wakes, stage liveness,
  WIP limits, blocker age, and outcome SLO.
- Weekly self-improvement reads pipeline events and rejection/retry evidence.
- Alert by email only when the system cannot recover or outcome SLO remains
  missed; technical Telegram noise remains suppressed.

## Acceptance Criteria

- One blocked article does not prevent allocation of a different safe topic.
- A successful CMS child can finish without permission to mutate its parent.
- CMO automatically aggregates the child output and completes delivery.
- CMO produces and delegates a weekly growth portfolio from SEO/business data.
- CEO records company-level direction and delegates; CEO performs no specialist
  work.
- Article production runs as native pipeline cases, not only issue prompt prose.
- Duplicate technical findings update canonical remediation work.
- Health reports business outputs and live execution paths, not only `done`
  counts.
- No CMS publish, Telegram proactive watch, old Paperclip mutation, or secret
  exposure occurs during cutover.

## Execution Status

- Wave 1 applied live after backup. AST-217 completed from existing CMS draft
  evidence; event-driven parent continuation completed AST-182 without creating
  another article or regenerating its image.
- Cross-owner parent mutation was removed from CMS specialist contracts.
- Productive article WIP is 3; blocked/external-wait work no longer consumes it.
- Telegram false completion was reproduced and corrected. AST-182 closed only
  after direct plugin delivery returned messageId `1258` and wrote delivery
  proof. Generic issue-done notifications and proactive watches remain off.
- Wave 2 routines are active and idempotently reconciled through the Paperclip
  API: daily leadership continuity, weekly CMO growth portfolio, and weekly CEO
  direction.
- Wave 3 is live. Source-controlled manifests reconcile three native pipelines:
  article production, topic inventory, and growth actions. Repeated sync reports
  `changed=false`, healthy pipeline graphs, and no warnings.
- The AST-228 work was migrated as native article case
  `article:numerology-online-expert-vs-calculator` with a parent topic case.
  Existing layout and image evidence was reused; no image provider call was
  repeated. The 1344x768 source is accepted against the 1472x822 target because
  per-axis deviations are 8.6957% and 6.5693%, both within the configured 20%.
- Native CMS automation AST-237 created and verified Payload draft 125, then
  transitioned the case to CMO delivery. Native CMO automation AST-239 sent a
  gender-neutral Telegram message containing only the title and CMS admin URL,
  wrote delivery proof `messageId=1264`, consumed the reserved topic, and moved
  the article case to terminal `delivered`.
- Two runtime defects found by the canary were fixed at source: mixed legacy
  `environments.company_id` schema drift now converges through migration 0126,
  and the Paperclip skill now documents native pipeline case operations so
  agents do not discover private routes from UI bundles or OpenAPI guesses.
- Docker production builds now compile every enabled bundled plugin. A failed
  pre-deploy image exposed missing plugin manifests, was rolled back, and the
  lifecycle state was restored before the corrected image was deployed. The
  final boot activated 8/8 plugins and registered 80 tools.
- Post-cutover convergence is live. Topic stage `ready` now has a first-class
  breakdown contract to article `opportunity`, with scheduled allocator-only
  dispatch, topic reservation, child-terminal recovery, and no legacy article
  issue tree. All three pipeline health checks pass without warnings.
- Daily evidence/GSC collectors and CEO triage now update canonical growth
  cases by stable fingerprint. CEO never mutates assigned/blocked foreign
  issues; a foreign 403 redirects routing into the growth case and does not
  block the portfolio.
- Seventeen legacy blockers were consolidated into four native growth cases,
  AST-218 was closed after live `amountMicros` bridge verification, and AST-226
  reran successfully with zero unassigned or blocked work.
- Current-week topic refill is active as native case
  `growth:topic-inventory-refill:2026-W29`; weekly CMO completion now requires
  3-10 native candidate topic case ids, not a Markdown-only content plan.
- Live CEO/CMO/content-strategist contracts were updated after DB and file
  backups. Change-report email delivery proof:
  `email_a6abf846dc9a4d9735f6cd49b1fab473`.
- Native manager delegation is now a first-class atomic issue-create contract.
  `pipelineCaseLink.caseId` plus a stable `requestKey` creates the specialist
  issue, its `work` link, and the case event in one DB transaction. Migration
  0127 enforces retry idempotency. The two-step issue-create then issue-link
  path remains only for existing/migrated work.
- Case output fetch hints now resolve full documents through
  `GET /api/cases/{caseId}/outputs/documents/{documentId}`. Live AST-275 proof
  was read without truncation, AST-283 advanced the refill to verify, and
  AST-284 completed it as measured/done with three ready topic cases.
- Change-report email delivery proof for atomic delegation and case-scoped
  evidence: `email_ce9138c00b9d3b7b655966634355bb92`.
- Wave 4 remains partially open: schedule deterministic outcome-SLO/liveness
  checks and make weekly self-improvement consume pipeline event/retry evidence.
