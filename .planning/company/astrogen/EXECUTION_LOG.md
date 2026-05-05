# Execution Log: Astrogen

## 2026-05-05

- Analyzed Astrogen Semantic Core MCP run `run_20260505_163254_core_product_intent_9b8d4983` after MCP query-shape gate fixes.
- Confirmed query-shape gates removed provider/UI junk from keyword-like artifacts: no email, legal/UI labels, price/count snippets, numbered UI labels, or provider error/timing rows in accepted/review/parked/competitor/recall artifacts.
- Recorded a remaining quality issue: `high_demand_conflict` review escalation still promotes high-volume off-topic competitor content terms, such as unrelated marketplace/service/banking/app-store phrases, when topical/domain confidence is too low.
- Confirmed `natal_chart` must not be added as a canonical product binding because that product is not canonized yet. Natal-card terms should remain brand/core-topic/review/opportunity evidence until Product Discovery or human approval.
- Updated agency-core Semantic Core MCP instructions and Astrogen SEO requirements so review escalation must consider topical fit and domain/result-type confidence, not volume alone.
- Re-ran Astrogen Semantic Core MCP layer 1 `core_product_intent` with policy-driven review escalation, competitor content parsing, and explicit `brand_astrogen` seed variants.
- New run `run_20260505_124618_core_product_intent_304990fe` completed with 32 accepted keywords, 36 review candidates, 79 parked keywords, 31 clusters, and 4 SERP segments.
- Brand check passed for first-layer inclusion: `Astrogen`, `астроген`, `astrogen україна`, `астроген натальна карта`, and `astrogen натальна карта` landed in accepted keywords; `astrogen com ua` landed in review as ambiguous intent.
- Exported local inspection CSVs under `.tmp/astrogen-semantic-core/csv-run_20260505_124618_core_product_intent_304990fe/`.
- Updated Semantic Core MCP competitor SERP recall contract for Astrogen and agency-core.
- Added agency-core instructions for production semantic-core runs to enable competitor content parsing when maximum recall matters.
- Clarified that parsed competitor content terms are candidate evidence only and still require normal MCP gates/layer membership.
- Updated the Semantic Core MCP plugin adapter to surface competitor expansion evidence summary during `prepare-paperclip-import`.
- Added tests that preserve `semantic_expansion.serp_competitor_expansion` run-layer parameters and expose `competitor_expansion_endpoint` / `serp_result_classification_reason` evidence summary.

## 2026-04-29

- Restored Astrogen-specific GSD working context after DiskInternals setup work was moved to a separate dialogue.
- Created baseline Astrogen `STATE`, `ROADMAP`, `REQUIREMENTS`, `PAPERCLIP_ENTITY_MAP`, and `config.json`.
- Reaffirmed scope rule: Astrogen-specific work goes under `.planning/company/astrogen/`; shared reusable assets go under `.planning/agency-core/`.

## 2026-05-01

