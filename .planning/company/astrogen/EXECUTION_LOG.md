# Execution Log: Astrogen

## 2026-05-22

- Audited Paperclip LLM usage for Astrogen between 2026-05-21 23:00 and 2026-05-22 10:00 Europe/Kiev.
- Found 84 Astrogen LLM request/cost events, all `timer/system` heartbeats from CEO, CMO, and CTO, consuming 26,543,631 input tokens and 27,714 output tokens.
- Applied the live Astrogen cutoff:
  - set active Astrogen timer heartbeats to disabled;
  - preserved `wakeOnDemand=true`;
  - set `heartbeat.skipIfNoActionableWork=true` for active Astrogen agents.
- Added source-level timer actionability guard in `heartbeatService.tickTimers()`:
  - `todo` assigned issues are actionable;
  - `in_progress`, `in_review`, and `blocked` assigned issues are actionable only when the issue or comments changed after the agent's previous heartbeat;
  - idle timers with `skipIfNoActionableWork=true` are skipped before an adapter/LLM run is created.
- Added focused tests for timer actionability and kept the existing silent-noop tests passing.
- Updated production config export to include heartbeat fields for drift review.
- Deployed `paperclip-app:v2026.513.10-heartbeat-cost-20260522` to production.
- Production smoke passed:
  - `/api/health` returned `status=ok`;
  - Docker app container runs the new image;
  - plugin loader activated 13/13 ready plugins and registered 92 tools;
  - live Astrogen active-agent heartbeat check returned `timer_enabled_agents=0`, `wake_on_demand_agents=29`, `skip_guard_agents=29`.

## 2026-05-20

- Started Payload CMS publication adapter implementation after Astrogen blog moved under Payload CMS:
  - added source package `@paperclipai/plugin-payload-cms-agent-tools`;
  - implemented secret-backed API-key configuration for `https://cms.astrogen.com.ua/api`;
  - added agent tools for build-state/access checks, blog post lookup, taxonomy lookup, media upload, draft create/update, and guarded publish;
  - added conservative Markdown-to-Lexical conversion for draft creation while allowing pass-through Payload Lexical JSON;
  - verified Payload service user access locally with the API key file outside Git: `buildState` returned 200 and `/api/access` showed publisher access for media, authors, categories, tags, blogPosts, redirects, agentActions, buildEvents, and buildState.

## 2026-05-19

- Delivered four existing Stage 65 Astrogen blog cover images to Telegram without article texts:
  - `Натальна карта дитини: як читати результат і не переінтерпретувати`;
  - `Що робити, якщо точний час народження дитини невідомий`;
  - `Які дані потрібні для натальної карти дитини: повний список перед замовленням`;
  - `Що входить у результат фінансової натальної карти, а що ні`.
- Created live Paperclip audit issue [AST-792](/AST/issues/AST-792). Delivery used the temporary audited direct Bot API fallback because the Phase 22 Telegram delivery-groups source implementation has not yet been cut over to production.
- Implemented Phase 22 `Telegram Attachment Delivery Groups` in source:
  - extended the shared `notification-contract` schema with `delivery_groups`;
  - added server-side grouped attachment resolution and tests;
  - added plugin SDK/host APIs for gated issue attachment metadata/content reads;
  - added capability `issue.attachments.read` and cross-company isolation tests;
  - added source-controlled `paperclip-plugin-telegram@0.3.1-paperclip.0`;
  - implemented grouped Telegram `sendDocument` delivery with idempotency, issue audit comments, and activity log;
  - preserved the short Ukrainian Telegram completion formatter so the plugin overlay does not reintroduce noisy upstream lifecycle messages.
- Verified locally with server contract/bridge tests, Telegram delivery/formatter tests, Telegram plugin typecheck/build, and server typecheck.
- Updated `ops/paperclip-production/manifests/plugins.md` to record the Phase 22 plugin package/version expectation.
- Production cutover was not performed in this source phase. Next step is a controlled app/plugin image deploy and smoke using the same guarded procedure as Phase 16/17.

## 2026-05-17

- Owner approved all three proposed Wave 1 Astrogen blog articles.
- Paperclip HIA captured the owner decision on [AST-705](/AST/issues/AST-705), and [AST-754](/AST/issues/AST-754) was completed.
- CMO created [AST-755](/AST/issues/AST-755) for Stage 55 article briefs, assigned it to `MKT Blog Brief Strategist`, and the strategist completed it.
- Stage 55 brief artifact on the live Astrogen workspace: `/astrogen/work/55-blog-article-briefs/active/blog-article-briefs-astrogen-wide-ua-ast-755-2026-05-17.md`.
- Added a CMO wakeup request so CMO reviews the completed briefs and opens article-writing tasks for the approved Wave 1 articles.
- Recovered the CMO follow-up after the first direct DB wakeup record did not create a heartbeat run and the service-created CMO run became a defunct process.
- Cancelled the stale CMO run and opened Stage 59 article-drafting tasks directly for `SEO Blog Article Writer`:
  - [AST-757](/AST/issues/AST-757) `Знак зодіаку: як визначити свій знак і не помилитися з межовою датою`;
  - [AST-758](/AST/issues/AST-758) `Натальна карта: що це таке, як її читати і що дає персональний розбір`;
  - [AST-759](/AST/issues/AST-759) `Сумісності знаків зодіаку: як читати таблицю, відсотки і межі такого прогнозу`.
- [AST-757](/AST/issues/AST-757) has the first active writer run; [AST-758](/AST/issues/AST-758) and [AST-759](/AST/issues/AST-759) are queued for the same writer.
- First-pass drafts were produced and mirrored into the canonical Astrogen workspace:
  - `/home/paperclip/astrogen/work/59-seo-blog-article-drafts/active/ast-757-zodiac-sign-ua-2026-05-17.md`;
  - `/home/paperclip/astrogen/work/59-seo-blog-article-drafts/active/ast-758-natalna-karta-shcho-tse-take-ua-2026-05-17.md`;
  - `/home/paperclip/astrogen/work/59-seo-blog-article-drafts/active/ast-759-sumisnist-znakiv-zodiaku-ua-2026-05-17.md`.
- Opened Stage 61 validation tasks:
  - [AST-760](/AST/issues/AST-760) for [AST-757](/AST/issues/AST-757);
  - [AST-761](/AST/issues/AST-761) for [AST-758](/AST/issues/AST-758);
  - [AST-762](/AST/issues/AST-762) for [AST-759](/AST/issues/AST-759).
- Stage 61 returned all three first-pass drafts for revision:
  - [AST-760](/AST/issues/AST-760): SEO lock drift, wrong `/free-horoscope` route/CTA framing, analytics mismatch;
  - [AST-761](/AST/issues/AST-761): SEO lock drift, missing approved `/free-horoscope` implementation, incomplete analytics handoff;
  - [AST-762](/AST/issues/AST-762): SEO lock drift, wrong product route/CTA surface, incomplete analytics/sanitizer blockers.
