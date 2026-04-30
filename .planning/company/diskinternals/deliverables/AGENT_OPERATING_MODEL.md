# DiskInternals Agent Operating Model

## Manager Layer

| Agent | Role In Growth OS | Status |
|-------|-------------------|--------|
| CEO | Executive sponsor, strategy approval, weekly growth impact review | Existing |
| CMO | Acting Growth PM, backlog owner, specialist delegation, approval handoff | Existing, updated |
| CTO | Tracking, MCP/BigQuery, attribution, technical PR review | Existing |

## Canonical Workspace Root

All DiskInternals agents must use `/companies/diskinternals` as the canonical writable root for company artifacts, reference docs, process docs, skills, and work outputs.

Do not create new artifacts under `/clients/diskinternals` or `/company/diskinternals`. `/clients/diskinternals` is legacy compatibility only. `/paperclip/instances/default/workspaces` is internal Paperclip execution storage only.

## CMO Semantic-Core Intake Contract

When CMO receives a semantic-core task, CMO must not route directly to Stage 53 from the task title alone.

Required intake before delegation:
- confirm product/route scope, target OS/platform, target geo, research language, and output language;
- check whether accepted Product Discovery already exists for the product/route;
- if discovery is missing or stale, delegate first to `MKT Product Discovery Analyst`;
- check whether existing DiskInternals pages already cover the seed query family and identify cannibalization/product-availability gaps;
- treat any human-provided keyword list as seed evidence, not as canonical truth;
- require `SEO Semantic Core Strategist` to use the Semantic Core MCP/plugin for collection;
- route the produced semantic core to `SEO Semantic Core Validator` before using it for page construction, blog planning, or production prioritization.

For not-yet-launched products, semantic-core work is allowed only as future landing/content architecture research. Briefs must not assert live product availability unless current canonical product evidence confirms it.

## Stage 53 Semantic-Core Tooling Contract

Stage 53 semantic-core agents must treat Paperclip's live plugin registry as the source of truth for available tools.

Required discovery and execution path:
- discover tools with `GET /api/agents/me/plugin-tools`;
- execute tools with `POST /api/agents/me/plugin-tools/execute`;
- do not use Codex desktop `tool_search`, local MCP resources, GitHub plugin listings, or Figma plugin listings to decide whether a Paperclip plugin exists.

Expected semantic-core tool chain:
- `paperclip.semantic-core-mcp-agent-tools:list-tools`;
- `paperclip.semantic-core-mcp-agent-tools:register-project`;
- `paperclip.semantic-core-mcp-agent-tools:run-layer` or `paperclip.semantic-core-mcp-agent-tools:run-layer-and-wait`;
- `paperclip.semantic-core-mcp-agent-tools:prepare-paperclip-import`;
- `paperclip.semantic-core-mcp-agent-tools:get-review-queue` and `submit-review-decisions` when review is required.

Support tools may include `paperclip.dataforseo-agent-tools:*`, `paperclip.serper-agent-tools:google-search`, and `paperclip.exa-agent-tools:*`, but these do not replace the semantic-core generator for Stage 53 output.

## Semantic-Core Sequential Handoff Contract

CMO owns the parent manager lane for semantic-core work.

Required sequence:
- after Stage 53 semantic-core generation completes, CMO must create a Stage 54 validation issue for `SEO Semantic Core Validator` before ending the heartbeat;
- the Stage 54 issue must link the Stage 53 artifact and keep the parent issue manager-owned;
- if validation is `accepted`, CMO records the manager acceptance decision before opening downstream page, blog, or production-prioritization work;
- if validation is `returned for revision`, CMO creates a bounded revision issue for `SEO Semantic Core Strategist` immediately, preserving the validator checklist;
- if validation is `blocked pending clarification`, CMO moves the parent to `blocked` and names the missing decision or tooling blocker.

A child handoff comment that recommends the next action is not enough when the parent owner is the manager responsible for creating that next action.

## Human Decision Resume Contract

When a manager creates or routes an owner-decision request through `OPS Human Interaction Agent`, the request must include a concrete post-answer unblock action.

