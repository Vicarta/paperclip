# Human Review Handoff and My Issues Plan

Date: 2026-03-26
Status: Completed
Owner: UI + Server + Skills + Docs

## Execution Update

Completed in this slice:

- normalized the planning handoff guidance in `skills/paperclip/SKILL.md` so human review handoff defaults to `in_review`;
- wired `/my-issues` into the board routes;
- changed `My Issues` to query `assigneeUserId=me` instead of using the broken “no agent assignee” heuristic;
- added `My Issues` discoverability in the sidebar and command palette;
- verified UI integrity with:
  - `pnpm --filter @paperclipai/ui typecheck`
  - `pnpm --filter @paperclipai/ui build`
- added targeted regression coverage:
  - `pnpm --filter @paperclipai/ui exec vitest run src/pages/MyIssues.test.tsx`
- validated the behavior in a real local Paperclip runtime:
  - `/my-issues` no longer falls through to `:companyPrefix`
  - the page shows the correct empty state when no issues are assigned
  - a board-user-assigned `in_review` issue appears in `My Issues`
  - an unrelated unassigned issue does not appear there
- extended the fix into the canonical agent grant path:
  - newly created agents now receive a `company_memberships` row automatically;
  - imported agents now receive a `company_memberships` row automatically;
  - `GET /companies/:companyId/members` self-heals missing agent memberships for pre-existing agents;
  - `AgentDetail` now surfaces a canonical `Can assign tasks` toggle backed by member grants;
  - `PATCH /companies/:companyId/members/:memberId/permissions` now returns the enriched member-with-grants shape expected by the UI
- verified the canonical grant path in a real local runtime:
  - existing orphaned agents were backfilled into `members`;
  - enabling `Can assign tasks` through the UI wrote a `tasks:assign` grant to the database;
  - disabling it through the UI removed the grant from the database;
  - an agent bearer key received `403 Missing permission: tasks:assign` when the grant was removed;
  - the same agent bearer key successfully reassigned an issue once the grant was restored
- deployed the changes to the live Paperclip instance and verified:
  - `/my-issues` resolves correctly in the live app instead of falling through to `:companyPrefix`;
  - `My Issues` loads user-assigned work from the live backend;
  - a temporary live smoke issue assigned to the logged-in board user appeared in `My Issues`;
  - after cleanup, the issue disappeared from the active `My Issues` list again
- added `My Issues` count semantics in the sidebar:
  - `Inbox` keeps its attention-style aggregate badge;
  - `My Issues` now shows the count of active issues assigned to the current user;
  - this count is driven by the same active-status query as the `My Issues` page itself
- added regression coverage for the new sidebar count:
  - `pnpm --filter @paperclipai/ui exec vitest run src/components/Sidebar.test.tsx`

Still pending:

- broader regression coverage beyond `MyIssues`;
- any future product decision about whether `My Issues` should later include “created by me” as a separate filter/tab;
- deciding whether the legacy `canCreateAgents` fallback in task assignment should remain indefinitely or be retired after canonical grants are fully rolled out.

## Context

Recent live usage exposed a real gap in the human-in-the-loop path.

Observed scenario:

1. A manager agent created a planning artifact and returned the parent issue to the requesting human.
2. The agent used `assigneeUserId=<requesting-user>` correctly.
3. The human could not reliably discover that issue through normal UI navigation.
4. The issue remained `in_progress`, which made the handoff look like active agent execution rather than explicit human review.

This is not just operator confusion.
It is a product-model inconsistency between:

- agent skill guidance
- status semantics
- human task discoverability in the UI

## Evidence

### 1. Paperclip skill guidance contains a real conflict

The agent skill currently says:

- when a board user says “send it back to me”, the agent should reassign to the user and typically set status to `in_review`
  - `skills/paperclip/SKILL.md`
- when the task is specifically “make a plan”, the agent should reassign it to the requester and leave it `in_progress`
  - `skills/paperclip/SKILL.md`

These two rules are in tension.
They create ambiguous behavior for human review handoffs.

### 2. Product/UI spec says `Inbox` is not the same as “my tasks”

The spec currently defines:

- `Inbox` = things requiring board attention
- `My Issues` = issues created by or assigned to the board operator

