# Phase 37: Article Cadence Stability And Runtime Recovery

## Objective

Make Astrogen article publication reliable again by replacing ad hoc recovery with
explicit system invariants:

```text
login/runtime health
-> plugin/tool readiness
-> writer routing
-> unique CMS draft accounting
-> article quality gates
-> concise Telegram delivery
-> backlog waves until remaining_count = 0
```

This phase is not another passive monitor. It is complete only when production
Paperclip can resume the Astrogen three-daily article cadence and catch-up
backlog without closing parent issues after one duplicate or partial article.

## Live Incident Baseline

Observed on 2026-06-30:

- Board login for `o.s@digital-r-evolution.com` failed with `403` first, then
  Better Auth returned `429 Too many requests`.
- The running production app used a hotfixed plugin state that would not survive
  container recreation.
- `paperclip.payload-cms-agent-tools` had previously been absent from the live
  plugin dispatcher, blocking CMS delivery tasks.
- `AST-2348` advanced only one article slot and repeatedly re-entered narrow
  repair loops.
- `AST-2159` remained blocked on stale/completed child relations and old CMS
  tool-surface blockers, even though the owner correction requires a catch-up
  count greater than the few visible CMS drafts.
- Some prior article parents closed or looked successful without a unique CMS
  `blogPosts/{id}` draft URL.
- Telegram still received messages that were technically true but not useful to
  the owner.

## Requirements Covered

- `AST-GOV-04`: explicit parent/child handoff, named blockers, no silent stuck
  work.
- `AST-GOV-06`: production contract/runtime cutover is part of any contract
  change.
- `AST-CONTENT-01`: no internal process or SEO-planning residue in reader HTML.
- `AST-CONTENT-05`: contextual internal links are part of article delivery.
- `AST-IMG-11`: human-topic covers normally use real-looking people in lived
  moments.
- `AST-HIA-01`: Telegram messages must be human-readable Ukrainian and useful.
- Phase 20 routing decision: Claude/OpenRouter is the primary Stage 59 writer;
  ChatGPT writer is fallback only after a recorded Claude/OpenRouter blocker or
  explicit narrow recovery reason.

## Wave 1: Immediate Production Unblock

Status: partially executed during this phase start.

1. Restore board login.
   - Confirm account exists.
   - Distinguish `403 invalid credential` from `429 rate limit`.
   - Reset the affected board-user password only after proving 403 persists
     after rate-limit reset.
   - Clear stale sessions for the affected user.

2. Deploy persistent runtime image.
   - Replace the non-persistent running-container plugin hotfix with the built
     image `paperclip-app:v2026.626.0-vicarta.11-plugin-runtime-manifest-20260630T1920Z`.
   - Restart only the app container; do not restart Postgres unless a database
     health failure requires it.
   - Verify `/api/health`.
   - Verify plugin loader reports all ready plugins loaded.

3. Clear stale runtime blockers.
   - Close blockers that only claimed Payload CMS tools were absent after the
     plugin loader proves the tools are registered.
   - Return affected CMS delivery issues to `todo`.
   - Queue a wakeup for the delivery assignee.
   - Remove stale `blocks` relations from completed children.

## Wave 2: Cadence State Machine Repair

1. Add or enforce a cadence parent invariant:
   - A scheduled cadence parent cannot close until it records a unique CMS draft
     URL or explicitly records a safe no-delivery disposition.
   - Duplicated parent closure does not count as delivered content.
   - `delivered_count` counts unique CMS `blogPosts/{id}` admin URLs only.

2. Add a catch-up accounting artifact on `AST-2159`:
   - expected slots by date and Kyiv time;
   - unique delivered CMS drafts;
   - duplicate/invalid closures;
   - remaining_count;
   - active wave issue ids;
   - next wave size.

3. Require wave creation in batches of 3-4 article pipelines until
   `remaining_count = 0`.
   - Do not let a catch-up parent close after one article.
   - Do not let a single blocked row freeze the whole backlog; supersede unsafe
     rows and continue with the next safe accepted opportunity.

## Wave 3: Writer Routing And Model Guardrail

1. Enforce Stage 59 primary writer routing:
   - `SEO Blog Article Writer (Claude)` via OpenRouter is primary.
   - `SEO Blog Article Writer (ChatGPT)` is allowed only when the issue comment
     names a concrete Claude/OpenRouter blocker or a narrow deterministic
     sanitizer recovery reason.

2. Add production guardrail:
   - Astrogen production article/cadence lanes must not use Spark models.
   - If any run reports a Spark model limit, the issue must be treated as a
     routing/config regression, not normal rate-limit noise.

3. Verify live agent configs:
   - CMO, CEO, validators, humanizer, image runtime, CMS fixer: `gpt-5.5`.
   - Claude writer: `anthropic/claude-sonnet-4.6` through OpenRouter.

## Wave 4: Article Quality Gates

1. Reader-facing SEO residue gate:
   - Block visible prose that explains keyword variants to the reader as an SEO
     tactic.
   - Allow natural wording that answers the user need without exposing the
     keyword strategy.

