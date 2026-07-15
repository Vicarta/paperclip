# Phase 46 Wave 3 Summary

Date: 2026-07-14
Status: Wave 3 complete; Phase 46 remains in progress for Wave 4

## Delivered

- Native Paperclip pipelines for article production, topic inventory, and
  growth actions, reconciled idempotently from `pipelines.yaml`.
- Pipeline-scoped agent authorization and stage-owner write grants.
- Native Pipeline Cases skill/reference for deterministic case reads, field
  updates, documents, blockers, transitions, and review actions.
- Idempotent environment schema convergence migration for instance-scoped
  execution environments.
- Production Docker build contract that compiles all enabled bundled plugins.
- One-call image policy: target 1472x822, one candidate, and acceptance of the
  provider result when both dimension deviations are at most 20% and visual QA
  passes. No retry, upscale, crop, or format-only conversion is required solely
  for within-tolerance dimensions.

## Live Canary Proof

- Article case: `095ef69d-6078-4d05-9487-fb5047235667`
- Topic case: `1b397783-74a4-4fd9-9adc-5f446dff0d08`
- CMS draft: `https://cms.astrogen.com.ua/admin/collections/blogPosts/125`
- CMS automation: AST-237, done
- CMO delivery automation: AST-239, done
- Telegram delivery proof: message 1264
- Final article stage: `delivered`, terminal `done`
- Final topic stage: `consumed`, terminal `done`
- Image provider calls during migration/canary continuation: 0
- Plugin boot: 8 succeeded, 0 failed, 80 tools registered

## Post-Canary Convergence

- Native topic `ready` now dispatches to article `opportunity` only through the
  scheduled CMO allocator and first-class Paperclip breakdown.
- The source topic advances to `reserved`; successful delivery consumes it,
  while terminal article cancellation returns a still-reserved topic to
  `ready`. The ready stage itself has no automation.
- Daily collectors write deduplicated growth cases. CEO routes only genuinely
  unassigned actionable issues and treats foreign assigned blockers as case
  evidence, not mutation targets.
- 17 legacy blockers were replaced by 4 native root-cause cases. No blocked
  issue remains after convergence; the pipeline has live finding/review/
  delegation paths.
- Empty topic inventory activated one stable weekly refill case. The weekly CMO
  plan must create 3-10 native candidate topics and cannot complete with only a
  document or agent conversation.
- DB backup: `/paperclip/instances/astrogen-clean/data/backups/paperclip-20260714-113413.sql.gz`.
- Agent contract backup:
  `/home/paperclip/backups/astrogen-agent-contracts-2026-07-14T113332-453Z`.
- Owner change email proof: `email_a6abf846dc9a4d9735f6cd49b1fab473`.

## Delegation Integrity Follow-up

- A live CMO to CTO delegation exposed a two-step failure window: the issue
  could be created and reassigned before its native case `work` link existed.
- Managers may link existing same-company work when they have pipeline write
  and task delegation authority; this does not grant issue mutation rights.
- New delegation uses atomic `pipelineCaseLink` issue creation. Stable request
  keys return the same issue on retry and cannot create duplicate specialist
  paths.
- Regression proof: 21/21 pipeline route tests plus DB, shared, and server
  typechecks pass.

## Case-scoped Evidence Follow-up

- New specialist delegation is atomic and idempotent through
  `pipelineCaseLink.caseId` plus a stable `requestKey`; migration `0127` adds
  the company/case/request uniqueness boundary.
- Full linked issue documents are now readable through the native case output
  boundary at
  `GET /api/cases/{caseId}/outputs/documents/{documentId}`. This does not grant
  broad access to a foreign issue, comments, or heartbeat context, and it
  preserves low-trust redaction.
- Pipeline context fetch hints use the case-scoped route. Route tests cover
  linked reads, unlinked and retired 404s, cross-company 404s, and the updated
  context hint; 22/22 tests and server typecheck pass.
- Live acceptance read the complete AST-275 evidence document: 3269 characters,
  three native ready topic keys, no truncation, no redaction.
- CMO AST-283 consumed that evidence and moved the refill case to verification;
  SEO Performance Analyst AST-284 approved it. The refill case is now
  `measured`/`done` and topic inventory has three `ready` cases.
- The independent GA4 evidence mismatch is correctly isolated in
  `external_wait`; it no longer blocks topic inventory or article cadence.