That is the right conceptual split.

Source:

- `doc/spec/ui.md`

### 3. `My Issues` implementation is incomplete / misleading

The UI has a `MyIssues` page component, but the current implementation filters like this:

- show issues with no `assigneeAgentId`
- exclude only `done` and `cancelled`

This does **not** mean “assigned to me”.
It includes unrelated unassigned issues and can miss the actual user-assigned intent.

Source:

- `ui/src/pages/MyIssues.tsx`

### 4. Backend already supports the right query primitive

The issues list endpoint already supports:

- `assigneeUserId=me`

This means the backend can already return true human-assigned tasks correctly.

Source:

- `server/src/routes/issues.ts`

### 5. The current flow makes review handoff too implicit

Today the human often has to infer the handoff from:

- a comment
- a status that still says `in_progress`
- no obvious “My tasks” entry point in the active nav flow

That is the wrong default for a control plane.

## Problem Statement

Paperclip has the right conceptual model, but the implementation currently fails to make human review handoff first-class and unambiguous.

Specifically:

1. agent-to-human review handoff is not normalized to one clear status;
2. the UI path for “show me the issues assigned to me” is not trustworthy;
3. `Inbox` is being treated as a fallback task list even though the product model says otherwise.

## Goals

1. Make agent-to-human review handoff explicit and consistent.
2. Make human-assigned issues easy to find without reading comments manually.
3. Align skill instructions, server semantics, and UI behavior.
4. Preserve the single-assignee model and existing issue lifecycle.

## Non-Goals

1. Solving all assignment permission problems in the same change.
2. Redesigning the entire inbox model.
3. Turning human work into a separate workflow system outside issues.
4. Reworking all issue statuses globally.

## Recommendation

Implement this in three ordered slices.

## Slice 1 — Normalize human review handoff semantics

### Decision

When an agent returns work to a human for review, the correct default is:

- `assigneeAgentId: null`
- `assigneeUserId: <requesting user>`
- `status: in_review`

This should apply even when the work product is a plan.

### Why

`in_review` matches the meaning of the handoff:

- the agent completed its current step;
- the human is now the active reviewer;
- the issue is not “still being executed by the agent”.

Leaving the issue in `in_progress` obscures ownership and creates bad discoverability.

### Required changes

1. Update `skills/paperclip/SKILL.md`
   - remove the ambiguity between generic “send it back to me” and planning-specific behavior;
   - define one default rule for human review handoff.
2. Update any corresponding guide/reference text that still tells agents to leave plan issues `in_progress` after handoff.
3. Confirm issue lifecycle docs still allow:
   - `in_progress -> in_review`
   - `in_review -> in_progress`
   - `in_review -> done`

### Acceptance criteria

1. Agents returning work to a user for review consistently use `in_review`.
2. The skill docs no longer contain contradictory instructions.

## Slice 2 — Make “My Issues” actually mean “my issues”

### Decision

`My Issues` must become the primary discoverability surface for human-assigned work.

### Why

This matches the product model:

- `Inbox` = alerts / attention
- `My Issues` = work owned by me

The current implementation violates that model.

### Required changes

1. Ensure there is a reachable route/navigation path for `My Issues`.
2. Change `MyIssues` data loading so it does not rely on “unassigned or no agent” heuristics.
3. Use the server’s supported filter:
   - `assigneeUserId=me`
4. Decide whether V1 `My Issues` should include:
   - only issues assigned to me; or
   - issues assigned to me plus issues created by me.

### Recommended V1 scope

Implement **assigned to me first**.

Reason:

- this solves the actual human handoff problem directly;
- it avoids adding new backend filtering for `createdByUserId` in the same change;
- it keeps semantics crisp.

If needed, “created by me” can be added later as a separate tab/filter, but it is not part of the active `My Issues` contract.

### Required changes

1. UI route wiring
   - verify/add route for `My Issues`
   - expose it in navigation consistently
2. UI page behavior
   - replace client-side “no assigneeAgentId” heuristic
   - fetch user-assigned issues via `assigneeUserId=me`
3. Empty-state copy
   - say “No issues assigned to you” only when that is actually true

### Acceptance criteria

