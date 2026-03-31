# Project Human-Facing Language (V1)

## Goal

Add one simple project-level setting:

- `Human-facing language`

This setting should control how the system talks to people inside a project, without forcing a language on all project artifacts.

## Product Decision

V1 is intentionally narrow.

Apply the project default only to:
- issue comments;
- clarification comments;
- manager summaries;
- human-facing replies;
- host-authored fallback replies when the host posts text to humans.

Do **not** apply it automatically to:
- markdown artifacts;
- research docs;
- code comments;
- structured outputs;
- workspace files in general.

This keeps the first release aligned with the real pain point: agents should communicate with humans in the right language, while work artifacts stay flexible.

## Precedence

Use this precedence order:

1. explicit issue-level instruction;
2. project default human-facing language;
3. agent-specific instruction;
4. adapter or model default.

Interpretation:
- if the current issue explicitly says to respond in another language, follow the issue;
- otherwise, if the project defines a human-facing language, use it for human-facing communication;
- only fall back to agent or adapter defaults if the project does not define one.

## V1 Setting Shape

UI label:
- `Human-facing language`

Initial supported values:
- `Ukrainian`
- `English`

Recommended persistence format:
- store canonical codes in the database, for example `uk` and `en`;
- render human-readable labels in the UI.

Why store codes instead of free text:
- easier validation;
- easier precedence logic;
- easier future localization and migration.

## Scope Boundary

This setting is **not** “project language”.

It is a communication preference for human-facing interaction inside the project.

That means:
- a project may use `Ukrainian` for issue comments;
- while still allowing English markdown artifacts or structured research outputs when the workflow requires that.

## Implementation Plan

### 1. Data Model

Add a nullable field to the project record:
- `humanFacingLanguage`

Concrete touchpoints:
- `packages/db/src/schema/projects.ts`
- new DB migration under `packages/db/src/migrations/`
- migration metadata snapshot

Recommended DB type:
- `text("human_facing_language")`

Recommended validation:
- nullable enum-like string constrained in shared validators to V1-supported values:
  - `uk`
  - `en`

## 2. Shared Types And Validation

Add the field to the shared project type and project validators.

Concrete touchpoints:
- `packages/shared/src/types/project.ts`
- `packages/shared/src/validators/project.ts`
- any shared export barrel that already re-exports project validators and types

Expected behavior:
- project create accepts the field optionally;
- project update accepts the field optionally;
- API responses include the field.

## 3. Project Configuration UI

Expose the setting in Project Configuration as one simple project-level field.

Concrete touchpoints:
- `ui/src/components/ProjectProperties.tsx`
- `ui/src/pages/ProjectDetail.tsx`

V1 UI recommendation:
- use a compact select, not a freeform text input;
- options:
  - `Default / unset`
  - `Ukrainian`
  - `English`

Why include `unset`:
- preserves backward compatibility;
- keeps agent-specific defaults working for old projects;
- avoids forced migration decisions at creation time.

## 4. Server Project API

No new endpoints are required.

The existing project routes can carry the field after schema and type updates.

Concrete touchpoints:
- `server/src/routes/projects.ts`
- `server/src/services/projects.ts`

Required behavior:
- `GET /projects/:id` returns `humanFacingLanguage`;
- `POST /companies/:companyId/projects` accepts it;
- `PATCH /projects/:id` updates it;
- activity logging should include the changed field automatically through existing update logging.

## 5. Runtime Injection

V1 should inject the project default once into run context instead of repeating it manually in every issue.

Concrete touchpoint:
- `server/src/services/heartbeat.ts`

Recommended approach:
- when the run resolves a project, load the project record;
- if `humanFacingLanguage` is set, add a compact runtime field to the context, for example:
  - `context.paperclipProject = { id, name, humanFacingLanguage }`
- also add a short normalized human-facing contract string or markdown block, for example:
  - `context.paperclipHumanFacingLanguageInstruction`

Example instruction content:
- `For human-facing communication in this project, default to Ukrainian unless the current issue explicitly requires another language. This applies to issue comments, clarification comments, manager summaries, and direct replies to humans. It does not automatically change artifact language.`

Why inject a prebuilt instruction instead of only raw metadata:
- lower token overhead for agent prompts;
- no need to update every agent prompt template by hand;
- lets adapters append one standard instruction block.