- Opened focused Stage 59 revision tasks [AST-763](/AST/issues/AST-763), [AST-764](/AST/issues/AST-764), and [AST-765](/AST/issues/AST-765) for `SEO Blog Article Writer`; [AST-763](/AST/issues/AST-763) is the first running revision.
- Stage 59 revision tasks completed and produced revised artifacts:
  - [AST-763](/AST/issues/AST-763): `/home/paperclip/astrogen/work/59-seo-blog-article-drafts/active/ast-763-zodiac-sign-ua-2026-05-17-rev1.md`;
  - [AST-764](/AST/issues/AST-764): `/home/paperclip/astrogen/work/59-seo-blog-article-drafts/active/ast-764-natalna-karta-shcho-tse-take-ua-revised-2026-05-21.md`;
  - [AST-765](/AST/issues/AST-765): `/home/paperclip/astrogen/work/59-seo-blog-article-drafts/active/ast-765-sumisnist-znakiv-zodiaku-ua-revised-2026-05-22.md`.
- Opened Stage 61 revalidation tasks [AST-766](/AST/issues/AST-766), [AST-767](/AST/issues/AST-767), and [AST-768](/AST/issues/AST-768).
- Revalidation returned all three revised drafts again. Current blocker is writer output failing the validator's accepted SEO/product route contract, not a new owner decision.
- Seeded the live Postgres `seo_ops` page registry from `https://astrogen.com.ua/sitemap.xml`.
- Registered 40 Astrogen blog-related URLs: 35 blog articles, 4 blog category pages, and the blog index.
- Enriched all 35 blog article registry rows from the public site CMS data source with title, H1/title fallback, meta description, category, tags, author metadata, featured image, content text, content word count, content block count, and content hash.
- Created discovery run `7e07491d-aecd-4e99-83fa-c5b6c65e10c2` with summary `{blogRelatedUrlCount: 40, blogArticleCount: 35, importedPageCount: 40, errorCount: 0}`.
- Remaining registry gap: map existing blog pages to approved/target semantic-core keyword clusters and start GSC/rank monitoring after publication or page matching.

## 2026-05-13

- Planned and executed Astrogen Phase 14 `SEO Blog Content Waves`.
- Defined the blog-only downstream workflow after semantic-core validation:
  - semantic core;
  - article opportunities;
  - SERP-checked shortlist clusters;
  - human-adjustable priorities;
  - paced waves;
  - content-plan validation;
  - article production;
  - performance feedback into later waves.
- Updated Astrogen requirements with:
  - article opportunity planning instead of keyword-by-keyword page creation;
  - normalized cluster demand;
  - human priority states;
  - paced wave planning;
  - batch-first LLM evaluation for keyword/opportunity sets.
- Updated agency-core `SEO_PERFORMANCE_LOOP` with article opportunity, wave mix, SERP shortlist grouping, and blog role contracts for `SEO Blog Content Strategist` and `SEO Blog Content Plan Validator`.
- Updated agency-core `SEMANTIC_CORE_MCP_AGENT_INSTRUCTIONS` so Paperclip-side LLM evaluation of keyword rows is batch-first and uses stable row IDs, compact evidence, deterministic chunking, and failed-row retries only.
- No live MCP run or live Paperclip agent setting update was triggered in this local phase.
- Applied Phase 14 to live Astrogen contracts on `ubuntu-oc` without starting a new MCP run:
  - `cmo/AGENTS.md`: manager rule for bounded blog waves instead of mass article creation.
  - `seo-semantic-core-strategist/AGENTS.md`: handoff boundary from semantic core to blog planning, with batch-first LLM review.
  - `seo-semantic-core-validator/AGENTS.md`: Phase 14 readiness gate before Stage 56.
  - `seo-blog-content-strategist/AGENTS.md`: article opportunities, normalized cluster demand, SERP shortlist grouping, paced waves, human priorities.
  - `seo-blog-content-plan-validator/AGENTS.md`: wave validation, role mix, pacing, cannibalization, template repetition, human priority checks.
  - `seo-blog-article-writer/AGENTS.md` and `seo-blog-article-validator/AGENTS.md`: article scope/validation boundaries tied to approved Phase 14 opportunities.
  - `seo-performance-analyst/AGENTS.md`: performance feedback into article opportunity status, cluster demand confidence, next-wave priorities, and GSC candidate suggestions.
  - process docs `56-seo-blog-content-plan.md`, `58-seo-blog-content-plan-validation.md`, and `66-published-page-seo-decision-loop.md` received Phase 14 addenda.
- Live backup and before/after hash ledger: `/home/paperclip/astrogen/backups/agent-contracts-phase14-20260513T093510Z`.

## 2026-05-06

- Planned and completed Phase 10 `Human-Usable Semantic Core Review`.
- Updated the Semantic Core Review data model and API so a human can persist whether a keyword clearly relates to an Astrogen service, Astrogen brand, the general topic, no match, or is uncertain.
- Reworked the `/AST/seo/semantic-core-review` page for owner review:
  - mouse-resizable table columns;
  - Ukrainian stage explanation for the current semantic-core layer;
  - separate tabs for the decision queue, automatically accepted core, and all keywords;
  - human-readable decision names and explanations;
  - Paperclip dark mode support;
  - hidden raw MCP payloads from the default human view.
- Added migration `0053_semantic_review_human_connection.sql`, verified DB/server/UI typechecks, redeployed live Paperclip, and confirmed the route returns HTTP 200, health returns `status=ok`, and live PostgreSQL includes the new human-connection columns.
- Added click-to-sort behavior to the Semantic Core Review table headers and redeployed live Paperclip; verified UI typecheck, live health, and `/AST/seo/semantic-core-review` HTTP 200.
- Critically reviewed the client-facing review/reporting boundary and planned agency-core Phase 5 `Client Portal Foundation`: separate portal app, Resend email-code auth, hash-only code/session storage, 14-day configurable sessions, DB-only email access, user-company access binding hash, Ukrainian-first localization, sanitized client API boundary, dashboard/keywords pages based on the SEO dashboard references, and Astrogen as the first pilot.
- Updated the portal deployment plan for public access: `cs.digital-r-evolution.com` should expose only the client portal over HTTPS, while Paperclip internal UI/API stays private behind Tailscale/local network; portal-to-Paperclip access must use a private server-side URL and server-only credential.
- Tightened the public portal deployment plan to Nginx + Let's Encrypt via Certbot. Local `.env` contains a redacted `RESEND_API_KEY` source, but production still needs server-side env values for sender email, portal base URL, auth/session peppers, private Paperclip client API URL, and service token; secrets must not be copied into planning, Git, logs, or issue comments.
- Earlier Client Portal Foundation work temporarily touched the dashboard reference project; that has been reverted and portal ownership is now `/path/to/paperclip-cs-portal`:
  - added user-company access binding hash support;
  - added and applied BigQuery migration `006_portal_access_binding.sql`;
  - deployed the updated portal app to `seodash_ubuntu_oc` with app HTTP still loopback-only;
  - prepared Nginx + Let's Encrypt config for `cs.digital-r-evolution.com`;
  - verified private route HTTP 200 and generic request-code behavior.
