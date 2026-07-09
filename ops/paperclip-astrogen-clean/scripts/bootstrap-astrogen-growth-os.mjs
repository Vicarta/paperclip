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
    key: "paperclip.seo-performance-loop",
    packageName: "@paperclipai/plugin-seo-performance-loop",
    packagePath: "/app/packages/plugins/plugin-seo-performance-loop",
    active: true,
    installOrder: 50,
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
    active: false,
    installOrder: 130,
    disabledReason: "Not needed for Phase 40.",
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

const agentDefs = [
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

const routineContracts = {
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
- Create or update compact Paperclip evidence/action issues.
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
- Create/update technical SEO finding issues with URL-level evidence.
- Record inspected, skipped, no-data, and cooldown decisions.

Forbidden:
- Do not request indexing in bulk.
- Do not mutate CMS content.
- Do not send Telegram messages.
- Do not spend paid provider budget.

Completion gate:
- Close done only after every selected URL has one of: finding routed, cooldown/watch recorded, skipped with reason, or explicit no due URLs.`,

  leadershipBacklogTriage: `Purpose: make sure Astrogen backlog and unassigned work cannot silently accumulate without executive ownership.

Timing:
- Runs daily at 06:40 Europe/Kiev, after deterministic evidence collection and GSC indexing audit.
- Missed schedules are skipped; do not backfill.

Inputs:
- Open Astrogen issues with status backlog, todo, blocked, or in_review where assigneeAgentId is empty.
- Open backlog issues older than 24 hours, even if they look parked.
- Recent routine outputs from evidence, GSC, SEO/GEO, article cadence, and release checks.

Leadership routing rules:
- SEO/GEO/content/traffic/revenue issues: route to Chief Marketing Officer when prioritization is needed, or directly to the correct SEO specialist when the next action is obvious.
- Company/platform/process/runtime issues: route to CEO or CTO with a concrete completion gate.
- Human-decision, Telegram writeback, or owner-input gaps: route to OPS Human Interaction Agent, CEO, or CTO without enabling Telegram proactive watches.
- Parked items may remain backlog only when they have an assignee, a written parked reason, and the next review condition/date.
- Do not leave actionable work in backlog/unassigned.

Execution boundary:
- CEO is the routing owner, not the domain executor.
- CEO may prioritize, assign, create bounded child issues, set blockers, and record routing decisions.
- CEO must not personally perform SEO analysis, CMS edits/publishing, Telegram operations, plugin/provider calls, paid provider calls, or other specialist execution.
- When specialist execution is needed, CEO routes it to CMO, CTO, HIA, or the correct specialist agent.
- Roger (Hermes Agent) config and proactive Telegram watches remain outside this routine.

Bounds:
- Process at most 10 candidate issues per run, highest priority and oldest updated first.
- Prefer assigning or creating bounded child issues over broad strategy comments.
- Do not replay full histories; use heartbeat context, compact comments, and issue metadata.

Allowed side effects:
- Assign issues, move actionable work to todo, create bounded child issues, set blockers, and record concise routing comments.
- Close duplicate/no-longer-needed issues only with explicit evidence.

Forbidden:
- Do not execute the routed domain work inside the CEO triage run.
- Do not change Roger (Hermes Agent), Telegram, CMS, plugin/provider, or paid-service state directly from this routine.
- Do not create open-ended research loops.

Completion gate:
- Close the routine execution only after reporting routed, parked, blocked, and skipped counts.
- Healthy exit requires no open unassigned backlog/todo item older than 24 hours without a written reason, or an explicit blocker explaining why routing was impossible.`,

  articleSlotAllocator: `Purpose: allocate at most one Astrogen article-production slot per active cadence day when backlog, budget, readiness, and recovery gates pass.

Activation mode:
- Controlled clean activation: target 1 new CMS draft per Europe/Kiev day.
- Schedule: daily 10:00 Europe/Kiev.
- Missed schedules use bounded article-only catch-up when routine variables set
  \`missedSlotCatchUp=enabled\`; never use broad catch-up for
  other expensive routines.
- If any open article-production issue is active, skip rather than queueing more work.

Allowed inputs:
- Approved article opportunities, Hermes/owner SEO direction, weekly SEO/GEO action outputs, human priorities, content-wave backlog, and current open article pipeline issues.
- The allocator consumes only topic records with status \`ready_for_brief_creation\`.
- If fewer than 3 ready topics are available, or a bounded expansion returns
  \`no-safe-topic\`, create or reuse one \`topic_inventory_refill\` child owned
  by SEO Blog Content Strategist and validated by SEO Blog Content Plan
  Validator. The allocator must be blocked by that refill child or kept in an
  explicit resumable continuation; \`no-safe-topic\` is not a successful
  terminal state.
- Topic refill uses existing accepted semantic-core inventory/review, GSC/GA4,
  Payload CMS inventory, CrawlObserver/internal-link evidence, active issue
  duplicate checks, and the consumed topic ledger. Do not run a broad
  semantic-core rebuild from this allocator.
- Topic refill should include Phase 14 article-opportunity fields when evidence
  is available: content role, demand class, human priority state, SERP grouping
  status, and whether a separate SERP value-gap check is still required before
  brief creation.
- If the refill child completes with zero ready topics, check whether one
  existing article can be improved through a bounded
  \`serp_value_gap_content_refresh\` lane before closing the cadence as no-slot.
  This lane requires relevant keyphrases, SERP competitor evidence, a missing
  user-value diagnosis, and a clear Astrogen information-gain angle.
- Do not create a content-refresh issue that only asks for generic editorial
  inserts such as \`Коротко\`, FAQ, CTA, comparison blocks, internal links,
  relatedPosts, or metadata edits. Those are separate layout/CMS/SEO fixer
  lanes unless the SERP value-gap artifact proves the element is needed to add
  substantive user value.
- If the refill child returns any \`ready_for_brief_creation\` topic, continue
  the same cadence path by reserving exactly one top safe topic and creating one
  brief/writer pipeline slot. Leave remaining ready topics for later cadence.
- If evidence tools are unavailable, route one CTO-owned technical blocker and
  keep the allocator blocked by refill/blocker evidence. Do not ask the owner to
  choose topics from incomplete evidence.
- Child discovery/validation results that a manager must act on must be visible
  in the parent issue thread or parent heartbeat context. If a child-only
  comment is not readable from the parent run, copy a compact parent-visible
  handoff before expecting the manager to route the next stage.
- A bounded content-expansion issue created from the allocator is a real
  dependency, not a side task. It must be created with the allocator issue as
  parentId and the allocator issue must either be blocked by that child through
  blockedByIssueIds or kept in an explicit resumable in_progress posture with a
  queued/wakeable continuation. Do not leave the allocator blocked only by
  prose such as "dependency result missing"; parentId, blockedByIssueIds, or a
  parent-visible handoff are required before ending the heartbeat.
- When that expansion child reaches done with any ready topic, the allocator
  owner must clear the dependency and route exactly one normal article pipeline
  slot for the top safe topic in the same cadence path. Recovery ownership is
  only valid for a true runtime/permission failure, not for a child result that
  already exists.

Pipeline contract:
- Normal article path: opportunity -> SERP value-gap check -> brief -> draft -> validation -> humanizer -> layout -> image -> CMS draft -> CMO Telegram article-link notification.
- One allocator run creates at most one new article pipeline parent. A bounded opportunity-expansion child is discovery work, not terminal success, when it returns a ready topic.
- Child issues must name workflow state, required artifact, completion evidence, blocker classes, next owner, and parent/goal links.
- Before creating a brief child, the article parent must have a completed
  \`serp_value_gap_check\` child assigned to MKT Competitive Intelligence
  Analyst, unless the accepted topic record already contains fresh SERP
  value-gap evidence. The required artifact is a compact top-result/value-gap
  packet: query, geo/language, top competing URLs/titles/snippets, competitor
  pattern summary, unsafe/overpromising claims to avoid, missing user questions,
  Astrogen information-gain angle, outline constraints, and
  \`serpGroupingStatus\`. If the Serper/SERP tool is unavailable, create a
  CTO-owned technical blocker and do not silently skip to brief.
- The canonical article parent stays open until the full delivery chain reaches terminal evidence: accepted cover image or explicit waiver, authenticated Payload CMS draft refetch, exactly 3 relatedPosts when suitable published/indexable posts exist, and CMO Telegram article-link notification proof. A layout package with \`ready_for_image_handoff\` is progress, not completion.

Canonical parent idempotency:
- Before creating a top-level article parent, derive normalized articleParentKey from the exact article title.
- Search open top-level article parents for the same articleParentKey. If one exists, reuse that issue as canonical and create only bounded child/recovery tasks under it.
- Never create a second top-level parent for the same article title because a writer, validator, image, layout, or recovery stage failed. Retry only the failed stage as a child.
- Duplicate parent creation errors from the clean DB mean: use the canonical issue named in the error and continue there.

Writer recovery:
- Primary writer is SEO Blog Article Writer (Claude).
- Use SEO Blog Article Writer (ChatGPT) only after a recorded Claude/OpenRouter runtime/provider blocker, missing canonical draft artifact, repeated same-class Claude protocol/validation failure, or explicit CMO recovery decision.
- A writer slot is incomplete without a canonical draft artifact or explicit no-draft blocker.
- One normal correction pass may return to the same writer with a narrow checklist; repeated same-class failure routes to fallback or CMO diagnosis.
- If fallback fails with the same blocker class, stop writer retries and diagnose brief/validator/contract mismatch.

Image gate:
- A normal new article is not ready for CMS draft delivery or owner notification until a cover image exists and passes QA, unless the owner explicitly waives image generation for that article.
- Cover subject mode must be intentional: human_scene, abstract_graphic, or justified exception.
- Use human_scene for human experience, decisions, relationships, family/children, career/money, emotions, consultation, or personal life context. Human-scene prompts may choose natural viewer/camera gaze when it makes the article more compelling, but normal cover generation is one image, not a three-candidate set.
- Use abstract_graphic for abstract concepts, definitions, zodiac-sign profiles, generic horoscope topics, frameworks, lists, comparisons, metrics, or non-personal explanations. Abstract covers must not contain people, faces, hands, bodies, silhouettes, or model-like figures.
- If image generation fails, route a bounded recovery issue to SEO Blog Image Runtime Executor; if the OpenRouter image plugin/secret/model path is broken, route the exact blocker to CTO.

Bounds:
- Default target is one new article slot per routine execution.
- When bounded catch-up is enabled, the allocator may open additional missed
  article slots up to \`maxCatchUpSlotsPerRun\`, using the same duplicate,
  readiness, budget, and active-lane gates as the normal slot.
- In an explicit catch-up run, \`maxCatchUpSlotsPerRun\` is a delivered-slot
  target ceiling, not a one-shot create limit. The allocator/CMO must continue
  sequentially after each completed CMS draft until the run has delivered the
  requested count, reaches the cap, or records durable no-safe-topic/blocker
  evidence. Do not close the catch-up allocator after the first successful
  draft when remaining catch-up slots are still in scope and no active article
  lane exists.
- \`no-safe-topic\` evidence is durable only after \`topic_inventory_refill\`
  has completed and still returned zero \`ready_for_brief_creation\` records
  with compact evidence. Otherwise it is a refill trigger, not a close reason.
- If any open article-production issue is active, skip rather than queueing more work.

Allowed side effects:
- Create one bounded article pipeline parent/child set only when opportunity, budget, and gates pass.
- Create one bounded \`topic_inventory_refill\` child when safe ready topics are
  exhausted or below the configured minimum.
- If zero ready topics remain and the current cadence scope allows recovery,
  route at most one bounded \`serp_value_gap_content_refresh\` issue for an
  existing article instead of forcing a duplicate article or silently stopping.
- If refill returns a ready topic, create one brief/writer pipeline slot for the
  top safe topic before closing the cadence path.
- Record no-slot/no-action evidence only when refill completed and still
  returned zero ready topics, or when a concrete blocker is linked.
- If validation blocks on correctable draft metadata or wording, route one
  bounded correction pass to the writer against the same canonical artifact,
  then return to validation. Do not leave the article parent waiting forever on
  a blocked validation child.

Forbidden:
- Do not generate images in this allocator.
- Do not publish CMS content.
- Do not send owner-facing Telegram from the allocator. CMO sends only the final article title and CMS/public URL through the Telegram plugin/adapter after validated CMS delivery.
- Do not create broad semantic-core rebuilds, competitor-research, paid ads, or social batches from this routine.
- Do not mark article delivery complete without CMS draft URL, accepted cover image or explicit waiver, and Telegram article-link delivery path.

Completion gate:
- Close the allocator run only after one of these is true: one article slot is
  created with clear next assignee/blockers; topic refill completed with no
  ready topic and durable evidence; or a concrete refill/runtime blocker is
  linked and visible from the parent.
- Do not close the canonical article parent merely because a writer, validator, humanizer, or layout child is done. Parent completion requires accepted cover image or explicit waiver, CMS draft/admin URL after authenticated refetch, verified CTA/editorial/relatedPosts gates, and Telegram article-link delivery proof.
- A generic report, stdout-only result, or issue close with no meaningful side effect is invalid.`,

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
- Route child issues for technical fixes, content refreshes, monitoring, owner SEO decisions through Hermes/CMO, or strategy review.
- Produce a concise internal weekly report document/comment and a Hermes-ready owner brief when owner direction would help.
- Send the detailed weekly SEO report by email when the SEO Performance Loop delivery plan says email is configured.

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
- Call paperclip.seo-performance-loop:seo-weekly-report-plan-get before finalizing the report.
- If the plan returns detailedReportChannel=email and deliveryReady=true, call paperclip.seo-performance-loop:seo-detailed-report-email-send with the Ukrainian detailed report, configured recipients, and an idempotency key tied to the routine issue.
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
};

const routineDefs = [
  routine("Daily Astrogen deterministic evidence collection", "SEO Performance Analyst", "10 6 * * *", routineContracts.dailyEvidence, "coalesce_if_active", "seo_performance_loop"),
  routine("Daily Astrogen due-URL GSC indexing audit", "SEO GSC Indexing Auditor", "20 6 * * *", routineContracts.gscIndexingAudit, "coalesce_if_active", "technical_seo_finding"),
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
    extraVariables: [
      { key: "missedSlotCatchUp", value: "enabled" },
      { key: "missedSlotCatchUpPolicy", value: "bounded_enqueue_missed_with_cap" },
      { key: "maxCatchUpSlotsPerRun", value: "3" },
    ],
  }),
  routine("Weekly Astrogen SEO/GEO action cycle", "SEO Performance Analyst", "0 9 * * 3", routineContracts.weeklySeoGeo, "coalesce_if_active", "seo_performance_loop"),
  routine("Weekly Paperclip clean release check", "Chief Technical Officer", "0 6 * * 2", routineContracts.releaseCheck, "coalesce_if_active", "paperclip_release_check"),
  routine("Weekly Astrogen Paperclip operating improvement review", "Chief Technical Officer", "30 12 * * 3", routineContracts.operatingSelfImprovement, "coalesce_if_active", "paperclip_operating_self_improvement", {
    status: "active",
    triggerEnabled: true,
    activation: "active_backup_email_gated",
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
  const oldKey = readMasterKey(OLD_APP);
  ensureCleanMasterKey();
  const cleanKey = readMasterKey(CLEAN_APP);
  const secretIds = {};
  const migrated = [];
  const missing = [];

  for (const def of secretDefs) {
    const old = byKey.get(def.key);
    if (!old || old.status !== "active") {
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
  if (pluginKey === "paperclip.seo-performance-loop") {
    config.articleCadenceEnabled = true;
    config.articleCadenceTargetPerDay = 1;
    config.articleCadenceTimezone = "Europe/Kiev";
    config.articleCadencePreferredTimes = "10:00";
    config.detailedReportLanguage = "uk";
    config.detailedReportChannel = "email";
    config.detailedReportFromEmail = "paperclip@aibizmate.com";
    config.detailedReportRecipientEmails = config.detailedReportRecipientEmails || "o.savitsky@gmail.com";
    config.resendApiKeySecretRef = secretIds["resend-api-key"];
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
    config.defaultAspectRatio = "16:9";
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

function instructionText(agent) {
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

## Article Parent Recovery Rule

- CEO is a routing/recovery owner, not an article executor.
- When recovering or reviewing an Astrogen article parent, do not close it only because all currently visible children are done. First verify the full delivery chain: draft, validation, humanizer, layout, accepted cover image or explicit waiver, Payload CMS draft/admin URL after authenticated refetch, verified CTA/editorial/relatedPosts gates, and CMO Telegram article-link notification proof.
- If the chain stops at \`ready_for_image_handoff\`, layout-ready, CMS-ready, or another intermediate state, keep or return the parent to \`in_progress\` and route the next bounded child to the correct specialist. For normal articles the next child after layout is \`SEO Blog Image Runtime Executor\`; after accepted image, route draft-only CMS delivery to a CMS-capable lane; after CMS refetch, CMO sends the concise Telegram link notification.
- Do not perform image generation, CMS mutation, or Telegram delivery yourself.
`;
  }

  if (agent.name === "Chief Marketing Officer") {
    return `

## Article Parent Completion Gate

- CMO owns the Astrogen article parent until the complete delivery chain finishes: opportunity or brief, draft, validation, humanizer, layout, accepted cover image or explicit image waiver, Payload CMS draft/admin URL after authenticated refetch, verified CTA/editorial/relatedPosts gates, and CMO Telegram article-link notification proof.
- A child closeout that says \`ready_for_image_handoff\`, layout-ready, CMS-ready, or "next owner is image/CMS/Telegram" is not a parent completion signal. It is the instruction to create or reuse the next bounded child task.
- If a parent has no active child but has not reached CMS draft plus Telegram proof, resume the existing parent and route the missing next stage. Do not create a duplicate article parent for the same title.
- Normal downstream route is: SERP value-gap check -> MKT Blog Brief Strategist -> SEO Blog Article Writer (Claude) -> validator/humanizer/layout -> SEO Blog Image Runtime Executor -> CMS-capable draft delivery lane -> CMO Telegram article-link notification. CMS delivery is draft-only; do not publish.
- Do not create a brief child until a completed SERP value-gap artifact exists
  for this article parent, unless the accepted topic record already has fresh
  top-result/value-gap evidence. If Serper/SERP tooling is unavailable, route
  one CTO blocker and keep the parent blocked/resumable; do not silently skip
  the competitive check.

## Topic Inventory Refill Control

- CMO controls article cadence, but does not personally generate topics,
  write drafts, create images, or mutate CMS content.
- If the allocator reports fewer than 3 safe ready topics or
  \`no-safe-topic\`, route one bounded \`topic_inventory_refill\` child to SEO
  Blog Content Strategist, with SEO Blog Content Plan Validator as the gate.
- A refill packet must contain 3-10 candidates and 1-3
  \`ready_for_brief_creation\` topics when evidence supports them. It must use
  Payload CMS, GSC/GA4, semantic-core inventory/review, CrawlObserver, active
  Paperclip issue duplicate checks, and consumed topic history.
- Do not close the allocator as done just because the current inventory is
  empty. Empty inventory is a refill trigger; it becomes no-action only after
  refill completes with zero ready topics and durable evidence.
- If evidence tooling is unavailable, route a CTO blocker with the exact
  missing plugin/binding/API path. Owner emails must explain what developers
  need to fix in plain Ukrainian, not ask the owner to choose a technical path.

## SERP Value-Gap Content Refresh Control

- Treat \`content_refresh\` as SEO/body improvement driven by relevant
  keyphrases and SERP value-gap evidence, not as a layout/editorial checklist.
- If no safe new topic exists, route one bounded
  \`serp_value_gap_content_refresh\` issue for an existing article only when
  the issue identifies the current article, target keyphrase cluster, SERP
  competitors, missing user value, and why refresh is safer than a new article.
- Do not delegate a refresh as "add \`Коротко\`", "add FAQ", "add CTA",
  "add related posts", "add internal links", "add comparison block", or
  "update metadata" unless the SERP value-gap artifact explains why that exact
  element adds missing user value.
- Editorial/layout defects remain editorial backfill/layout repair. Metadata,
  internal-link-only, and relatedPosts-only work remains deterministic
  CMS/SEO fixing. Keep those lanes separate from content refresh.
`;
  }

  if (agent.name === "SEO Blog Content Strategist") {
    return `

## Topic Inventory Refill Contract

- Own the \`topic_inventory_refill\` research packet for Astrogen blog cadence.
- Use compact evidence from Payload CMS, GSC/GA4, semantic-core
  inventory/review, CrawlObserver/internal-link data, active Paperclip issues,
  and consumed topic history.
- Return 3-10 topic records total. Mark 1-3 as
  \`ready_for_brief_creation\` only when duplicate and cannibalization checks
  pass. Otherwise use \`candidate\`, \`parked_insufficient_evidence\`,
  \`needs_owner_direction\`, \`reject_duplicate\`, or
  \`reject_cannibalization\`.
- Every ready topic must include topicKey, Ukrainian working title, primary
  query, supporting queries, intent, funnel role, audience segment, target
  service/route relationship, evidence references, CMS duplicate check, active
  issue duplicate check, cannibalization assessment, CTA target, internal link
  targets, forbidden claims/tone constraints, content role, demand class, SERP
  grouping status, SERP value-gap requirement, and why it is safe now.
- If SERP evidence is not checked during refill, set
  \`serpGroupingStatus=not_checked\` and \`serpValueGapRequired=true\` instead
  of pretending the topic is fully brief-ready.
- Do not invent broad topics when evidence tools are unavailable. Route the
  exact runtime/plugin blocker to CTO and keep the refill issue blocked.

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
  outline constraints for the brief, internal-link/CTA implication, and
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
- Name exact body sections or paragraphs that need substantive improvement.
  Do not recommend FAQ, CTA, comparison, relatedPosts, internal links, or
  metadata changes unless the SERP/user-value gap directly justifies them.
`;
  }

  if (agent.name === "MKT Blog Brief Strategist") {
    return `

## Phase 14 Brief Contract

- Create briefs only from an approved article opportunity plus completed SERP
  value-gap evidence, unless the parent issue contains an explicit CMO waiver.
- The brief must preserve: articleParentKey, primary/supporting queries,
  content role, demand class, SERP grouping status, target route, CTA, internal
  links, duplicate/cannibalization notes, and the SERP value-gap artifact link.
- Add a dedicated \`Information gain\` section with 3-5 concrete bullets naming
  what Astrogen will add beyond current competing pages.
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
- Do not request generic addition of \`Коротко\`, FAQ, CTA, comparison blocks,
  internal links, relatedPosts, or metadata. Include those only when the
  artifact proves that specific element is the best way to close the value gap.
`;
  }

  if (agent.name === "SEO Blog Article Writer (Claude)" || agent.name === "SEO Blog Article Writer (ChatGPT)") {
    return `

## Phase 14 Article Draft Contract

- Write only from an approved brief that contains SERP value-gap evidence or an
  explicit CMO waiver.
- The draft must visibly satisfy the brief's \`Information gain\` bullets
  without copying competitor text or expanding into unsupported claims.
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
`;
  }

  if (agent.name === "SEO Blog Article Validator") {
    return `

## Phase 14 Validation Gate

- Validate the draft against the approved opportunity, brief, and SERP
  value-gap artifact.
- Approve only when the draft clearly delivers the brief's \`Information gain\`
  bullets, avoids competitor-like unsafe/overpromising claims, preserves the
  intended SERP intent/page type, and does not cannibalize the target service
  route or recent Astrogen content.
- If the draft is merely generic coverage of the keyword, return
  \`changes_required\` with a narrow checklist tied to the missing value-gap
  bullets.

## Content Refresh Validation Gate

- For \`serp_value_gap_content_refresh\`, validate the updated article against
  the refresh brief and SERP value-gap artifact.
- Approve only when the article adds the missing user value named in the
  artifact and stays distinct from existing Astrogen pages.
- Reject updates that are mostly mechanical insertion of \`Коротко\`, FAQ, CTA,
  comparison blocks, internal links, relatedPosts, metadata, or layout blocks
  without substantive information gain.
`;
  }

  if (agent.name === "SEO Blog Image Runtime Executor") {
    return `

## Cover Image Recovery Contract

- Normal Astrogen blog cover generation uses one provider call for one image. Use the configured default model, candidateCount=1/n=1, aspectRatio=16:9, and CMS target 1472x822. Do not request three candidates, 2K/4K, or a premium model unless the issue contains an explicit owner/CMO recovery authorization with the reason.
- The configured default model for normal article covers is google/gemini-2.5-flash-image. Do not override it to google/gemini-3.1-flash-image, Nano Banana 2, Pro, or another premium model during normal cadence work.
- A corrected retry authorized after an \`image_quality_blocked\` comment is a new generation pass, not a re-review of the same rejected files.
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
- CMS delivery is draft-only. Do not publish. After creating/updating the CMS draft, refetch it and verify status, workflowStatus, cover/ogImage, CTA, editorial inserts, and relatedPosts before marking the issue done.
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

function upsertResendEmailSecretBindings(secretIds, pluginIds, agentIds) {
  const resendSecretId = secretIds["resend-api-key"];
  const seoPluginId = pluginIds["paperclip.seo-performance-loop"];
  const seoAgentId = agentIds["SEO Performance Analyst"];
  if (!resendSecretId || !seoPluginId || !seoAgentId) return;

  psql(
    CLEAN_DB,
    `
      insert into company_secret_bindings (
        company_id, secret_id, target_type, target_id, config_path,
        version_selector, required, label, created_at, updated_at
      ) values (
        ${qUuid(CLEAN_COMPANY_ID)}, ${qUuid(resendSecretId)}, 'plugin',
        ${q(seoPluginId)}, 'settings.resendApiKeySecretRef', 'latest', true,
        'Resend API key for SEO Performance Loop detailed weekly report email',
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

  psql(
    CLEAN_DB,
    `
      insert into company_secret_bindings (
        company_id, secret_id, target_type, target_id, config_path,
        version_selector, required, label, created_at, updated_at
      ) values (
        ${qUuid(CLEAN_COMPANY_ID)}, ${qUuid(resendSecretId)}, 'agent',
        ${q(seoAgentId)}, 'resendApiKeySecretRef', 'latest', true,
        'SEO Performance Analyst: Resend API key for detailed weekly SEO report email',
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
    const routineVariables = [
      { key: "workflowKey", value: item.workflowKey },
      { key: "cycleSafety", value: item.status === "active" ? "controlled-active" : "paused-first" },
      { key: "activationContractVersion", value: "phase41" },
      ...item.extraVariables,
    ];
    const routineEnv = {
      workflowKey: item.workflowKey,
      activation: item.activation,
      activationContractVersion: "phase41",
      ...item.extraEnv,
    };
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

    let revisionId = psql(
      CLEAN_DB,
      `select id from routine_revisions where company_id='${CLEAN_COMPANY_ID}' and routine_id=${qUuid(routineId)} and revision_number=1 limit 1;`,
    ).trim();
    if (!revisionId) revisionId = randomUUID();
    const snapshot = {
      version: 1,
      routine: {
        id: routineId,
        companyId: CLEAN_COMPANY_ID,
        projectId,
        goalId,
        title: item.title,
        description: item.description,
        assigneeAgentId: agentIds[item.owner],
        priority: "medium",
        status: item.status,
        concurrencyPolicy: item.concurrencyPolicy,
        catchUpPolicy: "skip_missed",
        variables: [{ key: "workflowKey", value: item.workflowKey }],
        env: { workflowKey: item.workflowKey, activation: item.activation, activationContractVersion: "phase41" },
      },
      triggers: [
        {
          id: triggerId,
          kind: "schedule",
          label: item.timezone,
          enabled: item.triggerEnabled,
          cronExpression: item.cron,
          timezone: item.timezone,
        },
      ],
    };
    psql(
      CLEAN_DB,
      `
        insert into routine_revisions (
          id, company_id, routine_id, revision_number, title, description,
          snapshot, change_summary, created_at
        ) values (
          ${qUuid(revisionId)}, ${qUuid(CLEAN_COMPANY_ID)}, ${qUuid(routineId)}, 1,
          ${q(item.title)}, ${q(item.description)}, ${qJson(snapshot)},
          'Phase 40 paused bootstrap revision', now()
        )
        on conflict (routine_id, revision_number) do update set
          title=excluded.title,
          description=excluded.description,
          snapshot=excluded.snapshot,
          change_summary=excluded.change_summary;

        update routines
        set latest_revision_id=${qUuid(revisionId)}, latest_revision_number=1, updated_at=now()
        where id=${qUuid(routineId)};
      `,
    );
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
  upsertResendEmailSecretBindings(secrets.secretIds, plugins.pluginIds, agentIds);
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

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
