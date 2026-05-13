# Phase 9: Astrogen Semantic Core Review GUI

## Objective

Replace the Excel-based semantic-core review loop with a database-backed web interface for Astrogen.

The GUI must let a human review semantic-core candidates, move keywords between accepted/review/parked/rejected/product-discovery states, and approve layer progression without editing spreadsheets. Excel may remain an export/import fallback, but it must not be the canonical state.

## Design Context

Use Astrogen's live site visual language, not generic Paperclip admin styling.

Observed from `https://astrogen.com.ua/` on 2026-05-06:

- Font: Montserrat from Google Fonts.
- Primary brand hue: deep burgundy `hsl(345 80% 28%)`, seen in CSS variables as `--primary` / `--accent`.
- Secondary accent: gold `#C69C6D`.
- Base surfaces: white background, dark neutral text, muted light-gray panels.
- UI tone: calm, service/admin oriented, rounded but restrained, Tailwind/shadcn-style controls.
- Human-facing language: Ukrainian.

See `DESIGN_CONTEXT.md` in this phase directory for the extracted tokens and UI implications.

Visual rule: this is an operational review tool, not a landing page. Use dense, scannable layouts, clear filters, restrained color, and decision-focused controls. Avoid decorative hero sections, gradient backgrounds, marketing cards, or icon clutter.

## Problem

The current workbook review flow is fragile:

- Paperclip UI currently cannot attach `.xlsx` review files cleanly in the issue comment flow.
- Excel mixes default decisions with human edits, so extraction must compare against the original workbook.
- Multi-sheet review creates duplicate decisions across `Review Queue`, `Parked`, and `SERP Evidence`.
- Humans can accidentally edit hidden/internal fields or produce decisions that violate Phase 23 import policy.
- The source of truth is split between MCP artifacts, local files, issue comments, and manual extraction scripts.

The reviewed Astrogen layer 1 run showed the failure mode clearly: human accepted useful terms, but the rerun became `unsafe_for_import` because locale-warning accepted terms were promoted without a policy-level resolution.

## Data Contract

Canonical state must live in PostgreSQL, preferably in `seo_ops`.

Required persisted entities:

- semantic-core review batch:
  - company/project/site;
  - MCP project id;
  - source run id;
  - layer;
  - import readiness;
  - policy version;
  - counts and unsafe reasons;
  - status: `draft`, `in_review`, `decisions_submitted`, `rerun_required`, `ready_for_next_layer`, `unsafe_blocked`, `closed`.
- review items:
  - keyword id / normalized keyword;
  - source artifact type: accepted, review, parked, serp evidence, recall;
  - current machine membership;
  - recommended human decision;
  - human decision;
  - decision status;
  - product binding status;
  - review reason;
  - evidence summary;
  - policy warnings;
  - duplicate/group key;
  - latest source run id and artifact row pointer.
- review decisions:
  - append-only decision log;
  - actor user/agent;
  - previous decision;
  - new decision;
  - notes;
  - timestamp;
  - validation outcome.
- rerun/import gate:
  - submitted MCP review artifact id;
  - reviewed rerun id;
  - latest `prepare_paperclip_import` result;
  - blocker reasons.

Do not store tokens or provider secrets in these tables.

## Visible Human UI

Do not expose every MCP field in the table. The default table should show only what a human needs to decide:

1. Keyword
2. Current status
3. Suggested decision
4. Human decision
5. Reason / warning badge
6. Product binding
7. Topic match
8. Confidence
9. Volume: geo and global
10. Evidence summary

Everything else goes into an expandable detail drawer:

- source and endpoint;
- SERP/competitor evidence;
- policy version;
- full decision trace;
- raw MCP payload;
- duplicate occurrences across artifacts;
- previous human decisions;
- rerun history.

## Main Screens

### 1. Review Batch Overview

Purpose: decide whether the layer can move forward.

Must show:

- layer and source run id;
- import readiness;
- unsafe reasons;
- accepted/review/parked/rejected counts;
- unresolved review count;
- warnings by class: locale, competitor evidence, no entity anchor, low confidence;
- CTA: `Почати рев'ю`, `Продовжити рев'ю`, `Запустити перевірку`, `Перейти до наступного шару` when allowed.

### 2. Decision Workbench

Primary working screen.

Layout:

- left filter rail or compact top filters;
- main review table;
- right detail drawer for selected keyword;
- sticky bottom action bar for bulk decision summary.