- Public activation is blocked because `cs.digital-r-evolution.com` currently points to `185.104.45.43` / `2a06:6440:0:2d2b::1`, while `seodash_ubuntu_oc` reports `89.167.61.146` / `2a01:4f9:c014:aa9a::1`.

- Updated Paperclip Semantic Core MCP adapter for the Volume Contract update:
  - `search_volume` is treated only as a backward-compatible alias of `geo_search_volume`;
  - `geo_search_volume` and `global_search_volume` now map to DataForSEO `keywords_data/google/search_volume/live`;
  - new runs no longer require `global_search_volume_country_distribution`; legacy rows preserve it only when present.
- Verified adapter tests, typecheck, and build; redeployed live Paperclip app and confirmed health plus `paperclip.semantic-core-mcp-agent-tools` activation with 16 tools.
- Restarted semantic-core execution task [AST-708](/AST/issues/AST-708) for [AST-705](/AST/issues/AST-705) with a fresh on-demand run under the Phase 23 + Volume Contract workflow. The task instruction now requires layer 1 `core_product_intent`, `prepare-paperclip-import`, a human review workbook, and a stop before layer 2.
- Updated Paperclip Semantic Core MCP agent workflow for Phase 23:
  - `prepare-paperclip-import` now surfaces `import_readiness`, `unsafe_reasons`, `policy_version`, accepted/review/parked counts, and `accepted_import_allowed` in the Paperclip tool response;
  - agency-core instructions now require layer-by-layer human review workbooks before advancing to the next production layer;
  - live Paperclip app was rebuilt/restarted and verified healthy; `paperclip.semantic-core-mcp-agent-tools` activated with 16 tools.
- Re-ran Astrogen layer 1 under the Phase 23 contract:
  - Project: `astrogen-ukraine-layer1-paperclip-review-20260506T102100Z`
  - Run: `run_20260506_102105_core_product_intent_5c87d989`
  - Import readiness: `ready_after_review`
  - Policy version: `conservative_acceptance_v1`
  - Accepted: 28; review: 11; parked: 207; clusters: 27; SERP segments: 3; SERP competitor candidates: 163; recall ledger: 163.
- Generated the first human review workbook:
  - `outputs/astrogen-semantic-core-review/run_20260506_102105_core_product_intent_5c87d989/astrogen_core_product_intent_run_20260506_102105_core_product_intent_5c87d989_human_review.xlsx`
  - Sheets: `Run Summary`, `Accepted`, `Review Queue`, `Parked`, `SERP Evidence`, and `Decision Guide`.
- Stopped before layer 2 as required. Next layer should wait for human review decisions on the layer 1 workbook.
- Critically reviewed Semantic Core MCP layer membership policy for Astrogen layer 2 before any new live run.
- Fixed and deployed systemic MCP policy changes:
  - adjacent acquisition terms can be accepted from topical/domain confidence instead of being flattened into `high_demand_conflict`;
  - Ukrainian mixed-language accepted candidates are routed to `unsupported_locale` review;
  - competitor SERP/content-parsing terms are candidate evidence only and cannot directly become accepted keywords.
- Added regression tests in `seo-semantic-core` for broad on-domain adjacent acceptance, off-domain high-demand review, mixed-language locale review, and competitor content evidence routing.
- Verified locally with full test suite, ruff, and compileall; redeployed live MCP twice with no-cache Docker rebuilds and confirmed healthy runtime plus 13 MCP tools.
- First post-policy live run was intentionally aborted because the project payload lacked `max_serp_clusters` and began unbounded SERP validation after the accepted set expanded.
- Restored bounded live-run thresholds in the ignored helper runner (`max_discovered_keywords=120`, `max_serp_clusters=35`) and re-ran layer 2 with content parsing enabled.
- Final layer 2 run `run_20260506_073240_adjacent_use_case_intent_19554b8c` completed under project `astrogen-ukraine-layer2-policyfix-contentgate-20260506T073239Z` with accepted 53, review 93, parked 488, clusters 50, SERP segments 3, SERP competitor candidates 571, and recall ledger 571.
- Inspection result: accepted keywords are now seed/direct-provider only; competitor content terms such as unrelated school/task snippets are parked or review evidence, not accepted. High-value adjacent terms including `гороскоп`, `натальна карта`, `гороскоп на сьогодні`, and product-bound horoscope/natal terms are accepted. Remaining review contains useful `generic_topic` competitor evidence plus some `high_demand_conflict` noise that should be reviewed before layer 3 or downstream planning.
- Fresh Volume Contract layer 1 run `run_20260506_111721_core_product_intent_454bf24d` completed under project `astrogen-ukraine-layer1-volume-contract-review-20260506T111800Z` after deploying the MCP provider sanitization fix for DataForSEO search-volume requests.
- `prepare-paperclip-import` returned `import_readiness=ready_after_review`, `policy_version=conservative_acceptance_v1`, no unsafe reasons, accepted 28, review 13, parked 252, rejected 1, clusters 27, SERP segments 3, SERP competitor candidates 210, and recall ledger 210.
- Provider cache metadata confirmed the new Volume Contract path: `keywords_data/google/search_volume/live` was used for volume, with no clickstream endpoint in the run metadata.
- Generated fresh human review workbook at `outputs/astrogen-semantic-core-review/run_20260506_111721_core_product_intent_454bf24d/astrogen_core_product_intent_run_20260506_111721_core_product_intent_454bf24d_human_review.xlsx` with sheets `Run Summary`, `Accepted`, `Review Queue`, `Parked`, `SERP Evidence`, and `Decision Guide`.
- Marked [AST-708](/AST/issues/AST-708) as the active layer 1 human-review gate. Layer 2 must not be rerun until the workbook decisions are approved or accepted-only import is explicitly authorized.
- Processed the edited owner workbook from `/path/to/local-downloads/astrogen_core_product_intent_run_20260506_111721_core_product_intent_454bf24d_human_review.xlsx`.
- Extracted 29 changed `human_decision` cells and deduplicated them to 25 MCP review decisions, all `accept`.
- Submitted MCP review decision artifact `review_20260506_125938_5845be3c` for source run `run_20260506_111721_core_product_intent_454bf24d`.
- Re-ran layer 1 with the submitted decisions. New reviewed run `run_20260506_130019_core_product_intent_8fa5e715` completed with accepted 34, review 11, parked 288, and policy version `conservative_acceptance_v1`.
- Stopped before layer 2 because `prepare-paperclip-import` returned `import_readiness=unsafe_for_import` with `unsafe_reasons=["accepted_contains_locale_review_terms"]`. The unsafe accepted terms are the human-accepted rows that still carry locale review warnings: `astrogen україна`, `astrogen натальна карта`, `астролог онлайн консультація`, and `синастрія онлайн`.

## 2026-05-06

- Implemented the planned database-backed Semantic Core Review GUI/API path so Excel is no longer the canonical review mechanism.
- Extended shared `seo_ops` schema with:
  - Phase 23 semantic-core run/membership fields;
  - `semantic_core_review_batches`, `semantic_core_review_items`, and `semantic_core_review_decisions`;
  - page-level `page_serp_targets` for `project_page + keyword + geo + language + device + search_engine`;
  - `metric_windows` and append-only `seo_decisions`;
  - page action cooldown/effect fields.