- Added live Paperclip agent `MKT Growth Strategy Architect` under CMO for Stage 15 strategic opportunity work.
- Added live Stage 15 process contract: `Strategic Opportunity Brief` after accepted Product Discovery and before downstream execution.
- Updated CMO contract so new/free routes such as `/free-horoscope` require Stage 10 route truth, Stage 15 growth strategy, and human strategy approval before downstream lanes.
- Added output-language guardrails to CMO and Stage 15 contracts: Astrogen human-facing issue comments, plan documents, decision packets, and summaries should be Ukrainian unless explicitly requested otherwise.
- Aligned `MKT Growth Strategy Architect` contract with Stage 15 speculative-mode rule: accepted Product Discovery is required by default, but an explicitly authorized speculative pre-discovery brief is allowed if labeled and non-executable.
- Added secret/log-safety rule to the growth strategy contract after the first smoke run printed broad `PAPERCLIP_*` env output in a run log; live log was scrubbed.
- Strengthened the growth strategy output-language rule after the AST-690 artifact was Ukrainian but the first completion comment used English status wording.
- Tested from CMO through `AST-689`: CMO updated the plan document with Stage 10 -> Stage 15 -> human approval, named `MKT Growth Strategy Architect`, surfaced four hypotheses, and created zero child issues.
- Tested the new agent directly through `AST-690`: it produced a speculative Ukrainian Stage 15 brief for `/free-horoscope`, marked missing Product Discovery clearly, recommended human-review options, created no child issues, and closed the test issue.
- Added agency-core `AGENT_EXECUTION_GOVERNANCE` and adopted it for Astrogen planning: explicit `parentId` vs dependency separation, non-silent task states, named blockers, Paperclip plugin/capability usage, SEO/MCP child lanes, provenance/cost recording, and human-readable notifications.
- Added agency-core `SEO_PERFORMANCE_LOOP` proposal: multi-company/project page ownership, daily sitemap discovery, GSC query accumulation, semantic-core growth from observations, project-page keyword target sets, configurable rank tracking policy, new-page opportunity detection, and product-launch SEO packages.
- Created local Paperclip plugin package `@paperclipai/plugin-gsc-bing-ga4-mcp-agent-tools` as the replacement for legacy `Search Console MCP Agent Tools`: backend-only token secret ref, fixed private MCP endpoint allowlist, default verified GSC/PageSpeed tools, configurable backend allowlist for future Bing/GA4 MCP tools, and site guard for `sc-domain:astrogen.com.ua`.
- Diagnosed stalled `/free-horoscope` flow: CMO created [AST-691](/AST/issues/AST-691) in `backlog`, so Product Discovery Analyst did not start. Recovered by moving [AST-691](/AST/issues/AST-691) to `todo`, which queued an active run. Updated agency-core governance so execution child issues must be `todo`, assignee availability must be checked, and managers must verify wakeup/active-run evidence after delegation.
- Confirmed [AST-691](/AST/issues/AST-691) completed, woke CMO on [AST-688](/AST/issues/AST-688), and CMO accepted Stage 10.
- CMO created [AST-692](/AST/issues/AST-692) for Stage 15; `MKT Growth Strategy Architect` completed a Strategic Opportunity Brief recommending `/free-horoscope` as a hybrid entry + retention system with guarded upsell, pending human decision on growth role and URL/naming policy.
- A stale recovery check briefly re-opened [AST-692](/AST/issues/AST-692) after it had already completed; restored it to `done`, cancelled the duplicate wakeup, and added the recovery-race guardrail to agency-core governance.
- CMO accepted Stage 15, blocked [AST-688](/AST/issues/AST-688) pending human decision, and opened [AST-693](/AST/issues/AST-693) / [AST-694](/AST/issues/AST-694) as the HIA decision-card path.
- Corrected the HIA human-decision model after [AST-694](/AST/issues/AST-694) exposed a logical gap: owner-assigned decision issues do not naturally resume the source workflow when the owner comments. [AST-693](/AST/issues/AST-693) and [AST-694](/AST/issues/AST-694) were cancelled, the decision request was moved back into [AST-688](/AST/issues/AST-688), and contracts now require source-issue comment + `Human Decision Needed` label by default.
- Cleaned stale backlog/silent-stall states after a second backlog review:
  - [AST-644](/AST/issues/AST-644) cancelled as obsolete old Observability alert for the Instagram Stage 57 blocker.
  - [AST-645](/AST/issues/AST-645) cancelled as obsolete HIA decision-card backlog under the retired owner-card model.
  - [AST-688](/AST/issues/AST-688) restored to `blocked` with `Human Decision Needed` after the source-issue decision comment replaced [AST-694](/AST/issues/AST-694).
  - [AST-683](/AST/issues/AST-683) moved from silent `in_progress` to explicit `blocked` with `Human Decision Needed` because its assignee `OPS Observability Agent` is intentionally paused.
  - Post-cleanup active queue has no `backlog`, `todo`, or silent `in_progress` items; remaining open items are explicit human-decision blockers.
- Re-reviewed all open `Human Decision Needed` tasks and removed stale/non-owner gates:
  - [AST-688](/AST/issues/AST-688) had already received and applied the owner answer, so it is no longer a human gate and moved forward to [AST-696](/AST/issues/AST-696).
  - [AST-664](/AST/issues/AST-664) cancelled as obsolete runtime-recovery blocker; latest comments stated `human decision required: no`, and the old cohort state no longer matched current agent status.
  - [AST-683](/AST/issues/AST-683) cancelled as obsolete Observability watch; re-enabling Observability should be a fresh decision/task, not continuation of the old watch.
  - [AST-129](/AST/issues/AST-129) cancelled as obsolete Instagram/Bright Data rerun blocker; this should not be revived without a new explicit cost/coverage guarded task.
  - Post-cleanup open `Human Decision Needed` count is `0`; active process is [AST-688](/AST/issues/AST-688) -> [AST-696](/AST/issues/AST-696).
