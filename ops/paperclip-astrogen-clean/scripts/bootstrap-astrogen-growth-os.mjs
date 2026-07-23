#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";

const OLD_DB = "paperclip-db-1";
const OLD_APP = "paperclip-app-1";
const CLEAN_DB = "paperclip-astrogen-clean-db-1";
const CLEAN_APP = "paperclip-astrogen-clean-app-1";

const OLD_COMPANY_ID = "c33f6b81-5ced-4270-9288-b46a32f6337a";
const CLEAN_COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const CLEAN_PUBLIC_URL = "http://ubuntu-oc.tailbd4e1c.ts.net:3210";
const HOST_COMPANY_DIR = "/home/paperclip/companies/astrogen-clean";
const CONTAINER_COMPANY_DIR = "/companies/astrogen";
const BACKUP_DIR = "/home/paperclip/backups";

const argv = new Set(process.argv.slice(2));
const APPLY = argv.has("--apply");
const DRY_RUN = argv.has("--dry-run") || !APPLY;

const secretDefs = [
  ["astrogen_payload_cms_api_key", "required"],
  ["crawlobserver-api-key", "required"],
  ["search-console-mcp-astrogen-token", "required"],
  ["telegram.bot_token.astrogen_ai_bot", "required"],
  ["resend-api-key", "required"],
  ["openrouter_api_key_4texts", "required"],
  ["openrouter_api_key_4images", "required"],
  ["dataforseo-api-login", "parked"],
  ["dataforseo-api-password", "parked"],
  ["serper-api-key", "required"],
  ["winning-structure-mcp-token", "required"],
  ["semantic-core-mcp-token", "required"],
  ["exa-api-key", "parked"],
  ["collaborator-api-key", "parked"],
  ["bright-data-api-token", "parked"],
].map(([key, tier]) => ({ key, tier }));

const pluginDefs = [
  {
    key: "paperclip-plugin-telegram",
    packageName: "paperclip-plugin-telegram",
    packagePath: "/app/packages/plugins/plugin-telegram",
    active: true,
    installOrder: 10,
  },
  {
    key: "paperclip.payload-cms-agent-tools",
    packageName: "@paperclipai/plugin-payload-cms-agent-tools",
    packagePath: "/app/packages/plugins/plugin-payload-cms-agent-tools",
    active: true,
    installOrder: 20,
  },
  {
    key: "paperclip.gsc-bing-ga4-mcp-agent-tools",
    packageName: "@paperclipai/plugin-gsc-bing-ga4-mcp-agent-tools",
    packagePath: "/app/packages/plugins/plugin-gsc-bing-ga4-mcp-agent-tools",
    active: true,
    installOrder: 30,
  },
  {
    key: "paperclip.crawlobserver-agent-tools",
    packageName: "@paperclipai/plugin-crawlobserver-agent-tools",
    packagePath: "/app/packages/plugins/plugin-crawlobserver-agent-tools",
    active: true,
    installOrder: 40,
  },
  {
    key: "paperclip.email-notifications",
    packageName: "@paperclipai/plugin-email-notifications",
    packagePath: "/app/packages/plugins/plugin-email-notifications",
    active: true,
    installOrder: 55,
  },
  {
    key: "paperclip.openrouter-image-agent-tools",
    packageName: "@paperclipai/plugin-openrouter-image-agent-tools",
    packagePath: "/app/packages/plugins/plugin-openrouter-image-agent-tools",
    active: true,
    installOrder: 60,
  },
  {
    key: "paperclip.collaborator-agent-tools",
    packageName: "@paperclipai/plugin-collaborator-agent-tools",
    packagePath: "/app/packages/plugins/plugin-collaborator-agent-tools",
    active: false,
    installOrder: 70,
    disabledReason: "Parked until backlink/provider workflow is explicitly enabled.",
  },
  {
    key: "paperclip.semantic-core-mcp-agent-tools",
    packageName: "@paperclipai/plugin-semantic-core-mcp-agent-tools",
    packagePath: "/app/packages/plugins/plugin-semantic-core-mcp-agent-tools",
    active: true,
    installOrder: 80,
  },
  {
    key: "paperclip.dataforseo-agent-tools",
    packageName: "@paperclipai/plugin-dataforseo-agent-tools",
    packagePath: "/app/packages/plugins/plugin-dataforseo-agent-tools",
    active: false,
    installOrder: 90,
    disabledReason: "Requires packaging smoke before activation.",
  },
  {
    key: "paperclip.serper-agent-tools",
    packageName: "@paperclipai/plugin-serper-agent-tools",
    packagePath: "/app/packages/plugins/plugin-serper-agent-tools",
    active: true,
    installOrder: 100,
  },
  {
    key: "paperclip.exa-agent-tools",
    packageName: "@paperclipai/plugin-exa-agent-tools",
    packagePath: "/app/packages/plugins/plugin-exa-agent-tools",
    active: false,
    installOrder: 110,
    disabledReason: "Requires packaging smoke before activation.",
  },
  {
    key: "paperclip.bright-data-agent-tools",
    packageName: "@paperclipai/plugin-bright-data-agent-tools",
    packagePath: "/app/packages/plugins/plugin-bright-data-agent-tools",
    active: false,
    installOrder: 120,
    disabledReason: "Requires explicit crawling budget approval.",
  },
  {
    key: "paperclip.winning-structure-mcp-agent-tools",
    packageName: "@paperclipai/plugin-winning-structure-mcp-agent-tools",
    packagePath: "/app/packages/plugins/plugin-winning-structure-mcp-agent-tools",
    active: true,
    installOrder: 130,
  },
  {
    key: "paperclip.search-console-mcp-agent-tools",
    packageName: "@paperclipai/plugin-search-console-mcp-agent-tools",
    packagePath: "/app/packages/plugins/plugin-search-console-mcp-agent-tools",
    active: false,
    installOrder: 140,
    disabledReason: "Superseded by gsc-bing-ga4 plugin.",
  },
  {
    key: "paperclip.diskinternals-bigquery-growth",
    packageName: "@paperclipai/plugin-diskinternals-bigquery-growth",
    packagePath: "/app/packages/plugins/plugin-diskinternals-bigquery-growth",
    active: false,
    installOrder: 150,
    disabledReason: "Cross-company plugin; never enable for Astrogen clean.",
  },
  {
    key: "paperclip.perfex-crm-agent-tools",
    packageName: "@paperclipai/plugin-perfex-crm-agent-tools",
    packagePath: "/app/packages/plugins/plugin-perfex-crm-agent-tools",
    active: false,
    installOrder: 160,
    disabledReason: "Not needed for Phase 40.",
  },
];

export const agentDefs = [
  role("CEO", "ceo", "Chief Executive Officer", null, "crown", false, true, "Owns company strategy, approvals, hiring boundaries, and final tradeoffs."),
  role("Chief Marketing Officer", "cmo", "Chief Marketing Officer", "CEO", "crown", true, false, "Owns Astrogen traffic growth, SEO/GEO priorities, content cadence, and owner-facing marketing decisions."),
  role("Chief Technical Officer", "cto", "Chief Technical Officer", "CEO", "shield", false, true, "Owns Paperclip runtime, integrations, plugin packaging, CMS/API reliability, and deployment safety."),
  role("OPS Human Interaction Agent", "human_interaction_agent", "Human Interaction Agent", "CEO", "message-square", false, false, "Owns Ukrainian owner-facing decision briefs, Telegram writeback, and human-response audit trails."),
  role("OPS Observability Agent", "devops", "Observability Agent", "Chief Technical Officer", "radar", false, false, "Owns deterministic health, drift, and liveness checks without idle LLM polling."),
  role("SEO Performance Analyst", "researcher", "SEO Performance Analyst", "Chief Marketing Officer", "target", false, false, "Turns compact GSC/GA4/CrawlObserver/CMS evidence into action queues and watch/cooldown decisions."),
  role("SEO GSC Indexing Auditor", "researcher", "SEO GSC Indexing Auditor", "SEO Performance Analyst", "eye", false, false, "Audits due URLs with quota/cooldown limits and routes indexing findings with evidence."),
  role("SEO Semantic Core Strategist", "researcher", "Semantic Core Strategist", "Chief Marketing Officer", "search", true, false, "Plans semantic-core layers and article opportunity expansion from approved evidence."),
  role("SEO Semantic Core Validator", "researcher", "SEO Semantic Core Validator", "SEO Semantic Core Strategist", "shield", true, false, "Validates semantic-core candidates, import readiness, and client-review safety."),
  role("SEO Blog Content Strategist", "cmo", "SEO Blog Content Strategist", "Chief Marketing Officer", "target", true, false, "Builds content plans from validated opportunities and business priority."),
  role("SEO Blog Content Plan Validator", "researcher", "SEO Blog Content Plan Validator", "SEO Blog Content Strategist", "eye", true, false, "Validates content plans before article production starts."),
  role("MKT Blog Brief Strategist", "cmo", "Blog Brief Strategist", "SEO Blog Content Strategist", "file-code", true, false, "Creates compact article briefs with locked title, route, keywords, scope, and CTA constraints."),
  role("SEO Blog Article Writer (Claude)", "researcher", "SEO Blog Article Writer", "MKT Blog Brief Strategist", "brain", false, false, "Writes canonical Ukrainian article artifacts through OpenRouter from accepted briefs only.", "openrouter"),
  role("SEO Blog Article Writer (ChatGPT)", "researcher", "Fallback SEO Blog Article Writer", "MKT Blog Brief Strategist", "brain", true, false, "Fallback writer used only for confirmed Claude/OpenRouter blockers or explicit CMO recovery.", "codex_local", "fallback-seo-blog-article-writer"),
  role("SEO Blog Article Validator", "researcher", "SEO Blog Article Validator", "SEO Blog Content Plan Validator", "shield", false, false, "Validates drafts against brief lock, factual risk, Astrogen voice, and artifact protocol."),
  role("SEO Blog Humanizer", "researcher", "SEO Blog Humanizer", "SEO Blog Article Validator", "sparkles", false, false, "Improves accepted drafts for natural Ukrainian readability without changing SEO locks."),
  role("SEO Blog Article Layout Editor", "researcher", "SEO Blog Article Layout Editor", "SEO Blog Humanizer", "layout", false, false, "Creates articleContent layout JSON and CMS-ready body structure."),
  role("SEO Blog Article Layout Validator", "researcher", "SEO Blog Article Layout Validator", "SEO Blog Article Layout Editor", "shield", false, false, "Validates layout JSON and CMS delivery evidence before owner notification."),
  role("SEO Blog Image Runtime Executor", "researcher", "SEO Blog Image Runtime Executor", "SEO Blog Article Layout Editor", "image", false, false, "Creates or verifies cover image runtime artifacts with image-key cost controls."),
  role("SEO CMS Technical Fixer", "researcher", "SEO CMS Technical Fixer", "Chief Technical Officer", "wrench", false, false, "Handles Payload CMS technical fixes, draft checks, and delivery verification."),
  role("MKT Product Discovery Analyst", "researcher", "Product Discovery Analyst", "Chief Marketing Officer", "microscope", false, false, "Evaluates new routes/products before SEO execution expands scope."),
  role("MKT Growth Strategy Architect", "researcher", "Growth Strategy Architect", "Chief Marketing Officer", "sparkles", true, false, "Designs growth experiments and acquisition strategy from validated evidence."),
  role("MKT Competitive Intelligence Analyst", "researcher", "Competitive Intelligence Analyst", "MKT Growth Strategy Architect", "search", true, false, "Analyzes competitors and SERP patterns in bounded batches."),
];