1. A user-assigned issue appears in `My Issues` without manual filtering.
2. Unrelated unassigned issues do not appear there.
3. The route is discoverable from normal navigation.

## Slice 3 — Clarify the role of Inbox vs My Issues

### Decision

Do **not** turn `Inbox` into the primary task list for human-assigned issues.

Instead:

- keep `Inbox` as an attention/alerts surface;
- use `My Issues` for explicit human-owned tasks;
- optionally add human-assigned review items to Inbox later as a convenience layer, not the canonical source.

### Why

This keeps the product model coherent and matches the existing spec.

### Required changes

1. Update docs where needed so the intended split is explicit.
2. Keep the count semantics distinct:
   - `Inbox` badge = attention items
   - `My Issues` badge = active assigned issues
3. Avoid mixing “assignment discoverability” with “alert stream” in the first fix.

### Acceptance criteria

1. Operators can explain the difference:
   - Inbox = attention
   - My Issues = assigned work
2. Human review handoff no longer depends on comment-reading alone.

## Follow-Up: assignment permissions for manager agents

This plan originally did **not** directly solve manager-agent `tasks:assign` access.

That was treated as a separate issue because:

- it affects whether a manager can route work autonomously;
- it does not change the correctness of the human review handoff model.

Outcome:

- canonical member grants are now the supported path;
- newly created/imported agents now receive memberships automatically;
- pre-existing agents are self-healed into memberships via the members path;
- `AgentDetail` now exposes a `Can assign tasks` toggle backed by canonical member grants.

Remaining product question:

1. decide which manager roles should receive `tasks:assign` by default;
2. decide whether that default belongs in:
   - company bootstrap;
   - agent onboarding defaults;
   - or explicit board-managed policy.

## Implementation Phases

## Phase 1 — Docs and skill contract

Files:

- `skills/paperclip/SKILL.md`
- `skills/paperclip/references/api-reference.md` if needed
- relevant docs under `doc/` if they describe the old behavior

Deliverables:

- one normalized rule for human review handoff
- no “plan handoff stays in progress” exception unless strongly justified

## Phase 2 — UI discoverability

Files:

- `ui/src/App.tsx`
- `ui/src/pages/MyIssues.tsx`
- any nav/sidebar components that surface personal pages
- `ui/src/api/issues.ts` if client helpers need filter support changes

Deliverables:

- reachable `My Issues`
- correct server-backed filtering for `assigneeUserId=me`
- correct empty state and page semantics

## Phase 3 — Regression coverage

Add or update tests for:

1. `My Issues` only shows user-assigned issues
2. user-assigned issue appears when using `assigneeUserId=me`
3. skill/docs no longer instruct conflicting handoff statuses
4. human review handoff path uses `in_review` in relevant agent behavior fixtures, if test coverage exists for that layer

## Suggested test cases

### Case 1 — Agent returns plan to human

Expected:

- assignee becomes user
- status becomes `in_review`
- issue remains visible in `My Issues`

### Case 2 — Unassigned issue should not pollute My Issues

Expected:

- issue with no assignee does not appear in `My Issues`

### Case 3 — User-assigned review issue is discoverable without comment context

Expected:

- opening `My Issues` is enough to find the task

## Risks

1. There may be existing agent prompts or workflows that implicitly rely on “plan handoff = in_progress”.
2. Some operators may currently use `My Issues` as a loose backlog of unassigned items because of the buggy filter.
3. If the nav does not currently expose `My Issues`, fixing only the page logic will still leave discoverability incomplete.

## Rollout Strategy

1. Fix docs/skill semantics first.
2. Fix UI route + filtering next.
3. Verify with one real end-to-end flow:
   - agent creates plan
   - agent returns issue to human
   - human finds it through `My Issues`
4. Only after that, address manager `tasks:assign` permissions as a separate autonomy improvement.

## Definition of Done

This work is done when all are true:

1. Paperclip has one unambiguous default for agent-to-human review handoff.
2. Human-assigned review tasks are discoverable through `My Issues` without manual issue filtering.
3. `Inbox` is no longer required as the primary retrieval path for human-assigned tasks.
4. The docs, UI, and runtime behavior all describe the same model.

Result:

- Done.
