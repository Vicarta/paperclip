# Phase 20: Article Writer Fallback And Cost-Controlled Recovery

## Goal

Prevent Astrogen blog article production from silently stalling or repeatedly returning to the same failing writer path, without burning tokens on frequent no-op LLM heartbeats.

## Context

- Live `SEO Blog Article Writer` currently uses `adapter_type=openrouter` with `model=anthropic/claude-sonnet-4.6`.
- Its runtime heartbeat is currently `enabled=false`; `wakeOnDemand=true`; `intervalSec=3600` is configured but inactive.
- `SEO Blog Article Validator` and `Chief Marketing Officer` use `codex_local` with `gpt-5.4`.
- Wave 1 article production showed a real failure mode:
  - writer produced drafts;
  - validator returned them for revision;
  - writer revised;
  - validator returned the same blocker classes again;
  - a stale HIA gate incorrectly asked the owner for a decision instead of opening corrective writer work.

## Cost Baseline

Pricing used for planning: Claude Sonnet 4.6 via OpenRouter at `$3 / 1M input tokens` and `$15 / 1M output tokens`.

Approximate monthly cost if every heartbeat invokes the writer LLM:

| Interval | Runs / month | 2k in / 200 out | 5k in / 500 out | 12k in / 1k out | 30k in / 2k out |
| --- | ---: | ---: | ---: | ---: | ---: |
| 5 min | 8,640 | $77.76 | $194.40 | $440.64 | $1,036.80 |
| 15 min | 2,880 | $25.92 | $64.80 | $146.88 | $345.60 |
| 60 min | 720 | $6.48 | $16.20 | $36.72 | $86.40 |
| 3 hours | 240 | $2.16 | $5.40 | $12.24 | $28.80 |
| 6 hours | 120 | $1.08 | $2.70 | $6.12 | $14.40 |

Planning decision: do not enable a 5- or 15-minute LLM heartbeat for article writers. Reuse and extend Paperclip's existing runtime recovery checks and wake-on-demand execution instead.

Paperclip already has a runtime-level guard for technical stalls:

- startup and periodic heartbeat recovery reaps orphaned runs and resumes persisted queued work;
- issue-assigned successful runs with no useful issue-side effect are marked `failed/silent_noop`;
- the runtime writes a diagnostic issue comment, releases the execution path, and sends an operational Telegram alert.

Phase 20 must not build a second general watchdog. It should add article-production transition rules on top of the existing recovery layer.

## Decisions

### Writer fallback

- Keep the current `SEO Blog Article Writer` as the primary writer.
- Create a separate fallback writer, tentatively `SEO Blog Article Writer GPT`, with the same article-writing contract but a different model/provider path.
- The fallback writer is not a general replacement. It is used only for rescue rewrites after repeated validation failures.
- The fallback writer must receive:
  - accepted Stage 55 brief;
  - latest failed draft artifact;
  - all relevant Stage 61 validation artifacts;
  - exact blocker classes;
  - locked SEO fields;
  - route/CTA contract;
  - analytics handoff requirements.

### Retry policy

- First Stage 61 failure: return to the same writer for a focused correction pass.
- Second Stage 61 failure with the same blocker class: allow one stricter corrective rerun only if the CMO makes the must-close checklist explicit.
- Third failure, or a repeated blocker class after the strict corrective rerun: stop assigning the same writer. CMO opens a rescue rewrite task for `SEO Blog Article Writer GPT`.
- If fallback writer also fails validation with the same blocker class, stop writer retries and route to CMO for contract/brief/validator mismatch diagnosis.

### Blocker taxonomy

Validator completion comments must include stable blocker classes:

- `seo_lock_drift`
- `route_cta_drift`
- `analytics_handoff_incomplete`
- `unsupported_claims`
- `reader_language_or_tone_drift`
- `brief_scope_drift`
- `internal_workflow_leak`
- `missing_required_contextual_links`
- `publication_packaging_incomplete`

