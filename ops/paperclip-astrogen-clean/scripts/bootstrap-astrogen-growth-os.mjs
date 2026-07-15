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
    active: false,
    installOrder: 80,
    disabledReason: "Requires packaging smoke before activation.",
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
  role("SEO Blog Article Writer (ChatGPT)", "researcher", "Fallback SEO Blog Article Writer", "MKT Blog Brief Strategist", "brain", true, false, "Fallback writer used only for confirmed Claude/OpenRouter blockers or explicit CMO recovery."),
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

Capacity and selection:
- Target one new CMS draft per Europe/Kiev day. Explicit article-only catch-up is bounded to 3 slots per run.
- Productive WIP cap is 3 article cases without an unresolved blocker. Blocked or external-wait cases do not consume productive WIP and never freeze a different topic.
- Read ready topic cases, choose at most one deterministically by human priority, demand evidence, freshness, and oldest ready timestamp. Never invent a topic inside this routine.

Atomic dispatch:
- Call \`POST /api/cases/{topicCaseId}/breakdown\` once with one item. The ready stage configuration must target \`astrogen-article-production\` stage \`opportunity\`, use piece noun \`article\`, and advance the topic to \`reserved\`.
- The item key is \`{topicKey}:reservation-v{topicCaseVersion}\`. The ready topic case version is the reservation generation: a retry of the same generation reuses one child, while a topic released after cancellation has a newer version and creates a new child instead of reusing the cancelled case. Its fields include operation=create, targetQueryCluster from queryCluster, blockerClass=null, nextReviewAt=null, attemptCount=0, cmsDraftId=null, cmsAdminUrl=null, and telegramMessageId=null. Inherited topic fields provide topicKey, titleUk, ctaRoute, and evidenceRefs.
- Treat the breakdown response as the reservation proof. Record the returned child article case id as consumingArticleCaseId and set a bounded reservationExpiresAt if the reserved-stage automation has not already done so.
- Breakdown request keys and native case keys are the per-reservation-generation idempotency boundary. Never create a legacy article parent, brief child, writer child, refill child, or recovery issue from the allocator.

Inventory refill:
- When ready inventory is below 3, ingest or update one canonical \`astrogen-growth-actions\` case with fingerprint \`topic-inventory-refill:{ISO-week}\`; do not create a blocked issue chain.
- The growth case delegates evidence-backed candidate generation to CMO and content specialists. Weekly CMO portfolio planning must ingest 3-10 candidate topic cases into \`astrogen-topic-inventory\`; candidate/evidence_ready stage automations validate them.
- If zero ready topics exist, the allocator still creates or updates that refill growth case and exits with the native case as a live continuation. \`no-safe-topic\` is never terminal success by itself.
- Missing Payload, GSC/GA4, semantic-core, CrawlObserver, or pipeline access becomes a typed blocker on the refill growth case. It does not stop other growth or article cases and is not sent to the owner as a topic-choice request.

Article delivery invariants:
- Claude is the primary writer; ChatGPT is fallback only after a durable Claude/provider/protocol blocker or explicit CMO recovery decision.
- Image stage makes exactly one provider call, requests 1472x822, and preserves a visually accepted original when each axis differs by at most 20 percent. No retry, upscale, crop, or conversion solely for a within-tolerance mismatch.
- Delivered requires accepted cover or explicit waiver, authenticated CMS draft/admin URL, verified articleContent with Коротко, CTA and exactly three suitable relatedPosts, and one gender-neutral Telegram message containing only title and CMS admin edit URL with delivery proof.
- CMS remains draft-only. Generic technical Telegram notifications and proactive watches remain off.

Completion gate:
- Done only when one native article case is live from a successful breakdown, the current daily/catch-up quota is already satisfied, productive WIP is full, or one canonical refill growth case is live for an empty/low inventory.
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
- Every finding follows discovered -> evidence_ready -> ownership_review -> action_selected -> delegated -> verified -> measured.
- Combine GSC query/page evidence, semantic-core geo frequency, Payload/live coverage, CrawlObserver, current SERP evidence, and existing action history.
- Resolve query-to-URL ownership and cannibalization before action selection.
- Select exactly one action: new_article, refresh, merge, reposition, internal_link, technical, or no_action.
- Only a delegated opportunity with the durable decision selectedAction=new_article may call native breakdown into topic inventory. The breakdown waits for the topic/article child outcome before verification. All other actions use linked growth execution cases.

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
- Ingest or update 3-10 evidence-backed \`astrogen-search-demand-opportunities\` cases at \`discovered\` using stable fingerprints. Never ingest topic candidates directly.
- Drive each opportunity through ownership review and one action selection. Only guarded \`new_article\` breakdown may create a native topic candidate.
- Maintain a target of 10 validated ready topics and a low-water mark of 3. Candidate and evidence-ready stage automations own enrichment and duplicate/cannibalization validation; CMO does not mark a candidate ready by narrative assertion.
- Manage delegated topic generation through the final validator outcomes. Candidate submissions and case IDs are progress, not inventory success; candidate, evidence_ready, consumed, rejected_duplicate and narrative lists do not count as ready inventory.
- Each action names the business/search outcome, evidence, accountable manager, specialist executor, completion proof, and review window.
- Delegate accepted actions immediately or link the existing canonical execution issue/case.
- Record ready-topic inventory level, productive article WIP, blocked article count, CMS drafts delivered in the completed week, and SEO actions completed.

Completion gate:
- A report alone is not completion. Every accepted action is delegated or linked to an executable existing path; blocked items have an owner and recovery/external-wait class; unrelated lanes continue.
- Content-supply completion requires at least 3 current non-retired topic cases actually at ready. If the count is lower, one canonical refill case or search-demand opportunity must remain nonterminal with an accountable specialist and nextReviewAt.
- Native topic case ids in candidate, evidence_ready, consumed, rejected_duplicate, or a list in comments/document never satisfy the ready-inventory gate.
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

  monthlyTrendDiscovery: `Purpose: produce evidence-backed Astrogen demand and market hypotheses for CMO portfolio review without creating article work directly.