- Added migration `0051_seo_ops_semantic_review_gui.sql`.
- Added API route group under `/api/seo/semantic-core/...`:
  - import `prepare_paperclip_import` payloads into review batches;
  - group duplicate keywords across artifacts;
  - store single/bulk human decisions with audit log;
  - apply policy guardrails before accepting risky rows;
  - store rerun/import gate metadata.
- Added UI route `/seo/semantic-core-review` and sidebar entry `SEO Review`.
- UI uses Astrogen operational styling: Montserrat stack, burgundy `#810e2b`, gold `#C69C6D`, dense filters/table, and detail drawer for raw MCP evidence.
- Added focused server tests for duplicate grouping and unsafe human-accept guardrails.
- Verified locally:
  - `pnpm --filter @paperclipai/db typecheck`
  - `pnpm --filter @paperclipai/server typecheck`
  - `pnpm --filter @paperclipai/ui typecheck`
  - `pnpm --filter @paperclipai/server exec vitest run src/__tests__/seo-ops-semantic-review.test.ts`
- Deployed the GUI/API to live Paperclip, applied migration `0051_seo_ops_semantic_review_gui.sql`, and verified:
  - `/api/health` returns `status=ok`;
  - `/seo/semantic-core-review` returns HTTP 200;
  - new `seo_ops` tables exist in PostgreSQL;
  - `paperclip.semantic-core-mcp-agent-tools` activates with 16 tools.
- Imported current Astrogen layer 1 payload `run_20260506_111721_core_product_intent_454bf24d` into live review batch `921494a2-3bf8-4aa5-9e4b-2685fea6f890`: accepted 28, review 13, parked 252, unresolved review 13.
- Updated the deployed Semantic Core Review API/UI for MCP locale warning import policy v2:
  - stores `locale_warning_severity`, `accepted_locale_warning_overridden`, `locale_override_reason`, `human_decision_applied`, and `human_decision_blocked_reason`;
  - stores `source_precision_class` for override validation;
  - blocks accepted locale warnings unless the row qualifies as an explainable edge case with high topic match, canonized/brand binding, high/medium source precision, and non-competitor/non-content source;
  - fixed the externally usable GUI route to `/AST/seo/semantic-core-review` and added an unprefixed redirect for `/seo/semantic-core-review`.
- Verified locally with DB/server/UI typecheck and 4 semantic-review helper tests, then redeployed live Paperclip and confirmed health, the `/AST/seo/semantic-core-review` route, and new live PostgreSQL columns.

## 2026-05-05

- Continued Astrogen Semantic Core generation to layer 2 `adjacent_use_case_intent`.
- Fixed and deployed Semantic Core MCP provider handling before layer 2 completion:
  - DataForSEO `keyword_overview` requests are now chunked at the provider limit of 700 keywords, preventing `40501 Max number exceeded` failures on large candidate sets.
  - SERP competitor content parsing now filters additional UI/CTA noise discovered in live Astrogen runs (`Введіть корректно email`, `КУПИТИ КВИТКИ`).
- Rebuilt and redeployed live Semantic Core MCP at `http://100.98.5.50:8001/mcp`; verified container health and 13-tool MCP surface.
- Final layer 2 run `run_20260505_183226_adjacent_use_case_intent_3fd352ec` completed with `paperclip_import.v1`, accepted 1, review 465, parked 2297, clusters 1, SERP segments 1, SERP competitor candidates 91, and recall ledger 91.
- Confirmed final layer 2 keyword-like artifacts are clean for provider/UI/email/CTA sanitation patterns after the MCP fix.
- Marked layer 2 as not ready for operational import: the only accepted keyword is the mixed-language `натальная карта що це`, while high-value adjacent terms such as `гороскоп`, `натальна карта`, `гороскоп на тиждень`, and related horoscope/natal phrases are mostly in `candidate_review` via `high_demand_conflict`.
- Exported local inspection CSVs under `.tmp/astrogen-semantic-core/csv-run_20260505_183226_adjacent_use_case_intent_3fd352ec/`.
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

## 2026-05-06

- Corrected Client Portal Foundation storage direction after review: portal control-plane data must live in PostgreSQL, not BigQuery.
- Portal implementation ownership has moved to `/path/to/paperclip-cs-portal`; the Postgres control-plane work should be re-applied there, not in the dashboard reference project.
- Added PostgreSQL migration `migrations/postgres/001_portal_control.sql`, deployment migration runner, and one-time legacy BigQuery-to-Postgres company/user backfill script.
- Deployed the updated portal stack to `seodash_ubuntu_oc`; `portal-db` is healthy, app remains loopback-only on `127.0.0.1:3000`, migration applied, and backfill completed with `companies=1`, `users=1`.
- Verified locally: `npm run lint`, `npm run typecheck`, `npm run build`, `npm run verify:v1`.
- Verified live private route: `http://127.0.0.1:3000/diskinternals/login` returned HTTP 200 and request-code for unknown email returned the generic non-enumerating success response.
- Confirmed `cs.digital-r-evolution.com` DNS now points to `89.167.61.146` / `2a01:4f9:c014:aa9a::1`.
- Attempted public Nginx + Let's Encrypt activation. Certbot failed because external TCP 80 to `89.167.61.146` times out. UFW was missing 80/443 rules, so added only `80/tcp` and `443/tcp`; the external timeout remained.
- Confirmed blocker is upstream/cloud firewall: Nginx listens on server `:80`, local server curl to `89.167.61.146:80` reaches Nginx, but external probe times out and server-side `tcpdump` captures zero packets.

## 2026-05-07

- Corrected the client-portal data ownership boundary: Paperclip/`seo_ops` remains the semantic-core review source of truth; the separate portal must consume client-safe Paperclip DTOs and submit user decisions back to Paperclip instead of owning semantic-core review state.
- Added Paperclip portal API routes under `/api/portal` protected by `PAPERCLIP_PORTAL_SERVICE_TOKEN`:
  - `GET /api/portal/companies/:companySlug/semantic-core/review` returns a client-safe review projection without raw MCP payloads, artifact row pointers, source occurrences, plugin settings, or internal issue URLs.
  - `POST /api/portal/semantic-core/review-items/:itemId/decision` validates and stores portal decisions through the same `seo_ops` policy guardrails used by the internal Semantic Core Review UI.