Default source-issue handoff:
- HIA writes the owner answer back to the source issue.
- If that answer resolves the only blocker, HIA moves the source issue from `blocked` to `todo`.
- HIA mentions the current assignee by exact Paperclip agent name so the assignee wakes and continues.
- The source manager resumes from the recorded answer instead of asking the owner again or creating a parallel route.

CTO owns a fallback stale-blocker audit for cases where the answer exists but the source issue remains blocked.

## Child Completion Parent Handoff Contract

Every DiskInternals agent has a live instruction rule for child completion handoff.

When an agent completes a child issue:
- fetch the parent issue;
- write a parent comment that links the completed child and names the produced artifact or decision;
- state the recommended next manager action;
- @-mention the current parent assignee by exact Paperclip agent name so the parent workflow wakes;
- do not close or reassign the parent unless explicitly authorized.

This is the standard handoff for specialist -> manager work, including Product Discovery -> CMO, Semantic Core -> CMO, and Validator -> CMO chains.

## SEO Lane

SEO owns all blog and organic-search work.

| Agent | Responsibility |
|-------|----------------|
| SEO Performance Analyst | GSC opportunities, search telemetry, URL opportunities |
| SEO Semantic Core Strategist | Semantic core and query clusters |
| SEO Semantic Core Validator | Semantic-core QA and cannibalization checks |
| SEO Blog Content Strategist | SEO blog content plan |
| SEO Blog Content Plan Validator | SEO blog plan QA |
| SEO Blog Article Writer | Article and refresh draft production |
| SEO Blog Article Validator | Article QA and recovery-safety checks |
| SEO Internal Linking Indexation Agent | Internal link queues and indexing candidates, pending approval |

## MKT Lane

MKT owns product discovery, audience, market, offer, campaign, funnel, and localization opportunity work. MKT does not own SEO blog work.

| Agent | Responsibility |
|-------|----------------|
| MKT Product Discovery Analyst | Product portfolio, product proxy scoring, product context |
| MKT Competitive Intelligence Analyst | Competitor and SERP business context |
| MKT Audience Segmentation Strategist | Audience and country/product segment strategy |
| MKT Audience Simulation Analyst | Persona and intent simulation |
| MKT Segment Validation Analyst | Segment validation and demand QA |
| MKT Validation Preparation Analyst | Testable validation planning |
| MKT PFB Hypothesis Analyst | Product-fit block and funnel hypotheses |
| MKT Content Plan Creator | Non-blog campaign and funnel content plans |
| MKT Offer & Funnel Strategist | Product-page, CTA, popup, and funnel strategy |
| MKT Campaign Funnel Plan Validator | Non-blog campaign/funnel plan QA |
| MKT Conversion Brief Strategist | Non-blog conversion briefs |
| MKT Localization Opportunity Agent | Signal-gated localization analysis, pending approval |

## CRO, DATA, QA, ADS, OPS

| Agent | Responsibility |
|-------|----------------|
| DATA Growth Analytics Agent | MCP contracts, data QA, scoring inputs, BigQuery marts, pending approval |
| CRO Funnel Experiment Agent | CTA, popup, and funnel experiment design, pending approval |
| QA Recovery Compliance Agent | Recovery-safety, product-routing, compatibility, price/discount QA, pending approval |
| ADS Paid Ads Copy Strategist | Paid ad copy and offer variants |
| ADS Ad Simulation Critique Analyst | Paid ad simulation critique |
| OPS Human Interaction Agent | Human approval and owner-decision handoff |
| OPS Observability Agent | Routine, plugin, run, and budget observability |

## CTO Operational Safety Net

`CTO Stale Human Decision Blocker Audit` runs as a manager routine and checks blocked `Human Decision Needed` issues for already-recorded owner answers. If the answer exists and no other blocker remains, CTO returns the source issue to `todo`, preserves assignee ownership, and mentions the assignee so the workflow resumes.

## Future SOC Lane

SOC is the future owner for social content planning and social creative validation. Do not route social content work to MKT blog roles.