export const routineContracts = {
  dailyEvidence: `Purpose: create one bounded Astrogen SEO/GEO evidence packet from deterministic sources before any strategy reasoning.

Canonical target:
- Primary domain is https://astrogen.com.ua.
- GSC property is sc-domain:astrogen.com.ua.
- Payload CMS base is https://cms.astrogen.com.ua/api.
- App-store/developer-site evidence is secondary only. If a listing points to another domain, record that as a metadata finding and keep the evidence packet centered on astrogen.com.ua.

Allowed inputs:
- Payload CMS metadata and sitemap/page discovery.
- GSC/GA4/CrawlObserver summaries through configured Paperclip plugins.
- Existing seo_ops registry/cooldown state if present.

Tooling path:
- Use Paperclip agent plugin tools through /api/agents/me/plugin-tools and /api/agents/me/plugin-tools/execute with the run token when no native wrapper is available.
- Do not use board-only plugin/admin routes. If a configured plugin is not callable from the heartbeat, route a CTO configuration issue and do not substitute another domain as the main evidence source.

Bounds:
- Prefer summaries and top deltas over raw history.
- Inspect at most 25 URLs unless a linked issue explicitly authorizes more.
- Use LLM reasoning only after deterministic evidence is compacted.
- Request at most 10 rows per source by default and never print raw plugin JSON/tool output. Summarize only the fields needed for the action/no-action gate.

Allowed side effects:
- Store one compact evidence packet on the routine issue.
- Ingest or update one canonical \`astrogen-growth-actions\` case per actionable finding using a stable findingFingerprint. Repeated evidence updates the same case.
- Record explicit no-action evidence when nothing actionable is found.
- Update registry/cooldown records only when the plugin contract supports it.

Forbidden:
- Do not publish CMS content.
- Do not send Telegram messages.
- Do not run paid crawl/search/image providers.
- Do not create article-production tasks from this routine.

Completion gate:
- Close done only after recording an action queue, a watch/cooldown decision, or an explicit no-action packet with source timestamps.`,

  gscIndexingAudit: `Purpose: audit only due Astrogen URLs for indexing state using quota and cooldown discipline.

Canonical target:
- Inspect only URLs under https://astrogen.com.ua unless the issue explicitly authorizes another Astrogen-owned property.
- GSC property is sc-domain:astrogen.com.ua.

Allowed inputs:
- seo_ops page registry due URLs.
- Public sitemap discovery only when the registry is empty, capped at 20 URLs for registration.
- GSC URL Inspection through the configured GSC/Bing/GA4 MCP plugin.

Tooling path:
- Use Paperclip agent plugin tools through /api/agents/me/plugin-tools and /api/agents/me/plugin-tools/execute with the run token when no native wrapper is available.
- Do not use board-only plugin/admin routes from an agent heartbeat.

Bounds:
- Inspect at most 10 URLs per run.
- Skip URLs already inside cooldown.
- Use deterministic URL-level evidence first; do not run a full-site LLM review.
- Do not print raw inspection/plugin JSON. Summarize URL, verdict, timestamp, and action only.

Allowed side effects:
- Ingest or update canonical \`astrogen-growth-actions\` cases with URL-level evidence and a stable URL plus root-cause fingerprint.
- Record inspected, skipped, no-data, and cooldown decisions.

Forbidden:
- Do not request indexing in bulk.
- Do not mutate CMS content.
- Do not send Telegram messages.
- Do not spend paid provider budget.

Completion gate:
- Close done only after every selected URL has one of: finding routed, cooldown/watch recorded, skipped with reason, or explicit no due URLs.`,

  leadershipBacklogTriage: `Purpose: keep Astrogen's active portfolio moving when individual tasks fail, block, duplicate, or lose an execution path.

Timing:
- Runs daily at 06:40 Europe/Kiev, after deterministic evidence collection and GSC indexing audit.
- Missed schedules are skipped; do not backfill.

Inputs:
- Open Astrogen issues with status backlog, todo, blocked, or in_review where assigneeAgentId is empty.
- Open backlog issues older than 24 hours, even if they look parked.
- Blocked issues older than 24 hours, repeated findings for the same URL/root cause, and workstreams with no executable non-blocked item.
- Recent routine outputs from evidence, GSC, SEO/GEO, article cadence, and release checks.

Leadership routing rules:
- SEO/GEO/content/traffic/revenue issues: route to Chief Marketing Officer when prioritization is needed, or directly to the correct SEO specialist when the next action is obvious.
- Company/platform/process/runtime issues: route to CEO or CTO with a concrete completion gate.
- Human-decision, Telegram writeback, or owner-input gaps: route to OPS Human Interaction Agent, CEO, or CTO without enabling Telegram proactive watches.
- Parked items may remain backlog only when they have an assignee, a written parked reason, and the next review condition/date.
- Do not leave actionable work in backlog/unassigned.
- Collapse repeated findings into one canonical \`astrogen-growth-actions\` pipeline case using a stable finding fingerprint and attach new evidence there instead of creating another blocked branch.
- When a native case needs a new specialist issue, create it through the issue API with \`pipelineCaseLink.caseId\` and a stable purpose-based \`pipelineCaseLink.requestKey\`. This atomically creates the issue and its work link. Never create first and link second; use the standalone issue-link route only for pre-existing or migrated work.
- Classify every reviewed blocker as internal recovery, external/developer wait, owner decision, obsolete, or superseded. A blocked item never freezes an unrelated workstream.
- Ensure the current company priorities still have executable delegated work. When a priority has only blocked items, route one safe alternative action to the correct manager or specialist without performing that work yourself.

Execution boundary:
- CEO is the routing owner, not the domain executor.
- CEO may prioritize and route an existing issue with only the standard assignee plus todo/backlog mutation and a concise routing comment.
- That existing-issue route is only for genuinely unassigned actionable backlog/todo work. For an already assigned, blocked, in-progress, or foreign-owned issue, CEO must not patch it; CEO creates or updates the canonical native growth case and links the issue as evidence.
- CEO may manage \`astrogen-growth-actions\` cases through native pipeline transitions. CEO must not cancel, close, or rewrite another agent's issue or blocker graph; terminal and dependency state belongs to the owning agent or deterministic pipeline transition.
- A 403 while attempting to mutate a foreign issue is a routing error, not a company blocker: stop that mutation, use the canonical growth case, and continue the remaining portfolio.
- CEO must not personally perform SEO analysis, CMS edits/publishing, Telegram operations, plugin/provider calls, paid provider calls, or other specialist execution.
- When specialist execution is needed, CEO routes it to CMO, CTO, HIA, or the correct specialist agent.
- Roger (Hermes Agent) config and proactive Telegram watches remain outside this routine.

Bounds:
- Process at most 10 candidate issues per run, highest priority and oldest updated first.
- Prefer assigning or creating bounded child issues over broad strategy comments.
- Do not replay full histories; use heartbeat context, compact comments, and issue metadata.

Allowed side effects:
- Assign existing issues, move actionable work to todo, record concise routing comments, and ingest or update canonical native growth cases by stable fingerprint.
- Record duplicate or obsolete evidence on the canonical growth case. The owning agent or deterministic pipeline transition performs terminal issue state changes.

Forbidden:
- Do not execute the routed domain work inside the CEO triage run.
- Do not change Roger (Hermes Agent), Telegram, CMS, plugin/provider, or paid-service state directly from this routine.
- Do not create open-ended research loops.

Completion gate:
- Close the routine execution only after reporting routed, parked, blocked, and skipped counts.
- Healthy exit requires no open unassigned backlog/todo item older than 24 hours without a written reason, no unclassified stale blocker, and at least one executable delegated path for each current company priority unless durable no-safe-action evidence exists.`,

  articleSlotAllocator: `Purpose: allocate article capacity from validated native topic inventory without creating a parallel issue-tree workflow.

Source of truth:
- Use only the native \`astrogen-topic-inventory\`, \`astrogen-article-production\`, and \`astrogen-growth-actions\` pipelines.
- The scheduled allocator is the only normal dispatcher for a topic in stage \`ready\`. A ready-stage automation must not auto-reserve topics.
- Native article stage automations own SERP check, brief, Claude draft, validation, humanizing, layout, one-call image generation, CMS draft, and CMO delivery.

Native case inventory read path:
- Resolve pipeline UUIDs through \`GET /api/companies/{companyId}/pipelines\`; never put a pipeline key into a \`pipelineId\` route.
- Read ready topics through \`GET /api/pipelines/{topicPipelineId}/cases?stageKey=ready&terminal=false&limit=10&offset=0\`.
- Count and dispatch only wrapper rows whose \`row.case.fields.selectedAction=new_article\`, \`row.parentCase.pipeline.key=astrogen-search-demand-opportunities\`, and \`row.parentCase.case.id\` equals \`row.case.parentCaseId\`. A legacy ready case without guarded opportunity lineage is ineligible and must not consume capacity.
- Read open article WIP through \`GET /api/pipelines/{articlePipelineId}/cases?terminal=false&limit=10&offset=0\` and classify productive versus blocked from returned case/work evidence.
- Read current-day delivered articles separately through \`GET /api/pipelines/{articlePipelineId}/cases?stageKey=delivered&terminal=true&limit=100&offset=0\`. Current-day accounting is the unique union of those delivered rows and open article rows whose \`row.case.fields.operation=create\` and \`row.case.fields.reservationDateKyiv\` equal the current Europe/Kiev business date. Never derive the daily count from \`terminal=false\` rows alone.
- Find the canonical refill through exact \`caseKey=growth:topic-inventory-refill:{ISO-week}\` on \`GET /api/pipelines/{growthPipelineId}/cases?caseKey={urlEncodedCaseKey}&terminal=false&limit=10\`.
- Compute \`{ISO-week}\` from the current Europe/Kiev business date. A nonterminal refill from an earlier week is historical evidence, never the current canonical continuation, even when its stage is \`executing\` or its \`nextReviewAt\` is in the future.
- Every \`/pipelines/{pipelineId}/cases\` response is a direct JSON array of wrapper rows shaped as \`{case, stage, parentCase, activeWork, descendantActiveWorkCount}\`. Read fields from \`row.case\` and lineage from \`row.parentCase\`; never read top-level \`row.fields\` or a guessed \`parentPipeline\`. Count it with \`Array.isArray(response) ? response.length : protocol_error\`; \`[]\` is the only valid empty inventory. Never read \`response.items\`, \`response.cases\`, or infer an empty result from an object-shaped response.
- Do not probe generic \`/api/cases\`, \`/api/pipeline-cases\`, or \`/api/pipelines/{pipelineKey}/cases\` aliases. A failure caused by a key in a UUID route is a caller-contract error, not a platform blocker.

Capacity and selection:
- Target three new CMS drafts per Europe/Kiev day. This is a controlled daily batch, not a broad scheduler catch-up.
- Productive WIP cap is 3 article cases without an unresolved blocker. Blocked or external-wait cases do not consume productive WIP and never freeze a different topic.
- Calculate \`availableSlots = min(3 - currentDayNewArticleBatchCount, 3 - productiveWipCount, eligibleReadyTopicCount)\`. \`currentDayNewArticleBatchCount\` includes only new-article cases reserved or delivered by this allocator in the current Europe/Kiev day; it excludes refreshes, cancelled cases, and article cases from an earlier batch.
- Count each current-day article case ID once even if it appears in more than one bounded inventory read. A delivered current-day case remains part of the batch after it becomes terminal and must never reopen an already consumed slot.
- Select up to \`availableSlots\` lineage-valid ready topic cases deterministically by human priority, demand evidence, freshness, and oldest ready timestamp. Never invent a topic inside this routine.
- Select at most one eligible topic from the same repetitive query family in one daily batch. Explicit calendar-date themes and ephemeral daily-horoscope themes, including sign-specific "на сьогодні" variants, are paused by owner policy and are never eligible even when a legacy case remains at ready.
- Count and select unique \`intentClusterKey\` values. Two differently worded topics that seek the same reader outcome and expected owner page are one topic; merge supporting queries and reject the duplicate lineage before dispatch.
- For \`portfolioLane=audience_interest_editorial\`, dispatch at most one topic per daily batch and at most four article cases reserved or delivered in the current Europe/Kiev calendar month. Prefer enough evidence-backed cases to reach two per month, but never invent or weaken a topic to meet that target.
- For \`allocationFamily=zodiac_compatibility\`, dispatch at most one topic per daily batch. Keep page-specific \`queryFamilyFingerprint\` values for ownership and cannibalization; allocationFamily exists only to prevent one cluster from consuming all three slots.
- When ready inventory exists but every remaining row is excluded only by a repetitive-family or allocationFamily daily cap, treat the remaining slots as a portfolio-diversification deficit, not as durable owner-policy impossibility.
- Dispatch the selected topics sequentially. A duplicate, blocked, or topic-specific breakdown failure records typed evidence for that topic and continues with the next independently ready topic. Stop the batch only for a shared API/authentication failure.

Atomic dispatch:
- For each selected topic, call \`POST /api/cases/{topicCaseId}/breakdown\` once with one item. The ready stage configuration must target \`astrogen-article-production\` stage \`opportunity\`, use piece noun \`article\`, and advance the topic to \`reserved\`.
- The item key is \`{topicKey}:reservation-v{topicCaseVersion}\`. The ready topic case version is the reservation generation: a retry of the same generation reuses one child, while a topic released after cancellation has a newer version and creates a new child instead of reusing the cancelled case. Its fields include operation=create, targetQueryCluster from queryCluster, blockerClass=null, nextReviewAt=null, attemptCount=0, cmsDraftId=null, cmsAdminUrl=null, and telegramMessageId=null. Inherited topic fields provide topicKey, titleUk, ctaRoute, and evidenceRefs.
- Treat the breakdown response as the reservation proof. Record the returned child article case id as consumingArticleCaseId and set a bounded reservationExpiresAt if the reserved-stage automation has not already done so.
- Breakdown request keys and native case keys are the per-reservation-generation idempotency boundary. Never create a legacy article parent, brief child, writer child, refill child, or recovery issue from the allocator.

Inventory refill:
- Independently of today's article slots, ingest or update one canonical \`astrogen-growth-actions\` case with fingerprint \`topic-inventory-refill:{ISO-week}\` and case key \`growth:topic-inventory-refill:{ISO-week}\` while eligible \`ready + reserved\` supply is below 25 or any \`contentPortfolioTrack\` is below its 12/5/3/3/2 target; do not create a blocked issue chain.
- A refill stage name is not liveness proof. Treat the current-week refill as live only when the case wrapper exposes current \`activeWork\`, positive \`descendantActiveWorkCount\`, or a current linked work issue with an explicit future monitor/recovery path. A done, cancelled, stale, prior-week, or unmonitored blocked issue does not count.
- When the exact current-week refill is below target and has no live work path, atomically delegate one bounded continuation to SEO Blog Content Strategist through issue creation with \`pipelineCaseLink.caseId\` and stable \`pipelineCaseLink.requestKey=topic-inventory-refill:{ISO-week}:continuation:v{caseVersion}\`. Reuse the returned issue on retry; never create first and link second.
- The growth case delegates evidence-backed search-demand and curriculum planning until the rolling plan contains 12 western-astrology learning topics, 5 applied audience questions, 3 trends, 3 trust/expert/method-boundary topics, and 2 commercial unmet-demand topics. Audience segments are diversity guardrails, not hard quotas. Only a delegated \`selectedAction=new_article\` breakdown may create a topic candidate.
- Before native search-demand ingestion, group accepted phrases by reader outcome, search intent, expected owner page and SERP family. One \`intentClusterKey\` creates one canonical opportunity and one plan row; variants remain \`supportingQueries\`.
- Prioritize portfolio breadth across audience-interest, adjacent-use-case, audience-need, and core-product demand. When accepted semantic inventory cannot supply enough broad candidates, reuse the latest valid trend report or run the bounded low-inventory fallback under /companies/astrogen/reference/trend-topic-policy.yaml. Trend output is evidence only: every proposed phrase must pass normal semantic-core validation before it can enter search-demand intake.
- Treat \`semantic_core_and_curriculum\` and \`audience_trends\` as independent refill source lanes with at most one live continuation per lane. A live, blocked, or compatibility-focused semantic continuation never satisfies or freezes a deficient audience-trends track; while audience_trends ready plus reserved supply is below three, reuse or create its stable bounded trend continuation.
- If the portfolio-track matrix is incomplete, the allocator creates or updates that refill growth case and verifies its real work/monitor path. \`no-safe-topic\` is never terminal success by itself.
- Missing Payload, GSC/GA4, semantic-core, CrawlObserver, or pipeline access becomes a typed blocker on the refill growth case. It does not stop other growth or article cases and is not sent to the owner as a topic-choice request.

Article delivery invariants:
- Claude is the primary writer; ChatGPT is fallback only after a durable Claude/provider/protocol blocker or explicit CMO recovery decision.
- Image stage makes exactly one provider call, requests 1472x822, and preserves a visually accepted original when each axis differs by at most 20 percent. No retry, upscale, crop, or conversion solely for a within-tolerance mismatch.
- Delivered requires accepted cover or explicit waiver, authenticated CMS draft/admin URL, verified articleContent with Коротко, CTA and exactly three suitable relatedPosts, and one gender-neutral Telegram message containing only title and CMS admin edit URL with delivery proof.
- CMS remains draft-only. Generic technical Telegram notifications and proactive watches remain off.

Completion gate:
- Done only when the current-day batch target or productive WIP cap is satisfied. A single successful breakdown does not satisfy a remaining daily batch deficit.
- When the current-day count is below three because ready inventory is empty or contains no independently dispatchable family, keep this same allocator issue \`in_progress\` with \`executionPolicy.monitor.nextCheckAt\` set to a bounded inventory and refill-output recheck and notes naming the exact current-week refill case. At the monitor wake, read terminal linked worker outputs, update the source growth case as CMO, continue the next deficient track, and dispatch newly ready topics. The worker does not receive \`astrogen-growth-actions\` \`pipelines:write\`; its write rejection is not a blocker when case-visible output exists. Close only after three current-day slots are reserved/delivered, the WIP cap is reached, or a durable typed external/provider/explicit-owner-policy bound makes the remaining slots impossible for this business day. A repetitive-family cap or underfilled 12/5/3/3/2 track is not such a bound.
- A refill in \`executing\` without active work or a future monitor is stranded work, not a completion condition. Repair its native delegation before scheduling the allocator recheck.
- A comment, legacy child issue, narrative no-slot report, or raw tool output is not completion evidence.`,

  weeklySeoGeo: `Purpose: turn compact daily evidence into a weekly Astrogen SEO/GEO action cycle.

Canonical target:
- Primary domain is https://astrogen.com.ua.
- GSC property is sc-domain:astrogen.com.ua.
- Treat app-store/developer-site mismatches as findings, not as a replacement target.

Allowed inputs:
- Latest bounded evidence packets from daily collection.
- GSC/GA4/CrawlObserver/Payload summaries for the completed Wednesday-Tuesday week.
- Existing open SEO/action issues, Hermes owner replies, and cooldown/watch records.

Tooling path:
- Use Paperclip agent plugin tools through /api/agents/me/plugin-tools and /api/agents/me/plugin-tools/execute with the run token when no native wrapper is available.
- Do not use board-only plugin/admin routes from an agent heartbeat.

Bounds:
- Use compact evidence only; do not replay whole issue history.
- Create only high-confidence child issues with clear assignees and blockers.
- Prefer watch/cooldown/no-action decisions over speculative work.
- Do not print raw plugin JSON or long issue histories. Use top 5-10 deltas from the latest evidence packets.

Allowed side effects:
- Ingest or update stable \`astrogen-search-demand-opportunities\` cases and route selected actions through native pipelines.
- Produce a concise internal weekly report document/comment and a Hermes-ready owner brief when owner direction would help.
- Send the detailed weekly SEO report through \`paperclip.email-notifications:email-seo-weekly-report-send\`.

Search-demand opportunity contract:
- Every actionable finding follows discovered -> evidence_ready -> ownership_review -> action_selected -> delegated -> verified -> measured. A durable no-action decision terminates at action_selected -> cancelled and creates no downstream work.
- Follow /companies/astrogen/reference/search-demand-policy.yaml. Start from accepted uncovered semantic-core clusters ranked by Ukraine geo frequency; use GSC query/page evidence, Payload/live coverage, CrawlObserver, current SERP evidence, and existing action history to resolve ownership. Exact-slug absence or one-to-five weekly GSC impressions never qualify a new article by themselves.
- Treat trend reports as portfolio evidence only. A trend phrase must pass the normal semantic-core validation workflow before it can become search-demand evidence. Calendar-date themes are paused and route to no_action rather than topic inventory.
- Resolve query-to-URL ownership and cannibalization before action selection.
- Select exactly one closed-enum action: new_article, refresh, merge, reposition, internal_link, technical, or no_action. Never append a reason to selectedAction; store actionReasonCode/actionReasonSummary separately. The discovered stage never writes selectedAction.
- Only a delegated opportunity with the durable decision selectedAction=new_article may call native breakdown into topic inventory. The breakdown waits for the topic/article child outcome before verification. All other actions use linked growth execution cases.
- no_action records its reason, cooldown and nextReviewAt, then uses action_selected -> cancelled without a child, execution blocker, verification, or measurement task.

Content refresh contract:
- \`content_refresh\` means improving an existing article's body/content after
  relevant keyphrase and SERP value-gap analysis.
- Required evidence is a compact SERP value-gap artifact: queries checked,
  geo/language, top competitors, competitor coverage patterns, missing user
  questions, Astrogen information-gain angle, and the exact article sections
  that need substantive improvement.
- Do not route \`content_refresh\` as generic insertion of \`Коротко\`, FAQ,
  CTA, comparison blocks, internal links, relatedPosts, or metadata-only edits.
- FAQ, comparison, CTA, relatedPosts, or structured blocks are allowed only
  when the SERP/user-value gap explicitly justifies them.
- Editorial/layout defects stay in editorial backfill or layout repair lanes;
  metadata, internal-link-only, and relatedPosts-only fixes stay in deterministic
  CMS/SEO fixer lanes.

Email delivery contract:
- Use the completed Wednesday-Tuesday Europe/Kiev period and the previous Wednesday-Tuesday comparison period; mark the latest 2 source days provisional when applicable.
- Write for a non-technical company owner in simple Ukrainian. Explain business meaning first; keep tool names, payload details, and internal implementation terms out of the main summary.
- CrawlObserver \`list-sessions\` returns a compact object whose \`sessions\` rows carry camelCase \`sessionId\` and \`quality.isFullCrawl\`. Select the latest completed row with \`quality.trusted=true\`, \`quality.status=trusted\`, and \`quality.isFullCrawl=true\`, then confirm it through \`get-session-quality\` before technical conclusions.
- A non-empty \`sessions\` array is never reported as no crawl session. Missing canonical \`sessionId\` is a plugin protocol blocker, not an evidence limitation.
- Owner email may say only whether verified technical crawl evidence was included and what that means. Keep \`bounded\`, \`list-sessions\`, \`get-session-quality\`, \`trust gate\`, \`proof\`, raw statuses, and adapter terminology in internal issue evidence.
- The first section must say what Paperclip will do next. Every action must name the existing issue or native case, accountable agent, current status, exact next step, and review date when known.
- Separate executable actions from watch/cooldown/no-action decisions. Never present a blocked or external-wait issue as completed work.
- Call paperclip.email-notifications:email-seo-weekly-report-send with the structured report object and an idempotency key tied to the routine issue. The company-scoped plugin renders safe HTML plus a plain-text fallback.
- Set ownerAction only when the owner can make a concrete decision. Otherwise state plainly that no owner action is required.
- Record email delivery proof in the issue thread without exposing raw secrets or provider payloads.
- If email delivery is configured but the tool/transport fails, create or link a CTO-owned blocker for the email transport and leave the weekly SEO issue blocked or in progress; do not silently fall back to comment-only completion.
- If the plan explicitly says email is not ready, keep the detailed report as a Paperclip issue document/comment and create or link a CTO blocker that names the missing sender, recipients, or Resend secret-ref.

Forbidden:
- Do not publish CMS content.
- Do not send Telegram by default.
- Do not run paid providers unless a linked issue authorizes budget.
- Do not create article slots directly; use the allocator routine.
- Do not close done with only an internal comment when email delivery is configured.

Completion gate:
- Close done only after action issues, Hermes/CMO owner-brief decisions, watch/cooldown decisions, or explicit no-action evidence are recorded.
- Close done only after the detailed weekly SEO email has delivery proof, or a concrete CTO-owned email transport blocker is linked and visible from the weekly issue.
- A report without routed decisions and the required email delivery/blocker evidence is incomplete.`,

  weeklyGrowthPortfolio: `Purpose: turn the completed Wednesday-Tuesday SEO/GEO evidence and content inventory into an executable Astrogen growth portfolio owned by CMO.

Timing:
- Runs Wednesday at 10:15 Europe/Kiev after the 09:00 SEO/GEO action cycle and before the 11:00 CEO direction review.

Management boundary:
- CMO chooses priorities, outcome targets, owners, sequence, and WIP. CMO does not perform SERP research, write articles, create images, mutate CMS, or repair runtime integrations.
- Use specialist outputs and durable evidence. Delegate execution through issues or native pipeline cases.

Required portfolio lanes:
- content supply: validated ready topics, article delivery, and SERP-driven refreshes;
- technical SEO/indexing: canonical deduped remediations and developer handoffs;
- GEO/entity visibility: evidence-backed entity/content/schema opportunities;
- conversion/revenue learning: landing-page, CTA, funnel, and measurement opportunities supported by current data.

Continuity rules:
- A blocker affects only its own case and dependency chain. It must never stop unrelated work in the same or another lane.
- Maintain at most 3 productive article parents and a bounded total action portfolio. Blocked/external-wait items remain visible but do not consume productive WIP.
- Reuse canonical issues for repeated findings. Do not create a new issue solely to make the board look active.
- If one lane has no safe executable action, record why and continue the other lanes.

Output contract:
- Create/update a compact weekly-growth-plan issue document with 3-7 prioritized actions when evidence supports them.
- Ingest or update evidence-backed \`astrogen-search-demand-opportunities\` cases at \`discovered\` using stable fingerprints and /companies/astrogen/reference/search-demand-policy.yaml until the rolling contentPortfolioTrack matrix 12/5/3/3/2 is met. Never ingest topic candidates directly.
- Keep the portfolio broader than current products: trend discovery starts from current audience segment situations, temporal/behavioral signals, cultural shifts, reader problems, seasonal recurrences and safety concerns, not from Astrogen products, modalities, service pages, existing keyword families or semantic-core seed catalogs. Evergreen how-to/checklist/explainer ideas, clinical/psychotherapy lanes, and product/modality families are not trend candidates by themselves. Do not fill a plan with near-identical sign/product query families. Calendar-date themes remain paused.
- If accepted semantic demand cannot maintain the low-water mark, reuse the latest valid trend report or delegate the bounded fallback in /companies/astrogen/reference/trend-topic-policy.yaml. Raw trend phrases are evidence only and must pass normal semantic-core validation before search-demand intake.
- Drive each opportunity through ownership review and one action selection. Only guarded \`new_article\` breakdown may create a native topic candidate.
- Maintain 25 lineage-valid future topics across \`ready\` and \`reserved\` with contentPortfolioTrack targets 12/5/3/3/2. Keep primaryAudienceSegmentId for diversity reporting only; never create filler for a segment. Candidate and evidence-ready stage automations own enrichment and duplicate/cannibalization validation.
- Manage delegated topic generation through final validator outcomes. Candidate submissions are progress, not inventory success; candidate, evidence_ready, consumed, rejected_duplicate, secondary-segment aliases, comments and narrative lists do not count. Update the canonical refill case document \`next-content-plan\` from the live counted native cases.
- Compute the current Europe/Kiev ISO week and use only exact \`caseKey=growth:topic-inventory-refill:{ISO-week}\` as the canonical refill. A prior-week nonterminal case is stale portfolio history and must not satisfy this week's completion gate.
- A stage label such as \`executing\` is not evidence of execution. Require current \`activeWork\`, positive descendant active work, or a linked issue with a future monitor/recovery path. If the exact current-week case is below target and has no such path, atomically delegate one SEO Blog Content Strategist continuation with \`pipelineCaseLink.caseId\` and stable request key \`topic-inventory-refill:{ISO-week}:continuation:v{caseVersion}\`.
- Each action names the business/search outcome, evidence, accountable manager, specialist executor, completion proof, and review window.
- Delegate accepted actions immediately or link the existing canonical execution issue/case.
- Record ready-topic inventory level, productive article WIP, blocked article count, CMS drafts delivered in the completed week, and SEO actions completed.

Completion gate:
- A report alone is not completion. Every accepted action is delegated or linked to an executable existing path; blocked items have an owner and recovery/external-wait class; unrelated lanes continue.
- Content-supply completion requires at least 25 non-retired lineage-valid topic cases at \`ready\` or \`reserved\` satisfying contentPortfolioTrack targets 12/5/3/3/2. If total or any track is lower, the exact current-week refill has an accountable specialist plus active linked work or a future monitor; \`stage=executing\` and \`nextReviewAt\` alone are insufficient.
- Native topic case ids in candidate, evidence_ready, consumed, rejected_duplicate, secondary segment aliases, or a list in comments never satisfy the portfolio gate. The \`next-content-plan\` case document must contain the same live native IDs counted by the gate.
- If fewer than 3 safe actions exist, include durable no-safe-action evidence rather than inventing work.`,

  weeklyCeoDirection: `Purpose: make one broad company-level direction decision for Astrogen after the weekly SEO/GEO and CMO growth portfolio cycles.

Timing:
- Runs Wednesday at 11:00 Europe/Kiev.
- Reviews the completed Wednesday-Tuesday operating week and the current CMO weekly-growth-plan.

Executive boundary:
- CEO thinks beyond marketing: revenue, product readiness, customer value, delivery capacity, platform risk, measurement quality, and future company functions.
- The current company has only a staffed marketing/growth organization, so CEO delegates growth execution to CMO and platform/integration work to CTO. CEO does not execute specialist tasks.

Required decisions:
- confirm, reorder, narrow, or stop current company bets;
- ensure each selected bet has an outcome metric, accountable manager, executable path, and review date;
- resolve cross-functional priority conflicts and capacity limits;
- ensure one blocked task has not frozen unrelated company work;
- identify missing future capabilities without pretending unstaffed departments already exist.

Completion gate:
- Record the executive direction and delegate every resulting action to CMO, CTO, HIA, or the correct manager.
- Do not close with a narrative-only review. At least one concrete delegation, explicit continuation of existing bets, or durable no-change decision with evidence is required.`,

  releaseCheck: `Purpose: verify clean Paperclip runtime provenance and compare against upstream release state without deploying.

Allowed inputs:
- Clean /api/health and local build metadata.
- Local release notes/manifests available in the runtime/source tree.
- GitHub release metadata only for read-only comparison.

Bounds:
- Read-only checks only.
- Summarize current version, expected version, and whether a newer upstream release appears available.

Allowed side effects:
- Create a CTO follow-up issue only when provenance is missing, health is failing, or a newer release needs review.
- Record explicit no-action evidence when current runtime is healthy and no action is needed.

Forbidden:
- Do not rebuild, restart, pull images, deploy, or edit production config.
- Do not change plugin state.
- Do not notify the owner unless a separate human-facing decision issue is created.

Completion gate:
- Close done only after health/provenance/latest-release evidence is recorded and any required follow-up issue is linked.`,

  operatingSelfImprovement: `Purpose: learn from each completed Astrogen operating week and improve Paperclip agents, contracts, workflows, routines, plugins, and recovery paths.

Timing:
- Runs every Wednesday at 12:30 Europe/Kiev, after the weekly SEO/GEO cycle and CEO business direction review.
- Reviews the previous Wednesday-Tuesday operating week.
- Missed schedules are skipped; do not backfill.

Ownership:
- Chief Technical Officer owns this Paperclip operating-system quality loop.
- CEO and CMO own business direction and prioritization, not low-level Paperclip process repair.
- CTO may route business-priority choices to CEO/CMO and technical implementation work to specialist agents.

Inputs:
- Failed, cancelled, stranded, retried, blocked, and long-running heartbeat/routine runs.
- Recovery issues, manual operator repairs, and owner feedback.
- Agent AGENTS.md/contracts, workflow manifests, routine descriptions, plugin settings, and cost/accounting signals.
- Completed improvements from the previous self-improvement cycle.

Decision policy:
- Prefer process and contract fixes before adding more routines.
- Distinguish agent behavior problems from plugin/runtime/config problems.
- Do not optimize for token cost alone; prioritize loop reliability, bounded context, clear artifacts, and recovery paths.
- Route business-priority decisions to CEO/CMO instead of deciding them inside CTO review.

Mutation gate:
- Read-only analysis may run without backup.
- Any change to live agent instructions, workflow/routine contracts, plugin settings, production manifests, scheduler config, or runtime config requires a successful fresh DB backup first.
- Backup path must be recorded in the issue comment and owner email.
- If backup fails, do not mutate; create a CTO blocker.
- If configured email delivery is unavailable, do not apply optional changes; create a CTO blocker to repair email/reporting first.

Allowed improvements:
- Update agent/routine/process contracts for clarity and safer delegation.
- Tighten validation gates, output caps, recovery classifications, and routing rules.
- Create bounded child issues for code/plugin/runtime changes that need implementation.
- Apply low-risk config/contract fixes when backup and verification pass.

Forbidden:
- Do not silently change production behavior without backup and email report.
- Do not publish CMS content, enable Telegram proactive watches, or call paid providers from this review.
- Do not edit Roger (Hermes Agent) config unless a separate owner-approved issue explicitly scopes it.
- Do not make broad refactors or open-ended research loops.

Owner email:
- Recipient: o.savitsky@gmail.com.
- Transport: paperclip.email-notifications email-change-report-send / Resend.
- Required when changes are applied.
- Email must include what changed, why it changed, backup path, verification result, follow-up issues or no-follow-up rationale, and rollback note.

Completion gate:
- Close done only after recording the improvement report, routing follow-ups, and, when changes were applied, confirming backup, verification, and owner email delivery.`,

  monthlyTrendDiscovery: `Purpose: produce evidence-backed Astrogen demand and market hypotheses for native portfolio review without creating article work directly.

Inputs and bounds:
- Follow /companies/astrogen/reference/trend-topic-policy.yaml. This routine fills only contentPortfolioTrack=audience_trends with a target of three eligible topics; it never fills the other four portfolio tracks. Read the latest durable report first through \`paperclip.semantic-core-mcp-agent-tools:get-trend-topic-report\`; when the audience_trends track is deficient, choose an underrepresented audience segment as a diversity guardrail and call \`paperclip.semantic-core-mcp-agent-tools:generate-trend-topic-report\` for that one segment only when no reusable report can reduce the deficit, with \`project_id=astrogen-audience-trends-ukraine\`, \`analysis_date=YYYY-MM-DD\` in Europe/Kiev, \`mode=live\`, the bounded six-month horizon, full existing-content inventory as duplicate context only, prior clusters/reviewed fingerprints, and private-project cache policy.
- Use only the declared tool fields: map CMS pages to \`existing_content\`, first-party metrics to \`internal_signals\`, and company context to \`project.business_context\`. Never send top-level \`business_context\`, \`runtime_inputs\`, \`existing_content_inventory\`, \`topic_pipeline_snapshot\`, or \`semantic_core_inventory\`.
- Focus a campaign report by sending exactly one configured entry in \`audience_segments\`. Never send \`primary_audience_segment_id\` or \`reviewed_fingerprints\`; they are not MCP fields. Apply reviewed fingerprints locally and summarize exclusions only in an \`internal_signals\` row with required \`title\` and \`description\`, not \`name\`/\`value\`.
- \`project.output_language\` is required; each \`existing_content\` row contains only \`title\`, optional \`url\`, and \`status=published|planned\`; \`internal_signals\` is an array. Do not send CMS \`slug\` or \`publishedAt\` as extra fields.
- Do not send \`products\` to \`generate-trend-topic-report\`. Do not put Astrogen product/service/modality terms in \`project.description\`, \`project.market\`, \`project.business_context\`, \`company_goal\`, \`audience_segments.name\`, or \`audience_segments.description\`. Existing content and previous clusters may contain those terms only as duplicate/ownership exclusion context.
- Preserve status, run_id, clusters, watchlist, rejected_signals, warnings, research_summary, cache_summary, cost.events, and report_markdown as one project-scoped durable trend report.
- A successful report may contain zero clusters. Never invent missing hypotheses or repeat the paid call merely to fill a quota.

Execution boundary:
- SEO Semantic Core Strategist owns the bounded trend report and delegates candidate review to SEO Semantic Core Validator. This routine never waits in the CMO management queue and never creates article tasks.
- CMO receives only native portfolio/action review after validated opportunities reach the appropriate search-demand stage; CMO does not perform trend research, provider validation, or ingestion.
- Never call \`prepare_paperclip_import\` for a trend run and never treat trend phrases as accepted semantic-core keywords.
- A promising phrase must be submitted separately to the normal semantic-core workflow. Only accepted demand may enter \`astrogen-search-demand-opportunities\`; only a later delegated \`selectedAction=new_article\` decision may create topic inventory.
- A \`candidate_review\` result is nonterminal. SEO Semantic Core Strategist delegates one stable review child per validation wave to SEO Semantic Core Validator, keeps the parent open, and requires append-only review plus one cached live materializing rerun per distinct original semantic-run/layer partition before the phrases are accepted, parked or rejected. Never combine phrases from different intended layers in one materializing run. Low confidence is not an owner decision. Validation child titles, purpose lines, and completion gates must describe validation/classification plus an ingestion handoff packet only; do not say the semantic-core assignee will materialize native search-demand cases.
- Validate at most five concrete Ukrainian search phrases with an audience-situation or reader-problem anchor per wave and at most three waves per report through run-layer-and-wait with explicit mode=live on \`astrogen-ukraine\`. Every phrase carries the report's exactly one \`primaryAudienceSegmentId\`; secondary segments never satisfy another quota. Every phrase must derive from a retained current temporal/behavioral audience signal; evergreen how-to/checklist/explainer ideas, clinical/psychotherapy lanes, and product/modality families are not enough. Product/service binding is downstream action context only and never a trend-generation seed. Never narrow a retained audience trend into an Astrogen product, service, modality, route, existing owner URL, or product keyword family; trend-derived phrases, topic titles, H1s, slugs, primary keywords and topicKeys must remain audience-discussion themes. If Paperclip introduced product/service/modality wording instead of preserving the audience signal, reject/cancel it as \`product_narrowing_contamination\`. Products may appear later only as contextual body links when useful. Mock or fixture output is smoke evidence only and can never satisfy production demand routing. Never reuse parked or rejected phrases. Each wave uses stable child fingerprint \`trend-validation:{trendReportRunId}:wave:{waveNumber}\`; inspect direct children and reuse the matching nonterminal child instead of creating duplicate validation or config-blocker work. If one wave is all parked, the focused segment remains below five, and unused non-calendar clusters remain, delegate the next bounded wave instead of closing discovery.
- Before validation, classify each selected phrase into exactly one supported candidate layer: \`adjacent_use_case_intent\` for decisions and situations served by Astrogen expertise, \`audience_need_intent\` for explicit audience problems or safety needs, or \`audience_interest_intent\` for broader verified audience interests. Partition the wave into layer-homogeneous calls while keeping at most five phrases total. Never submit \`core_product_intent\` to candidate-keyword validation; preserve direct product/service signals for the separate semantic-core seed/core workflow. A \`parked_outside_layer\` or \`owner_mismatch\` result is nonterminal if the phrase was not run on its preclassified intended layer: correct it once inside the same wave. Never sweep a phrase across every layer.
- \`audience_interest_intent\` feeds the bounded \`audience_interest_editorial\` portfolio lane, targeting two and capped at four articles per Europe/Kiev calendar month. It does not require direct product or entity anchoring when current audience evidence, a defensible Astrogen editorial bridge, SERP information gain, claim boundaries, non-cannibalization and useful internal links pass. \`no_entity_anchor\` or \`owner_mismatch\` alone is not a terminal park reason for that lane.
- A terminal validation child is not success evidence by status alone. Before done it must append exactly one machine-readable fenced JSON result projection under the reserved heading \`## trendIngestionResult\` with \`finalDisposition\`, \`acceptedSemanticCandidates\`, \`acceptedSemanticCandidateCount\`, \`createdSearchDemandCaseIds\`, \`eligibleReadyTopicCountAfter\`, \`primaryAudienceSegmentId\`, \`segmentEligibleTopicCountAfter\`, \`remainingUnusedClusters\`, and \`validationWave\`. Do not use that exact heading for prose, checklists, or required-field notes. \`accepted_for_search_demand_ingestion\` means the ingestion owner must still create or reuse native search-demand cases. Accepted candidate count never increments topic inventory. \`createdSearchDemandCaseIds\` contains only real native case IDs; ready counts come only from live lineage-valid topic cases at ready plus reserved, or are null with a typed evidence-access blocker. Semantic-core validators do not need \`pipelines:write\`; a missing write permission on a validation child is expected role separation, not a CTO blocker. If accepted candidates exist but no native case IDs exist, SEO Semantic Core Strategist creates or reuses one bounded ingestion handoff assigned to SEO Blog Content Strategist, then reads the returned real case IDs before deciding the next wave. If no search-demand case was created, the focused segment remains below five, the current wave is below three, and eligible unused clusters remain, delegate the next wave. Report exhaustion continues with an underrepresented audience segment under campaign bounds or a first-class next-window monitor; it never completes an underfilled portfolio.
- Before native ingestion, group accepted phrases into page-level intent clusters. One reader outcome plus one search intent and expected owner page creates one \`intentClusterKey\`, one canonical opportunity and one quota row; choose one primary query and retain the rest as supporting queries. A provider phrase, semantic row or trend run is never a separate opportunity by itself.
- Do not use model memory as current trend evidence, mutate CMS, publish, generate images, or send Telegram.

Completion gate:
- Store every typed trend report with cache and cost telemetry, then route only bounded semantic validation for selected phrases or record explicit zero-cluster/no-supported-trend evidence. No \`candidate_review\` may remain unresolved. Trend discovery fills only contentPortfolioTrack=audience_trends, whose rolling target is 3; it never fills the other four tracks. A report may finish after bounded exhaustion, but portfolio refill closes only at 25 eligible \`ready + reserved\` topics satisfying 12/5/3/3/2 with a matching \`next-content-plan\` document. Never create an article or topic directly from trend output.`,

  monthlyScaledContentAudit: `Purpose: detect bounded Astrogen near-duplicate or repeated-template article clusters that lack independent reader value.

Deterministic preselection:
- Compare normalized titles, heading trees, main-content semantics, section-purpose sequences, selected value generators, and entity-substitution patterns.
- Exclude navigation, footer, legal/safety text, Коротко, CTA, related posts, CMS chrome, metadata, and decorative media before comparison.
- Send only deterministic candidate clusters and compact evidence to LLM review; inspect at most 5 clusters or 50 URLs.

Execution boundary:
- Assess independent purpose, substantive overlap, derivative rewriting, thin or padded content, evidence, effort, and sibling differentiation.
- Route keep/differentiate/consolidate/refresh/park recommendations into one canonical growth case per stable cluster fingerprint.
- Consolidation and ownership changes require portfolio authority. Findings do not mutate CMS or create article-production tasks directly.
- One blocked cluster does not stop the rest. Do not call shared layout components substantive duplication and do not label generation itself as spam.

Completion gate:
- Every selected cluster has a typed recommendation and evidence route, or the run records explicit no-candidate or insufficient-evidence proof.`,
};

