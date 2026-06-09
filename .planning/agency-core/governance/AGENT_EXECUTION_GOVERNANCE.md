# Agent Execution Governance

## Purpose

This contract is the reusable operating rule for Paperclip agents across client companies. It exists to prevent silent stalled work, ambiguous task ownership, untraceable dependencies, and accidental use of tools outside the Paperclip capability model.

It is company-agnostic. Client-specific thresholds, language, budgets, routes, products, and data sources belong in each company overlay.

## Core Model

Paperclip work must keep four concepts separate:

| Concept | Meaning | Must Not Be Used For |
|---|---|---|
| `parentId` | Work hierarchy and manager/child relationship | Dependency tracking by itself |
| Blocker/dependency | A named condition that prevents progress | Hiding work in `todo` or vague comments |
| Assignee | The person or agent expected to act now | Historical ownership or FYI routing |
| Execution state | Status plus checkout/run/wakeup/recovery evidence | A loose text description only |

## Task State Rule

An agent task must not sit silently.

Every open task must be in one of these explainable states:

- `todo`: ready for the current assignee to start or resume.
- `in_progress`: checked out by an assignee and connected to an active/recent run, wakeup, or explicit continuation comment.
- `blocked`: waiting on a named blocker owner with a clear unblock condition.
- `in_review`: waiting for a named human or agent reviewer.
- `done`: completed with a concise result comment and parent handoff where applicable.
- `cancelled`: intentionally stopped with the reason recorded.

If a task is `in_progress` but has no active run, wakeup, recovery path, or fresh continuation comment, a manager or observability routine should treat it as suspicious and escalate or recover it.

## Run Side-Effect Rule

An assignment run is not complete just because the adapter process exits successfully.

For issue-assigned work, a successful run must leave at least one meaningful issue-side effect:

- a result, blocker, continuation, or handoff comment;
- a status transition;
- an artifact/attachment/work-product handoff referenced from the issue;
- a parent/child handoff when the issue is part of a managed workflow.

If an assignment run exits successfully while the issue remains executable and unchanged, Paperclip runtime should treat it as a `silent_noop` failure, release the execution lock, add a diagnostic issue comment, and alert the operator. This prevents work from disappearing behind a green process status.

## Blocker Rule

A blocker must name:

- what is blocked;
- who owns the unblock action;
- what exact answer, approval, tool fix, credential, data, or decision is needed;
- what should happen after the blocker is resolved.

Do not use a vague blocker such as "waiting" without owner and unblock condition.

Human blockers do not need a short timeout. They do need a durable source-issue comment, the `Human Decision Needed` label, a clear human decision request, and a resume path after the answer is recorded. Do not create a separate owner-assigned issue by default; the human should answer in the blocked source issue unless a manager explicitly requests a different channel.

If a separate HIA liaison issue is created for internal tracking, it must not carry `Human Decision Needed`. That label belongs only on the blocked source issue that needs the owner answer, otherwise the human-decision queue becomes duplicated and misleading. Because Paperclip auto-labels blocked issues as `Human Decision Needed`, an HIA liaison issue must not remain `blocked` after the owner-facing source-issue question is posted; close/cancel the liaison or keep it in a non-blocked internal state.

## Parent And Child Handoff Rule

When a child issue completes, the completing agent must:

- write a short result comment on the child issue;
- write a short handoff comment on the parent issue when the parent needs to continue;
- mention or otherwise wake the current parent assignee only when action is actually required;
- avoid closing the parent unless explicitly authorized by the parent workflow.

The parent issue remains the manager-owned coordination lane. Child completion is not automatically the same as parent completion.

When a manager opens an execution child issue and the child is running or ready to run, the parent should normally stay `in_progress`, not `blocked`. Use `blocked` on the parent only for a real external blocker or owner decision. In Paperclip, `blocked` auto-adds `Human Decision Needed`, so using it as "waiting for my child" creates a false human gate.

## Document And Annotation Rule

Use comments for short state changes. Use issue documents for reviewable work products.

A canonical issue document is required when the work product is any of these:

- an owner decision or approval packet;
- a strategy, plan, content plan, article brief, validation package, or report;
- a CMS delivery summary where a human may need to inspect what was delivered;
- a technical finding batch where URL-level evidence, rows, or field changes matter;
- a detailed weekly/monthly performance report;
- a handoff that another agent must use as source material, not just a status note.

Comments are sufficient for:

- one-step technical closeouts;
- wakeup/retry/recovery notes;
- short parent/child handoffs;
- "done/blocked/cancelled" state transitions when the full work product already lives in a document or external artifact.

Reviewers should use inline document annotations when feedback depends on an exact sentence, table row, URL, KPI, CMS field, or claim. Do not ask the owner to describe "where in the report" something is wrong if the reviewer can annotate the exact place.

After a document is accepted, approved, or used as downstream source material, treat it as locked/frozen. Later changes must create a new revision document, a child correction issue, or a clearly labelled amendment. Do not silently rewrite an accepted document and leave downstream agents unable to tell which version was approved.

Telegram and other short notification channels should point to the document or issue and summarize the human meaning. They should not duplicate the full internal artifact, raw rows, or agent-to-agent instructions.

## Delegation Execution State Rule

When a manager creates a child issue for work that should start now, the child issue must be executable, not parked.

Required manager behavior:

