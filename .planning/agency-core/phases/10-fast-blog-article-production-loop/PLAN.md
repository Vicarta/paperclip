# Phase 10: Fast Blog Article Production Loop

## Problem

Astrogen article production is slower than the actual writing work.

Observed on `AST-802`:

- first full writer draft took about 2.4 minutes;
- correction drafts took about 2 minutes each;
- fallback GPT rescue took about 5 minutes;
- the largest delay was not drafting, but waiting about 60 minutes between child completion and CMO manager review;
- CMO heartbeat is currently hourly (`intervalSec=3600`);
- parent issues are not woken immediately when a child execution issue finishes.

The target is one article ready for review in about 10-15 minutes when topic and brief are already approved.

## Goal

Create a fast, reliable article-production loop:

```text
accepted brief
-> writer draft
-> immediate manager/validator handoff
-> image/CMS/Telegram
```

No hourly manager gap should sit between completed child tasks.

## Immediate Runtime Change

Set CMO heartbeat interval to 10 minutes as a temporary operational safety net:

```json
{
  "heartbeat": {
    "enabled": true,
    "intervalSec": 600,
    "cooldownSec": 10,
    "wakeOnDemand": true,
    "maxConcurrentRuns": 1
  }
}
```

This is not the final design. The final design is event-based parent wakeup.

## Required System Changes

### 1. Child Completion Wakes Parent Manager

When an issue transitions to `done` or `blocked` and has `parentId`, Paperclip should evaluate whether the parent assignee should be woken.

Wake parent when:

- child status becomes `done`, `blocked`, or `in_review`;
- parent status is `in_progress` or `todo`;
- parent has an assignee agent;
- parent assignee has `wakeOnDemand=true`;
- no active run is already running for that parent agent/issue.

Wake payload should include:

- `source=child_completion`;
- child issue id/identifier/status;
- parent issue id/identifier;
- reason: `child_completed_parent_review_needed`.

Do not wake if the parent is terminal.

### 2. Writer Preflight Before Done

Article writers must not mark Stage 59 tasks `done` unless deterministic checks pass.

Required checks:

- artifact path exists and is non-empty;
- locked H1/title exact match;
- slug exact match;
- SEO meta title exact match;
- SEO meta description exact match when the brief locks it;
- supporting keywords set preserved;
- CTA URLs preserved;
- no Han/mixed-script characters in Ukrainian prose;
- closeout summary does not claim checks passed if any check failed.

If any check fails, writer should return `blocked` or `returned` with a structured blocker class instead of `done`.

### 3. Faster Fallback Routing

Do not wait for three rounds when the blocker is deterministic.

Immediate fallback after one failed correction is allowed for:

- `seo_lock_drift`;
- `locale_script_corruption`;
- `closeout_misreport`;
- missing canonical artifact after `done`.

### 4. Validator Routing

After a writer returns a clean artifact, CMO should open validation immediately.

If the validation task is created as a child, parent wakeup should again work when validation returns.

### 5. Expensive Heartbeat Policy

Do not enable routine LLM heartbeat for specialist writers.

Allowed:

- CEO, CMO, CTO routine heartbeat;
- specialist wake-on-demand only;
- temporary specialist heartbeat only with explicit human approval and time-boxed rollback.

## Acceptance Criteria

- CMO heartbeat interval is 10 minutes in live runtime.
- A child issue completion can wake the parent manager without waiting for hourly heartbeat.
- Writer cannot mark article draft `done` with deterministic SEO lock mismatch.
- A single deterministic correction failure routes to fallback writer.
- One approved-brief article can reach completed draft + validation handoff in 10-15 minutes in a controlled smoke.

## Verification

- Query live CMO runtime config and confirm `intervalSec=600`.
- Create or use a test parent/child issue pair and verify child `done` queues a parent wakeup.
- Run writer preflight unit tests against:
  - valid Ukrainian article artifact;
  - artifact with `西方`;
  - artifact with changed H1/slug/meta.
- Run a controlled article lane and record:
  - brief completion time;
  - writer completion time;
  - parent-review wake latency;
  - validation handoff time.