2. Related posts gate:
   - CMS draft delivery must include exactly 3 related posts when the article
     type expects related materials.
   - Missing relatedPosts blocks delivery, not post-delivery cleanup.

3. Image gate:
   - Human-experience topics require people unless the brief explicitly says the
     topic is abstract/diagrammatic.
   - For batches of three human-topic covers, at least one should have a person
     looking toward the viewer.
   - Do not count this with a separate owner-facing process; add it to image QA
     metadata and batch-level validation.

4. Internal-linking gate:
   - Article briefs must carry target-product/internal-link priorities from the
     current content plan.
   - Internal-link needs must feed the next content-plan wave, not remain a
     detached SEO report.

## Wave 5: Telegram Quality

1. Suppress low-value completion messages.
   - Do not notify the owner for internal Stage 55/59/61/68 completions unless
     they need action or explain a real delay.

2. Send full useful owner messages when relevant.
   - New CMS draft: title, admin URL, status, cover/relatedPosts presence, and
     whether owner action is needed.
   - Blocker: what stopped, why it matters, who owns the next step.
   - Catch-up progress: unique CMS drafts delivered versus remaining backlog.

3. Preserve line breaks and Telegram formatting.
   - No escaped `\n` in owner messages.
   - No raw run ids, stage labels, or adapter internals unless the owner needs
     them to decide.

## Wave 6: Verification

Working result requires:

- Board login works for the affected user.
- Production app runs the persistent v11 image and all ready plugins load.
- Payload CMS plugin is ready and the April delivery blocker has been returned
  to a real delivery lane.
- `AST-2348` reaches the next CMS draft URL or has a precise blocker that is not
  a stale relation.
- `AST-2159` has a current expected-vs-delivered table and `remaining_count`.
- New article wave creation continues until the missing backlog is zero.
- No new Spark-model article/cadence run appears.
- Telegram owner messages are either useful business updates or suppressed.

## Execution Log

- 2026-06-30 22:40 Kyiv: deployed
  `paperclip-app:v2026.626.0-vicarta.11-plugin-runtime-manifest-20260630T1920Z`
  to production app container only.
- 2026-06-30 22:40 Kyiv: verified `/api/health` OK and plugin loader
  `total=8`, `succeeded=8`, `failed=0`.
- 2026-06-30 22:40 Kyiv: verified Payload CMS, Telegram, CrawlObserver,
  OpenRouter image, GSC/GA4, Collaborator, and SEO loop plugins are `ready`.
- 2026-06-30 22:41 Kyiv: reset board-user password for
  `o.s@digital-r-evolution.com` after proving sign-in still returned `403`
  after the rate-limit reset. Auth endpoint then returned `200`.
- 2026-06-30 22:48 Kyiv: removed stale `AST-2226 -> AST-2159` blocker because
  `AST-2226` was already `done`.
- 2026-06-30 22:48 Kyiv: closed obsolete Payload CMS plugin runtime blockers
  `AST-2364` and `AST-2365`, returned `AST-2363` to `todo`, and queued a wakeup
  for `SEO CMS Technical Fixer`.
- 2026-06-30 23:10-23:35 Kyiv: fixed the board login/runtime blocker at the
  source and production levels.
  - Root cause: explicit `auth.publicBaseUrl` for the public Tailnet/reverse
    proxy URL was being rewritten to the internal listener port. Added a
    loopback-only auth URL rewrite helper and deployed production with
    `BETTER_AUTH_TRUSTED_ORIGINS` including
    `https://ubuntu-oc.tailbd4e1c.ts.net:4447`.
  - Added backward-compatible legacy agent plugin routes:
    `GET /api/agents/me/plugin-tools` and
    `POST /api/agents/me/plugin-tools/execute`.
  - Deployed production app image
    `paperclip-app:v2026.626.0-vicarta.12-auth-plugin-tools-20260630T2012Z`
    with an app-only restart; Postgres was not restarted.
  - Verified external browser login for `o.s@digital-r-evolution.com` returns
    HTTP 200, `/api/health` is OK, plugin loader reports the active production
    plugin set loaded successfully, and authenticated legacy plugin-tools
    discovery returns HTTP 200.
  - Closed stale runtime blocker `AST-2300` with deploy proof after it continued
    to block downstream CMS lanes despite the route fix.
  - Woke `AST-2384` and `AST-2390` through the authenticated board API. `AST-2384`
    completed image generation through OpenRouter
    `google/gemini-3.1-flash-image`; `AST-2390` is now checked out and running
    in `SEO CMS Technical Fixer`.

## Open Follow-Up

- Convert Wave 2-5 invariants into source-level tests and runtime guards where
  they are not already enforced.
- Audit and update live Astrogen contracts after source edits, following
  `AST-GOV-06`.
- Re-check `AST-2348`, `AST-2383`, `AST-2363`, `AST-2227`, and `AST-2159` after
  their queued/running wakeups complete.