## 6. Adapter Consumption

Adapters already render prompt templates from runtime context. V1 should add one standard project-language note to the run prompt/system prompt path.

Concrete touchpoints:
- `packages/adapters/codex-local/src/server/execute.ts`
- `packages/adapters/cursor-local/src/server/execute.ts`
- `packages/adapters/claude-local/src/server/execute.ts`
- `packages/adapters/gemini-local/src/server/execute.ts`
- `packages/adapters/opencode-local/src/server/execute.ts`
- `packages/adapters/pi-local/src/server/execute.ts`

Recommended behavior:
- append the standardized human-facing language instruction once per run when present;
- do not rewrite the main prompt template architecture;
- keep this additive and adapter-agnostic.

Important:
- the instruction should affect human-facing replies only;
- it should explicitly say that artifact language is unchanged unless the task says otherwise.

## 7. Host-Authored Replies

Host-authored fallback comments must also respect the same project default.

Concrete touchpoints:
- `server/src/services/issue-auto-reply.ts`
- any related heartbeat reply-posting path in `server/src/services/heartbeat.ts`

V1 recommendation:
- when building host-generated human-facing fallback comments, pass the project language in;
- localize only the wrapper text owned by the host, for example:
  - timeout message;
  - generic failure message;
  - clarification framing.

Do not translate agent-provided summary text automatically in V1.

## 8. Behavior Contract

V1 expected behavior:

- Issue says “reply in English” -> use English, even if project default is Ukrainian.
- Issue is silent -> use project default human-facing language.
- Artifact generation task is silent -> do **not** automatically translate the artifact.
- If a workflow later wants artifact-language defaults, that should be a separate feature.

## 9. Tests

### Server tests

Add coverage for:
- project create/update/get with `humanFacingLanguage`;
- heartbeat context injection when the issue belongs to a project with `humanFacingLanguage`;
- precedence:
  - explicit issue-level instruction wins over project default;
  - project default wins over agent default;
- host auto-reply wrapper localization.

Likely files:
- `server/src/__tests__/...` around project routes/services
- heartbeat execution tests
- issue auto-reply tests

### UI tests

Add coverage for:
- Project Configuration renders the new field;
- saving the field patches the project;
- saved value reloads correctly.

Likely files:
- `ui/src/components/...test.tsx`
- `ui/src/pages/...test.tsx`

## 10. Rollout Plan

### Phase A — Data + UI

Ship:
- schema;
- migration;
- shared types;
- Project Configuration field;
- API roundtrip.

Result:
- project can store `Human-facing language`.

### Phase B — Runtime Injection

Ship:
- project field added to heartbeat run context;
- standard human-facing language instruction injected into run context.

Result:
- agents see the project default without issue-level duplication.

### Phase C — Reply Enforcement

Ship:
- adapter prompt injection;
- host auto-reply localization;
- regression tests for precedence.

Result:
- human-facing replies start honoring the project default consistently.

## 11. Non-Goals For V1

Do not implement yet:
- automatic artifact translation;
- per-project research-language defaults;
- per-project markdown artifact language;
- per-agent language overrides in UI;
- full locale bundle / i18n system;
- automatic translation of legacy comments or docs.

## 12. Risks

### Risk: agents over-apply the setting

If the prompt wording is sloppy, agents may start translating artifacts too.

Mitigation:
- keep the instruction explicit about scope;
- test with artifact-heavy tasks and confirm no forced translation happens.

### Risk: conflicting hardcoded agent defaults

Some agent instructions may already say things like “reply to humans in Ukrainian by default”.

Mitigation:
- project runtime contract must explicitly outrank those defaults;
- audit and simplify old hardcoded language defaults where needed.

### Risk: wrapper localization without content localization

Host fallback comments may become partially localized while embedded summary text remains in another language.

Mitigation:
- only localize host-owned wrapper text in V1;
- do not pretend mixed-language summaries were fully translated.

## 13. Acceptance Criteria

V1 is done when:
- a project can save `Human-facing language` in Project Configuration;
- agents inherit it automatically when an issue is silent;
- issue comments, clarification comments, manager summaries, and direct human-facing replies use it by default;
- host-authored fallback replies use localized wrapper text;
- markdown artifacts and structured outputs are not automatically translated just because the project has a human-facing language setting.