- Refactored the semantic-core decision application helper so internal Paperclip routes and portal routes share validation/write behavior.
- Verified with targeted tests and server typecheck.
- Deployed the portal API to live Paperclip and set live `PAPERCLIP_PORTAL_SERVICE_TOKEN` without exposing the token in logs.
- First deploy briefly returned 502 because macOS AppleDouble files (`._*.sql`) entered the Docker build context and were treated as pending SQL migrations. Removed those files from the live build context, rebuilt, and added `.dockerignore` rules for `._*` / `**/._*`.
- Verified live Paperclip health at `https://ubuntu-oc.tailbd4e1c.ts.net:4447/api/health` returns HTTP 200.
- Verified from the portal host that `http://127.0.0.1:3200/api/portal/companies/astrogen/semantic-core/review` returns `ok=true`, `items=293`, `batches=1`, `company=astrogen` with the service token, and returns HTTP 401 without the token.
- Portal live configuration should use `PAPERCLIP_PORTAL_API_URL=http://127.0.0.1:3200` on this host, because MagicDNS `ubuntu-oc.tailbd4e1c.ts.net` does not resolve from the same server environment.
- Tightened the Paperclip portal semantic-core boundary so client portal review only receives client-reviewable Astrogen items:
  - hidden from portal: parked/rejected/internal-only candidates, `unknown + none` product/topic rows, `no_entity_anchor`, competitor/content/UI-noise warnings, unsafe/non-reviewable locale warnings, and obvious app/system/store fragments such as `settings Налаштування`, `Google Store`, and `play_apps Бібліотека та пристрої`;
  - preserved internally useful noisy candidates in the internal Paperclip semantic-core review data/API;
  - added route-helper tests for noisy examples, locale edge cases, and valid service/topic rows.
- Redeployed live Paperclip and verified from both the Tailscale endpoint and the portal host loopback URL that the Astrogen portal semantic-core response now returns `items=30`, all pending, with 28 accepted and 2 review rows, and none of the known app/system/store examples.
- Added client-safe Ukrainian `reviewContext` to the Paperclip portal semantic-core API with `title`, `description`, `clientTask`, `nextStep`, `stageLabel`, and progress counts.
- The context explains that review is mandatory and blocks further semantic-core/content preparation until every visible request has a decision, uses respectful `ви` language, and does not mention Paperclip or internal workflow labels.
- Sanitized the portal batch DTO to remove `sourceRunId`, `projectId`, `siteId`, raw `layer`, raw `status`, `importReadiness`, `warningCounts`, and parked counts from the client API surface.
- Redeployed live Paperclip and verified the Astrogen response includes `reviewContext`, `items=30`, `progress.pending=0`, `stageLabel="Клієнтський розгляд завершено"`, and no `Paperclip`, `core_product_intent`, `unsafe_blocked`, `parked`, `unsupported_locale`, or `no_entity_anchor` labels in the client context/batch/warnings surface.

## 2026-05-10

- Fixed the Paperclip portal semantic-core inventory lifecycle contract:
  - `status` remains backward-compatible, but the DTO now also exposes explicit `lifecycleMembership`.
  - `accepted`/`lifecycleMembership=accepted` means an item is actually in the active semantic core.
  - Machine triage is now exposed separately as `recommendation.sourceSignal`, `recommendation.machineMembership`, and a client-safe recommendation label.
  - Machine `currentMachineMembership=accepted` in a candidate row is labeled `Рекомендовано до погодження`, not `Автоматично погоджено`.
- Added route-helper tests proving active-batch machine-accepted items stay `candidate`, completed accepted items stay `accepted`, and the old misleading label is absent.
- Verified locally with `pnpm vitest run server/src/__tests__/portal-routes.test.ts` and `pnpm typecheck`.
- Redeployed live Paperclip and verified `/api/portal/companies/astrogen/semantic-core` returns summary `total=618`, `accepted=27`, `candidate=588`, `deferred=1`, `rejected=2`, `removed=0`; the known noisy keyword `гороскоп на тиждень 4 10 квітня` is `candidate` with `recommendation.sourceSignal=machine_recommended_accept` and label `Рекомендовано до погодження`.
- Planned and completed agency-core Phase 6.1 `Semantic Core Visible Completion Alignment` after discovering that Astrogen layer 2 was complete in the portal but still `in_review` in Paperclip because backend completion counted hidden historical duplicate `Astrogen`.
- Updated Paperclip completion sync so it uses the same client-visible semantics as the portal review endpoint:
  - historical accepted duplicates are excluded from client-visible completion;
  - explicit `re_review` / `force_client_review` rows remain visible and can still block completion;
  - hidden/internal rows do not block client review completion.
- Added focused tests for hidden historical duplicates and explicit re-review duplicates; verified with:
  - `pnpm vitest run server/src/__tests__/seo-ops-semantic-review.test.ts server/src/__tests__/portal-routes.test.ts`
  - `pnpm typecheck`
- Redeployed live Paperclip and ran completion sync for layer 2 batch `53c2c939-a23a-4a86-87e3-da6371feecf1`.
- Live result: batch status is `client_review_completed`, `client_review_status=completed`, progress is `82/82`, accepted `76`, rejected `6`, deferred `0`. Handoff comments were posted to [AST-710](/AST/issues/AST-710) and [AST-705](/AST/issues/AST-705), and [AST-705](/AST/issues/AST-705) moved from `blocked` to `todo` for internal validation/next-layer continuation.

## 2026-05-11

- Executed Astrogen Phase 13 / agency-core Phase 8 contract update before any further broad semantic-core generation.
- Updated live Astrogen agent instructions on `ubuntu-oc`:
  - CMO now owns the traffic-first semantic-core strategy and must include layer policy, prior final keyword source, and validation handoff before delegating live MCP generation.
  - SEO Semantic Core Strategist now must pass Astrogen traffic strategy/layer policy to MCP, call `get-paperclip-import-schema` after MCP contract changes, preserve new diagnostics, pass prior final keywords, and avoid live MCP runs while the MCP server is still being updated.
  - SEO Semantic Core Validator now validates broad layers against traffic strategy instead of universal product binding, including explicit checks for `no_entity_anchor` misuse, `not_search_query` exposure, stale prior decisions, and raw content-plan phrases.
  - CTO is limited to technical enablement and explicitly forbidden from keyword lifecycle decisions or semantic overrides.
  - HIA must explain broad Astrogen traffic in Ukrainian business language without raw MCP/Paperclip labels.
- Updated live Astrogen Stage 53/54 process docs with traffic-first layer policy and layer-aware validation rules.
- Added live handoff template `/home/paperclip/astrogen/docs/records/2026-05-11-semantic-core-layer-handoff-template.md`.
- Backups and after-hashes are stored on the server under `/home/paperclip/astrogen/backups/agent-contracts-20260511T160709Z`.
- Did not run a new MCP layer or live MCP test, because the MCP server is still implementing the matching contract changes.
- After operator approval to proceed, created CMO-managed launch issue [AST-716](/AST/issues/AST-716) with the updated `AI_AGENT_MCP_USAGE.md` contract summarized in the brief.
- CMO accepted the manager path and created execution child [AST-717](/AST/issues/AST-717) for `SEO Semantic Core Strategist`.
- [AST-717](/AST/issues/AST-717) started an active strategist run and launched fresh Layer 3 `audience_need_intent` generation:
  - MCP job: `job_11e1130b64a8`
  - MCP run: `run_20260511_163753_audience_need_intent_6b089606`
  - `prepare_paperclip_import` preliminary state from strategist run log: `import_readiness=ready_after_review`, `policy_version=conservative_acceptance_v4_traffic_strategy_policy`, `prior_final_keyword_suppressed_count=98`, `net_new_review_count=3490`.
