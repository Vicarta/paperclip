# Issue Comment Auto-Replies Plan

## Context

Today Paperclip wakes the assigned agent when a board user adds a comment to an issue, but the result of that run is usually only visible in run detail, live run output, or scattered workspace artifacts.

From the operator's perspective this is the wrong shape. If a human writes a comment on an issue, the natural expectation is that the assigned agent replies back on the same issue thread with a clean, human-readable answer.

The current codebase already has the key primitives needed for this:

- issue comments are durable and already drive issue work
- issue comment events already wake agents through heartbeat orchestration
- issue detail already renders comments and linked runs in one timeline
- adapters already return structured execution outputs like `summary` and `resultJson`

What is missing is a server-side step that turns a completed comment-triggered run into a durable agent-authored reply comment.

## Problem Statement

Current behavior has three UX failures:

1. A user comment triggers work, but the response is not posted back where the user asked the question.
2. The user has to hunt for the result in run detail, transcript, or files.
3. If an agent does write anything back manually, formatting quality depends on prompt discipline rather than product behavior.

That makes issue comments feel like an unreliable trigger instead of a true conversational work surface.

## Goals

1. When an issue comment wakes an agent, the completed run should post a reply comment back to that same issue.
2. The reply should be human-readable and concise, with no transcript noise, debug chatter, or runtime metadata.
3. The behavior should be implemented centrally in server orchestration, not by repeating prompt rules per agent.
4. The first version should work for existing local adapters, especially `codex_local`, without requiring adapter-specific product wiring.
5. The new behavior should preserve current run history, activity logging, and issue/run linkage.

## Non-Goals

- Building nested comment threading.
- Replacing run detail pages or live run streaming.
- Designing a general-purpose chat product separate from issues.
- Posting every tool step or transcript delta back into comments.
- Auto-summarizing arbitrary non-issue runs.

## Desired UX

### Success path

1. Board user adds a comment to an issue.
2. Paperclip wakes the relevant agent.
3. The run completes.
4. Paperclip posts one agent-authored issue comment containing the actual response.
5. The comment remains linked to the underlying run for drill-down.

### Failure path

If the run fails, the issue should still receive a short agent-authored blocker comment that explains what happened in operator language.

Example shape:

- what was attempted
- why it could not complete
- what the human should do next, if anything

No stack traces, raw stderr, or tool event dumps should be posted into the comment.

## Scope of V1

V1 should only auto-reply for runs that were explicitly created from issue-comment interaction.

That includes:

- assignee wakeups from `issue.comment`
- mention wakeups from `comment.mention`
- reopen-via-comment wakeups where a human comment is still the triggering interaction

V1 should not auto-reply for:

- timer heartbeats
- generic automation runs unrelated to a user comment
- project-level or agent-level runs with no issue comment context

## Current Code Facts

### Comment-triggered wakeups already exist

`server/src/routes/issues.ts` already creates wakeups from issue comments and places issue/comment identifiers into the wakeup payload and context snapshot.

### Issue UI already supports mixed comments and runs

`ui/src/components/CommentThread.tsx` already renders a merged issue timeline of comments and linked runs. It also already knows how to associate a comment with a run when activity contains both identifiers.

### Structured result data already exists

Adapters can already return:

- `summary`
- `resultJson`
- `errorMessage`
- `question`

`server/src/services/heartbeat-run-summary.ts` already has a summarization helper for result payloads.

### Server already posts some technical comments

`server/src/services/heartbeat.ts` already posts system-generated comments for workspace/runtime readiness in specific cases. That proves server-side comment posting from heartbeat completion is already an accepted architectural pattern.

## Proposed Product Rule

When a run meets all of these conditions:

- it is linked to an issue
- it was triggered by an issue comment flow
- it reaches a terminal state
- a human-facing reply body can be derived

Paperclip should create exactly one agent-authored reply comment on that issue.

This reply should be treated as durable operator-facing output. Run logs and transcripts remain available separately for debugging.