Inputs and bounds:
- Use completed-period GSC/GA4 and site-search changes, semantic-core evidence, current topic inventory, verified Astrogen product/service changes, approved SERP/competitor evidence, and time-stamped public or community signals.
- Inspect at most 20 compact candidate signals and retain at most 8 hypotheses.
- Require two independent signals, or one first-party signal with a concrete validation plan.
- Every hypothesis has a stable fingerprint, audience problem, evidence refs, first-observed date, expected horizon, business fit, confidence band, alternative explanation, falsifier, next validation step, expiry, and observe/validate/reject/expired status.

Execution boundary:
- CMO manages hypotheses and delegates validation; CMO does not perform specialist research or create article tasks here.
- A hypothesis cannot enter topic inventory until normal evidence and ownership validation pass.
- Do not use model memory as current trend evidence, mutate CMS, publish, generate images, or send Telegram.

Completion gate:
- Store a typed monthly hypothesis document and route only concrete bounded validation work, or record explicit no-supported-trend evidence. Never close with an article task created from an unvalidated hypothesis.`,

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
    activation: "controlled_target_1_after_phase41",
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
  routine("Monthly Astrogen trend discovery", "Chief Marketing Officer", "0 8 1 * *", routineContracts.monthlyTrendDiscovery, "coalesce_if_active", "monthly_trend_discovery", {
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

function role(name, roleName, title, reportsTo, icon, search, canCreateAgents, charter, adapterType = "codex_local") {
  const slug = name
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return { name, role: roleName, title, reportsTo, icon, search, canCreateAgents, charter, adapterType, slug };
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
    config.requestTimeoutMs = 60000;
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
  if (pluginKey === "paperclip.winning-structure-mcp-agent-tools") {
    config.winningStructureMcpTokenSecretRef = secretIds["winning-structure-mcp-token"];
    config.winningStructureMcpUrl = "http://100.98.5.50:8000/mcp";
    config.allowedClientKeysCsv = "astrogen-ukraine";
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
- Missed article slots are not automatically backfilled.
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
- Article lifecycle belongs to CMO and the \`astrogen-article-production\` pipeline. Do not create article stage/recovery issue trees or perform image generation, CMS mutation, Telegram delivery, SEO analysis, or provider calls.
`;
  }

  if (agent.name === "Chief Marketing Officer") {
    return `

## Native Article And Topic Pipeline Control

- CMO controls portfolio choice and delivery gates but does not perform SERP research, writing, image generation, CMS mutation, or runtime repair.
- Create every new specialist issue for a native case with \`pipelineCaseLink.caseId\` and a stable purpose-based \`pipelineCaseLink.requestKey\` on the issue-create request. This atomically creates the issue and its typed work link. The standalone issue-link route is only for pre-existing or migrated work.
- After creating or linking work, re-read case-visible work products before deciding the stage. Positive completion proof routes to verify; a durable blocker artifact routes to external_wait with blockerClass and nextReviewAt; only a missing artifact may create or reuse one bounded evidence-recovery issue. Never build a recovery chain or leave a case in executing after a durable blocker is visible.
- \`astrogen-topic-inventory\` and \`astrogen-article-production\` cases are the source of truth. Do not create article parent/stage/recovery issue trees for recurring cadence.
- The scheduled allocator selects at most one topic at \`ready\` and calls \`POST /api/cases/{topicCaseId}/breakdown\` with one item. Native breakdown creates/reuses the article child at \`opportunity\` and advances the topic to \`reserved\`.
- The ready stage has no on-enter automation. Never reserve a topic merely because validation moved it to ready; only the scheduled allocator dispatches capacity.
- Native article stage automations own SERP check, brief, Claude draft, validation, humanizing, layout, one-call image generation, CMS draft, and CMO delivery. Recovery resumes the same case and stage.
- Phase 47 replaces the standalone SERP gate with the native \`strategy_input -> winning_structure -> structure_decision | structure_review\` path. CMO manages authority and portfolio continuity but never performs MCP research or writes the article.
- A paused Winning Structure run blocks only its article case and does not consume productive WIP. Low-risk decisions may be submitted only when the option is explicitly authorized by the pipeline contract. Accepting cannibalization risk, merging/consolidating, reassigning ownership, cancelling a run, removing the primary keyword, or changing the canonical owner requires an explicit human decision.
- For an added-value pause, CMO may authorize only a concrete reader-facing asset from /companies/astrogen/reference/article-value-system.yaml with an assigned producing role, validation method, observable acceptance criteria, and due_before_publication=true. Semantic-core/ownership/tool access, generic research, more text, keywords, or a table/FAQ/checklist/CTA by itself is not reader value.
- Delivery is terminal only at article stage \`delivered\` with accepted cover or waiver, authenticated CMS admin URL, verified content gates, and gender-neutral Telegram delivery proof. CMS remains draft-only.
- When ready inventory is below 3, create or update one \`astrogen-growth-actions\` case with fingerprint \`topic-inventory-refill:{ISO-week}\`. Do not create a refill issue chain.
- Weekly portfolio planning ingests 3-10 evidence-backed topic cases at \`candidate\` with stable topic keys. A content-plan document without native topic case ids is incomplete.
- After delegation, follow every candidate through enrichment and validation. Do not close the portfolio or refill because three candidates were submitted; re-read the live topic pipeline and count only non-retired cases at \`ready\`.
- If validation leaves fewer than 3 ready topics, keep or return the canonical refill growth case to \`executing\`, delegate a bounded continuation to the existing specialist path, and set \`nextReviewAt\`. The native verify gate prevents false \`measured\` completion.
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
- Include every exact affected public URL. For each URL provide the current problem, required code/configuration changes, and post-deploy verification steps.
- Include shared repository/deploy/sitemap actions and the source Paperclip issue. A link to an issue or attachment does not replace the URL list in the email.
- Do not use \`email-notification-send\` or a generic incident summary for developer implementation requests.
- If the exact affected scope is not known, continue deterministic evidence collection or keep the case in technical investigation. Do not send an incomplete handoff to the owner.
`;
  }

  if (agent.name === "SEO Blog Content Strategist") {
    return `

## Topic Inventory Refill Contract

- Own evidence enrichment for \`astrogen-search-demand-opportunities\` and guarded topic candidates delegated from approved \`new_article\` actions.
- Use compact evidence from Payload CMS, GSC/GA4, semantic-core
  inventory/review, CrawlObserver/internal-link data, active Paperclip issues,
  and consumed topic history.
- Ingest or update 3-10 native search-demand cases at \`discovered\` using stable opportunity fingerprints. Never ingest topic candidates directly. Enrich only a topic candidate created by guarded native breakdown after \`selectedAction=new_article\`, then transition it to \`evidence_ready\`, \`waiting_evidence\`, or \`expired\`; the validator alone moves evidence-ready cases to \`ready\`, \`needs_owner_direction\`, or \`rejected_duplicate\`.
- Every ready topic must include topicKey, Ukrainian working title, primary
  query, supporting queries, intent, funnel role, audience segment, target
  service/route relationship, evidence references, CMS duplicate check, active
  issue duplicate check, cannibalization assessment, CTA target, internal link
  targets, forbidden claims/tone constraints, content role, demand class, SERP
  grouping status, SERP value-gap requirement, and why it is safe now.
- If SERP evidence is not checked during refill, set
  \`serpGroupingStatus=not_checked\` and \`serpValueGapRequired=true\` instead
  of pretending the topic is fully brief-ready.
- Do not invent broad topics when evidence tools are unavailable. Attach the exact typed runtime/plugin blocker to the affected native topic/refill case; unrelated topic and growth cases continue.

## Winning Structure Strategy Input Contract

- Store one \`winning-structure-input\` case document as plain JSON that is directly valid for both \`validate_task_input\` and \`start_winning_structure_run\`. Do not wrap it in Markdown and do not create a separate internal shape.
- Required top-level objects are \`task\` and \`market\`. Never use \`task_input\`, a string market, a nested \`namespace\`, \`run_id\`, \`decisions\`, or local heartbeat/session/issue identifiers in the payload.
- The top level carries \`company_id\`, \`project_id\`, \`client_key=astrogen-ukraine\`, the stable \`idempotency_key\`, \`task\`, \`market\`, \`cache_policy\`, \`editorial_constraints\` and optional page, business, ownership and reader-value context.
- Merge evidence, commitments and product bridge targets into one \`business_context\`. A concrete future asset belongs in \`manual_value_commitments\`; an existing verified source belongs in \`reader_value_evidence\`.
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
`;
  }

  if (agent.name === "SEO Blog Content Plan Validator") {
    return `

## Topic Inventory Validation Gate

- Validate \`topic_inventory_refill\` packets before the article allocator can
  consume them.
- Accept only records whose status, evidence, duplicate check, cannibalization
  assessment, CTA/internal-link plan, cooldown notes, content role, demand
  class, SERP grouping status, and SERP value-gap requirement are explicit.
- Reject or park topics that overlap existing service pages, CMS drafts,
  recently produced articles, active article parents, or accepted semantic-core
  items without a distinct intent.
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

## Winning Structure MCP Contract

- For native article stages \`strategy_input\` and \`winning_structure\`, use Winning Structure MCP as the ownership, SERP and reader-value source of truth. Serper may supply caller evidence but never substitutes for a completed Winning Structure result.
- Read the \`winning-structure-input\` case document, parse its plain JSON body and pass the exact object unchanged to both validation and start. Never reconstruct the payload or rename \`task\` to \`task_input\`.
- Require the stable top-level namespace \`company_id\`, \`project_id\`, \`client_key=astrogen-ukraine\` and idempotency key \`winning-structure:{articleCaseId}:{revision}\`, plus object-valued \`task\` and \`market\`.
- Strategy Input owns the payload, namespace and idempotency key only. It must leave MCP run ID, status, hashes, decision version, retention and result fields null; never place a heartbeat, session or issue ID in an MCP field. Only Winning Structure may populate those fields from plugin responses.
- For every plugin operation, pass \`company_id\`, \`project_id\`, \`client_key\`, \`run_id\`, and \`decisions\` as top-level parameters exactly as declared by the tool schema. Never send a nested \`namespace\` object.
- Include a trustworthy current-page snapshot for refreshes, CMS ownership candidates, GSC query-to-URL evidence, forbidden topics, CTA/product bridge targets, claim constraints and non-SERP reader-value evidence or a concrete deliverable commitment.
- Call validate before start. Store the returned input hash, start only once, preserve run ID, poll the same run with bounded backoff and stop on paused or terminal status.
- If validation rejects the stored schema before any remote run exists, persist the typed errors and return the case to \`strategy_input\` for payload repair. Never use this transition after a plugin-returned run ID or input hash exists.
- When paused, copy the exact decision request, version, options and evidence to the case and transition to \`structure_decision\`. Never manufacture a decision or restart the run.
- On completion, import the structured result, Markdown reference, effective hash, decision version, structure sections, quality requirements, publication requirements, cost/provenance and retention deadline into durable case documents before artifact expiry.
- Keep imported MCP artifacts immutable. A selected value unit is valid strategy input only with 1-4 canonical \`targetIntentCovered\` values from the Astrogen article-value system; never use future remote \`targetSectionIds\` at strategy-input time. Approved Astrogen selected value units are durable strategy input: map them to generated sections through their canonical \`targetIntentCovered\` values and each section's \`intent_covered\`; persist \`mappedSectionIds\`. The remote MCP may add value plans but does not erase approved local units. If no generated section maps an approved unit, create a separate typed \`winning-structure-local-overlay\` from that selected unit instead of opening a CTO task. Each selected-unit overlay entry must name \`sourceKind=selected_value_unit\`, \`sourceValueUnitId\`, mapped support IDs, insertion point, evidence/commitment refs, purpose, writer instruction, examples to avoid, claim boundaries, and \`provenance=paperclip_normalization_from_selected_value_unit\`. An accepted remote plan may use \`sourcePlanId\` and \`provenance=paperclip_normalization_from_accepted_plan\`.
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

- Create a brief only from an imported and accepted Winning Structure result. Preserve section IDs, hierarchy, purpose, writer instruction, evidence references, claim boundaries, examples to avoid, review flags and publication requirements as structured fields.
- Use the accepted Astrogen article type and two to four approved reader-value units. A table, FAQ, checklist, comparison or historical note is only presentation; it is not value unless it delivers the accepted evidence-backed contribution.
- Do not add a universal block set. Prove that selected value units fit this reader problem and do not repeat the substantive role of recent sibling articles.
- A committed but undelivered asset remains a publication blocker and must be visible in the brief. Do not let the writer simulate it.

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

- This is the shared writer-workspace contract. Claude is the primary writer. ChatGPT may execute only after the case records a Claude/provider/protocol blocker or an explicit CMO fallback decision; ChatGPT must never self-trigger or replace a healthy Claude path.
- The Claude writer runs through the OpenRouter prompt adapter. It has no callable shell, browser, or Paperclip API tools: never emit \`<tool_call>\`, shell commands, or raw API instructions. Return the adapter's single JSON protocol response with the complete attachment artifact and, on completion, the typed \`pipelineTransition\` to the allowed next stage. Paperclip validates and performs that transition before it can close the stage task.
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
- If either dimension differs by more than 20 percent, record a runtime contract blocker for CTO. That mismatch does not authorize an automatic second generation. A new provider call requires an actual visual-quality failure plus explicit CMO recovery authorization.
- Do not request three candidates, 2K/4K, or a premium model unless the issue contains an explicit owner/CMO recovery authorization with the reason.
- The configured default model for normal article covers is google/gemini-2.5-flash-image. Do not override it to google/gemini-3.1-flash-image, Nano Banana 2, Pro, or another premium model during normal cadence work.
- A corrected retry authorized after an \`image_quality_blocked\` comment is a new generation pass, not a re-review of the same rejected files. Dimension or output-format mismatch within the 20 percent tolerance is never \`image_quality_blocked\` and must not create a retry.
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
- Produce CMS body only as canonical \`articleContent.v1\`: top-level \`schemaVersion="articleContent.v1"\` plus \`blocks\`. Do not use legacy aliases such as \`content\`, \`columns\`, \`body/linkText\` for CTA, or free-form icon objects.
- Required articleContent block types are exactly: \`paragraph\`, \`heading\`, \`list\`, \`editorialCallout\`, \`iconList\`, \`twoColumnText\`, and \`quietCta\`. Use the Payload CMS tool schema as the source of truth before handoff.
- CMS delivery is draft-only. Do not publish. After creating/updating the CMS draft, refetch it and verify status, workflowStatus, cover/ogImage, CTA, editorial inserts, and relatedPosts before marking the issue done. For CMS update/refresh of an existing article, create and verify \`before-after-diff\` on your own assigned CMS issue before closeout; the CMO aggregates it into the parent.
- Do not guess Paperclip or CMS schemas by trying multiple malformed payloads. If the exact schema is unclear, inspect the relevant local schema once, perform one corrected attempt, and otherwise record a blocker with the exact missing contract.
- When a dependency is already resolved, clear the blocker in the issue state and continue the current issue; do not create duplicate article parents or child tasks for the same title.
`;
  }

  if (agent.name === "SEO CMS Technical Fixer") {
    return `

## Payload CMS Draft Contract

- CMS delivery is draft-only. Do not publish.
- Use the \`Payload CMS Create Blog Post Draft\` and \`Payload CMS Update Blog Post Draft\` tool schemas as the source of truth. Their runtime schema is canonical; do not infer fields from previous failed attempts.
- \`articleContent\` must be canonical \`articleContent.v1\`: \`schemaVersion\` plus \`blocks\`. Reject or return upstream payloads that use \`content\`, \`columns\`, \`body/linkText\` for CTA, or free-form icon objects.
- Before a create/update call, verify the payload has: early \`editorialCallout\` titled \`Коротко\`, CTA as \`quietCta.title/text/linkLabel/linkUrl\`, exactly 3 \`relatedPosts\` when suitable published/indexable posts exist, accepted cover/OG image or explicit waiver, and draft workflow status.
- Do not trial-and-error Payload writes. If a schema validation or Payload response fails, capture the exact error, route it to the producing stage, and stop after one corrected attempt.
- After create/update, refetch the CMS draft and verify status, workflowStatus, cover/ogImage, CTA, editorial inserts, relatedPosts, and CMS admin edit URL before reporting completion.
- For CMS draft updates or refreshes of an existing article, create or update issue document key \`before-after-diff\` on \`$PAPERCLIP_TASK_ID\` with title \`Before/After Diff\`, format \`markdown\`, and a compact comparison of source CMS/admin URL, after/draft revision evidence, sections added/changed/unchanged, preserved fields, CMS admin review URL, and publish status. Verify it on your own issue. Mark the CMS child done when CMS and child-document gates pass. Never mutate another agent's parent issue and never block completed CMS delivery solely because parent mutation is unauthorized; CMO owns parent aggregation.
- For a draft-only update to an already published article, Payload may return the latest edited document as \`_status="draft"\` / \`workflowStatus="draft"\` while the public live article remains published. Treat this as a valid draft revision, not a blocker, when authenticated refetch proves the edited draft, the public live URL still resolves, cover/OG media, slug, metadata, canonical, noindex, relatedPosts, and unrelated fields are preserved, and the completion comment says \`draft revision created; live publish not performed\`.
`;
  }

  return "";
}

function writeInstructionsFiles() {
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