- Current concern: the fresh Layer 3 run produced a very large net-new review set. It must go through strategist/validator quality gating before any client portal exposure.
- After the MCP-side broad-layer config update, updated the Paperclip MCP adapter and planning contracts so `traffic_strategy` is preserved into registered `project_config`, and broad layers keep `requires_product_binding=false`, `requires_service_pathway=false`, `requires_topic_domain_match=true`, `review_uncertain_topic_matches=true`, and `allowed_topic_domains` with project-defined topic labels/include terms.
- Verified the adapter change with `pnpm --filter @paperclipai/plugin-semantic-core-mcp-agent-tools test` and `pnpm --filter @paperclipai/plugin-semantic-core-mcp-agent-tools typecheck`.
- Added and deployed Paperclip-owned semantic-core review group API for the client portal:
  - `GET /api/portal/companies/:companySlug/semantic-core/review-groups`
  - `POST /api/portal/semantic-core/review-groups/:groupId/decision`
- Added `seo_ops.semantic_core_review_group_decisions` migration/table so group-level decisions have an audit summary while per-item decisions remain authoritative.
- Verified locally with server route tests, server typecheck, and DB migration numbering check.
- Deployed live Paperclip on `ubuntu-oc`; migration `0057_semantic_core_review_group_decisions.sql` applied, app health returns HTTP 200, and the Astrogen review-groups endpoint returns `ok=true`.
- Current live Astrogen group endpoint state: active batch `007e6e91-1632-4d54-a6d1-b8ea5833f9fa`, stage `Третій етап: потреби аудиторії`, `groupCount=0`, because the current active batch has no client-visible pending review items.
- Fixed Paperclip import handling for the completed AST-721 Layer 3 run without repeating MCP generation:
  - Added import guards that keep prior-final duplicates and obvious language-lane leakage internal-only before portal exposure.
  - Added Paperclip-side review grouping metadata during import so the client portal can render authoritative grouped review.
  - Fixed `candidate_review` counting in imported batch summaries.
  - Fixed portal review-group aggregate Ukraine/Global volume to sum variants in the group.
- Verified locally with `pnpm --filter @paperclipai/server exec vitest run src/__tests__/portal-routes.test.ts src/__tests__/seo-ops-semantic-review.test.ts` and `pnpm --filter @paperclipai/server typecheck`.
- Deployed live Paperclip twice: first for import guards/grouping, then for the group-volume DTO fix.
- Existing MCP artifact was too large for the API body limit (`~150 MB` vs `10 MB`), so created a compact import payload from the same generated result without rerunning MCP:
  - Full artifact: `/home/paperclip/astrogen/work/53-seo-semantic-core/active/ast-721-prepare-paperclip-import-2026-05-11.json`
  - Compact payload: `/home/paperclip/astrogen/work/53-seo-semantic-core/active/ast-721-prepare-paperclip-import-2026-05-11.compact.json`
- Imported source run `run_20260511_190540_audience_need_intent_06e6a500` into review batch `a5a0fb0e-eb6d-4e1b-8997-b4fba43f394d`.
- Live import result: `accepted=0`, `review=3251`, `parked=261`, `rejected=26`, `unresolved=3251`, status `in_review`, client review status `in_review`.
- Live portal review-groups result for Astrogen now returns active batch `a5a0fb0e-eb6d-4e1b-8997-b4fba43f394d`, stage `Третій етап: потреби аудиторії`, `13` groups, `3077` client-visible pending variants.
- Spot checks confirmed `Gemini AI`, `Gemini Google`, Russian `гороскоп на сегодня`, and prior-final `Astrogen` are not in the client-visible review group queue.
- Updated [AST-721](/AST/issues/AST-721) to `done` with the import details and next step: client review in the portal.
- Investigated why `gemini ai` and `gemini google` still appeared in the client portal Candidates inventory.
- Root cause was Paperclip-side lifecycle mapping, not MCP:
  - MCP correctly returned both rows as `parked_outside_layer` / `off_topic_entity_conflict`, `domain_topic_match=none`, `product_binding_status=unknown`, `human_review_required=false`, recommended reject.
  - Paperclip `review-groups` correctly hid them, but the general `/semantic-core` inventory endpoint still fell through parked internal diagnostics to `candidate`.
- Fixed `buildSemanticCoreInventory` to exclude no-human-decision parked `off_topic_entity_conflict` diagnostics from client inventory while preserving potentially useful parked candidates.
- Verified locally with `pnpm --filter @paperclipai/server exec vitest run src/__tests__/portal-routes.test.ts` and `pnpm --filter @paperclipai/server typecheck`.
- Deployed live Paperclip and verified:
  - `/api/portal/companies/astrogen/semantic-core` has `gemini_ai_count=0`, `gemini_google_count=0`, summary `total=3882`, `accepted=183`, `candidate=3690`, `deferred=1`, `rejected=8`.
  - `/api/portal/companies/astrogen/semantic-core/review-groups` still has `gemini_ai_count=0`, `gemini_google_count=0`, active batch `a5a0fb0e-eb6d-4e1b-8997-b4fba43f394d`, `13` groups / `3077` pending variants.

## 2026-05-17

- Updated live Astrogen human-decision contract so owner-facing `Human Decision Needed` cards must be self-contained Ukrainian decision briefs, not terse internal workflow gates.
- Updated live `/home/paperclip/astrogen/docs/foundation/HUMAN_DECISION_REQUEST.md`, CMO instructions, and HIA instructions:
  - CMO must prepare a complete owner-facing decision brief before routing approval requests through HIA.
  - HIA must reject or return under-specified requests that contain only stage names, option IDs, or internal labels.
  - SEO/blog approval briefs must include article titles, primary/supporting keywords, Ukraine/global demand, cluster/family demand when available, business role, proposed page type, next step, required inclusions, forbidden claims, and a simple answer format.
- Refreshed the active Astrogen owner decision request on [AST-705](/AST/issues/AST-705) with a plain-language Wave 1 article approval packet for the three proposed articles: `знак зодіаку`, `натальна карта`, and `сумісності знаків зодіаку`.

## 2026-05-18