## Proposed Detection Rules

A run qualifies for issue auto-reply when its context snapshot indicates comment-originated interaction.

Primary signals:

- `contextSnapshot.issueId` exists
- `contextSnapshot.commentId` exists
- `contextSnapshot.source` is one of:
  - `issue.comment`
  - `comment.mention`
  - `issue.comment.reopen`

This should be checked in server heartbeat finalization, not in UI.

## Proposed Output Selection Rules

### Success output priority

Generate the reply body from the best available human-facing field, in this order:

1. `adapterResult.summary`
2. summarized `adapterResult.resultJson`
3. a minimal fallback generated by server templates

### Failure output priority

Generate a short blocker comment from:

1. sanitized `adapterResult.errorMessage`
2. sanitized `resultJson.error` or `resultJson.message`
3. a minimal fallback failure template

### Question path

If the adapter returns `question`, V1 should post a compact question comment instead of a generic success/failure summary.

## Proposed Sanitization Rules

The comment generator must strip technical clutter before posting.

Remove or suppress:

- lines starting with `[paperclip]`
- raw stdout/stderr snippets
- session IDs, runtime IDs, worktree details, or absolute local file system paths unless they are user-relevant deliverables
- token/cost metadata
- command invocation notes
- path directives like `The above agent instructions were loaded from ...`
- empty boilerplate and repeated headings

Preserve:

- the actual outcome
- created or updated deliverables when useful
- the next action or blocker when applicable

## Proposed Comment Format

The format should be strict and boring on purpose.

### Success

- one short summary paragraph
- optional bullet list of created or updated artifacts
- optional closing line if human action is needed

### Failure

- one short blocker paragraph
- optional one-line next step

### Question

- one short question paragraph
- optional 2-5 clear answer choices when provided by adapter data

Avoid:

- giant markdown templates
- raw transcripts
- speculative filler
- repeated restatement of the user comment

## Proposed Server Architecture

Add a dedicated helper in heartbeat completion flow.

Suggested shape:

- `buildIssueAutoReplyComment(...)`
- `shouldPostIssueAutoReply(...)`
- `postIssueAutoReplyComment(...)`

Responsibilities:

### `shouldPostIssueAutoReply(...)`

- inspect finalized run context
- determine whether the run was triggered by issue-comment interaction
- prevent non-comment runs from auto-posting

### `buildIssueAutoReplyComment(...)`

- choose best source content from adapter outputs
- sanitize technical noise
- normalize markdown formatting
- return `null` if there is no safe human-facing content to post

### `postIssueAutoReplyComment(...)`

- create the issue comment as the agent
- write activity that links `commentId` and `runId`
- enforce idempotency so one run cannot post multiple auto-replies

## Idempotency Strategy

This behavior must be idempotent.

Requirements:

- no duplicate reply comments for the same run
- safe retry behavior if comment posting fails after run finalization
- ability to inspect whether a run already posted an auto-reply

Preferred implementation:

- add an explicit persisted marker on the run or in a side table
- do not rely only on comment body matching

If schema churn is undesirable for V1, a temporary fallback could be activity-based detection, but persisted state is the more defensible design.

## Data Model Options

### Option A: Reuse activity log only

Pros:

- minimal schema changes

Cons:

- weaker idempotency guarantees
- more brittle retries

### Option B: Add reply-comment tracking to runs

Examples:

- `heartbeat_runs.auto_reply_comment_id`
- `heartbeat_runs.auto_reply_posted_at`

Pros:

- clear linkage
- easy idempotency
- easy debugging

Cons:

- schema change required

Recommendation: choose Option B.

## Integration Point

The best integration point is server heartbeat finalization after the run reaches a terminal state and after usage/result metadata is persisted.

Why this point is correct:

- final status is known
- `summary`, `resultJson`, and `errorMessage` are available
- issue linkage is still available
- activity and comment creation can reference the finalized run id

This should happen before the function fully returns control, so the issue timeline is durable immediately after run completion.