- Ten-minute control cycle found [AST-696](/AST/issues/AST-696) completed and CMO moved [AST-688](/AST/issues/AST-688) to the next real human gate: choose `1-3` segment hypotheses for Validation Preparation.
- Cancelled [AST-697](/AST/issues/AST-697) as a duplicate HIA liaison gate after it incorrectly carried `Human Decision Needed`; canonical owner response location remains [AST-688](/AST/issues/AST-688).
- After the owner answered [AST-688](/AST/issues/AST-688), recovered the chain through [AST-698](/AST/issues/AST-698), [AST-700](/AST/issues/AST-700), and [AST-701](/AST/issues/AST-701) with 10-minute controls and manual wakeups where child issues were `todo` without active run.
- The process reached a new valid owner gate on [AST-688](/AST/issues/AST-688): approve whether to open Stage 45 Paid Ads Copy for `/free-horoscope` and which segments to include.
- Cancelled [AST-702](/AST/issues/AST-702) as another duplicate HIA liaison gate; Paperclip auto-labels blocked issues as `Human Decision Needed`, so HIA liaison tasks must not remain `blocked` after posting the canonical source-issue question.

## 2026-05-02

- Corrected the `/free-horoscope` direction after the owner clarified the needed lane is SEO/blog traffic acquisition, not Google Ads / paid ads copy.
- Closed [AST-688](/AST/issues/AST-688) with a direction-correction note and created [AST-705](/AST/issues/AST-705) as the CMO-owned SEO/blog content-plan parent lane.
- Linked [AST-704](/AST/issues/AST-704) as the specialist content-plan child under [AST-705](/AST/issues/AST-705); the child correctly detected missing prerequisites instead of producing a speculative Stage 56 plan.
- Returned [AST-704](/AST/issues/AST-704) to CMO as done-with-prerequisite-blocker, because the blocker was not owner input: missing route-level SEO contract plus `Stage 53 -> Stage 54 -> human approval`.
- CMO opened [AST-706](/AST/issues/AST-706) for canonical `/free-horoscope` route reference refresh. Corrected [AST-705](/AST/issues/AST-705) from `blocked` to `in_progress` because a manager parent waiting for a running child is not a `Human Decision Needed` gate.
- Fixed [AST-706](/AST/issues/AST-706) live workspace permission blocker: Paperclip runtime user `oc` could not create files under `/home/paperclip/astrogen/docs/reference/products/` because `/home/paperclip` lacked traversal permission and `products/` ACL masked write access. Added minimal ACL permissions for `oc`, verified write/create, re-woke [AST-706](/AST/issues/AST-706), and it completed successfully.
- Synced created `/free-horoscope` reference files from live Astrogen workspace into the local Astrogen repo and committed them there. CMO accepted [AST-706](/AST/issues/AST-706) and opened [AST-707](/AST/issues/AST-707) for Stage 53 semantic core; [AST-707](/AST/issues/AST-707) has a running heartbeat run.
- Investigated the root cause of the `AST-706` permission failure and confirmed it was systemic: `/home/paperclip/astrogen` is shared by Paperclip app/agents running as `oc`/uid 1000 and File Browser running as `paperclip`/uid 1002. The old ACL mask gave `oc` read/execute on several existing directories but not write/create.
- Applied a cross-runtime ACL/default-ACL policy to `/home/paperclip/astrogen` so both `oc` and `paperclip` can create and edit managed workspace files. Verified bidirectional smoke writes in `docs/reference/products`, `docs/reference`, and `work`.
- Added reusable ops documentation in `ops/paperclip/company-workspace-permissions.md` and added the workspace mount permission rule to agency-core execution governance.
- Diagnosed [AST-708](/AST/issues/AST-708) as a true runtime silent-noop: `SEO Semantic Core Validator` assignment runs exited successfully but left the issue in `todo` with no result comment.
- Planned and implemented agency-core Phase 3 `Runtime Silent-Noop Recovery And Telegram Operational Alerts`.
- Deployed the updated Paperclip app to live `paperclip-app-1` and verified `/api/health` returned `ok`.
- Re-ran [AST-708](/AST/issues/AST-708) after deployment. The new guard correctly marked replacement run `63d44d5c-a4d1-4d72-9e03-f4d6de1968a6` as `failed/silent_noop`, added a diagnostic issue comment, released the issue execution lock, and sent a Telegram operational alert (`messageId=477`).
- Existing issue-done Telegram messages now include the responsible agent name when available.