- Fixed live Telegram issue-done formatting after Astrogen messages for [AST-754](/AST/issues/AST-754) and [AST-755](/AST/issues/AST-755) still exposed internal workflow titles such as `HIA`, `Stage 55`, and `Wave 1`.
- Patched the live installed `paperclip-plugin-telegram` formatter in `/paperclip/.paperclip/plugins/node_modules/paperclip-plugin-telegram/dist/formatters.js`.
- New issue-done messages use short Ukrainian fields: `Тема`, `Що сталося`, and `Далі`; the `Далі` line explicitly says whether the owner needs to act now.
- Added mappings for owner approval gates, article briefing, article draft, and article validation issues so Telegram does not repeat raw issue titles or generic `Задачу ... завершено` summaries.
- Restarted the live Paperclip app; plugin loader reported `12/12` plugins activated, and `/api/health` returned `status=ok`.
- Smoke-tested the live formatter for the AST-755 title; output is now `Тема: Підготовка статей`, `Що сталося: Підготовлено робочі брифи...`, and `Далі: Автори готують тексти...`.
- Investigated the stalled Wave 1 article-production lane after Stage 61 revalidation returned all three revised drafts again.
- Root cause: CMO opened stale HIA gate [AST-769](/AST/issues/AST-769), asking the owner to choose one article for drafting even though the owner had already approved all three articles and all three drafts had already gone through Stage 59 plus two Stage 61 validation passes.
- Recovery applied in live Paperclip:
  - cancelled stale HIA gate [AST-769](/AST/issues/AST-769);
  - restored [AST-705](/AST/issues/AST-705) to `in_progress` and removed the false `Human Decision Needed` blocker;
  - created recovery manager issue [AST-771](/AST/issues/AST-771).
- CMO completed recovery planning on [AST-771](/AST/issues/AST-771) and opened execution-ready corrective Stage 59 reruns:
  - [AST-772](/AST/issues/AST-772) for the zodiac-sign article;
  - [AST-773](/AST/issues/AST-773) for the natal-chart article;
  - [AST-774](/AST/issues/AST-774) for the zodiac-compatibility article.
- Current state: [AST-772](/AST/issues/AST-772) has a running writer run; [AST-773](/AST/issues/AST-773) and [AST-774](/AST/issues/AST-774) have queued writer runs. No owner decision is needed at this point.
- Planned Phase 20 `Article Writer Fallback And Cost-Controlled Recovery`:
  - keep the current Claude Sonnet writer as primary;
  - add a separate GPT-based fallback writer for rescue rewrites after repeated same-class validation failures;
  - require validator blocker classes so CMO can count repeated failures;
  - avoid frequent writer LLM heartbeats and use deterministic watchdog checks instead.
- Corrected Phase 20 planning language after verifying existing Paperclip runtime recovery:
  - Paperclip already reaps orphaned runs, resumes persisted queued work, and marks issue-assigned successful no-op runs as `failed/silent_noop`;
  - Phase 20 should extend that existing recovery layer with article-production transition rules, not create a duplicate general watchdog.
- Current writer cost baseline: `anthropic/claude-sonnet-4.6` is planned at `$3/M input` and `$15/M output`; a 5-minute no-op heartbeat can cost roughly `$78-$1,037/month` depending on context size, while the existing configured hourly interval would be roughly `$6-$86/month` if every heartbeat invokes the writer LLM.
- Stopped the external 15-minute Codex heartbeat monitor for Wave 1 article recovery. New Astrogen rule: do not passively check the same stalled Paperclip condition more than three times; after the third unchanged check, fix the system-level cause or reassign/recover the work.
- Applied Phase 20 live first pass on `ubuntu-oc`:
  - added `SEO Blog Article Writer GPT` as a separate `gpt-5.4` fallback writer, leaving the primary writer on Claude Sonnet;
  - updated CMO contract so repeated same-class validator failures, protocol/runtime failures, or missing canonical artifacts route to the fallback writer instead of changing the primary writer's model;
  - updated Validator contract to emit structured blocker classes, attempt number, repeated-blocker status, recommended next owner, and must-close checklist;
  - updated Writer contract so `done` requires a verified non-empty canonical Stage 59 markdown artifact path;
  - disabled routine LLM heartbeat for all Astrogen specialist agents and left it enabled only for CEO, CMO, and CTO.
- Removed misleading `Human Decision Needed` labels from [AST-705](/AST/issues/AST-705), [AST-771](/AST/issues/AST-771), and [AST-775](/AST/issues/AST-775); these are internal process/technical blockers, not owner decisions.
- Reassigned [AST-774](/AST/issues/AST-774) to `SEO Blog Article Writer GPT` and queued a fallback writer recovery wakeup for the zodiac-compatibility article.
- [AST-774](/AST/issues/AST-774) completed successfully through the fallback writer with verified canonical artifact `/astrogen/work/59-seo-blog-article-drafts/active/ast-774-experts-sumisnosti-znakiv-zodiaku-ua-2026-05-18.md`.
- Reopened [AST-772](/AST/issues/AST-772) and [AST-773](/AST/issues/AST-773) for the same fallback writer path because their previous `done` state still lacked canonical workspace files; this is `artifact_contract_missing`, not a content approval decision.
- Corrected [AST-705](/AST/issues/AST-705) and [AST-771](/AST/issues/AST-771) from `blocked` to `in_progress`, because the lane is now internal recovery work rather than an owner decision wait.

## 2026-05-19

- Confirmed that the prior Astrogen article workflow had a Stage 65 image lane under `/home/paperclip/astrogen/work/65-seo-blog-image-generation/active`, but the current Wave 1 lane stopped at Stage 64 packaging.
- Root cause: the live Stage 65 process document still described image generation as a future slot, and the CMO/Stage 64 contracts did not require an image bundle before Telegram/editorial delivery.
- Updated live Astrogen contracts on `ubuntu-oc`:
  - `/home/paperclip/astrogen/docs/process/65-seo-blog-image-generation.md`;
  - `/home/paperclip/astrogen/docs/process/64-seo-blog-publication-packaging.md`;
  - `/home/paperclip/astrogen/agents/cmo/AGENTS.md`.
- New rule: Stage 64 publication packaging is not complete for blog articles until a governed Stage 65 hero image bundle exists, unless the owner explicitly waives images.
- Generated Stage 65 hero images for the three already packaged Wave 1 articles without regenerating article text:
  - `ast-788-wave1-natal-chart-ua-image-2026-05-19`;
  - `ast-788-wave1-zodiac-sign-ua-image-2026-05-19`;
  - `ast-788-wave1-zodiac-compatibility-ua-image-2026-05-19`.
- All three generated images passed `validate-seo-blog-image-bundle` automated QA at `2752x1536`.
- Created delivery issue [AST-791](/AST/issues/AST-791), attached nine artifacts: three markdown files, three HTML files, and three hero images.
- Sent the article packages to Telegram as one short summary message plus three media groups, one per article. Telegram message ids: `569`, `570-572`, `573-575`, and `576-578`.
- Added an audit comment on [AST-791](/AST/issues/AST-791). The delivery used the Astrogen Telegram bot secret from Paperclip Secrets; no plaintext token was printed or stored in Git.

## 2026-05-20

- Deployed the new bundled `paperclip.payload-cms-agent-tools` plugin to live Paperclip on `ubuntu-oc`.
- Built and switched production to Docker image `paperclip-app:v2026.513.3-payload-cms-20260520`.
- Stored the Astrogen Payload CMS API key in Paperclip Secrets as `Astrogen Payload CMS API Key`; plugin config stores only the secret UUID and CMS collection slugs.
- Installed and loaded plugin record `paperclip.payload-cms-agent-tools` from `/app/packages/plugins/plugin-payload-cms-agent-tools`.
- Plugin loader registered 9 tools:
  - `payload_cms_health_check`;
  - `payload_cms_get_build_state`;
  - `payload_cms_get_access`;
  - `payload_cms_find_blog_post`;
  - `payload_cms_list_taxonomy`;
  - `payload_cms_upload_media`;
  - `payload_cms_create_blog_post_draft`;
  - `payload_cms_update_blog_post_draft`;
  - `payload_cms_publish_blog_post`.