- create execution-ready child issues in `todo`, not `backlog`;
- use `backlog` only for intentionally parked or future work, and state why it is not meant to start;
- before assigning a child issue, check that the intended assignee is not `paused`, archived, missing, or otherwise non-invokable;
- if the intended assignee is paused or unavailable, do not silently assign the issue to that agent; either choose a valid assignee or mark the parent/child `blocked` with the owner and unblock condition;
- after creating or updating an execution child issue, verify that there is a wakeup, active run, or clear reason why no wakeup is expected;
- if no wakeup or active run appears for an execution child issue, the manager should recover it immediately instead of waiting for a later heartbeat.
- before any recovery state change, re-read the child issue status and latest comments; never move a `done` or `cancelled` child issue back to `todo` unless a manager explicitly requests rework.
- if the child already completed, treat missing active run as expected and wake the parent/manager for review instead of re-opening the child.

Common failure states this rule is meant to prevent:

- manager says "I opened the child issue" but the child remains in `backlog`;
- child issue is assigned to a paused agent;
- parent remains `in_progress` with no active child execution and no blocker;
- human has authorized execution, but the manager leaves the workflow in a plan-only state.
- completed child issue is accidentally re-opened by a stale recovery check.

## Plugin And Capability Rule

Paperclip agents must use Paperclip's live plugin registry as the source of truth for available tools.

Required flow inside Paperclip:

1. Discover tools with `GET /api/agents/me/plugin-tools`.
2. Execute tools with `POST /api/agents/me/plugin-tools/execute`.
3. Treat plugin output, errors, budget/cost metadata, and provenance as part of the task record.

Agents must not assume that Codex desktop tools, local MCP resources, GitHub connectors, Figma connectors, or external MCP endpoints are available inside Paperclip unless exposed through Paperclip's plugin/capability model or explicitly granted in the company runtime.

Secrets, bearer tokens, and provider credentials must remain server-side and must not be written into prompts, issue comments, run logs, or planning files.

Production plugin configuration must store secret references, not secret values. Company-specific provider credentials must be resolved by company/project context at tool execution time, not by a single global credential unless the plugin is explicitly single-tenant. When the Paperclip UI exposes a secret binding control, plugin settings should use SecretBindingPicker-compatible fields so operators choose existing secrets instead of pasting raw keys.

## Workspace Mount Permission Rule

Company workspaces mounted into Paperclip must be writable by the actual runtime users that create files, not only by the nominal owner of the directory.

Required operations behavior:

- identify every runtime that writes to the workspace, including Paperclip app/agent runtime, file-browser tools, import/export helpers, and deployment scripts;
- use a stable ownership or ACL policy that lets those runtimes create and edit files in the managed workspace;
- set default ACLs on directories so newly created files remain editable by the required runtimes;
- verify cross-runtime writes before assigning agent work that creates docs, reference files, artifacts, or work products;
- document the live policy in `ops/paperclip/company-workspace-permissions.md` or the equivalent company ops note.

Do not treat a single-directory `Permission denied` fix as complete if the workspace is shared by multiple runtimes with different uid/gid values.

## SEO And MCP Work Separation

SEO/MCP workflows should use separate child issues for different execution lanes.

Default lanes:

- generation: create or refresh data/artifacts through MCP/provider workflows;
- validation: check schema, relevance, quality gates, evidence, volume semantics, and import readiness;
- review/routing: decide what to accept, park, reject, route, or ask a human to approve;
- implementation: create briefs, rewrite content, update pages, or change system behavior;
- monitoring: track GSC/rank/SERP/page performance and decide if follow-up action is needed.

Do not combine generation, validation, strategic routing, implementation, and monitoring in one large issue unless the manager explicitly marks it as a small smoke test.

## MCP Provenance And Budget Rule

Provider-backed or MCP-backed work must preserve enough evidence for audit and budget accounting.

Record when available:

- MCP server/tool name;
- `project_id`, `client_key`, `run_id`, `job_id`, or import id;
- schema/version/algorithm version;
- cache hit/miss summary;
- provider request counts;
- estimated or actual cost by provider/stage;
- artifact links or import references;
- validation status and known gaps.

Zero, null, or unavailable metrics must not be treated as automatic rejection without a relevance decision. This is especially important for long-tail SEO keywords.

## Human Communication Rule

Human-facing updates must use the company's configured human language and be understandable without reading agent-internal logs.

Telegram or other human notification channels should include:

- company/project context when multiple companies share one instance;
- issue identifier;
- sending or responsible agent name when known;
- human-readable title;
- short useful result or question;
- one link to the Paperclip task for details.

Avoid raw agent-to-agent summaries, English status boilerplate in non-English companies, provider jargon, and long implementation logs in human notifications. Telegram text should be no-nonsense, mostly short sentences, and materially shorter than the internal task comment.

Each human notification event should have one owner. Do not deliver the same lifecycle event through parallel server-side and plugin-side senders.

## Manager / Observability Expectations

Managers and observability routines should detect:

- execution-ready child issues left in `backlog`;
- child issues assigned to paused or non-invokable agents;
- `in_progress` tasks without active/recent run evidence;
- `blocked` tasks with no owner or unblock condition;
- completed child issues that did not hand off to the parent;
- plugin/tool failures that were hidden as generic blockers;
- human answers recorded in comments but not propagated back to the blocked source issue;
- budget-heavy provider loops without run/cost provenance.

Observability should report "found issue / started recovery / recovery complete" for long-running or stuck system problems when the channel is stable and appropriate.

Runtime-level guards may also report directly when a problem is detected before observability sees it. These alerts should be short, human-readable, and should not expose raw logs, secrets, provider tokens, or long agent-internal reasoning.

## Adoption Rule

Each client company may add local thresholds and language rules, but should not fork this contract unless the agency-core model itself changes.