Filters:

- status: accepted, review, parked, rejected, evidence;
- decision: empty, accept, reject, defer, revise, product discovery;
- warning: locale, mixed language, competitor evidence, no entity anchor, low confidence;
- product binding: canonized product, brand binding, topic only, proposed product, unknown;
- source: seed, provider, GSC, SERP evidence, human-added;
- search text.

Bulk actions:

- accept selected;
- defer selected;
- reject selected;
- route to product discovery;
- clear decisions;
- add note.

Guardrails:

- `unsupported_locale` or `mixed_language` cannot be silently accepted unless a policy override reason is chosen.
- competitor content evidence cannot become accepted without product/topic fit.
- `no_entity_anchor` accepted decisions require product discovery, product binding override, or explicit "topic cluster only" treatment.
- UI must show "will require rerun" before submitting decisions.

### 3. Product Binding Resolver

Purpose: resolve accepted terms that need product/topic binding.

Required controls:

- choose canonized product;
- mark as brand binding;
- mark as topic-only;
- propose product discovery;
- reject as outside scope.

This screen should be opened from warning badges, not forced on every keyword.

### 4. Rerun Gate

After human decisions:

- submit decisions to MCP;
- rerun current layer with decisions;
- call `prepare_paperclip_import`;
- show final readiness.

Outcomes:

- `ready_accepted_only`: allow accepted import and next layer.
- `ready_after_review`: show remaining review queue.
- `unsafe_for_import`: block next layer and list unsafe rows.
- `needs_policy_fix`: create/assign policy-fix task.

### 5. Audit And Export

Support:

- export current view to CSV/XLSX for offline discussion;
- export decision log;
- attach or register a work product in the Paperclip issue;
- link source MCP artifacts and reruns.

Export is secondary. Database state remains canonical.

## Interaction Details

Decision values:

- `accept`
- `reject`
- `defer`
- `revise`
- `product_discovery`
- `keep_review`

The UI must map human-friendly labels to MCP-safe review decisions. It should not expose raw MCP action names when they are confusing.

Recommended visible labels:

- `Прийняти`
- `Відхилити`
- `Відкласти`
- `Уточнити формулювання`
- `На продуктове рев'ю`
- `Залишити на рев'ю`

Rows with duplicate keyword appearances across artifacts should be grouped as one decision with a source list, not shown as independent contradictory rows.

## Implementation Plan

1. Extend `seo_ops` with review batch/item/decision tables or add equivalent tables to the SEO Performance Loop plugin schema.
2. Add backend import tool:
   - input: `prepare_paperclip_import(run_id)` payload;
   - output: review batch and normalized review items.
3. Add decision API:
   - update one row;
   - bulk update;
   - append audit event;
   - validate policy warnings.
4. Add MCP submit/rerun API:
   - build `submit_review_decisions` payload from DB;
   - store MCP review artifact id;
   - rerun same layer;
   - store new import readiness.
5. Build Astrogen review UI using Astrogen design tokens.
6. Add issue integration:
   - show a review batch link on `AST-708`;
   - register review batch as issue work product;
   - post status comments only for major transitions.
7. Add tests for duplicate row grouping, warning-gated decisions, append-only audit, and rerun readiness handling.
8. Use the current Astrogen layer 1 files as a fixture:
   - source run `run_20260506_111721_core_product_intent_454bf24d`;
   - edited review decisions;
   - reviewed unsafe rerun `run_20260506_130019_core_product_intent_8fa5e715`.

## Acceptance Criteria

- Human can complete semantic-core review without touching Excel.
- All human decisions are stored in Postgres with audit trail.
- Table shows only decision-relevant columns by default.
- Details drawer exposes full MCP evidence when needed.
- Duplicate keywords across review/parked/SERP evidence resolve to one decision.
- UI blocks or flags unsafe accept decisions before rerun.
- MCP decisions can be submitted from DB.
- Current layer can be rerun from the UI.
- Next layer button is disabled unless latest `prepare_paperclip_import` permits it.
- `AST-708` can link to the review batch instead of relying on file attachment.

## Non-Goals

- Do not build a full keyword research UI in this phase.
- Do not build SEO monitoring dashboards here.
- Do not expose all raw MCP columns in the main table.
- Do not make Excel the canonical review artifact.
- Do not add Astrogen-only schema names; use tenant-scoped data.