## Run-to-Comment Linking

The UI already knows how to show a comment as linked to a run when activity provides both identifiers.

The server should therefore log activity for the auto-reply comment with:

- `action: issue.comment_added`
- `entityType: issue`
- `entityId: issue.id`
- `details.commentId`
- `runId`
- `agentId`

That should let current UI behavior keep working with little or no frontend change.

## Adapter Compatibility

### `codex_local`

High priority. This is the main target for the current deployment.

Use:

- `summary` first
- `resultJson.summary/result/message` second

### Other local adapters

The same server logic should apply to:

- `claude_local`
- `cursor`
- `gemini_local`
- `opencode_local`
- `pi_local`

because they already expose similar summary/result fields.

### `openclaw_gateway`

This should remain compatible, but V1 should avoid relying on OpenClaw-specific comment-posting behavior. The server should still own the default issue auto-reply behavior when enough structured output exists.

## Edge Cases

### Agent writes its own issue comment during the run

V1 should not try to collapse or deduplicate semantically similar comments. It only needs to ensure that the server itself does not post duplicates for the same run.

### Empty summary but successful file changes

If the run succeeded but there is no usable summary, post nothing rather than emit technical garbage.

### Long summaries

Trim aggressively to a reasonable size and prefer one concise comment over a giant dump.

### Sensitive content

Do not echo secret-looking values, auth material, or hidden env-derived values into comments.

## Implementation Phases

## Phase 1: Comment Auto-Reply Plumbing

1. Add run qualification helper for comment-triggered runs.
2. Add reply content builder and sanitizer.
3. Add comment posting on run finalization.
4. Log linked activity with `runId` and `commentId`.

## Phase 2: Idempotency Hardening

1. Add explicit persistence for `auto_reply_comment_id` and posted timestamp.
2. Guard retries and race conditions.
3. Add regression coverage for duplicate prevention.

## Phase 3: UX Polish

1. Refine formatting rules.
2. Improve question rendering when adapter returns structured `question` data.
3. Optionally surface a small badge in run detail showing which comment was auto-posted.

## Test Plan

### Server tests

1. Comment-triggered successful run posts one agent-authored reply comment.
2. Mention-triggered run posts one reply comment.
3. Non-comment timer heartbeat posts no reply comment.
4. Failure run posts one short blocker comment without stderr noise.
5. Empty/technical summary yields no comment.
6. Duplicate finalization does not create duplicate comments.

### UI regression checks

1. The new auto-reply comment appears in issue timeline without reload surprises.
2. Existing run cards still appear.
3. Linked run pill on the comment remains intact when activity contains `runId`.

### Manual acceptance checks

1. Add a board comment to an assigned issue.
2. Confirm the agent runs.
3. Confirm a clean reply appears in the same issue thread.
4. Confirm no transcript junk appears in the posted comment.
5. Confirm run detail is still available separately.

## Acceptance Criteria

1. A board comment to an assigned issue causes the resulting run to post back a human-readable reply comment on that issue.
2. The reply is concise and free of technical noise.
3. The reply is visibly attributable to the responding agent.
4. The reply remains linked to the run for drill-down.
5. Non-comment heartbeats do not suddenly start spamming issue comments.
6. Duplicate run-finalization paths do not create duplicate reply comments.

## Rollout Strategy

1. Implement behind a feature flag if schema or behavior risk looks high.
2. Enable in local/dev first.
3. Validate with `codex_local` issue-comment flows.
4. Expand to other local adapters after confidence is high.
5. Enable by default once the behavior is stable and comments remain clean.

## Recommendation on Process

A full GSD milestone workflow is probably too heavy for this task right now.

Recommended process:

- create a dedicated branch
- land this plan doc first
- implement in small backend-first slices
- keep tests close to each slice
- only pull in full GSD ceremony if this expands into a broader issue-chat initiative with multiple phases and UI workstreams

That keeps the work disciplined without turning a focused bugfix/product-gap into unnecessary process overhead.