- Smoke-tested live agent tool execution through `/api/agents/me/plugin-tools/execute`:
  - `payload_cms_get_build_state` returned `HTTP 200`, `lastBuildStatus=queued`, `buildInProgress=false`;
  - `payload_cms_health_check` returned `HTTP 200` and confirmed read access to `buildState`, access metadata, and create/read/update access for `blogPosts`, `media`, `authors`, `categories`, `tags`, and `redirects`.
- Noted production schema drift in `company_secrets`: live DB includes extra not-null secret metadata columns that are not represented in the current source helper. For this deployment, the Payload key was inserted/rotated through a compatibility SQL path using the same local-encrypted provider; follow-up should reconcile the source schema/service with the live secret schema before relying on the generic secret helper for new secret creation.
- Checked upstream before implementing the follow-up. Newer upstream already has the same secret metadata direction (`key`, lifecycle `status`, managed mode, provider metadata, and version fingerprint fields), so the live DB was ahead of the local source rather than randomly broken.
- Backported the minimal compatible secret schema/service support instead of pulling the full upstream secret subsystem:
  - added migration `0058_secret_schema_reconciliation`;
  - updated `company_secrets` and `company_secret_versions` schema definitions;
  - updated `secretService` create/resolve/rotate behavior to populate and respect the lifecycle metadata;
  - added embedded Postgres tests for create/resolve/rotate.
- Deployed production image `paperclip-app:v2026.513.4-secret-schema-20260520` on `ubuntu-oc`.
- Production health check returned `status=ok`; plugin loader reported `10/10` plugins loaded successfully and `81` registered tools.
- Verified migration `0058_secret_schema_reconciliation` in the live Drizzle journal.
- Smoke-tested the generic `secretService` path in live Paperclip using a dummy local-encrypted secret: created version 1, resolved it, rotated to version 2, resolved the rotated value, and removed the test secret. No real secret value was printed or stored in Git.

## 2026-05-21

- Updated the Chinese horoscope Payload CMS draft (`blogPosts/38`) so the ending uses one calm final CTA instead of stacked promotional cards.
- Replaced the generic lifestyle cover with a topic-specific editorial illustration for `Китайський гороскоп: як він працює і чим відрізняється від західного`.
  - Final no-text Payload media id: `59`.
  - Draft post id: `38`.
  - CMS state remains `_status=draft`, `workflowStatus=draft`.
- Tightened Phase 23 contracts so a generic or weakly connected cover image is a blocking package defect, not an optional handoff note.
- Added a cover-image rule: blog covers must not contain rendered text, labels, letters, numbers, captions, or text-like decoration.
- Completed the live Phase 23 delivery chain for [AST-821](/AST/issues/AST-821):
  - Payload draft `38` was updated through the `articleContent.v1` layout pipeline and kept in draft state;
  - the final article ending now uses one compact in-article CTA instead of repeated stacked CTA cards;
  - the current cover is topic-specific and text-free: Payload media id `59`;
  - CMO accepted and closed [AST-821](/AST/issues/AST-821) after verified delivery proof.
- Fixed the production Telegram delivery-groups runtime blocker:
  - root cause: the installed Telegram plugin dependency used an older persistent `@paperclipai/plugin-sdk` that did not expose `ctx.issues.listAttachments` and `ctx.issues.getAttachmentContent`;
  - aligned the persistent Telegram plugin SDK dependency with the running app image SDK and restarted the Paperclip app container;
  - Telegram plugin loaded successfully after restart;
  - [AST-827](/AST/issues/AST-827) produced an acceptance-grade audit comment with `Telegram message ids: 628`;
  - [AST-839](/AST/issues/AST-839) and superseded [AST-829](/AST/issues/AST-829) are closed.
- Important durability note: this production recovery included a live persistent plugin dependency alignment. It proves the runtime path but does not replace the durable Phase 22 requirement to ship the source-controlled Telegram plugin package through the normal app/plugin cutover path.

## 2026-05-22

- Rechecked the Chinese horoscope Payload CMS draft after the Phase 23 closeout.
- Found that the draft still had two `quietCta` blocks despite the intended final-CTA policy.
- Updated Payload draft `38` directly through the CMS API:
  - removed the earlier duplicated `free-horoscope` CTA block and its lead-in paragraph;
  - kept one final compact CTA to the Astrogen experts catalog;
  - kept `_status=draft` and `workflowStatus=draft`;
  - verified `articleContent.v1` now has `29` blocks and exactly one `quietCta`;
  - verified the cover remains topic-specific and text-free: Payload media id `59`.
- Paperclip live issue state remains closed for [AST-821](/AST/issues/AST-821), [AST-827](/AST/issues/AST-827), [AST-829](/AST/issues/AST-829), and [AST-839](/AST/issues/AST-839). Telegram delivery proof remains `message id 628`.
- Rechecked Telegram plugin state through the Paperclip API:
  - live plugin record still reports `paperclip-plugin-telegram@0.3.0`;
  - activity log still shows generic `issue.updated` forwarding for technical closeout issues after the source policy was added;
  - attempted the safe API reinstall path from `/app/packages/plugins/plugin-telegram`, but the live app path does not expose a built Paperclip plugin manifest for that installer;
  - durable fix still requires the normal server-side app/plugin package cutover. The runtime SDK alignment proves attachment delivery, but it does not prove the Telegram completion-noise policy is active in the installed live plugin bundle.
- Completed the Telegram plugin package cutover:
  - verified SSH/Tailscale access and production Docker health;
  - rebuilt and tested the source-controlled `paperclip-plugin-telegram@0.3.1-paperclip.0` package locally (`16` test files, `229` tests);
  - installed the built package under `/paperclip/.paperclip/plugins/local-packages/paperclip-plugin-telegram-0.3.1-paperclip.0`;
  - updated the production plugin registry to point at that package path and manifest;
  - restarted the Paperclip app container and verified health;
  - live plugin API now reports version `0.3.1-paperclip.0`;
  - plugin loader logs show `paperclip-plugin-telegram` activated successfully at version `0.3.1-paperclip.0`;
  - installed policy smoke confirms proof/delivery closeout notifications are suppressed while real CMS draft-ready notifications remain allowed.
- Tightened the Astrogen article image-generation contract:
  - cover images must meet a premium editorial/photo-quality Astrogen visual standard, not merely be topic-adjacent;
  - cover prompts must carry article intent, topic anchors, Astrogen style anchors, no-text/no-glyph constraints, crop safety, and fit rationale;
  - validator blocker classes now include off-brand covers, weak topic signal, visible AI artifacts, and below-brand-standard image quality;
  - the CMO manifest now treats premium topic-specific cover generation as part of the required new-article delivery chain.