CMO uses these classes to count repeated failures. Do not rely on free-text comments alone.

### Article production recovery rules

Do not solve this with frequent writer heartbeats.

Extend the existing Paperclip recovery path with cheap deterministic article-production checks that inspect Paperclip state and only wake agents when there is a real condition:

- writer issue `in_progress` with no output / no useful action beyond threshold;
- writer run queued too long without start;
- validator returned `returned for revision`, but no corrective writer issue exists after a short window;
- parent CMO issue is `blocked` with `Human Decision Needed`, but latest evidence says no owner decision is required;
- stale HIA gate contradicts a newer owner approval or downstream execution evidence.

Recommended thresholds:

- writer queued with no start: 15 minutes;
- writer running with no output: 20 minutes;
- writer total runtime: 30 minutes unless the run is actively producing useful output;
- validator returned-for-revision with no child issue: 15 minutes;
- stale human-decision gate audit: hourly, deterministic only.

### Writer heartbeat policy

- Keep primary writer `wakeOnDemand=true`.
- Keep routine writer heartbeat disabled by default.
- If a heartbeat is needed as a safety net, use a long interval only: 3-6 hours, never 5-15 minutes.
- Prefer a deterministic system watchdog over an LLM heartbeat.
- If enabling a writer heartbeat, require:
  - max concurrent runs = 1;
  - no-op response cap;
  - compact inbox-only context;
  - budget alert threshold;
  - no full issue thread load unless assigned work exists.

## Implementation Plan

1. Add `SEO Blog Article Writer GPT`.
   - Same article writer instruction bundle.
   - Different adapter/model path.
   - Separate name and audit identity.
   - No routine heartbeat by default.

2. Update CMO contract.
   - CMO must count article attempts by article family and blocker class.
   - CMO must switch to fallback writer after repeated same-class failures.
   - CMO must not create owner/HIA gates for internal writer-quality failures.
   - CMO must create owner-facing summaries only after validator acceptance.

3. Update SEO Blog Article Validator contract.
   - Require structured blocker classes in every returned-for-revision comment.
   - Require `attempt_number`, `same_blocker_repeated=true|false`, and `recommended_next_owner`.
   - `recommended_next_owner` values:
     - `same_writer_revision`
     - `fallback_writer_rescue`
     - `cmo_contract_diagnosis`
     - `owner_editorial_review`

4. Update SEO Blog Article Writer contract.
   - Writer must quote the exact accepted SEO lock in its completion comment.
   - Writer must explicitly mark each validator blocker as closed.
   - Writer must not change route/CTA/product surface unless the accepted brief says so.

5. Extend existing runtime recovery with article-production rules.
   - Prefer the server-side recovery path that already handles orphaned runs, queued work, and `silent_noop`.
   - If implemented as a routine first, it must be a thin deterministic inspector, not an LLM heartbeat.
   - It should inspect issue/run tables and comments without invoking article-writer LLM.
   - It should create or reopen recovery issues only when deterministic evidence exists.

6. Add tests or smoke checks.
   - Same blocker twice routes to strict corrective rerun.
   - Same blocker three times routes to fallback writer.
   - Fallback failure routes to CMO diagnosis, not infinite retries.
   - Stale HIA gate is cancelled when downstream draft/validation evidence proves owner input is not needed.
   - No 5-minute writer heartbeat is enabled.

## Acceptance Criteria

- A dedicated fallback writer agent exists and is distinguishable in audit logs.
- CMO contract includes retry/fallback rules and forbids owner gates for internal writer-quality failures.
- Validator outputs stable blocker classes.
- Article production cannot loop indefinitely through the same writer on the same blocker class.
- Writer LLM is not invoked on a frequent no-op heartbeat.
- Recovery from stale article-production states reuses Paperclip's existing recovery layer, is deterministic, cheap, and visible in Paperclip.