- Live images: `.52-atomic-pipeline-delegation` followed by
  `.53-case-output-read`; final app health is OK with 8/8 plugins and 80 tools.
- Backups:
  `/home/paperclip/backups/paperclip-astrogen-clean-before-atomic-delegation-20260714T1215Z.dump`,
  `/home/paperclip/backups/paperclip-astrogen-clean-before-case-output-read-20260714T1242Z.dump`,
  and `/home/paperclip/backups/astrogen-agent-contracts-2026-07-14T125110-642Z`.
- Final delegation convergence reports `already-converged`; active or queued
  heartbeat runs: 0.
- Owner change email proof:
  `email_ce9138c00b9d3b7b655966634355bb92`.
- Email developer handoff was hardened after AST-224 exposed two delivery
  defects: escaped `\\n\\n` reached the recipient literally, and a generic
  notification could omit the affected URL list. Plugin version `0.2.0` now
  normalizes escaped paragraph separators at the transport boundary and adds
  typed tool `email-developer-handoff-send`.
- The developer handoff tool rejects an empty/incomplete `affectedPages` list.
  Every page requires an absolute URL, current problem, required changes, and
  verification steps. CTO live/bootstrap contracts forbid generic notification
  tools for developer implementation requests.
- Corrected AST-224 handoff was delivered for eight exact URLs. Delivery proof:
  `email_8075963b3390b04026e42ac248837d49`; Resend provider message:
  `90c12433-b2a7-4fb5-962e-6bd330cf77ce`.
- Live image is `.54-email-developer-handoff`; `.53-case-output-read` is the
  immediate rollback image. Pre-deploy backup:
  `/home/paperclip/backups/paperclip-before-v54-email-handoff-20260714T1615Z.dump`.

## Human Cover Emotion And Diversity Follow-up

- A visual audit of the latest approved human covers found a repeated formula:
  seated person/couple, table, laptop/notebook/cup, bright neutral room,
  burgundy clothing accent, and a weak or neutral expression. Prompt wording
  changed, but the narrative moment and composition did not.
- Image plugin `paperclip.openrouter-image-agent-tools` v0.2.0 now exposes
  `image-visual-history-get` and stores recent approved human-scene
  fingerprints in company-scoped plugin state.
- Paid `human_scene` generation requires typed art direction with a specific
  event, action, emotional beat, 2-5 visible emotion cues, gaze, shot, camera
  angle, props, and brand anchors. A proposal must differ from every recent
  cover on at least 4 of 9 visual axes.
- The stable Astrogen layer is premium editorial realism, clean natural light,
  and restrained burgundy/warm-gold accents. Setting, subjects, action,
  emotion, gaze, shot, angle, and props are the variable layer; brand colors
  cannot substitute for a new scene.
- Six reviewed human covers (`AST-235`, `AST-189`, `AST-141`, `AST-128`,
  `AST-106`, `AST-92`) seed live visual history. CMO, layout editor, layout
  validator, image executor, native pipeline, bootstrap, and canonical image
  design/process contracts use the same gate.
- Regression proof: image plugin tests 15/15 and typecheck pass. Live negative
  preflight read all six fingerprints, rejected missing art direction, and
  rejected an intentional AST-235 duplicate before provider execution. Cost
  events stayed `513 -> 513`; no paid image was generated for deployment QA.
- Current live image is `.55-image-emotion-diversity`; rollback is
  `.54-email-developer-handoff`. Health is OK, image plugin v0.2.0 registered
  both tools, all 8 active plugins started, and post-build cleanup restored 41G
  free disk space. Backup:
  `/home/paperclip/backups/paperclip-before-v55-image-emotion-20260714T1640Z.dump`.

## Remaining

Wave 4 must schedule continuous deterministic checks for scheduler due work,
orphaned wakes, stage liveness, productive WIP, blocker age, and business
outcome SLOs. Weekly self-learning must consume native pipeline event and retry
evidence. Technical Telegram noise remains disabled.

The final rebuild preflight passes with 41G free against the conservative 30G
floor. BuildKit cache is 0B after the manual rebuild cleanup, and the weekly
timer remains enabled with a 10GB reserve policy. The current `.55` image and
the `.54` rollback tag remain; no old Paperclip or Hermes data was removed.