export const routineDefs = [
  routine("Daily Astrogen deterministic evidence collection", "SEO Performance Analyst", "10 6 * * *", routineContracts.dailyEvidence, "coalesce_if_active", "seo_performance_loop", {
    status: "active",
    triggerEnabled: true,
    activation: "active_evidence_collection",
  }),
  routine("Daily Astrogen due-URL GSC indexing audit", "SEO GSC Indexing Auditor", "20 6 * * *", routineContracts.gscIndexingAudit, "coalesce_if_active", "technical_seo_finding", {
    status: "active",
    triggerEnabled: true,
    activation: "active_due_url_audit",
  }),
  routine("Daily Astrogen leadership backlog triage", "CEO", "40 6 * * *", routineContracts.leadershipBacklogTriage, "coalesce_if_active", "leadership_backlog_triage", {
    status: "active",
    triggerEnabled: true,
    activation: "active_backlog_safety",
  }),
  routine("Astrogen article slot allocator", "Chief Marketing Officer", "0 10 * * *", routineContracts.articleSlotAllocator, "skip_if_active", "article_cadence", {
    status: "active",
    triggerEnabled: true,
    activation: "active_daily_batch_3",
    catchUpPolicy: "enqueue_missed_with_cap",
  }),
  routine("Weekly Astrogen SEO/GEO action cycle", "SEO Performance Analyst", "0 9 * * 3", routineContracts.weeklySeoGeo, "coalesce_if_active", "seo_performance_loop", {
    status: "active",
    triggerEnabled: true,
    activation: "active_weekly_action_cycle",
  }),
  routine("Weekly Astrogen CMO growth portfolio plan", "Chief Marketing Officer", "15 10 * * 3", routineContracts.weeklyGrowthPortfolio, "coalesce_if_active", "growth_portfolio_control", {
    status: "active",
    triggerEnabled: true,
    activation: "active_after_weekly_seo",
  }),
  routine("Weekly Astrogen CEO business direction review", "CEO", "0 11 * * 3", routineContracts.weeklyCeoDirection, "coalesce_if_active", "executive_direction_review", {
    status: "active",
    triggerEnabled: true,
    activation: "active_after_cmo_portfolio",
  }),
  routine("Weekly Paperclip clean release check", "Chief Technical Officer", "0 6 * * 2", routineContracts.releaseCheck, "coalesce_if_active", "paperclip_release_check", {
    status: "active",
    triggerEnabled: true,
    activation: "active_release_observation",
  }),
  routine("Weekly Astrogen Paperclip operating improvement review", "Chief Technical Officer", "30 12 * * 3", routineContracts.operatingSelfImprovement, "coalesce_if_active", "paperclip_operating_self_improvement", {
    status: "active",
    triggerEnabled: true,
    activation: "active_backup_email_gated",
  }),
  routine("Monthly Astrogen trend discovery", "SEO Semantic Core Strategist", "0 8 1 * *", routineContracts.monthlyTrendDiscovery, "coalesce_if_active", "monthly_trend_discovery", {
    status: "active",
    triggerEnabled: true,
    activation: "active_current_evidence_only",
  }),
  routine("Monthly Astrogen scaled-content audit", "SEO Performance Analyst", "30 8 2 * *", routineContracts.monthlyScaledContentAudit, "coalesce_if_active", "monthly_scaled_content_audit", {
    status: "active",
    triggerEnabled: true,
    activation: "active_deterministic_candidates_first",
  }),
];

function role(name, roleName, title, reportsTo, icon, search, canCreateAgents, charter, adapterType = "codex_local", slugOverride = null) {
  const slug = slugOverride ?? name
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return { name, role: roleName, title, reportsTo, icon, search, canCreateAgents, charter, adapterType, slug };
}

export function assertUniqueAgentSlugs(agents = agentDefs) {
  const bySlug = new Map();
  for (const agent of agents) {
    const current = bySlug.get(agent.slug) ?? [];
    current.push(agent.name);
    bySlug.set(agent.slug, current);
  }
  const collisions = [...bySlug.entries()].filter(([, names]) => names.length > 1);
  if (collisions.length > 0) {
    throw new Error(`Agent instruction-root slug collision: ${collisions.map(([slug, names]) => `${slug} <- ${names.join(", ")}`).join("; ")}`);
  }
}

function routine(title, owner, cron, description, concurrencyPolicy, workflowKey, options = {}) {
  return {
    title,
    owner,
    cron,
    description,
    concurrencyPolicy,
    catchUpPolicy: options.catchUpPolicy ?? "skip_missed",
    workflowKey,
    timezone: "Europe/Kiev",
    status: options.status ?? "paused",
    triggerEnabled: options.triggerEnabled ?? false,
    activation: options.activation ?? "manual_after_smoke",
    extraVariables: options.extraVariables ?? [],
    extraEnv: options.extraEnv ?? {},
  };
}

function dockerBaseArgs() {
  return process.getuid?.() === 0 ? ["docker"] : ["sudo", "docker"];
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: options.encoding ?? "utf8",
    input: options.input,
    stdio: options.stdio,
    maxBuffer: options.maxBuffer ?? 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const stderr = result.stderr ? String(result.stderr) : "";
    const stdout = result.stdout ? String(result.stdout) : "";
    throw new Error(`${command} ${args.join(" ")} failed\n${stderr || stdout}`);
  }
  return result.stdout ? String(result.stdout) : "";
}

function dockerExec(container, args, options = {}) {
  const [cmd, ...prefix] = dockerBaseArgs();
  return run(cmd, [...prefix, "exec", container, ...args], options);
}

function psql(container, sql) {
  const [cmd, ...prefix] = dockerBaseArgs();
  return run(
    cmd,
    [
      ...prefix,
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "paperclip",
      "-d",
      "paperclip",
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
      "-At",
    ],
    { input: sql },
  );
}

function psqlJson(container, sql) {
  const out = psql(container, `select coalesce(json_agg(row_to_json(t)), '[]'::json)::text from (${sql}) t;`);
  return JSON.parse(out.trim() || "[]");
}

function q(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function qUuid(value) {
  return value ? `${q(value)}::uuid` : "NULL";
}

function qJson(value) {
  return `${q(JSON.stringify(value))}::jsonb`;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function decodeMasterKey(raw) {
  const trimmed = raw.trim();
  if (/^[A-Fa-f0-9]{64}$/.test(trimmed)) return Buffer.from(trimmed, "hex");
  const base64 = Buffer.from(trimmed, "base64");
  if (base64.length === 32) return base64;
  if (Buffer.byteLength(trimmed, "utf8") === 32) return Buffer.from(trimmed, "utf8");
  throw new Error("Invalid local encrypted master key format.");
}

function decryptValue(masterKey, material) {
  const decipher = createDecipheriv("aes-256-gcm", masterKey, Buffer.from(material.iv, "base64"));
  decipher.setAuthTag(Buffer.from(material.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(material.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function encryptValue(masterKey, value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    scheme: "local_encrypted_v1",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function ensureCleanMasterKey() {
  dockerExec(CLEAN_APP, [
    "sh",
    "-lc",
    [
      "set -eu",
      'p="$PAPERCLIP_SECRETS_MASTER_KEY_FILE"',
      'mkdir -p "$(dirname "$p")"',
      'if [ ! -s "$p" ]; then umask 077; node -e "process.stdout.write(require(\\"node:crypto\\").randomBytes(32).toString(\\"base64\\"))" > "$p"; fi',
      'chown node:node "$p" 2>/dev/null || true',
      'chmod 600 "$p"',
      'test -s "$p"',
    ].join("; "),
  ]);
}

function readMasterKey(container) {
  return decodeMasterKey(dockerExec(container, ["sh", "-lc", 'cat "$PAPERCLIP_SECRETS_MASTER_KEY_FILE"']));
}

function backupCleanDb() {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
  const backupPath = `${BACKUP_DIR}/astrogen-clean-phase40-${stamp}.dump`;
  const fd = openSync(backupPath, "w", 0o600);
  try {
    const [cmd, ...prefix] = dockerBaseArgs();
    const result = spawnSync(cmd, [
      ...prefix,
      "exec",
      CLEAN_DB,
      "pg_dump",
      "-U",
      "paperclip",
      "-d",
      "paperclip",
      "-Fc",
    ], {
      stdio: ["ignore", fd, "pipe"],
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    if (result.status !== 0) throw new Error(result.stderr || "pg_dump failed");
  } finally {
    closeSync(fd);
  }
  return backupPath;
}

function writeCleanRuntimeFile(filePath, contents, mode = "600") {
  dockerExec(CLEAN_APP, [
    "sh",
    "-lc",
    [
      "set -eu",
      `p=${shellQuote(filePath)}`,
      'mkdir -p "$(dirname "$p")"',
      'cat > "$p"',
      'chown node:node "$p" 2>/dev/null || true',
      `chmod ${mode} "$p"`,
    ].join("; "),
  ], { input: contents });
}

function syncCodexRuntimeAuth() {
  const sharedAuth = dockerExec(OLD_APP, ["sh", "-lc", "cat /paperclip/.codex/auth.json"]);
  const sharedConfig = dockerExec(OLD_APP, ["sh", "-lc", "cat /paperclip/.codex/config.toml"]);
  const companyConfig = dockerExec(OLD_APP, [
    "sh",
    "-lc",
    "cat /paperclip/instances/default/companies/c33f6b81-5ced-4270-9288-b46a32f6337a/codex-home/config.toml",
  ]);
  writeCleanRuntimeFile("/paperclip/.codex/auth.json", sharedAuth, "600");
  writeCleanRuntimeFile("/paperclip/.codex/config.toml", sharedConfig, "600");
  writeCleanRuntimeFile(
    "/paperclip/instances/astrogen-clean/companies/cb7b5231-2da0-4e91-b4af-538d8f1ca263/codex-home/config.toml",
    companyConfig,
    "600",
  );
  dockerExec(CLEAN_APP, [
    "sh",
    "-lc",
    [
      "set -eu",
      "d=/paperclip/instances/astrogen-clean/companies/cb7b5231-2da0-4e91-b4af-538d8f1ca263/codex-home",
      'mkdir -p "$d"',
      'ln -sfn /paperclip/.codex/auth.json "$d/auth.json"',
      'chown -h node:node "$d/auth.json" 2>/dev/null || true',
      'chown node:node "$d/config.toml" 2>/dev/null || true',
      'chmod 700 "$d"',
      'chmod 600 "$d/config.toml"',
    ].join("; "),
  ]);
}

function loadInventory() {
  const cleanCounts = psqlJson(
    CLEAN_DB,
    `
      select 'agents' as key, count(*)::int as count from agents where company_id='${CLEAN_COMPANY_ID}'
      union all select 'secrets', count(*)::int from company_secrets where company_id='${CLEAN_COMPANY_ID}' and deleted_at is null
      union all select 'routines', count(*)::int from routines where company_id='${CLEAN_COMPANY_ID}'
      union all select 'plugins', count(*)::int from plugins
      union all select 'issues', count(*)::int from issues where company_id='${CLEAN_COMPANY_ID}' and hidden_at is null
    `,
  );
  const oldSecrets = psqlJson(
    OLD_DB,
    `
      select key, status, latest_version
      from company_secrets
      where company_id='${OLD_COMPANY_ID}'
        and key in (${secretDefs.map((item) => q(item.key)).join(",")})
      order by key
    `,
  );
  const oldOpenIssues = psqlJson(
    OLD_DB,
    `
      select i.identifier, i.status, i.priority, i.title, coalesce(a.name, '') as assignee
      from issues i
      left join agents a on a.id=i.assignee_agent_id
      where i.company_id='${OLD_COMPANY_ID}'
        and i.status in ('todo','in_progress','in_review')
        and i.hidden_at is null
      order by case i.status when 'in_progress' then 1 when 'in_review' then 2 when 'todo' then 3 else 9 end, i.updated_at desc
    `,
  );
  return { cleanCounts, oldSecrets, oldOpenIssues };
}

function migrateSecrets() {
  const oldRows = psqlJson(
    OLD_DB,
    `
      select s.id, s.key, s.name, s.description, s.status, s.latest_version,
             v.material::text as material
      from company_secrets s
      join company_secret_versions v on v.secret_id=s.id and v.version=s.latest_version
      where s.company_id='${OLD_COMPANY_ID}'
        and s.key in (${secretDefs.map((item) => q(item.key)).join(",")})
      order by s.key
    `,
  );
  const byKey = new Map(oldRows.map((row) => [row.key, row]));
  const cleanExistingRows = psqlJson(
    CLEAN_DB,
    `
      select id, key, status
      from company_secrets
      where company_id='${CLEAN_COMPANY_ID}'
        and key in (${secretDefs.map((item) => q(item.key)).join(",")})
        and deleted_at is null
    `,
  );
  const cleanExistingByKey = new Map(cleanExistingRows.map((row) => [row.key, row]));
  const oldKey = readMasterKey(OLD_APP);
  ensureCleanMasterKey();
  const cleanKey = readMasterKey(CLEAN_APP);
  const secretIds = {};
  const migrated = [];
  const missing = [];

  for (const def of secretDefs) {
    const old = byKey.get(def.key);
    if (!old || old.status !== "active") {
      const existing = cleanExistingByKey.get(def.key);
      if (existing?.status === "active") {
        secretIds[def.key] = existing.id;
        continue;
      }
      missing.push(def.key);
      continue;
    }
    const plain = decryptValue(oldKey, JSON.parse(old.material));
    const material = encryptValue(cleanKey, plain);
    const valueSha = sha256(plain);
    const id = randomUUID();
    const secretId = psql(
      CLEAN_DB,
      `
        insert into company_secrets (
          id, company_id, name, provider, external_ref, latest_version, description,
          key, status, managed_mode, provider_metadata, updated_at
        ) values (
          ${qUuid(id)}, ${qUuid(CLEAN_COMPANY_ID)}, ${q(old.name)}, 'local_encrypted',
          NULL, 1, ${q(old.description)}, ${q(old.key)}, 'active',
          'paperclip_managed', ${qJson({ migratedFrom: "old-live", tier: def.tier })}, now()
        )
        on conflict (company_id, key) do update set
          name=excluded.name,
          description=excluded.description,
          latest_version=1,
          status='active',
          managed_mode='paperclip_managed',
          provider_metadata=excluded.provider_metadata,
          updated_at=now()
        returning id;
      `,
    ).trim();
    psql(
      CLEAN_DB,
      `
        insert into company_secret_versions (
          secret_id, version, material, value_sha256, fingerprint_sha256,
          status, revoked_at, created_at
        ) values (
          ${qUuid(secretId)}, 1, ${qJson(material)}, ${q(valueSha)}, ${q(valueSha)},
          'current', NULL, now()
        )
        on conflict (secret_id, version) do update set
          material=excluded.material,
          value_sha256=excluded.value_sha256,
          fingerprint_sha256=excluded.fingerprint_sha256,
          status='current',
          revoked_at=NULL;
      `,
    );
    secretIds[def.key] = secretId;
    migrated.push(def.key);
  }
  return { secretIds, migrated, missing };
}

function readPackageVersion(packagePath) {
  const out = dockerExec(CLEAN_APP, [
    "node",
    "-e",
    `try{const j=require(${JSON.stringify(`${packagePath}/package.json`)}); process.stdout.write(j.version || "0.0.0")}catch{process.stdout.write("0.0.0")}`,
  ]);
  return out.trim() || "0.0.0";
}

function readCleanPluginManifest(packagePath) {
  const out = dockerExec(CLEAN_APP, [
    "node",
    "-e",
    `import(${JSON.stringify(`file://${packagePath}/dist/manifest.js`)}).then((m)=>process.stdout.write(JSON.stringify(m.default||m))).catch((error)=>{process.stderr.write(error.stack||String(error));process.exit(1);})`,
  ]);
  return JSON.parse(out.trim() || "{}");
}

function loadOldPluginRows() {
  const keys = pluginDefs.map((item) => q(item.key)).join(",");
  const rows = psqlJson(
    OLD_DB,
    `
      select plugin_key, package_name, package_path, version, api_version,
             categories, manifest_json, status, install_order
      from plugins
      where plugin_key in (${keys})
    `,
  );
  return new Map(rows.map((row) => [row.plugin_key, row]));
}

function loadOldPluginConfig() {
  const keys = pluginDefs.map((item) => q(item.key)).join(",");
  const rows = psqlJson(
    OLD_DB,
    `
      select p.plugin_key, c.config_json
      from plugins p
      left join plugin_config c on c.plugin_id=p.id
      where p.plugin_key in (${keys})
    `,
  );
  return new Map(rows.map((row) => [row.plugin_key, row.config_json ?? {}]));
}

function buildActivePluginConfig(pluginKey, oldConfig, secretIds) {
  const config = { ...(oldConfig || {}) };
  if (pluginKey === "paperclip-plugin-telegram") {
    config.paperclipBaseUrl = "http://127.0.0.1:3100";
    config.paperclipPublicUrl = CLEAN_PUBLIC_URL;
    config.telegramBotTokenRef = secretIds["telegram.bot_token.astrogen_ai_bot"];
    config.enableInbound = true;
    config.enableCommands = false;
    config.enableProactiveWatches = false;
    config.maxSuggestionsPerHourPerCompany = 0;
    config.watchDeduplicationWindowMs = 86400000;
    config.notifyOnIssueCreated = false;
    config.notifyOnIssueDone = false;
  }
  if (pluginKey === "paperclip.payload-cms-agent-tools") {
    config.payloadApiKeySecretRef = secretIds.astrogen_payload_cms_api_key;
    config.payloadApiBaseUrl = config.payloadApiBaseUrl || "https://cms.astrogen.com.ua/api";
    config.blogPostsCollectionSlug = "blogPosts";
    config.requestTimeoutMs = 60000;
    config.defaultEditorialAuthor = {
      name: "Astrogen",
      slug: "astrogen",
      roleTitle: "Редакція Astrogen",
    };
    config.articleTypeCategoryDefaults = {
      zodiac_profile: { slug: "astrologiya", title: "Астрологія" },
      product_education: { slug: "inshi", title: "Інші" },
      expert_method_selection: { slug: "eksperty", title: "Експерти" },
      life_situation_decision: { slug: "inshi", title: "Інші" },
      concept_explainer: { slug: "astrologiya", title: "Астрологія" },
      relationship_compatibility: { slug: "stosunky", title: "Стосунки" },
      forecast_cycle: { slug: "free-horoscope", title: "Безкоштовний персональний тижневий гороскоп" },
      historical_cultural_explainer: { slug: "inshi", title: "Інші" },
    };
  }
  if (pluginKey === "paperclip.gsc-bing-ga4-mcp-agent-tools") {
    config.gscBingGa4McpTokenSecretRef = secretIds["search-console-mcp-astrogen-token"];
    config.gscBingGa4McpUrl = "http://172.18.0.1:3002/mcp";
    config.allowedSiteUrl = "sc-domain:astrogen.com.ua";
    config.allowedGa4PropertyId = "484723525";
    config.requestTimeoutMs = 120000;
  }
  if (pluginKey === "paperclip.crawlobserver-agent-tools") {
    config.crawlObserverApiKeySecretRef = secretIds["crawlobserver-api-key"];
    config.crawlObserverBaseUrl = "http://ubuntu-aibizmate-n8n.tailbd4e1c.ts.net:8899";
    config.allowedProjectId = "fe5261b6-e793-44ae-a093-253a19b3c78e";
    config.requestTimeoutMs = 120000;
    config.allowMutatingTools = false;
  }
  if (pluginKey === "paperclip.email-notifications") {
    config.resendApiKeySecretRef = secretIds["resend-api-key"];
    config.resendApiBaseUrl = "https://api.resend.com";
    config.fromEmail = "paperclip@aibizmate.com";
    config.defaultRecipientEmails = "o.savitsky@gmail.com";
    config.allowlistedRecipientEmails = "o.savitsky@gmail.com";
    config.defaultLanguage = "uk";
    config.costAccountingMode = "estimated_per_email";
    config.estimatedEmailCostUsd = 0.001;
  }
  if (pluginKey === "paperclip.openrouter-image-agent-tools") {
    config.openrouterApiKeySecretRef = secretIds.openrouter_api_key_4images;
    config.openrouterBaseUrl = "https://openrouter.ai/api/v1";
    config.defaultModel = config.defaultModel || "google/gemini-2.5-flash-image";
    config.allowModelOverride = false;
    config.maxImagesPerRequest = 1;
    config.defaultImageSize = "1472x822";
    config.targetDimensionTolerancePercent = 20;
    config.defaultAspectRatio = "16:9";
    config.requireSubjectMode = true;
    config.structuredArtDirectionMode = "required_for_human_scene";
    config.visualHistoryLimit = 8;
    config.minimumDistinctVisualAxes = 4;
    config.legacyAvoidVisualPatterns = [
      "seated person or couple at a table with laptop, notebook, cup, and neutral catalogue expression",
      "burgundy sweater used as the main brand signal",
      "generic bright home office with window, plant, wooden desk, and no visible emotional event",
    ];
    config.costAccountingMode = "provider_reported";
    config.estimatedImageCostUsd = 0.04;
    config.appName = "Paperclip Astrogen Image Generation";
    config.siteUrl = "https://astrogen.com.ua";
  }
  if (pluginKey === "paperclip.serper-agent-tools") {
    config.serperApiKeySecretRef = secretIds["serper-api-key"];
    config.serperApiBaseUrl = "https://google.serper.dev";
    config.costAccountingMode = "estimated_per_request";
    config.estimatedSearchCostUsd = 0.001;
    config.estimatedNewsCostUsd = 0.001;
  }
  if (pluginKey === "paperclip.semantic-core-mcp-agent-tools") {
    config.semanticCoreMcpTokenSecretRef = secretIds["semantic-core-mcp-token"];
    config.semanticCoreMcpUrl = "http://100.98.5.50:8001/mcp";
    config.allowedProjectIdsCsv = "astrogen-ukraine,astrogen-audience-trends-ukraine";
    config.allowedClientKeysCsv = "";
    config.requestTimeoutMs = 300000;
    config.pollIntervalMs = 2000;
    config.runWaitTimeoutMs = 600000;
    config.localInventoryReadOnly = true;
    config.maxLocalInventoryRows = 50;
  }
  if (pluginKey === "paperclip.winning-structure-mcp-agent-tools") {
    config.winningStructureMcpTokenSecretRef = secretIds["winning-structure-mcp-token"];
    config.winningStructureMcpUrl = "http://100.98.5.50:8000/mcp";
    config.allowedClientKeysCsv = "astrogen-ukraine,astrogen-audience-trends-ukraine";
    config.requestTimeoutMs = 180000;
    config.costAccountingMode = "provider_reported";
  }
  return config;
}

function upsertPlugins(secretIds) {
  const oldRows = loadOldPluginRows();
  const oldConfig = loadOldPluginConfig();
  const pluginIds = {};
  const ready = [];
  const disabled = [];

  for (const def of pluginDefs) {
    const old = oldRows.get(def.key);
    const manifestJson = old?.manifest_json || readCleanPluginManifest(def.packagePath);
    const id = randomUUID();
    const version = readPackageVersion(def.packagePath) || old?.version || "0.0.0";
    const status = def.active ? "ready" : "disabled";
    const lastError = def.active ? null : def.disabledReason;
    const pluginId = psql(
      CLEAN_DB,
      `
        insert into plugins (
          id, plugin_key, package_name, package_path, version, api_version,
          categories, manifest_json, status, install_order, last_error, updated_at
        ) values (
          ${qUuid(id)}, ${q(def.key)}, ${q(def.packageName || old?.package_name)},
          ${q(def.packagePath)}, ${q(version)}, ${Number(old?.api_version || manifestJson.apiVersion || 1)},
          ${qJson(old?.categories || manifestJson.categories || [])}, ${qJson(manifestJson)},
          ${q(status)}, ${Number(def.installOrder)}, ${q(lastError)}, now()
        )
        on conflict (plugin_key) do update set
          package_name=excluded.package_name,
          package_path=excluded.package_path,
          version=excluded.version,
          api_version=excluded.api_version,
          categories=excluded.categories,
          manifest_json=excluded.manifest_json,
          status=excluded.status,
          install_order=excluded.install_order,
          last_error=excluded.last_error,
          updated_at=now()
        returning id;
      `,
    ).trim();
    pluginIds[def.key] = pluginId;

    const settings = def.active
      ? buildActivePluginConfig(def.key, oldConfig.get(def.key), secretIds)
      : { desiredState: "parked", reason: def.disabledReason };

    if (def.active) {
      psql(
        CLEAN_DB,
        `
          insert into plugin_config (plugin_id, config_json, last_error, updated_at)
          values (${qUuid(pluginId)}, ${qJson(settings)}, NULL, now())
          on conflict (plugin_id) do update set
            config_json=excluded.config_json,
            last_error=NULL,
            updated_at=now();
        `,
      );
      ready.push(def.key);
    } else {
      disabled.push(def.key);
    }

    psql(
      CLEAN_DB,
      `
        insert into plugin_company_settings (company_id, plugin_id, settings_json, last_error, enabled, updated_at)
        values (${qUuid(CLEAN_COMPANY_ID)}, ${qUuid(pluginId)}, ${qJson(settings)}, ${q(lastError)}, ${def.active ? "true" : "false"}, now())
        on conflict (company_id, plugin_id) do update set
          settings_json=excluded.settings_json,
          last_error=excluded.last_error,
          enabled=excluded.enabled,
          updated_at=now();
      `,
    );
  }
  return { pluginIds, ready, disabled };
}

export function instructionText(agent) {
  return `# ${agent.name}

You are ${agent.title} for Astrogen in the clean Paperclip instance.

## Role Charter

${agent.charter}
${agentSpecificInstructions(agent)}

## Operating Rules

- Work only on assigned Paperclip issues and explicit routine execution issues.
- Do not perform idle polling or generic "anything to do?" checks.
- Use typed workflow state from the issue description, issue documents, or manifest.
- Create compact evidence packets before using expensive LLM reasoning.
- Do not spend external budget, send owner-facing messages, or mutate production systems unless the issue explicitly authorizes that action.
- If blocked, name the blocker class, the owner, and the concrete next action.
- Human-facing Astrogen communication must be Ukrainian, concise, and understandable without internal stage labels.
- Build multiline issue descriptions/comments as data: use the Paperclip helper, a JSON file, \`jq --rawfile\`, or \`JSON.stringify\`. Never interpolate Markdown, backticks, angle brackets, or \`$VAR\` into a shell command; shell substitution must never be able to alter task evidence.
- Keep payload construction and API mutation free of cleanup commands. Never append \`rm\`, temp-directory cleanup, or another destructive operation to a command that creates or sends a Paperclip payload; leave bounded temp files for normal workspace cleanup. When building JSON from a file with jq, use \`jq -n --rawfile\` so the command always emits a JSON document.
- For \`PATCH /api/cases/{caseId}\`, use \`fieldPatch\` for incremental top-level field changes with the latest \`expectedVersion\`. Use \`fields\` only for an intentional full replacement after verifying the outgoing complete field count. Never send both.

## Canonical Astrogen Scope

- Primary SEO/GEO target: https://astrogen.com.ua and Google Search Console property sc-domain:astrogen.com.ua.
- Primary CMS target: https://cms.astrogen.com.ua/api.
- Google Play, app-store, developer-profile, and developer-website data are secondary evidence only. If they point to another domain such as analyca.in, record that as a brand/app metadata finding; do not switch the routine's target domain.
- Do not infer a new Astrogen canonical domain from a search result, app listing, backlink, or developer website.

## Paperclip Harness And Plugin Tools

- Routine work must flow through Paperclip scheduler -> routine run -> execution issue -> assignment wakeup -> heartbeat.
- For plugin data, use the agent tool dispatcher routes with the current run token when no native tool wrapper is present: GET /api/agents/me/plugin-tools and POST /api/agents/me/plugin-tools/execute.
- For linked specialist evidence, use the case output fetch hint. Read full documents only through GET /api/cases/{caseId}/outputs/documents/{documentId}; do not request broad access to a foreign issue, its comments, or heartbeat context.
- Plugin tool execution must use the canonical request body only: { "tool": "plugin.key:tool_name", "parameters": { ... }, "runContext": { "agentId": "$PAPERCLIP_AGENT_ID", "runId": "$PAPERCLIP_RUN_ID", "companyId": "$PAPERCLIP_COMPANY_ID", "projectId": "$PAPERCLIP_PROJECT_ID", "issueId": "$PAPERCLIP_TASK_ID" } }. Do not use legacy toolName/input/arguments payloads and never omit projectId.
- Do not use board-only plugin/admin routes from an agent heartbeat. If a plugin tool is unavailable, record the exact route/tool failure and route a CTO configuration issue instead of substituting unrelated public-web evidence.

## Token and Source Control

- For routine execution, do not inspect Paperclip server/source code, route schemas, package internals, or broad \`/app\` trees unless the issue explicitly asks for runtime debugging.
- Do not run broad \`rg\`, \`find\`, \`grep -R\`, or recursive source reads over \`/app\`, \`/paperclip\`, or \`/companies\`; query only the exact file/API/tool needed.
- Use Paperclip issue APIs, hot routes from the Paperclip skill, and installed plugin tools instead of rediscovering API schemas from source.
- Prefer one compact evidence command per data source; stop when the completion gate can be satisfied.
- Do not print raw API/tool JSON to stdout or comments. Request at most 10 rows per source by default, select only fields needed for the completion gate, and summarize top 3-5 findings.
- If a tool returns a large payload, do not inspect or paste the whole payload. Filter it with a structured selector first, then discard the raw response.

## Cycle Safety

- Scheduled work must have a bounded input set, quota, and completion gate.
- A current-day article batch deficit is reconciled only by the same bounded native allocator, up to its daily target and productive-WIP cap. It never enables a broad scheduler catch-up storm.
- Telegram is for owner-facing decisions and summaries, not internal routine status.
`;
}

function agentSpecificInstructions(agent) {
  if (agent.name === "CEO") {
    return `

## Native Portfolio Routing Rule

- CEO is a portfolio routing owner, not a domain executor and not an article recovery worker.
- Route genuinely unassigned actionable backlog/todo work with only assignee plus todo/backlog and a concise comment.
- Never patch, close, cancel, reassign, or rewrite the blocker graph of an already assigned, blocked, in-progress, or foreign-owned issue. Treat it as evidence and create or update one \`astrogen-growth-actions\` case by stable finding fingerprint.
- A 403 on foreign issue mutation means the route was wrong. Stop that mutation, use the native growth case, and continue unrelated priorities; do not block the leadership cycle.
- Repeated findings for one URL and root cause update the same growth case. External dependencies use \`external_wait\` plus nextReviewAt and never freeze unrelated work.
- In growth \`external_wait\`, current typed case fields outrank stale linked issues and artifacts. When \`executionStatus=waiting_next_day_trend_research\`, \`blockerClass=bounded_trend_cooldown\`, \`ownerActionRequired=false\`, and \`nextReviewAt\` is in the future, keep the case in \`external_wait\` and PATCH the same automation issue with \`executionPolicy.monitor.nextCheckAt=case.nextReviewAt\`, \`executionPolicy.monitor.scheduledBy=assignee\`, and concise notes. Do not resume because an older blocker issue became done. At monitor wake, resume only when eligible ready inventory or a permitted fresh/reused bounded trend run provides a concrete execution path; otherwise advance one bounded monitor without comments or owner notifications.
- Article lifecycle belongs to CMO and the \`astrogen-article-production\` pipeline. Do not create article stage/recovery issue trees or perform image generation, CMS mutation, Telegram delivery, SEO analysis, or provider calls.
`;
  }

  if (agent.name === "Chief Marketing Officer") {
    return `

## Native Article And Topic Pipeline Control

- For the zodiac compatibility acquisition cluster, follow /companies/astrogen/reference/zodiac-compatibility-cluster.yaml. Delegate Semantic Core discovery and validation before page planning; do not assign pillar, sign-hub, or pair-page writing directly. Require one page-level keyword packet for every proposed URL, treat reverse sign order and gender wording as supporting queries by default, and route existing owners to refresh/merge/reposition/internal_link. Every compatibility case carries clusterLane=compatibility_reference, allocationFamily=zodiac_compatibility, contentPortfolioTrack=audience_applied_questions, and portfolioLane=search_demand_core. Only a guarded native search-demand opportunity with selectedAction=new_article may create production work.
- CMO controls portfolio choice and delivery gates but does not perform SERP research, writing, image generation, CMS mutation, or runtime repair.
- Create every new specialist issue for a native case with \`pipelineCaseLink.caseId\` and a stable purpose-based \`pipelineCaseLink.requestKey\` on the issue-create request. This atomically creates the issue and its typed work link. The standalone issue-link route is only for pre-existing or migrated work.
- After creating or linking work, re-read case-visible work products before deciding the stage. Positive completion proof routes to verify; a durable blocker artifact routes to external_wait with blockerClass and nextReviewAt; only a missing artifact may create or reuse one bounded evidence-recovery issue. Never build a recovery chain or leave a case in executing after a durable blocker is visible.
- \`astrogen-topic-inventory\` and \`astrogen-article-production\` cases are the source of truth. Do not create article parent/stage/recovery issue trees for recurring cadence.
- For routine inventory reads, resolve IDs with \`GET /api/companies/{companyId}/pipelines\`, then call the bounded \`GET /api/pipelines/{pipelineId}/cases?stageKey={stageKey}&terminal=false&limit=10&offset=0\` route. Use exact \`caseKey\` for canonical refill lookup. Never guess generic case-list aliases or put a pipeline key into the UUID path.
- Pipeline stage automation is stored under \`stage.config.onEnter\` and \`stage.config.automation\`. Do not inspect only top-level \`stage.onEnter\` or \`stage.automation\`, and do not create manual bridging issues merely because those top-level aliases are null.
- The bounded pipeline case-list response is always a direct JSON array of wrapper rows shaped as \`{case, stage, parentCase, activeWork, descendantActiveWorkCount}\`. Read fields from \`row.case\` and guarded lineage from \`row.parentCase.pipeline\`. Count only \`Array.isArray(response) ? response.length : protocol_error\`; a missing \`items\` or \`cases\` property is never evidence of zero inventory. On a non-array response, record a shared protocol blocker and do not create a refill or close the allocator from that response.
- The scheduled allocator calculates the current-day batch deficit and selects up to three lineage-valid topics at \`ready\`, bounded by productive WIP. Eligibility requires \`selectedAction=new_article\` and the guarded search-demand parent. It calls \`POST /api/cases/{topicCaseId}/breakdown\` once per selected topic, so native breakdown creates/reuses each article child at \`opportunity\` and advances only that topic to \`reserved\`.
- The ready stage has no on-enter automation. Never reserve a topic merely because validation moved it to ready; only the scheduled allocator dispatches capacity.
- Native article stage automations own SERP check, brief, Claude draft, validation, humanizing, layout, one-call image generation, CMS draft, and CMO delivery. Recovery resumes the same case and stage.
- Phase 47 replaces the standalone SERP gate with the native \`strategy_input -> winning_structure -> structure_decision | structure_review\` path. CMO manages authority and portfolio continuity but never performs MCP research or writes the article.
- A paused Winning Structure run blocks only its article case and does not consume productive WIP. Low-risk decisions may be submitted only when the option is explicitly authorized by the pipeline contract. Accepting cannibalization risk, merging/consolidating, reassigning ownership, cancelling a run, removing the primary keyword, or changing the canonical owner requires an explicit human decision.
- For an added-value pause, CMO may authorize only a concrete reader-facing asset from /companies/astrogen/reference/article-value-system.yaml with an assigned producing role, validation method, observable acceptance criteria, and due_before_publication=true. Semantic-core/ownership/tool access, generic research, more text, keywords, or a table/FAQ/checklist/CTA by itself is not reader value.
- Delivery is terminal only at article stage \`delivered\` with accepted cover or waiver, authenticated CMS admin URL, verified content gates, and gender-neutral Telegram delivery proof. CMS remains draft-only.
- In native \`image_recovery_review\`, CMO may authorize exactly one corrective provider retry for a case-visible hard visual QA defect such as readable text, numbers, language-like glyph clutter, fabricated screen content, or another explicit visual-policy violation. A familiar non-linguistic pictogram or decorative strokes that form no readable letters, words, numbers, controls, or fake interface are not pseudo-writing by themselves. If visual review overturns a false-positive QA decision and dimensions remain within tolerance, CMO registers and accepts the existing candidate through the typed \`accept_existing_after_visual_review\` transition without another provider call. It never authorizes a retry for a dimension/format miss within the per-axis 20 percent tolerance, never generates the image itself, and never asks the owner for this operational decision.
- Keep one canonical \`astrogen-growth-actions\` refill case live while eligible \`ready + reserved\` inventory is below 25 or any contentPortfolioTrack is below its 12/5/3/3/2 target. Use fingerprint \`topic-inventory-refill:{ISO-week}\` and case key \`growth:topic-inventory-refill:{ISO-week}\`; do not create a refill issue chain.
- Portfolio planning and segmented trend research ingest evidence-backed \`astrogen-search-demand-opportunities\` until the rolling content plan contains 25 future topics across the 12/5/3/3/2 contentPortfolioTrack targets. Each topic has exactly one \`primaryAudienceSegmentId\` for diversity reporting, but audience segments are not hard quotas. Only delegated \`new_article\` decisions create guarded topic candidates. Raw reports, comments, and direct legacy topic lists are incomplete.
- At \`action_selected\`, write \`selectedAction\` as exactly one closed-enum value: \`new_article\`, \`refresh\`, \`merge\`, \`reposition\`, \`internal_link\`, \`technical\`, or \`no_action\`. Store the reason separately; never append it to the enum. A durable \`no_action\` uses the native \`action_selected -> cancelled\` transition and creates no child, blocker, verification, or measurement work.
- Portfolio selection favors breadth across audience-interest, adjacent-use-case, audience-need, and core-product demand, selects at most one repetitive query family per daily batch, and selects at most one allocationFamily=zodiac_compatibility topic per daily batch. Calendar-date themes are paused by owner policy and must not enter article production.
- When accepted semantic demand cannot supply enough broad candidates, use the latest valid trend report or the bounded low-inventory fallback in /companies/astrogen/reference/trend-topic-policy.yaml. Trend output remains evidence only until each selected phrase passes normal semantic-core validation.
- A semantic \`candidate_review\` result is not a completed wave and never becomes an owner question by default. Reuse or delegate exactly one child with fingerprint \`trend-review:{trendReportRunId}:wave:{validationWave}\` to SEO Semantic Core Validator, keep the trend parent open, and continue only after every reviewed phrase is materialized as accepted, parked or rejected in its original semantic-run/layer partition.
- Accepted emerging trend demand may use the bounded \`trend_emerging\` evidence fallback when Ukraine frequency is unavailable, but only with the live report identity, retained sources, expiry, falsifier, confidence/warnings and full CMS ownership/cannibalization review. Never invent volume.
- For trend validation and ingestion, a child being \`done\` is not success evidence. Read the child's \`## trendIngestionResult\` JSON section and require \`finalDisposition\`, \`createdSearchDemandCaseIds\`, \`eligibleReadyTopicCountAfter\`, \`primaryAudienceSegmentId\`, \`segmentEligibleTopicCountAfter\`, \`remainingUnusedClusters\`, and \`validationWave\`. The \`## trendIngestionResult\` heading is reserved for one machine-readable fenced JSON object only; do not use that exact heading for prose, checklists, or required-field notes. If accepted candidates exist but no search-demand case was created, delegate one ingestion handoff to SEO Blog Content Strategist; do not ask CTO to grant \`pipelines:write\` to semantic-core agents. If no search-demand case was created, the focused segment remains below five, the wave is below three, and eligible unused clusters remain, delegate the next bounded wave.
- Require trend ingestion to report unique \`intentClusterKey\` values. Similar phrases that share reader outcome, intent, SERP family and expected owner page become one canonical search-demand opportunity with supporting queries; they never count as separate topics or segment-quota progress.
- Control the \`audience_interest_editorial\` lane at portfolio level: prefer enough eligible topics to deliver two per Europe/Kiev month, never reserve more than four in that month, and never dispatch more than one in a daily batch. The target never authorizes filler or weaker evidence.
- Require \`layerValidationMatrix\` in the trend ingestion result. Do not accept bounded exhaustion while any phrase has only \`parked_outside_layer\` or \`owner_mismatch\` evidence from a layer different from its preclassified intended layer.
- After delegation, follow every opportunity and candidate through ownership, enrichment, and validation. Re-read live \`ready\` and \`reserved\` cases and count each topic once under exactly one primary segment; secondary segments never close a deficit.
- If total eligible future supply is below 25 or any contentPortfolioTrack is below target, keep or return the canonical refill growth case to \`executing\`, select deficient tracks and their appropriate source lanes, delegate bounded continuations, and set \`nextReviewAt\`. \`semantic_core_and_curriculum\` and \`audience_trends\` are independent source lanes with at most one live continuation each. A live, blocked, or compatibility-focused semantic continuation never satisfies or freezes a deficient audience-trends track. The native grouped quota gate prevents false \`measured\` completion.
- Update \`next-content-plan\` on the canonical refill case from the same live native case IDs used by quota accounting, and include a separate visible \`trendOpportunityQueue\` section for audience-first trend candidates that are not yet counted. The verified topic section includes topicCaseId, topicKey, titleUk, primary query/frequency, one primary segment, ownership and duplicate verdicts, incoming/outgoing internal links, trend report run id, and native stage. The trend queue includes trendReportRunId, primaryAudienceSegmentId, audience signal, reader problem, proposed phrase, status, not-counted reason, next action owner, and evidence refs. Agent comments are not this document.
- When the campaign daily/run bound is exhausted and the next permitted focused report is on a future Kyiv window, move the canonical refill case to \`external_wait\` with typed bounded-cooldown fields and a first-class monitor. Do not mark it measured or ask the owner to invent topics.
- Missing evidence tooling becomes one typed blocker on the refill growth case. Empty inventory never freezes unrelated lanes and is never sent to the owner as a technical choice.

## SERP Value-Gap Content Refresh Control

- Treat \`content_refresh\` as SEO/body improvement driven by relevant
  keyphrases and SERP value-gap evidence, not as a layout/editorial checklist.
- If no safe new topic exists, route one bounded
  \`serp_value_gap_content_refresh\` issue for an existing article only when
  the issue identifies the current article, target keyphrase cluster, SERP
  competitors, missing user value, and why refresh is safer than a new article.
- If \`serpValueGapRequired=true\`, or if the refresh parent has no accepted
  parent-visible value-gap artifact, create or reuse exactly one
  \`serp_value_gap_check\` child assigned to \`MKT Competitive Intelligence
  Analyst\` before any refresh brief, writer, layout, or CMS update task.
  Block the refresh parent on that child until it returns queries checked, top
  competitors, coverage patterns, missing user questions, Astrogen
  information-gain angle, and exact sections to improve.
- Do not treat \`serpValueGapRequired=true\` as evidence. It is only a routing
  trigger. The executable sequence is: refresh parent -> SERP value-gap check
  -> validated refresh brief -> article body refresh -> validation -> CMS draft
  update. Preserve existing images/media unless the issue explicitly names an
  image defect.
- Do not delegate a refresh as "add \`Коротко\`", "add FAQ", "add CTA",
  "add related posts", "add internal links", "add comparison block", or
  "update metadata" unless the SERP value-gap artifact explains why that exact
  element adds missing user value.
- Editorial/layout defects remain editorial backfill/layout repair. Metadata,
  internal-link-only, and relatedPosts-only work remains deterministic
  CMS/SEO fixing. Keep those lanes separate from content refresh.
`;
  }

  if (agent.name === "Chief Technical Officer") {
    return `

## Developer Handoff Email Contract

- When implementation requires a site developer, produce a concrete technical package first and send it only through \`paperclip.email-notifications:email-developer-handoff-send\`.
- Use it only for affected pages on a configured public Astrogen website host. A Paperclip API, agent permission, plugin, native-case route, harness, localhost, private-network, or tailnet problem is an internal CTO recovery path, never a developer handoff and never an owner email.
- Include every exact affected public URL. For each URL provide the current problem, required code/configuration changes, and post-deploy verification steps.
- Include shared repository/deploy/sitemap actions and the source Paperclip issue. A link to an issue or attachment does not replace the URL list in the email.
- Do not use \`email-notification-send\` or a generic incident summary for developer implementation requests.
- If the exact affected scope is not known, continue deterministic evidence collection or keep the case in technical investigation. Do not send an incomplete handoff to the owner.
`;
  }

  if (agent.name === "SEO Performance Analyst") {
    return `

## Native Search-Demand Evidence Contract

- A search-demand case with \`semanticLifecycleState=accepted\` and a durable \`semanticMaterializedRunId\` or \`semanticAcceptedRunId\` has already passed Semantic Core validation. Verify that stored lineage; never call \`run-layer\` again for the same phrase from discovered-stage automation.
- The discovered stage never writes \`selectedAction\`. Exact invalid/duplicate signals plus owner-paused calendar-date or ephemeral daily-horoscope intents use the native \`discovered -> cancelled\` transition with a typed rejection reason. All other signals, including likely overlap/no-action cases, preserve evidence and advance to \`evidence_ready\` so ownership and action selection stay with their designated stages.
- For CrawlObserver, call \`list-sessions\` first and use the exact returned crawl ID as the camelCase \`sessionId\` parameter for every session-scoped tool. Never use \`session_id\` or \`id\`, and never guess parameters after a schema error.
- CrawlObserver data is decision evidence only after \`get-session-quality({ sessionId })\` confirms the trust gate. A stale or untrusted crawl is an explicit evidence limitation, not permission to invent a clean coverage verdict.
- Trend-emerging demand with unavailable geo frequency remains eligible only through the bounded policy evidence already stored on the case. Preserve \`unavailable_not_zero\` and never infer volume.
- In native search-demand \`verified\`, a valid unpublished CMS draft waits on the current automation issue. Store \`nextReviewAt\` in the case and PATCH that issue with \`executionPolicy.monitor.nextCheckAt\` set to the same timestamp, \`executionPolicy.monitor.scheduledBy=assignee\`, and notes naming the case/CMS draft; keep it \`in_progress\`. Do not use generic \`monitorNextCheckAt\`/\`monitorNotes\` fields, which are not the writable API contract. Do not create a human interaction, owner request, publication child task, or repeated verification issue just because the draft is not published yet.
`;
  }

  if (agent.name === "SEO Blog Content Strategist") {
    return `

## Topic Inventory Refill Contract

- For zodiac compatibility work, read /companies/astrogen/reference/zodiac-compatibility-cluster.yaml. Preserve one pillar, twelve sign hubs, and at most seventy-eight unordered canonical pair owners. Every such case carries \`clusterLane=compatibility_reference\`, \`allocationFamily=zodiac_compatibility\`, \`contentPortfolioTrack=audience_applied_questions\`, and \`portfolioLane=search_demand_core\`; compatibility never counts as audience_trends. Semantic discovery may be batched by family, but every proposed URL requires its own accepted pageKeywordPacket. Never create separate owners for reversed sign order or gender phrasing without distinct current SERP and demand proof.
- Own evidence enrichment for \`astrogen-search-demand-opportunities\` and guarded topic candidates delegated from approved \`new_article\` actions.
- Use compact evidence from Payload CMS, GSC/GA4, semantic-core
  inventory/review, CrawlObserver/internal-link data, active Paperclip issues,
  and consumed topic history.
- Read the latest accepted semantic-core snapshot through \`paperclip.semantic-core-mcp-agent-tools:get-local-inventory\` before declaring semantic-core unavailable. The returned rows are under \`acceptedKeywords\` with \`id\`, \`keyword\`, \`normalizedKeyword\`, \`layer\`, \`geoSearchVolume\`, \`globalSearchVolume\`, and \`domainTopicMatch\`; \`clusters: []\` is valid for a migrated snapshot. This local read-only tool requires no external MCP token, returns at most 50 rows, and must be paged or filtered by \`minimumGeoSearchVolume\` instead of requesting a raw import payload.
- The authenticated Semantic Core MCP validation project is exactly \`astrogen-ukraine\`. Trend reports use only \`astrogen-audience-trends-ukraine\`. Never probe guessed aliases, legacy snapshot IDs, domains, company UUIDs, or Paperclip project UUIDs as MCP project IDs. Read each tool schema once and send only its declared parameters.
- Group related accepted keywords into a stable search-demand opportunity, then establish uncovered/owned status through the full Payload/live CMS inventory. Semantic-core supplies accepted demand and frequency; it does not replace CMS coverage or cannibalization review.
- Ingest or update native search-demand cases at \`discovered\` using stable opportunity fingerprints and /companies/astrogen/reference/search-demand-policy.yaml until contentPortfolioTrack counts satisfy western_astrology_learning=12, audience_applied_questions=5, audience_trends=3, trust_expert_method_boundaries=3, and commercial_unmet_demand=2. Fill the most deficient portfolio track with its correct source lane; do not use trend research as filler outside audience_trends. Every campaign row carries exactly one \`contentPortfolioTrack\`, exactly one \`primaryAudienceSegmentId\` for diversity reporting, optional secondary segments, and trendReportRunId only when trend-derived. For western_astrology_learning curriculum nodes, accepted Semantic Core demand may be replaced only by the approved typed curriculum proof; ownership, cannibalization, SERP analysis, internal links and Winning Structure remain mandatory. A GSC-only fallback needs at least 20 impressions in a completed 28-day window and proof that no stronger uncovered semantic candidate should precede it. An accepted emerging trend phrase may instead use the policy's fully evidenced \`trend_emerging\` fallback when frequency is unavailable; preserve \`unavailable_not_zero\` and never invent volume. A proposed trend phrase must still pass normal semantic-core validation and resolve any \`candidate_review\` before search-demand intake. Reject/cancel \`product_narrowing_contamination\` if the phrase/title/topicKey introduces Astrogen product, service, modality, route, existing owner URL, or product keyword-family language instead of the retained audience signal. Never ingest topic candidates directly. When a trend validation handoff has \`acceptedSemanticCandidates\` but no \`createdSearchDemandCaseIds\`, this role owns materializing or reusing those native search-demand cases and reporting the real case IDs back to the parent issue; do not redirect that work to semantic-core agents or CTO permissions. Enrich only a topic candidate created by guarded native breakdown after \`selectedAction=new_article\`, then transition it to \`evidence_ready\`, \`waiting_evidence\`, or \`expired\`; the validator alone moves evidence-ready cases to \`ready\`, \`needs_owner_direction\`, or \`rejected_duplicate\`.
- Before any native search-demand create, cluster the complete handoff by reader outcome, search intent, expected page type/owner and SERP family. Create or reuse one canonical case per \`intentClusterKey\`, with stable \`clusterDedupeKey\`, one \`primaryQuery\`, all variants in \`supportingQueries\`, and arrays of \`sourceSemanticCandidateIds\` and \`sourceClusterIds\`. The canonical case key must be independent of validation run and phrase wording. If a phrase-level case already exists, merge its evidence into the canonical case, record \`canonicalOpportunityCaseId\`, and cancel/reject duplicate opportunity/topic lineages before allocation. Quotas and plan rows count unique \`intentClusterKey\`, not accepted phrases or native rows. Keep \`queryFamilyFingerprint\` page-specific; use the separate \`allocationFamily\` only for portfolio batch caps.
- Set \`portfolioLane=audience_interest_editorial\` only for accepted \`audience_interest_intent\`; all other cases use \`search_demand_core\`. The editorial lane needs no direct product/entity anchor, but must carry current audience evidence, an Astrogen editorial bridge, SERP information gain, safety boundaries and internal-link value. Products remain optional contextual body links only.
- Native search-demand ingest uses \`POST /api/pipelines/{pipelineId}/cases\` with \`caseKey\`, \`title\`, \`summary\`, and \`stageKey=discovered\` at the top level; typed demand evidence belongs under \`fields\`. Never hide \`caseKey\` inside \`fields\`. Reuse the stable case key on retry so a transport failure cannot create a duplicate.
- Build every native case create/update body in a JSON file or through \`JSON.stringify\`; keep \`summary\` and string fields plain text without Markdown backticks. Never inline a case payload into a shell command.
- Exclude explicit calendar-date themes and ephemeral daily-horoscope themes while the owner pause is active, including named day/month zodiac profiles, birthday-date profiles, horoscopes for a named calendar date, and sign-specific variants "на сьогодні". Record a discovered legacy opportunity from either family as a typed owner-policy rejection and use discovered -> cancelled without writing selectedAction; expire an undelivered topic candidate instead of producing an article.
- Every ready topic must include topicKey, Ukrainian working title, primary
  query, supporting queries, intent, funnel role, exactly one configured
  primaryAudienceSegmentId, optional non-counting secondaryAudienceSegmentIds, trendReportRunId, target
  service/route relationship, evidence references, CMS duplicate check, active
  issue duplicate check, cannibalization assessment, CTA target, internal link
  targets, forbidden claims/tone constraints, content role, demand class, SERP
  grouping status, SERP value-gap requirement, and why it is safe now.
- If SERP evidence is not checked during refill, set
  \`serpGroupingStatus=not_checked\` and \`serpValueGapRequired=true\` instead
  of pretending the topic is fully brief-ready.
- In \`waiting_evidence\`, one successful bounded Semantic Core check with no matching query/segment coverage is a terminal no-coverage result for that candidate, not an indefinite technical blocker. Persist the result and expire the candidate. Also expire it when another topic from the same repetitive family already occupies the current daily batch. A future source fingerprint may rediscover it; the canonical refill must continue to broader candidates now.
- Do not invent broad topics when evidence tools are unavailable. Attach the exact typed runtime/plugin blocker to the affected native topic/refill case; unrelated topic and growth cases continue.

## Trend Ingestion Result Projection

- For every trend validation handoff, append exactly one \`## trendIngestionResult\` section with one fenced JSON object before setting the issue done. Do not use that exact heading for prose, checklists, or required-field notes. It must contain \`finalDisposition\`, \`acceptedSemanticCandidates\`, \`acceptedSemanticCandidateCount\`, \`createdSearchDemandCaseIds\`, \`eligibleReadyTopicCountAfter\`, \`primaryAudienceSegmentId\`, \`segmentEligibleTopicCountAfter\`, \`remainingUnusedClusters\`, \`validationWave\`, and \`layerValidationMatrix\`. Use \`accepted_for_search_demand_ingestion\` when accepted materialized rows still await native ingestion; use \`created_search_demand\` only when the listed native cases actually exist. Accepted candidate count is never a ready-topic count. Query ready counts from live lineage-valid topic cases at ready plus reserved; if that query is unavailable, write null and a typed blocker. Semantic-core agents do not need \`pipelines:write\`; if an issue body asks them to materialize native cases directly, treat that as superseded by this contract and return a handoff packet for SEO Blog Content Strategist. Other valid dispositions are \`covered_existing_owner\`, \`duplicate_or_cannibalizing\`, \`rejected\`, or \`blocked_typed_dependency\`. A comment-only result or terminal status without this projection is incomplete.
- For focused trend continuations that originate from a native growth case, publish outcome evidence through the linked-case-output contract: write one source case document with \`## focusedContinuationResult\` or \`## trendIngestionResult\`, and link only the relevant child evidence issue as \`work\`. Do not PATCH source growth-case fields from the delegated worker unless your run has explicit \`pipelines:write\` on that pipeline. A \`pipeline_write_forbidden\` response on source-case fields is not a CTO blocker when the case document and work link exist; the source-case owner/monitor must read outputs and update its own fields or stage.
- If the next native transition, review, or guarded create requires the configured CMO approver, write a typed \`needs_manager_action\` result naming the target case, requested action, expected version, and evidence refs, then mark the delegated specialist issue done. Missing manager-only approval authority is not a specialist blocker and must never create a \`blocks\` relation against the CMO. The CMO consumes the result, performs the approval or transition, and continues the same source growth case.

## Winning Structure Strategy Input Contract

- Store one \`winning-structure-input\` case document as plain JSON that is directly valid for both \`validate_task_input\` and \`start_winning_structure_run\`. Do not wrap it in Markdown and do not create a separate internal shape.
- Required top-level objects are \`task\` and \`market\`. Never use \`task_input\`, a string market, a nested \`namespace\`, \`run_id\`, \`decisions\`, or local heartbeat/session/issue identifiers in the payload.
- The top level carries \`company_id\`, \`project_id\`, \`client_key=astrogen-ukraine\`, the stable \`idempotency_key\`, \`task\`, \`market\`, \`cache_policy\`, \`editorial_constraints\` and optional page, business, ownership and reader-value context.
- For an existing CMS draft or refresh, \`task.page_mode\` is exactly \`existing\`; use \`new\` only when no page exists. \`editorial_constraints\` is always a list of strings. Use only the allowed \`reader_value_evidence.evidence_type\` and \`manual_value_commitments.asset_type\` values in \`taskInputContract\` from \`/companies/astrogen/reference/winning-structure-policy.yaml\`; never invent local enum names.
- Merge evidence, commitments and product bridge targets into one \`business_context\`. A concrete future asset belongs in \`manual_value_commitments\`; an existing verified source belongs in \`reader_value_evidence\`.
- Each \`reader_value_evidence\` object must have \`evidence_id\`, \`evidence_type\`, \`title\`, \`summary\`, \`reader_problem\`, and \`source\`. Each \`manual_value_commitments\` object must have \`commitment_id\`, \`asset_type\`, \`description\`, \`reader_problem\`, \`value_proposition\`, \`owner\`, \`target_content_units\`, \`validation_method\`, \`acceptance_criteria\`, and \`due_before_publication=true\`. Each \`product_bridge_targets\` object must have \`url\` and a human-facing \`label\`. Never use legacy aliases such as \`ref\`, \`route\`, \`relationship\`, \`bridge_role\`, \`claim_boundary\`, \`owner_role\`, \`commitment_type\`, \`reader_facing_asset\`, or \`verification_before_delivery\` in the MCP payload.
- Persist \`winningStructureInputDocumentId=winning-structure-input\` and leave all MCP-owned runtime fields null. Only a plugin response can populate run ID, hashes, status, decisions, retention and result document fields.

## SERP Value-Gap Refresh Candidate Rule

- When a candidate is rejected as a new article because of duplicate or
  cannibalization risk, check whether one existing Astrogen article can safely
  absorb the missing intent through \`serp_value_gap_content_refresh\`.
- A refresh candidate must name the existing CMS article, target keyphrase
  cluster, SERP competitors, missing user questions, Astrogen
  information-gain angle, and why refresh is safer than creating a new article.
- Do not propose refresh work as generic editorial insertion. FAQ, comparison,
  CTA, relatedPosts, internal links, metadata, or structured blocks are valid
  only when the SERP value-gap artifact justifies that exact element.

## Content Portfolio And Curriculum Rule

- Assign every future article exactly one \`contentPortfolioTrack\`: \`western_astrology_learning\`, \`audience_applied_questions\`, \`audience_trends\`, \`trust_expert_method_boundaries\`, or \`commercial_unmet_demand\`. The rolling targets are 12/5/3/3/2. Keep audience segments for diversity reporting, not hard quotas, and never create filler to satisfy a segment.
- For \`western_astrology_learning\`, use /companies/astrogen/reference/western-astrology-curriculum.yaml with roles \`pillar\`, \`prerequisite\`, \`deepening\`, or \`example\`. One article introduces exactly one new astrology concept. A synonym such as \`дім / будинок / дом\` is an alias of one concept; definitions, lists, comparisons, examples, FAQ answers, or workflows for adjacent terms count as additional concepts even when called supporting context.
- Every curriculum topic and article must preserve \`curriculumNodeId\`, \`primaryConceptKey\`, exactly one matching item in \`introducedConceptKeys\`, prerequisite node/article links, excluded future concepts, and the distinct teaching contribution. Previously taught concepts may be mentioned briefly with a published prerequisite link but are not retaught.
- Before selecting or materializing a curriculum node, query native topic inventory across active and terminal stages by \`curriculumNodeId\`, \`primaryConceptKey\`, and direct search-demand parent children. A \`consumed\` topic or delivered article marks the node fulfilled. Never recreate, revive, or count it as future supply; update the learning-plan evidence and continue with the first prerequisite-ready missing node. A measured search-demand parent with a consumed topic child is historical ownership proof, not a reusable intake candidate.
- A curriculum prerequisite may proceed without accepted Semantic Core demand and without a classic SERP value gap only when SERP analysis is complete, the graph has a named missing node, no CMS owner or cannibalization conflict exists, incoming and outgoing prerequisite links are defined, and \`distinctTeachingContribution\` proves a unique teaching purpose. Winning Structure remains mandatory. More than one new concept, a missing published prerequisite, duplicate ownership, unsafe scope, or no distinct teaching role rejects it.
`;
  }

  if (agent.name === "SEO Semantic Core Strategist") {
    return `

## Local Semantic Inventory Contract

- For an assigned zodiac compatibility campaign, follow /companies/astrogen/reference/zodiac-compatibility-cluster.yaml. Research the pillar, all twelve sign hubs, and bounded pair families through \`astrogen-ukraine\` on \`adjacent_use_case_intent\`. Reuse project cache and batch related seeds, but return a separate accepted pageKeywordPacket for every proposed page. Reverse sign order, mixed-locale wording, and gender variants are aliases/supporting queries unless current SERP evidence proves a different page intent.
- Read the latest accepted company/project semantic-core snapshot through \`paperclip.semantic-core-mcp-agent-tools:get-local-inventory\` before declaring inventory unavailable or requesting another agent handoff. Read candidates from \`acceptedKeywords\` and use \`geoSearchVolume\`; a migrated snapshot may correctly report \`clusters: 0\`.
- This local read-only tool requires no external MCP token. Use \`limit<=50\`, page or filter by \`minimumGeoSearchVolume\`, and return compact candidate evidence rather than the raw import payload.
- For search-demand handoffs, return a bounded batch of high-priority accepted keyword candidates or existing clusters with stable IDs and frequency for the campaign's one deficient primary audience segment. Do not claim \`uncovered\` from semantic-core alone: the content strategist must group intent and verify full CMS coverage, cannibalization and URL ownership. Do not create article or topic cases yourself.

## Trend Topic Report Contract

- Use \`paperclip.semantic-core-mcp-agent-tools:generate-trend-topic-report\` only under /companies/astrogen/reference/trend-topic-policy.yaml with \`project_id=astrogen-audience-trends-ukraine\`, required \`analysis_date=YYYY-MM-DD\` in Europe/Kiev, private-project cache isolation, and bounded live research. Do not send \`products\`; project/company/audience guidance must describe audience situations and reader problems without Astrogen product/service/modality terms, and every retained item needs a current temporal/behavioral audience signal. Use \`astrogen-ukraine\` only later for semantic validation of selected phrases.
- For a focused segment, pass one configured \`audience_segments\` row. Do not send undeclared \`primary_audience_segment_id\` or \`reviewed_fingerprints\`; internal signals use \`title\` and \`description\`.
- Preserve the complete report identity, warnings, evidence summary, cache telemetry, and cost events. A successful zero-cluster result is valid and must not be padded with model-memory topics.
- Never call \`prepare_paperclip_import\` for a trend run, never classify its phrases as accepted semantic-core keywords, and never create search-demand, topic, or article work directly from raw trend output.
- Return selected potentially useful phrases to the normal semantic-core validation workflow with the focused report's one primaryAudienceSegmentId and trendReportRunId. Only accepted demand may be handed to the content strategist for CMS ownership and cannibalization review; secondary audience relevance never creates a second quota row.
- Treat \`candidate_review\` as nonterminal. Delegate one stable \`trend-review:{trendReportRunId}:wave:{validationWave}\` child to SEO Semantic Core Validator and keep the validation wave open until the reviewed phrases are accepted, parked or rejected through the materializing semantic rerun. Do not ask the owner to decide low-confidence or technical semantic classification. Validation child wording must not assign native search-demand case materialization to semantic-core roles; ask for a handoff packet instead.
- After Validator returns final accepted evidence, delegate one bounded ingestion handoff to SEO Blog Content Strategist. The Validator and Semantic Core Strategist do not need \`pipelines:write\`, and a missing write permission on either role must not create a CTO permission task. If an older issue description asks you to create native cases directly from a semantic-core role, treat the AGENTS.md contract as authoritative and hand off ingestion instead.
`;
  }

  if (agent.name === "SEO Semantic Core Validator") {
    return `

## Bounded Semantic Review Authority

- Own nonterminal Semantic Core \`candidate_review\` resolution for Astrogen. This is an agent review lane, not an owner decision and not a reason to close trend discovery.
- Semantic validation uses \`astrogen-ukraine\`; audience-first trend reports use \`astrogen-audience-trends-ukraine\`. Use only these two project IDs according to the task's policy. Never probe company slugs, domains, URLs, Paperclip UUIDs, legacy snapshot IDs, or other aliases. If an exact run-bound call fails, report that call; do not search for another project ID.
- Read each exact live run's prepared \`paperclip_import.v1\` rows and decision trace. Review only the phrases named by the assigned \`trend-review:{trendReportRunId}:wave:{validationWave}\` fingerprint; never broaden the batch or invent alternatives.
- You may choose only \`accept\`, \`park\`, or \`reject\`. Accept only a query-shaped Ukrainian phrase with supported locale, medium/high configured non-core audience-layer topic-domain match, clear Astrogen audience fit, evidence that the phrase came from an audience signal rather than a product/service seed, and a safe editorial or service pathway. Explicit product binding alone is not enough for a trend-derived phrase. Never accept a duplicate, unsupported locale, mixed-language noise, off-topic entity conflict, or a phrase lacking a defensible ownership boundary.
- For \`audience_interest_intent\`, a defensible editorial bridge is a valid ownership boundary: direct product/service/entity anchoring is not required when current audience signal, configured topic-domain match, audience fit, SERP value potential and safety boundaries pass. Do not park solely for \`no_entity_anchor\` or \`owner_mismatch\`; record the bounded editorial bridge and let downstream ownership/cannibalization review decide the page action.
- Low confidence alone is not an owner blocker. Record the evidence, uncertainty and downstream ownership boundary. Park when the phrase belongs to another semantic layer or lacks enough current support; reject only for durable mismatch/noise/duplicate evidence.
- Submit decisions append-only through \`paperclip.semantic-core-mcp-agent-tools:submit-review-decisions\` using \`decision\` values \`accept\`, \`park\`, or \`reject\`. Partition reviewed phrases by original semantic run ID and intended non-core layer, then materialize each partition in exactly one \`run-layer-and-wait\` call with explicit \`mode=live\`, \`provider_cache_mode=read_write\`, the same partition phrases, matching review decisions, and matching \`force_re_review_keywords\` records. Never combine different intended layers in one materializing run and do not rely on old runs mutating.
- Prepare the new run import and return a final accepted, parked or rejected disposition for every reviewed phrase. A partial review queue or a \`get-keywords\` failure is not completion; use the typed prepared import.
- Accepted phrases go only to \`astrogen-search-demand-opportunities\`. They never create topic or article work directly. When geo frequency remains unavailable, preserve unknown as \`unavailable_not_zero\` and attach the live trend evidence required by /companies/astrogen/reference/search-demand-policy.yaml; never invent a volume.
- Do not create or mutate native pipeline cases and do not request \`pipelines:write\`. Return the accepted evidence to the SEO Semantic Core Strategist, who delegates ingestion to SEO Blog Content Strategist. Your issue is complete when final materialized dispositions and the handoff packet are durable; downstream case proof belongs to the parent validation wave.
`;
  }

  if (agent.name === "SEO Blog Content Plan Validator") {
    return `

## Topic Inventory Validation Gate

- For zodiac compatibility work, read /companies/astrogen/reference/zodiac-compatibility-cluster.yaml and reject any page without a final accepted packet stored in the canonical \`pageKeywordPacket\` field, unique canonical owner, complete CMS check, guarded search-demand lineage, clusterLane=compatibility_reference, allocationFamily=zodiac_compatibility, contentPortfolioTrack=audience_applied_questions, and portfolioLane=search_demand_core. The aliases \`acceptedPageKeywordPacket\` and \`finalPageKeywordPacket\` do not satisfy the ready gate. Reject reverse-order or gender-only duplicates unless distinct current SERP and demand evidence proves a separate intent.
- For \`western_astrology_learning\`, read /companies/astrogen/reference/western-astrology-curriculum.yaml and require one \`primaryConceptKey\` plus exactly one matching \`introducedConceptKeys\` item. A definition, list, comparison, FAQ answer, example, catalogue, or workflow for an adjacent astrology term is another concept even when labelled supporting context. Require published prerequisite article URLs before a dependent node reaches \`ready\`.
- Validate \`topic_inventory_refill\` packets before the article allocator can
  consume them.
- Accept only records whose status, evidence, duplicate check, cannibalization
  assessment, CTA/internal-link plan, cooldown notes, content role, demand
  class, SERP grouping status, and SERP value-gap requirement are explicit.
- Reject or park topics that overlap existing service pages, CMS drafts,
  recently produced articles, active article parents, or accepted semantic-core
  items without a distinct intent.
- Require guarded search-opportunity lineage, full CMS/live semantic coverage evidence, and demand eligibility under /companies/astrogen/reference/search-demand-policy.yaml. An exact-slug probe, a newest-post sample, or a micro GSC signal is not enough for \`ready\`.
- If a topic is strategically promising but needs business direction, mark it
  \`needs_owner_direction\` with a short Ukrainian decision brief. Do not ask
  the owner to solve plugin/API/tooling failures.

## Content Refresh Validation Gate

- Validate \`serp_value_gap_content_refresh\` packets before an existing
  article is rewritten.
- Accept a refresh only when it has target keyphrases, current article evidence,
  SERP competitor evidence, missing user-value diagnosis, an Astrogen
  information-gain angle, and exact article sections that need substantive
  improvement.
- Reject refresh packets that are only generic editorial, metadata,
  relatedPosts, internal-link, FAQ, CTA, or comparison-block checklists without
  SERP/user-value justification.
`;
  }

  if (agent.name === "MKT Competitive Intelligence Analyst") {
    return `

## Semantic Core Trend Validation Boundary

- \`audience_trends\` is a Paperclip content portfolio track, never a Semantic Core layer value. Never pass it as \`layer\` to \`run-layer\` or \`run-layer-and-wait\`.
- Use \`audience_need_intent\` only for concrete audience problems, decisions, questions, or use cases. Use \`audience_interest_intent\` only for broader audience-first editorial interests that have a defensible Astrogen bridge without product narrowing.
- Call a Semantic Core layer tool only when the assigned issue explicitly requires semantic validation. Otherwise return the retained trend evidence and candidate handoff to the semantic validation role.
- Every bounded trend validation call must use \`project_id=astrogen-ukraine\`, 1-50 explicit \`candidate_keywords\`, one supported non-core layer, \`mode=live\`, and \`provider_cache_mode=read_write\`. If the intended layer is ambiguous, return a typed handoff naming the ambiguity; do not guess a layer, retry the same invalid payload, or treat a portfolio-track label as a plugin enum.

## Winning Structure MCP Contract

- For \`western_astrology_learning\`, preserve the canonical curriculum node and constrain every remote section and local overlay to one \`primaryConceptKey\`. Multiple value units may deepen that concept but may not introduce adjacent astrology terminology, a twelve-item catalogue, or an interpretation workflow that needs untaught concepts. Reject the structure instead of accepting concept overload as bounded support.
- For native article stages \`strategy_input\` and \`winning_structure\`, use Winning Structure MCP as the ownership, SERP and reader-value source of truth. Serper may supply caller evidence but never substitutes for a completed Winning Structure result.
- Read the \`winning-structure-input\` case document, parse its plain JSON body and pass the exact object unchanged to both validation and start. Never reconstruct the payload or rename \`task\` to \`task_input\`.
- Require the stable top-level namespace \`company_id\`, \`project_id\`, \`client_key=astrogen-ukraine\` and idempotency key \`winning-structure:{articleCaseId}:{revision}\`, plus object-valued \`task\` and \`market\`.
- Strategy Input owns the payload, namespace and idempotency key only. It must leave MCP run ID, status, hashes, decision version, retention and result fields null; never place a heartbeat, session or issue ID in an MCP field. Only Winning Structure may populate those fields from plugin responses.
- For every plugin operation, pass \`company_id\`, \`project_id\`, \`client_key\`, \`run_id\`, and \`decisions\` as top-level parameters exactly as declared by the tool schema. Never send a nested \`namespace\` object.
- Include a trustworthy current-page snapshot for refreshes, CMS ownership candidates, GSC query-to-URL evidence, forbidden topics, CTA/product bridge targets, claim constraints and non-SERP reader-value evidence or a concrete deliverable commitment.
- Follow /companies/astrogen/reference/winning-structure-policy.yaml. Normal production input sets top-level \`gist_enabled=true\` and maps the versioned project policy to \`cost_policy.currency\`, \`operation_rates_usd\`, \`pricing_source\`, and \`pricing_version\`; never invent rates for intentionally unpriced operations. A baseline comparison requires an explicitly authorized canary with a distinct task revision and idempotency key, and Paperclip review remains the winner authority.
- Call validate before start. A valid response must be remote proof: \`valid=true\`, \`validation_source=remote_mcp\`, \`input_hash\`, and \`task_input_contract_version\`. Store the returned input hash, start only once, preserve run ID, poll the same run with bounded backoff and stop on paused or terminal status.
- When the remote run remains active after the bounded poll, persist \`nextReviewAt\` in case fields and PATCH the current automation issue with a first-class \`executionPolicy.monitor\` using the same timestamp, \`scheduledBy=assignee\`, and notes containing the same run ID. Keep the issue \`in_progress\`; a case field alone is not a continuation path. Never exit a successful heartbeat with an active remote run and no issue monitor.
- If validation rejects the stored schema before any remote run exists, persist \`validation_issues\` with their paths and return the case to \`strategy_input\` for payload repair. A repeated identical input-document digest and validation-issues fingerprint is a typed pre-start contract-repair state, not another retry or a new task. Never use this transition after a plugin-returned run ID or input hash exists.
- When paused, copy the exact decision request, version, options and evidence to the case and transition to \`structure_decision\`. Never manufacture a decision or restart the run.
- On completion, import the structured result, Markdown reference, effective hash, decision version, structure sections, quality requirements, publication requirements, cost/provenance and retention deadline into durable case documents before artifact expiry. Keep raw MCP JSON, section lists, requirements, value plans, provenance and cost objects out of case fields: fields are an index of IDs, hashes, statuses, counts and short summaries only. The combined field budget is 48 KiB, and no one field may exceed 8 KiB.
- Persist the completed run as immutable result, content-selection-audit, meta-evidence-brief, provider-provenance and cost documents. Input, status and result \`gist_enabled\` values must agree. Selection audit and meta evidence are recommendations, never publishable prose, title, description or generated metadata.
- Verify Phase 32 evidence routing from durable provenance: Serper SERP with geo/language/pagination/device; competitor text through DataForSEO Content Parsing, then Serper Scrape, LLMLayer standard and at most one eligible proxy fallback; Reddit only through Reddit API or .json. Preserve failed attempts. \`no_visual_conclusion\` blocks UX or rendered-page claims.
- Write a complete Paperclip ledger amount only for numeric \`total_estimated\` with \`estimation_status=estimated\` and \`telemetry_status=complete\`. Partial \`priced_subtotal\` is a lower bound, null is unknown and zero requires proof that no paid operation occurred.
- Keep imported MCP artifacts immutable. Read approved selected value units from \`winning-structure-input.business_context.selected_value_units\`; compact case fields intentionally contain only their IDs and are never the source of the mapping contract. A selected value unit is valid strategy input only with 1-4 canonical \`targetIntentCovered\` values from the Astrogen article-value system; never use future remote \`targetSectionIds\` at strategy-input time. Approved Astrogen selected value units are durable strategy input: map them to generated sections through their canonical \`targetIntentCovered\` values and each section's \`intent_covered\`; persist \`mappedSectionIds\`. The remote MCP may add value plans but does not erase approved local units. If no generated section maps an approved unit, create a separate typed \`winning-structure-local-overlay\` from that selected unit instead of opening a CTO task. Each selected-unit overlay entry must name \`sourceKind=selected_value_unit\`, \`sourceValueUnitId\`, mapped support IDs, insertion point, evidence/commitment refs, purpose, writer instruction, examples to avoid, claim boundaries, and \`provenance=paperclip_normalization_from_selected_value_unit\`. An accepted remote plan may use \`sourcePlanId\` and \`provenance=paperclip_normalization_from_accepted_plan\`.
- The overlay may not introduce new evidence, claims, scope, keyword ownership, CTA routes or product capabilities. Set \`structureMappingStatus=normalized_with_overlay\` and persist its document ID; use \`raw_complete\` when every unit maps to a raw section. Anything requiring a new claim, scope, ownership, evidence, or plan interpretation is a manager-review blocker, not a technical task.
- Never concatenate writer instructions into article prose and never expose raw MCP payloads, tokens or debug artifacts in issue comments.

## SERP Value-Gap Contract

- Own bounded \`serp_value_gap_check\` issues for Astrogen article parents.
- Use Serper Google Search through Paperclip plugin tools as the default SERP
  source. Query the primary keyword with \`gl=ua\`, \`hl=uk\`, \`num=10\`, and
  do not run broad crawl/scrape batches unless the issue explicitly authorizes
  them.
- Produce one compact durable artifact with: primary query, support queries
  checked or not checked, geo/language/device assumptions, top 5-10 organic
  competing URLs/titles/snippets, competitor page-type pattern, SERP intent,
  common headings/claims inferred from snippets, unsafe or overpromising claims
  Astrogen must avoid, missing user questions, Astrogen information-gain angle,
  whether a short historical/context note would clarify a \`Що таке\` /
  \`Що це означає\` section without becoming filler, outline constraints for
  the brief, internal-link/CTA implication, and
  \`serpGroupingStatus\` = \`checked_same_intent\`,
  \`checked_split_required\`, or \`needs_recheck\`.
- Do not copy competitor text. Summarize patterns only.
- If Serper or another required SERP tool is unavailable, record blocker class
  \`serp_tool_unavailable\`, name the exact plugin/config/secret error, and
  route a CTO-owned blocker. Do not mark the value-gap issue done without SERP
  evidence or an explicit CMO/owner waiver.

## SERP Value-Gap Content Refresh Artifact

- For \`serp_value_gap_content_refresh\`, compare the relevant keyphrases
  against the current Astrogen article and top SERP competitors.
- The artifact must state which existing article is being refreshed, what
  competitors cover better or differently, what user questions are missing, and
  the precise Astrogen information-gain angle.
- If a brief historical/context note would help the reader understand a term,
  practice, or misconception, state where it belongs and why. If it would be
  decorative, say \`historical_note_not_needed\`.
- Name exact body sections or paragraphs that need substantive improvement.
  Do not recommend FAQ, CTA, comparison, relatedPosts, internal links, or
  metadata changes unless the SERP/user-value gap directly justifies them.
`;
  }

  if (agent.name === "MKT Blog Brief Strategist") {
    return `

## Winning Structure Brief Contract

- For \`western_astrology_learning\`, add a typed \`curriculumScope\` with one \`primaryConceptKey\`, exactly one matching \`introducedConceptKeys\` item, published prerequisite URLs, allowed known concepts and excluded future concepts. Remove any provider section that teaches an untaught term; calling it context does not make it acceptable.
- Create a brief only from an imported and accepted Winning Structure result. Preserve section IDs, hierarchy, purpose, writer instruction, evidence references, claim boundaries, examples to avoid, review flags and publication requirements as structured fields.
- Keep the complete planning record in the canonical \`brief\` case document. Also create a separate \`writer-brief\` JSON case document of at most 48000 UTF-8 characters before transitioning to draft. It contains only locked basics, search intent, information gain, selected reader-value units, concise evidence/claim boundaries, CTA/internal-link constraints, avoid constraints, readerFacingSectionIds, curriculumScope when applicable, and compact reader-facing section instructions. Exclude provider audit objects, provenance, validation instructions, publication blockers, CMS/media fields, revision ledgers, handoffOnly sections, and repeated examples-to-avoid payloads.
- Persist \`writerBriefDocumentKey=writer-brief\`, the writer-brief revision ID, and character count as compact case fields. Never transition to draft when the writer brief is missing, quarantined, truncated, above the stage limit, or inconsistent with the canonical brief.
- Read the imported content-selection audit and meta-evidence brief as evidence for section inclusion and factual boundaries only. Never paste their text into the article or treat the meta brief as a generated title or description.
- Use the accepted Astrogen article type and two to four approved reader-value units. A table, FAQ, checklist, comparison or historical note is only presentation; it is not value unless it delivers the accepted evidence-backed contribution.
- Do not add a universal block set. Prove that selected value units fit this reader problem and do not repeat the substantive role of recent sibling articles.
- A committed but undelivered asset remains a publication blocker and must be visible in the brief. Do not let the writer simulate it.

## CMS Category Policy

- Resolve and persist \`cmsCategorySlug\` and \`cmsCategoryTitle\` in the brief. The approved v1 article-type defaults are: \`zodiac_profile=astrologiya\`, \`product_education=inshi\`, \`expert_method_selection=eksperty\`, \`life_situation_decision=inshi\`, \`concept_explainer=astrologiya\`, \`relationship_compatibility=stosunky\`, \`forecast_cycle=free-horoscope\`, and \`historical_cultural_explainer=inshi\`.
- A topic/service-specific approved category overrides the default. Use stable slugs, never numeric Payload IDs, and never create taxonomy during article delivery.
- This embedded mapping is an approved equivalent of \`/companies/astrogen/reference/cms-delivery-policy.yaml\`. Do not block only because that filesystem path is unavailable; block only when articleType is absent, no approved mapping exists, or two applicable mappings conflict.

## Phase 14 Brief Contract

- Create briefs only from an approved article opportunity plus completed SERP
  value-gap evidence, unless the parent issue contains an explicit CMO waiver.
- The brief must preserve: articleParentKey, primary/supporting queries,
  content role, demand class, SERP grouping status, target route, CTA, internal
  links, duplicate/cannibalization notes, and the SERP value-gap artifact link.
- Add a dedicated \`Information gain\` section with 3-5 concrete bullets naming
  what Astrogen will add beyond current competing pages.
- Include a \`Historical/context note\` instruction only when the SERP/value-gap
  artifact says it helps explain a concept or remove a myth. It should be 2-4
  sentences inside a \`Що таке\` / \`Що це означає\` style section, not a
  standalone history block.
- Add \`Avoid from SERP\` constraints for unsafe, overpromising, generic, or
  competitor-like claims found in the value-gap artifact.
- If the value-gap artifact is missing, stale, or says \`needs_recheck\`, return
  the issue to CMO/Competitive Intelligence instead of creating a generic brief.

## Content Refresh Brief Contract

- For \`serp_value_gap_content_refresh\`, create a refresh brief only from a
  validated value-gap artifact and current article evidence.
- The brief must include a before/after change plan tied to the artifact:
  target keyphrases, missing user questions, information-gain angle, exact
  sections to improve, claims to avoid, and what must remain unchanged.
- If a short historical/context note is useful, name the exact section where it
  should be inserted and the misconception or context it clarifies. Do not add
  it as a generic enrichment requirement.
- Do not request generic addition of \`Коротко\`, FAQ, CTA, comparison blocks,
  internal links, relatedPosts, or metadata. Include those only when the
  artifact proves that specific element is the best way to close the value gap.
`;
  }

  if (agent.name === "SEO Blog Article Writer (Claude)" || agent.name === "SEO Blog Article Writer (ChatGPT)") {
    return `

## Evidence-Backed Draft Contract

- For \`western_astrology_learning\`, teach exactly one new astrology concept. Do not define or compare adjacent terms, list twelve houses/signs, add a glossary or FAQ that introduces new terms, or use an interpretation workflow that depends on concepts the curriculum has not taught. Published prerequisites may be mentioned briefly with links but not retaught. Ukrainian aliases of the primary concept count as the same concept. At most one curriculum-approved supporting term may be used when accuracy requires it: define it immediately in one plain-language sentence, record it in \`supportingTermGlossary\`, and do not give it a heading, table, list, FAQ, comparison, example set, workflow, or second teaching objective.
- This is the shared writer-workspace contract. Claude is the primary writer. ChatGPT may execute only after the case records a Claude/provider/protocol blocker or an explicit CMO fallback decision; ChatGPT must never self-trigger or replace a healthy Claude path.
- The Claude writer runs through the OpenRouter prompt adapter. It has no callable shell, browser, or Paperclip API tools: never emit \`<tool_call>\`, shell commands, or raw API instructions. Return the adapter's single JSON protocol response with the complete attachment artifact. Include typed \`pipelineTransition\` when the native state machine exposes multiple allowed next stages; when exactly one transition exists, it may be omitted and Paperclip selects that route deterministically. Never guess between multiple routes. Paperclip validates and performs the transition before it can close the stage task.
- Use only the complete injected \`writer-brief\` document for draft requirements. Never reconstruct it from compact case fields or continue from a missing, redacted, or truncated inline document.
- Write article prose only from brief sections typed \`readerFacing\`. Treat CMS/media fields, revision IDs, publication blocker notes, validation instructions, source/provenance notes, editorial signals, and any section titled \`Редакційні сигнали та медіа-поля\` as \`handoffOnly\`, even when an older immutable provider result numbered them as a section. On a validate-to-draft return, apply the latest content-validation case document before the older brief and never repeat a rejected operational section.
- Treat the accepted Winning Structure and brief as requirements, not prose. Write original Ukrainian copy without copying competitor wording or concatenating section instructions.
- Deliver the selected type-specific value units and cite or bound their evidence internally. Never invent expert observations, consultation cases, statistics, historical facts, tests, screenshots, product capabilities or personal experience.
- Astrology, tarot, numerology, Human Design and related systems must be framed as interpretive practices, not scientific proof or guaranteed prediction. Do not make medical, legal, financial, diagnostic, deterministic or fatalistic claims.
- If an evidence-backed unit or committed asset is unavailable, record the exact requirement as blocked instead of replacing it with generic filler.

## Phase 14 Article Draft Contract

- Write only from an approved brief that contains SERP value-gap evidence or an
  explicit CMO waiver.
- The draft must visibly satisfy the brief's \`Information gain\` bullets
  without copying competitor text or expanding into unsupported claims.
- When the approved brief requests a historical/context note, write it as 2-4
  practical sentences inside the relevant \`Що таке\` / \`Що це означає\`
  section. Use it to clarify the origin, evolution, or common misconception of
  the concept; do not turn it into a decorative history lesson.
- Do not pull extra semantic-core keywords directly into the article. If the
  brief/value-gap evidence is insufficient, record \`brief_value_gap_missing\`
  instead of inventing a generic article.

## Content Refresh Writing Contract

- For \`serp_value_gap_content_refresh\`, rewrite only from a validated refresh
  brief that names the current article, target keyphrases, SERP gap, and exact
  sections needing improvement.
- Preserve accepted facts, tone boundaries, H1/title/schema/metadata unless the
  issue explicitly includes metadata work.
- The output must add substantive missing user value. Do not satisfy refresh by
  merely adding \`Коротко\`, FAQ, CTA, comparison blocks, internal links,
  relatedPosts, or layout blocks unless the brief ties that element to the SERP
  value gap.
- A short historical/context note is allowed only when the refresh brief asks
  for it and ties it to a reader-value gap. Keep it inside the relevant
  definitional/explanatory section; do not add a separate generic history
  section.
- Comments are not durable body artifacts. For refresh work, create or update
  the issue document \`canonical-refresh-draft\` with
  \`PUT /api/issues/$PAPERCLIP_TASK_ID/documents/canonical-refresh-draft\`
  before marking the issue done. The document body must contain the
  ready-to-apply Ukrainian section text, insertion/replacement map, target CMS
  id/admin URL, media/publish guardrails, and validation checklist.
- After writing the document, refetch it with
  \`GET /api/issues/$PAPERCLIP_TASK_ID/documents/canonical-refresh-draft\` and
  mention \`/AST/issues/<identifier>#document-canonical-refresh-draft\` in the
  completion comment. If the document cannot be written or refetched, block as
  \`writer_artifact_write_failed\`; do not claim an artifact exists in a
  comment alone.
`;
  }

  if (agent.name === "SEO Blog Article Validator") {
    return `

## Final Main-Content Quality Gate

- For \`western_astrology_learning\`, scan headings, definitions, tables, lists, examples, FAQ and workflows before both validation approval and MC pass. Persist the detected concept keys and pass only when exactly the declared primary concept is newly taught; concept overload is \`revise_substantive\`, not a style defect.
- At native stage \`mc_quality\`, audit the post-humanizer draft independently against the imported Winning Structure, brief, evidence, commitments and relevant competitor baseline.
- Return one typed outcome: \`pass\`, \`revise_surface\`, \`revise_substantive\`, or \`reject_unsafe\`. Route surface-only naturalness defects to humanize and substantive value/evidence defects to draft.
- Passing requires reader-task completion, visible original contribution, specificity, useful depth, acceptable information density, fulfilled publication requirements, claim safety, sibling differentiation and no process residue.
- Structure, length, FAQ, tables, CTA, \`Коротко\` and related posts do not prove quality by themselves. Reject padding, derivative coverage, unsupported claims and cosmetic value blocks.
- When \`geoRetrievabilityRequired=true\`, additionally check answer-first passages, entity clarity, self-contained fragments and factual specificity. Never use estimated LSI similarity, keyword repetition or invented numeric precision as a gate.

## Phase 14 Validation Gate

- Validate the draft against the approved opportunity, brief, and SERP
  value-gap artifact.
- Approve only when the draft clearly delivers the brief's \`Information gain\`
  bullets, avoids competitor-like unsafe/overpromising claims, preserves the
  intended SERP intent/page type, and does not cannibalize the target service
  route or recent Astrogen content.
- If the brief requested a historical/context note, approve it only when it is
  short, relevant to a \`Що таке\` / \`Що це означає\` section, and clarifies a
  concept or misconception. Reject decorative or unsupported history.
- If the draft is merely generic coverage of the keyword, return
  \`changes_required\` with a narrow checklist tied to the missing value-gap
  bullets.

## Content Refresh Validation Gate

- For \`serp_value_gap_content_refresh\`, validate the updated article against
  the refresh brief and SERP value-gap artifact.
- Approve only when the article adds the missing user value named in the
  artifact and stays distinct from existing Astrogen pages.
- A historical/context note can count as information gain only when the
  artifact or brief ties it to a real reader question, term confusion, or
  misconception.
- Reject updates that are mostly mechanical insertion of \`Коротко\`, FAQ, CTA,
  comparison blocks, internal links, relatedPosts, metadata, or layout blocks
  without substantive information gain.
`;
  }

  if (agent.name === "SEO Blog Humanizer") {
    return `

## Bounded Editorial Naturalness Contract

- For \`western_astrology_learning\`, preserve the one-concept boundary. Do not add explanatory definitions, synonyms beyond the primary concept's aliases, examples, FAQ material or transitions that teach a second astrology concept.
- Perform one minimal pass after factual/structural validation. Preserve every fact, evidence boundary, Winning Structure section purpose, SEO lock, CTA route and publication requirement.
- Correct only observable editorial patterns: canned openings/closings, repeated sentence starts, uniform paragraph rhythm, generic transitions, abstract wording, unnecessary explanation and mechanical triads.
- Do not produce an AI probability, name a supposed model family, optimize for detector evasion, invent first-person experience, add conversational filler or recursively rewrite the article.
- Store the changed artifact and a compact change list. The independent MC quality stage decides whether the final text passes.
`;
  }

  if (agent.name === "SEO Blog Image Runtime Executor") {
    return `

## Cover Image Recovery Contract

- Before a paid generation, call \`paperclip.openrouter-image-agent-tools:image-visual-history-get\` and read the latest 6-8 company-scoped human-scene fingerprints.
- Every generation must declare \`subjectMode\`. For \`human_scene\`, provide the plugin's complete typed \`artDirection\`: narrative moment, scene archetype, setting, subject arrangement, action type and description, specific emotional beat, at least two visible emotion cues, shot distance, camera angle, gaze plan, dominant props, brand anchors, and avoid patterns.
- A new human scene must differ from every recent fingerprint on at least 4 of 9 axes. If the plugin rejects similarity, revise the concept once before provider spend; do not turn preflight into a loop.
- Astrogen style is stable lighting, refined editorial realism, soft neutral base, restrained burgundy/wine and warm-gold accents, and subtle esoteric detail. It is not a mandatory burgundy sweater, neutral home office, wooden table, laptop, notebook, plant, or cup.
- \`calm\`, \`thoughtful\`, \`focused\`, and \`reflective\` are tone modifiers, not sufficient emotional beats. QA must identify a topic-specific emotion such as uncertainty, recognition, relief, resolve, trust, tenderness, discovery, reassurance, curiosity, or anticipation and at least two visible cues in face, gaze, posture, hands, movement, or interaction.
- Reject a blank catalogue expression, posed stock smile, or another seated-at-table device scene even when the image is technically clean. Viewer-facing gaze is occasional and semantic, not required on every image; aim for 1-2 of the latest 6 human-scene covers.
- Normal Astrogen blog cover generation uses exactly one provider call for one image. Use the configured default model, candidateCount=1/n=1, aspectRatio=16:9, and request the preferred CMS target 1472x822.
- Treat image generation as a visually sensitive, non-deterministic process: preserve a good result instead of degrading it through mechanical resizing or repeated generation.
- After generation, calculate absolute width and height deviation separately against 1472x822. If both are at most 20 percent and visual QA passes, accept and preserve the original provider file. Do not upscale, stretch, destructively crop, convert only to satisfy a preferred format, or call the provider again solely for a within-tolerance dimension/format mismatch.
- Persist \`coverImageProviderCallCount\` after each paid provider call. If either dimension differs by more than 20 percent, record a runtime contract blocker for CTO. That mismatch does not authorize an automatic second generation. A new provider call requires an actual visual-quality failure plus explicit CMO recovery authorization in native \`image_recovery_review\`.
- Do not request three candidates, 2K/4K, or a premium model unless the issue contains an explicit owner/CMO recovery authorization with the reason.
- The configured default model for normal article covers is google/gemini-2.5-flash-image. Do not override it to google/gemini-3.1-flash-image, Nano Banana 2, Pro, or another premium model during normal cadence work.
- A corrected retry authorized after an \`image_quality_blocked\` comment is a new generation pass, not a re-review of the same rejected files. Dimension or output-format mismatch within the 20 percent tolerance is never \`image_quality_blocked\` and must not create a retry.
- On a hard visual QA defect (readable text, numbers, language-like glyph clutter, fabricated screen content, or an explicit visual-policy violation), persist exact evidence and transition the native case to \`image_recovery_review\`. A familiar non-linguistic pictogram or decorative strokes that form no readable letters, words, numbers, controls, or fake interface are not pseudo-writing by themselves. Do not block the image issue, ask the owner, or self-authorize a paid retry. The CMO stage may authorize only one corrective retry by setting \`coverImageRetryAuthorizationCount=1\` and \`coverImageRetryAuthorizedAt\`, or accept the same durable candidate after false-positive visual review through \`accept_existing_after_visual_review\` without a provider call.
- Before closing a retry as blocked, compare the latest operator/owner retry authorization timestamp with candidate file/work-product timestamps. If all candidates predate the authorization, generate fresh candidates with unique filenames.
- Do not satisfy a retry by re-QAing previously rejected candidates unless the issue explicitly asks for a waiver or re-review.
- Completion requires at least one accepted durable work product via \`POST /api/issues/$PAPERCLIP_TASK_ID/work-products/register-workspace-artifact\` when the accepted image is already in the execution workspace. Send \`relativePath\`, \`title\`, optional \`summary\`, \`contentType\`, \`status=ready_for_review\`, \`reviewState=approved\`, and \`isPrimary=true\`. Do not create raw \`provider=paperclip\` artifact JSON by hand for workspace files.
- The accepted image must be written to the execution workspace before creating the work product. If the image tool can return base64, use it only inside a local script, write the file, then discard raw image data from summaries and comments.
- The registration route derives the current execution workspace from the issue/run context, uploads the file as an issue attachment, and creates the canonical attachment-backed work product.
- Do not guess work-product schemas by trying multiple malformed payloads. If the typed registration route fails, record the route error and stop instead of retrying raw schema variants.
- If the fresh retry still fails QA, record \`image_quality_blocked\` with exact visual evidence and stop. Do not create another self-scheduled retry or additional paid candidate set.
`;
  }

  if (agent.name === "SEO Blog Article Layout Editor") {
    return `

## Article Workflow Invariant

- Treat the article workflow as a typed handoff pipeline, not a retry loop. Each stage consumes durable evidence from the previous stage and either completes its own gate once or records one precise blocker.
- Do not generate, repair, or re-QA cover images in the layout step. Consume the accepted cover image only from an approved Paperclip work product or CMS media evidence. If no accepted cover work product or explicit waiver exists, block as \`cover_image_missing\`.
- For CMS delivery, required inputs are: canonical draft artifact, validator evidence, layout package or articleContent JSON, accepted cover work product or waiver, CTA route decision, and exactly 3 relatedPosts when suitable published/indexable posts exist.
- For create delivery, the CMS-ready envelope also carries articleType plus cmsCategorySlug/cmsCategoryTitle from the accepted brief. These are stable policy keys, never numeric Payload relation IDs. A topic/service-specific category overrides the article-type default in /companies/astrogen/reference/cms-delivery-policy.yaml.
- Produce CMS body only as canonical \`articleContent.v1\`: top-level \`schemaVersion="articleContent.v1"\` plus \`blocks\`. Do not use legacy aliases such as \`content\`, \`columns\`, \`body/linkText\` for CTA, or free-form icon objects. The required early \`editorialCallout\` titled exactly \`Коротко\` must use variant exactly \`soft\`; \`brand\` and \`situation\` are only for later callouts.
- Required articleContent block types are exactly: \`paragraph\`, \`heading\`, \`list\`, \`editorialCallout\`, \`iconList\`, \`twoColumnText\`, and \`quietCta\`. Use the Payload CMS tool schema as the source of truth before handoff.
- Every \`paragraph\` block must include a string \`text\`. When linked \`spans\` are present, preserve them and set \`text\` to their exact concatenated visible text; a spans-only paragraph is invalid and must not leave layout validation.
- CMS delivery is draft-only. Do not publish. After creating/updating the CMS draft, refetch it and verify status, workflowStatus, cover/ogImage, CTA, editorial inserts, and relatedPosts before marking the issue done. For CMS update/refresh of an existing article, create and verify \`before-after-diff\` on your own assigned CMS issue before closeout; the CMO aggregates it into the parent.
- Do not guess Paperclip or CMS schemas by trying multiple malformed payloads. If the exact schema is unclear, inspect the relevant local schema once, perform one corrected attempt, and otherwise record a blocker with the exact missing contract.
- When a dependency is already resolved, clear the blocker in the issue state and continue the current issue; do not create duplicate article parents or child tasks for the same title.
`;
  }

  if (agent.name === "SEO CMS Technical Fixer") {
    return `

## Payload CMS Draft Contract

- For \`western_astrology_learning\`, require passed curriculum validation and MC evidence before any CMS mutation. Refuse delivery when more than the declared primary concept is taught, even if layout and Payload schema are valid; never treat CMS as the place to repair concept scope.
- CMS delivery is draft-only. Do not publish.
- Use the \`Payload CMS Create Blog Post Draft\` and \`Payload CMS Update Blog Post Draft\` tool schemas as the source of truth. Their runtime schema is canonical; do not infer fields from previous failed attempts.
- \`articleContent\` must be canonical \`articleContent.v1\`: \`schemaVersion\` plus \`blocks\`. Reject or return upstream payloads that use \`content\`, \`columns\`, \`body/linkText\` for CTA, or free-form icon objects.
- Before the first CMS mutation, deterministically verify every \`paragraph.text\` is a string and equals the concatenated visible \`spans[].text\` when spans exist. Return a mismatch to layout validation; do not use the CMS create call as the schema validator.
- Before a create/update call, verify the payload has: early \`editorialCallout\` titled \`Коротко\` with variant exactly \`soft\`, CTA as \`quietCta.title/text/linkLabel/linkUrl\`, exactly 3 \`relatedPosts\` when suitable published/indexable posts exist, accepted cover/OG image or explicit waiver, and draft workflow status. After write, count resolved relations rather than submitted IDs: an authenticated depth=1 refetch must return three distinct expanded related-post objects, each with \`_status=published\`, \`workflowStatus=approved\`, and \`noindex=false\`.
- For a general new article, pass \`articleType\` and the accepted \`cmsCategorySlug\`/\`cmsCategoryTitle\` to \`payload_cms_create_blog_post_draft\`. The company-scoped plugin resolves its configured editorial author and category relation idempotently inside that one typed operation. Do not pre-call raw CMS APIs, guess numeric author/category IDs, omit \`articleType\`, or build your own relation resolver. An explicitly scoped expert article passes its verified author relation instead.
- If the typed relation resolver fails, record \`cms_relation_policy_missing\` with exact adapter evidence. Do not make multiple malformed writes and do not ask the owner to choose a technical Payload field; repair the company CMS delivery policy and resume this same case.
- Do not trial-and-error Payload writes. If a schema validation or Payload response fails, capture the exact error, route it to the producing stage, and stop after one corrected attempt.
- After create/update, refetch the CMS draft and verify status, workflowStatus, cover/ogImage, CTA, editorial inserts, relatedPosts, and CMS admin edit URL before reporting completion. Copy the admin URL exactly from the Payload plugin response. Never construct, slugify, translate, or change its collection segment; Astrogen draft URLs must start with \`https://cms.astrogen.com.ua/admin/collections/blogPosts/\`.
- For CMS draft updates or refreshes of an existing article, create or update issue document key \`before-after-diff\` on \`$PAPERCLIP_TASK_ID\` with title \`Before/After Diff\`, format \`markdown\`, and a compact comparison of source CMS/admin URL, after/draft revision evidence, sections added/changed/unchanged, preserved fields, CMS admin review URL, and publish status. Verify it on your own issue. Mark the CMS child done when CMS and child-document gates pass. Never mutate another agent's parent issue and never block completed CMS delivery solely because parent mutation is unauthorized; CMO owns parent aggregation.
- For a draft-only update to an already published article, Payload may return the latest edited document as \`_status="draft"\` / \`workflowStatus="draft"\` while the public live article remains published. Treat this as a valid draft revision, not a blocker, when authenticated refetch proves the edited draft, the public live URL still resolves, cover/OG media, slug, metadata, canonical, noindex, relatedPosts, and unrelated fields are preserved, and the completion comment says \`draft revision created; live publish not performed\`.
`;
  }

  return "";
}

function writeInstructionsFiles() {
  assertUniqueAgentSlugs();
  for (const agent of agentDefs) {
    const dir = path.join(HOST_COMPANY_DIR, "agents", agent.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "AGENTS.md"), instructionText(agent), { mode: 0o644 });
  }
}

function baseRuntimeConfig() {
  return {
    heartbeat: {
      enabled: false,
      wakeOnDemand: true,
      skipIfNoActionableWork: true,
      maxConcurrentRuns: 1,
    },
  };
}

function adapterConfigFor(agent, secretIds) {
  const instructionsRoot = `${CONTAINER_COMPANY_DIR}/agents/${agent.slug}`;
  if (agent.adapterType === "openrouter") {
    return {
      env: {
        OPENROUTER_API_KEY: {
          type: "secret_ref",
          version: "latest",
          secretId: secretIds.openrouter_api_key_4texts,
        },
      },
      model: "anthropic/claude-sonnet-4.6",
      timeoutSec: 900,
      maxCompletionTokens: 16000,
      instructionsFilePath: `${instructionsRoot}/AGENTS.md`,
      instructionsRootPath: instructionsRoot,
      instructionsEntryFile: "AGENTS.md",
      requireArtifactOnDone: true,
    };
  }

  const env = {
    PAPERCLIP_API_URL: { type: "plain", value: "http://127.0.0.1:3100" },
  };
  if (agent.name === "SEO Blog Image Runtime Executor") {
    env.OPENROUTER_API_KEY = {
      type: "secret_ref",
      version: "latest",
      secretId: secretIds.openrouter_api_key_4images,
    };
  }
  return {
    cwd: CONTAINER_COMPANY_DIR,
    env,
    model: "gpt-5.5",
    search: agent.search,
    graceSec: 15,
    timeoutSec: 0,
    instructionsFilePath: `${instructionsRoot}/AGENTS.md`,
    instructionsRootPath: instructionsRoot,
    instructionsEntryFile: "AGENTS.md",
    instructionsBundleMode: "external",
    outputInactivityTimeoutMs: 1800000,
    dangerouslyBypassApprovalsAndSandbox: true,
  };
}

function upsertAgents(secretIds) {
  writeInstructionsFiles();
  const ids = {};
  for (const agent of agentDefs) {
    const existing = psql(
      CLEAN_DB,
      `select id from agents where company_id='${CLEAN_COMPANY_ID}' and name=${q(agent.name)} order by created_at limit 1;`,
    ).trim();
    ids[agent.name] = existing || randomUUID();
  }

  for (const agent of agentDefs) {
    const reportsTo = agent.reportsTo ? ids[agent.reportsTo] : null;
    psql(
      CLEAN_DB,
      `
        insert into agents (
          id, company_id, name, role, title, status, reports_to, capabilities,
          adapter_type, adapter_config, runtime_config, permissions, icon,
          metadata, updated_at
        ) values (
          ${qUuid(ids[agent.name])}, ${qUuid(CLEAN_COMPANY_ID)}, ${q(agent.name)},
          ${q(agent.role)}, ${q(agent.title)}, 'idle', ${qUuid(reportsTo)},
          ${q(agent.charter)}, ${q(agent.adapterType)}, ${qJson(adapterConfigFor(agent, secretIds))},
          ${qJson(baseRuntimeConfig())}, ${qJson({ canCreateAgents: agent.canCreateAgents })},
          ${q(agent.icon)}, ${qJson({ bootstrap: "phase40", desiredState: "active" })}, now()
        )
        on conflict (id) do update set
          role=excluded.role,
          title=excluded.title,
          status='idle',
          reports_to=excluded.reports_to,
          capabilities=excluded.capabilities,
          adapter_type=excluded.adapter_type,
          adapter_config=excluded.adapter_config,
          runtime_config=excluded.runtime_config,
          permissions=excluded.permissions,
          icon=excluded.icon,
          metadata=excluded.metadata,
          pause_reason=NULL,
          paused_at=NULL,
          error_reason=NULL,
          updated_at=now();
      `,
    );
  }
  return ids;
}

function upsertResendEmailSecretBindings(secretIds, pluginIds) {
  const resendSecretId = secretIds["resend-api-key"];
  const emailPluginId = pluginIds["paperclip.email-notifications"];
  if (!resendSecretId || !emailPluginId) return;

  psql(
    CLEAN_DB,
    `
      insert into company_secret_bindings (
        company_id, secret_id, target_type, target_id, config_path,
        version_selector, required, label, created_at, updated_at
      ) values (
        ${qUuid(CLEAN_COMPANY_ID)}, ${qUuid(resendSecretId)}, 'plugin',
        ${q(emailPluginId)}, 'resendApiKeySecretRef', 'latest', true,
        'Resend API key for company-scoped email notifications and weekly SEO reports',
        now(), now()
      )
      on conflict (company_id, target_type, target_id, config_path) do update set
        secret_id=excluded.secret_id,
        version_selector=excluded.version_selector,
        required=excluded.required,
        label=excluded.label,
        updated_at=now();
    `,
  );

}

function upsertSerperAgentToolsSecretBindings(secretIds, pluginIds, agentIds) {
  const serperSecretId = secretIds["serper-api-key"];
  const serperPluginId = pluginIds["paperclip.serper-agent-tools"];
  if (!serperSecretId || !serperPluginId) return;

  const pluginConfigPath = "serperApiKeySecretRef";
  psql(
    CLEAN_DB,
    `
      insert into company_secret_bindings (
        company_id, secret_id, target_type, target_id, config_path,
        version_selector, required, label, created_at, updated_at
      ) values (
        ${qUuid(CLEAN_COMPANY_ID)}, ${qUuid(serperSecretId)}, 'plugin',
        ${q(serperPluginId)}, ${q(pluginConfigPath)}, 'latest', true,
        'Serper API key for paperclip.serper-agent-tools plugin config',
        now(), now()
      )
      on conflict (company_id, target_type, target_id, config_path) do update set
        secret_id=excluded.secret_id,
        version_selector=excluded.version_selector,
        required=excluded.required,
        label=excluded.label,
        updated_at=now();
    `,
  );

  const serperAgentNames = [
    "SEO Performance Analyst",
    "SEO Blog Content Strategist",
    "SEO Blog Content Plan Validator",
    "MKT Growth Strategy Architect",
    "MKT Competitive Intelligence Analyst",
  ];
  for (const agentName of serperAgentNames) {
    const agentId = agentIds[agentName];
    if (!agentId) continue;
    psql(
      CLEAN_DB,
      `
        insert into company_secret_bindings (
          company_id, secret_id, target_type, target_id, config_path,
          version_selector, required, label, created_at, updated_at
        ) values (
          ${qUuid(CLEAN_COMPANY_ID)}, ${qUuid(serperSecretId)}, 'agent',
          ${q(agentId)}, ${q(pluginConfigPath)}, 'latest', true,
          ${q(`${agentName}: Serper API key for bounded SERP evidence tools`)},
          now(), now()
        )
        on conflict (company_id, target_type, target_id, config_path) do update set
          secret_id=excluded.secret_id,
          version_selector=excluded.version_selector,
          required=excluded.required,
          label=excluded.label,
          updated_at=now();
      `,
    );
  }
}

function upsertWinningStructureSecretBinding(secretIds, pluginIds) {
  const secretId = secretIds["winning-structure-mcp-token"];
  const pluginId = pluginIds["paperclip.winning-structure-mcp-agent-tools"];
  if (!secretId || !pluginId) return;

  psql(
    CLEAN_DB,
    `
      insert into company_secret_bindings (
        company_id, secret_id, target_type, target_id, config_path,
        version_selector, required, label, created_at, updated_at
      ) values (
        ${qUuid(CLEAN_COMPANY_ID)}, ${qUuid(secretId)}, 'plugin',
        ${q(pluginId)}, 'winningStructureMcpTokenSecretRef', 'latest', true,
        'Winning Structure MCP bearer token for private Astrogen article analysis',
        now(), now()
      )
      on conflict (company_id, target_type, target_id, config_path) do update set
        secret_id=excluded.secret_id,
        version_selector=excluded.version_selector,
        required=excluded.required,
        label=excluded.label,
        updated_at=now();
    `,
  );
}

function upsertSemanticCoreSecretBinding(secretIds, pluginIds) {
  const secretId = secretIds["semantic-core-mcp-token"];
  const pluginId = pluginIds["paperclip.semantic-core-mcp-agent-tools"];
  if (!secretId || !pluginId) return;

  psql(
    CLEAN_DB,
    `
      insert into company_secret_bindings (
        company_id, secret_id, target_type, target_id, config_path,
        version_selector, required, label, created_at, updated_at
      ) values (
        ${qUuid(CLEAN_COMPANY_ID)}, ${qUuid(secretId)}, 'plugin',
        ${q(pluginId)}, 'semanticCoreMcpTokenSecretRef', 'latest', true,
        'Semantic Core MCP bearer token for private Astrogen demand research',
        now(), now()
      )
      on conflict (company_id, target_type, target_id, config_path) do update set
        secret_id=excluded.secret_id,
        version_selector=excluded.version_selector,
        required=excluded.required,
        label=excluded.label,
        updated_at=now();
    `,
  );
}

function ensureGoalAndProject(agentIds) {
  let goalId = psql(
    CLEAN_DB,
    `select id from goals where company_id='${CLEAN_COMPANY_ID}' and title='Traffic Growth / SEO-GEO Operating Loop' order by created_at limit 1;`,
  ).trim();
  if (!goalId) {
    goalId = randomUUID();
    psql(
      CLEAN_DB,
      `
        insert into goals (id, company_id, title, description, level, status, owner_agent_id)
        values (${qUuid(goalId)}, ${qUuid(CLEAN_COMPANY_ID)}, 'Traffic Growth / SEO-GEO Operating Loop',
          'Primary Astrogen clean operating goal for additional traffic, SEO/GEO optimization, and article production.',
          'company', 'active', ${qUuid(agentIds["Chief Marketing Officer"])});
      `,
    );
  } else {
    psql(
      CLEAN_DB,
      `
        update goals set status='active', owner_agent_id=${qUuid(agentIds["Chief Marketing Officer"])}, updated_at=now()
        where id=${qUuid(goalId)};
      `,
    );
  }

  let projectId = psql(
    CLEAN_DB,
    `select id from projects where company_id='${CLEAN_COMPANY_ID}' and name='Astrogen Growth OS' order by created_at limit 1;`,
  ).trim();
  if (!projectId) {
    projectId = randomUUID();
    psql(
      CLEAN_DB,
      `
        insert into projects (id, company_id, goal_id, name, description, status, lead_agent_id, color, icon)
        values (${qUuid(projectId)}, ${qUuid(CLEAN_COMPANY_ID)}, ${qUuid(goalId)}, 'Astrogen Growth OS',
          'Clean manifest-driven Astrogen SEO/GEO/content operating system.',
          'active', ${qUuid(agentIds["Chief Marketing Officer"])}, '#2563eb', 'target');
      `,
    );
  } else {
    psql(
      CLEAN_DB,
      `
        update projects set goal_id=${qUuid(goalId)}, status='active',
          lead_agent_id=${qUuid(agentIds["Chief Marketing Officer"])}, updated_at=now()
        where id=${qUuid(projectId)};
      `,
    );
  }
  return { goalId, projectId };
}

function upsertRoutines(agentIds, projectId, goalId) {
  const created = [];
  for (const item of routineDefs) {
    // Routine variables are user-supplied template inputs, not a policy/config
    // store. Operational limits belong in the typed contract and dedicated
    // state, otherwise Paperclip correctly strips unused definitions or rejects
    // them as invalid environment bindings.
    const routineVariables = [];
    const routineEnv = null;
    let routineId = psql(
      CLEAN_DB,
      `select id from routines where company_id='${CLEAN_COMPANY_ID}' and title=${q(item.title)} order by created_at limit 1;`,
    ).trim();
    if (!routineId) routineId = randomUUID();
    psql(
      CLEAN_DB,
      `
        insert into routines (
          id, company_id, project_id, goal_id, title, description, assignee_agent_id,
          priority, status, concurrency_policy, catch_up_policy, variables, env,
          origin_kind, origin_id, updated_at
        ) values (
          ${qUuid(routineId)}, ${qUuid(CLEAN_COMPANY_ID)}, ${qUuid(projectId)}, ${qUuid(goalId)},
          ${q(item.title)}, ${q(item.description)}, ${qUuid(agentIds[item.owner])}, 'medium',
          ${q(item.status)}, ${q(item.concurrencyPolicy)}, ${q(item.catchUpPolicy)},
          ${qJson(routineVariables)},
          ${qJson(routineEnv)},
          'phase40_manifest', ${q(item.workflowKey)}, now()
        )
        on conflict (id) do update set
          project_id=excluded.project_id,
          goal_id=excluded.goal_id,
          description=excluded.description,
          assignee_agent_id=excluded.assignee_agent_id,
          status=excluded.status,
          concurrency_policy=excluded.concurrency_policy,
          catch_up_policy=excluded.catch_up_policy,
          variables=excluded.variables,
          env=excluded.env,
          updated_at=now();
      `,
    );

    let triggerId = psql(
      CLEAN_DB,
      `select id from routine_triggers where company_id='${CLEAN_COMPANY_ID}' and routine_id=${qUuid(routineId)} and label=${q(item.timezone)} order by created_at limit 1;`,
    ).trim();
    if (!triggerId) triggerId = randomUUID();
    psql(
      CLEAN_DB,
      `
        insert into routine_triggers (
          id, company_id, routine_id, kind, label, enabled, cron_expression, timezone, updated_at
        ) values (
          ${qUuid(triggerId)}, ${qUuid(CLEAN_COMPANY_ID)}, ${qUuid(routineId)}, 'schedule',
          ${q(item.timezone)}, ${item.triggerEnabled ? "true" : "false"}, ${q(item.cron)}, ${q(item.timezone)}, now()
        )
        on conflict (id) do update set
          enabled=excluded.enabled,
          cron_expression=excluded.cron_expression,
          timezone=excluded.timezone,
          updated_at=now();
      `,
    );

    const snapshot = {
      version: 1,
      routine: {
        id: routineId,
        companyId: CLEAN_COMPANY_ID,
        projectId,
        goalId,
        parentIssueId: null,
        title: item.title,
        description: item.description,
        assigneeAgentId: agentIds[item.owner],
        priority: "medium",
        status: item.status,
        concurrencyPolicy: item.concurrencyPolicy,
        catchUpPolicy: item.catchUpPolicy,
        variables: routineVariables,
        env: routineEnv,
      },
      triggers: [
        {
          id: triggerId,
          kind: "schedule",
          label: item.timezone,
          enabled: item.triggerEnabled,
          cronExpression: item.cron,
          timezone: item.timezone,
          publicId: null,
          signingMode: null,
          replayWindowSec: null,
        },
      ],
    };
    const latestMatches = psql(
      CLEAN_DB,
      `select coalesce((
        select rr.snapshot = ${qJson(snapshot)}
        from routine_revisions rr
        join routines r on r.latest_revision_id=rr.id
        where r.id=${qUuid(routineId)}
      ), false);`,
    ).trim() === "t";
    if (!latestMatches) {
      const revisionId = randomUUID();
      const revisionNumber = Number(psql(
        CLEAN_DB,
        `select coalesce(max(revision_number), 0) + 1 from routine_revisions where routine_id=${qUuid(routineId)};`,
      ).trim());
      psql(
        CLEAN_DB,
        `
        insert into routine_revisions (
          id, company_id, routine_id, revision_number, title, description,
          snapshot, change_summary, created_at
        ) values (
          ${qUuid(revisionId)}, ${qUuid(CLEAN_COMPANY_ID)}, ${qUuid(routineId)}, ${revisionNumber},
          ${q(item.title)}, ${q(item.description)}, ${qJson(snapshot)},
          'Manifest reconciliation via Phase 46 canonical contract', now()
        );

        update routines
        set latest_revision_id=${qUuid(revisionId)}, latest_revision_number=${revisionNumber}, updated_at=now()
        where id=${qUuid(routineId)};
      `,
      );
    }
    created.push(item.title);
  }
  return created;
}

function currentOldIssueInventoryMarkdown() {
  const rows = psqlJson(
    OLD_DB,
    `
      select i.identifier, i.status, i.priority, i.title, coalesce(a.name, '') as assignee
      from issues i
      left join agents a on a.id=i.assignee_agent_id
      where i.company_id='${OLD_COMPANY_ID}'
        and i.status in ('todo','in_progress','in_review')
        and i.hidden_at is null
      order by case i.status when 'in_progress' then 1 when 'in_review' then 2 when 'todo' then 3 else 9 end, i.updated_at desc
    `,
  );
  if (rows.length === 0) return "No old live todo/in_progress/in_review issues were found.";
  return rows
    .map((row) => `- ${row.identifier} (${row.status}, ${row.priority}) ${row.title}${row.assignee ? ` - ${row.assignee}` : ""}`)
    .join("\n");
}

function nextIssueInsertSql({ id, parentId, projectId, goalId, title, description, status, priority, assigneeAgentId, originId, originFingerprint }) {
  return `
    with current_max as (
      select coalesce(max(issue_number), 0) as max_num from issues where company_id=${qUuid(CLEAN_COMPANY_ID)}
    ), updated_company as (
      update companies
      set issue_counter = greatest(issue_counter, (select max_num from current_max)) + 1
      where id=${qUuid(CLEAN_COMPANY_ID)}
      returning issue_counter, issue_prefix
    )
    insert into issues (
      id, company_id, project_id, goal_id, parent_id, title, description,
      status, priority, assignee_agent_id, issue_number, identifier,
      origin_kind, origin_id, origin_fingerprint, created_at, updated_at
    )
    select ${qUuid(id)}, ${qUuid(CLEAN_COMPANY_ID)}, ${qUuid(projectId)}, ${qUuid(goalId)}, ${qUuid(parentId)},
      ${q(title)}, ${q(description)}, ${q(status)}, ${q(priority)}, ${qUuid(assigneeAgentId)},
      issue_counter, issue_prefix || '-' || issue_counter,
      'phase40_transition', ${q(originId)}, ${q(originFingerprint || originId)}, now(), now()
    from updated_company
    returning id || E'\\t' || identifier;
  `;
}

function upsertIssue({ parentId = null, projectId, goalId, title, description, status = "todo", priority = "medium", assigneeAgentId, originId, originFingerprint }) {
  const existing = psqlJson(
    CLEAN_DB,
    `
      select id, identifier from issues
      where company_id='${CLEAN_COMPANY_ID}'
        and origin_kind='phase40_transition'
        and origin_id=${q(originId)}
        and hidden_at is null
      order by created_at
      limit 1
    `,
  )[0];
  if (existing) {
    psql(
      CLEAN_DB,
      `
        update issues set
          project_id=${qUuid(projectId)},
          goal_id=${qUuid(goalId)},
          parent_id=${qUuid(parentId)},
          title=${q(title)},
          description=${q(description)},
          status=${q(status)},
          priority=${q(priority)},
          assignee_agent_id=${qUuid(assigneeAgentId)},
          origin_fingerprint=${q(originFingerprint || originId)},
          updated_at=now()
        where id=${qUuid(existing.id)};
      `,
    );
    return existing;
  }
  const id = randomUUID();
  const raw = psql(CLEAN_DB, nextIssueInsertSql({
    id,
    parentId,
    projectId,
    goalId,
    title,
    description,
    status,
    priority,
    assigneeAgentId,
    originId,
    originFingerprint,
  })).trim();
  const [createdId, identifier] = raw.split("\t");
  return { id: createdId, identifier };
}

function upsertTransitionPack(agentIds, projectId, goalId) {
  const inventory = currentOldIssueInventoryMarkdown();
  const parentDescription = `## Objective

Clean Astrogen transition pack from old live Paperclip.

This is selective by design. The clean instance must not bulk-import historical done/cancelled/stale blocked work or old runtime-restart issues.

## Old live active inventory

${inventory}

## Carry-forward lanes

- AST-1956: reconcile missed article demand through the clean article slot allocator with bounded article-only catch-up. No broad automatic catch-up storm.
- AST-2758: review Solar SEO planning gate in the clean workflow context.
- AST-1911: keep Collaborator publisher catalog access parked until backlink workflow enablement.
- AST-1561: preserve the human-decision object/writeback architecture gap as a clean workflow gap.

## Not migrated by default

Old runtime reload/restart/regression tasks stay out of the clean Astrogen traffic bootstrap unless CTO opens a separate Paperclip engineering issue.`;

  const parent = upsertIssue({
    projectId,
    goalId,
    title: "Astrogen clean transition pack",
    description: parentDescription,
    status: "backlog",
    priority: "high",
    assigneeAgentId: null,
    originId: "parent",
  });

  const children = [
    {
      originId: "article-catchup",
      title: "Reconcile missed article demand with bounded article catch-up",
      description: "Carry-forward from AST-1956. Decide which missed article slots still matter, then feed only approved demand into the clean article slot allocator with a count cap and budget. Article cadence may use bounded catch-up; do not enable broad catch-up for other expensive routines.",
      status: "backlog",
      priority: "high",
      assigneeAgentId: null,
    },
    {
      originId: "solar-seo-gate",
      title: "Review Solar SEO planning gate for clean workflow import",
      description: "Carry-forward from AST-2758. Recreate the owner approval only if the Solar SEO planning gate is still strategically current in the clean workflow.",
      status: "backlog",
      priority: "medium",
      assigneeAgentId: null,
    },
    {
      originId: "collaborator-access",
      title: "Park Collaborator publisher catalog access before backlink workflow enablement",
      description: "Carry-forward from AST-1911. Collaborator API key exists, but publisher catalog access was declined by provider. Keep backlink/provider workflow parked until explicit access and budget approval.",
      status: "backlog",
      priority: "medium",
      assigneeAgentId: null,
    },
    {
      originId: "human-decision-object",
      title: "Preserve human-decision object and Telegram writeback gap",
      description: "Carry-forward from AST-1561. Track the clean workflow need for canonical pending decision objects plus Telegram proof/writeback. This is architecture work, not a current owner question.",
      status: "backlog",
      priority: "medium",
      assigneeAgentId: null,
    },
  ].map((child) => upsertIssue({
    ...child,
    parentId: parent.id,
    projectId,
    goalId,
  }));
  return { parent, children };
}

function verifySummary() {
  const counts = psqlJson(
    CLEAN_DB,
    `
      select 'agents' as key, count(*)::int as count from agents where company_id='${CLEAN_COMPANY_ID}'
      union all select 'active_secrets', count(*)::int from company_secrets where company_id='${CLEAN_COMPANY_ID}' and status='active' and deleted_at is null
      union all select 'ready_plugins', count(*)::int from plugins where status='ready'
      union all select 'disabled_plugins', count(*)::int from plugins where status='disabled'
      union all select 'paused_routines', count(*)::int from routines where company_id='${CLEAN_COMPANY_ID}' and status='paused'
      union all select 'enabled_triggers', count(*)::int from routine_triggers where company_id='${CLEAN_COMPANY_ID}' and enabled=true
      union all select 'idle_heartbeat_agents', count(*)::int from agents where company_id='${CLEAN_COMPANY_ID}' and runtime_config #>> '{heartbeat,enabled}' = 'true'
    `,
  );
  const unsafeRoutines = psqlJson(
    CLEAN_DB,
    `
      select title, concurrency_policy, catch_up_policy
      from routines
      where company_id='${CLEAN_COMPANY_ID}'
        and (
          concurrency_policy='always_enqueue'
          or (
            catch_up_policy='enqueue_missed_with_cap'
            and origin_id <> 'article_cadence'
          )
        )
    `,
  );
  return { counts, unsafeRoutines };
}

function restartCleanApp() {
  const composeDir = "/home/paperclip/apps/paperclip-astrogen-clean";
  const [cmd, ...prefix] = dockerBaseArgs();
  run(cmd, [...prefix, "compose", "-p", "paperclip-astrogen-clean", "-f", `${composeDir}/docker-compose.yml`, "restart", "app"], {
    maxBuffer: 8 * 1024 * 1024,
  });
}

function disableTelegramProactiveWatches() {
  psql(
    CLEAN_DB,
    `
      with telegram as (
        select id from plugins where plugin_key='paperclip-plugin-telegram'
      )
      update plugin_jobs j
      set status='paused', next_run_at=NULL, updated_at=now()
      from telegram
      where j.plugin_id=telegram.id
        and j.job_key='check-watches';

      with telegram as (
        select id from plugins where plugin_key='paperclip-plugin-telegram'
      )
      update plugin_state s
      set value_json='[]'::jsonb, updated_at=now()
      from telegram
      where s.plugin_id=telegram.id
        and s.state_key like 'watches_%';
    `,
  );
}

function main() {
  const inventory = loadInventory();
  if (DRY_RUN) {
    console.log(JSON.stringify({
      mode: "dry-run",
      cleanCounts: inventory.cleanCounts,
      oldSecretsFound: inventory.oldSecrets.length,
      oldOpenIssues: inventory.oldOpenIssues.length,
      planned: {
        secretsToMigrate: secretDefs.length,
        activePlugins: pluginDefs.filter((item) => item.active).length,
        disabledPlugins: pluginDefs.filter((item) => !item.active).length,
        activeAgents: agentDefs.length,
        pausedRoutines: routineDefs.length,
        transitionChildren: 4,
      },
    }, null, 2));
    return;
  }

  const backupPath = backupCleanDb();
  syncCodexRuntimeAuth();
  const secrets = migrateSecrets();
  const missingRequired = secretDefs
    .filter((item) => item.tier === "required" && !secrets.secretIds[item.key])
    .map((item) => item.key);
  if (missingRequired.length > 0) {
    throw new Error(`Required clean secret refs were not created: ${missingRequired.join(", ")}`);
  }
  const plugins = upsertPlugins(secrets.secretIds);
  const agentIds = upsertAgents(secrets.secretIds);
  upsertResendEmailSecretBindings(secrets.secretIds, plugins.pluginIds);
  upsertSerperAgentToolsSecretBindings(secrets.secretIds, plugins.pluginIds, agentIds);
  upsertWinningStructureSecretBinding(secrets.secretIds, plugins.pluginIds);
  upsertSemanticCoreSecretBinding(secrets.secretIds, plugins.pluginIds);
  const { goalId, projectId } = ensureGoalAndProject(agentIds);
  const routines = upsertRoutines(agentIds, projectId, goalId);
  const transition = upsertTransitionPack(agentIds, projectId, goalId);
  restartCleanApp();
  disableTelegramProactiveWatches();
  const verification = verifySummary();

  console.log(JSON.stringify({
    mode: "apply",
    backupPath,
    codexRuntimeAuthSynced: true,
    migratedSecrets: secrets.migrated.length,
    missingOrInactiveSecrets: secrets.missing,
    pluginsReady: plugins.ready.length,
    pluginsDisabled: plugins.disabled.length,
    agents: agentDefs.length,
    routinesPaused: routines.length,
    transitionParent: transition.parent.identifier,
    transitionChildren: transition.children.map((child) => child.identifier),
    telegramProactiveWatches: "disabled",
    verification,
  }, null, 2));
}

const isDirectExecution = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectExecution) {
  try {
    main();
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
