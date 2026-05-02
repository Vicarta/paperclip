# Paperclip Guide For DiskInternals Operators

## What Paperclip Does For DiskInternals

Paperclip is configured as a growth operating system for DiskInternals. Its job is not to generate random content or keep agents busy. Its job is to turn business goals into controlled work that can improve organic traffic, trial downloads, order-page visits, license purchases, product page performance, and localization opportunities.

The practical idea is simple: a human describes a business problem or opportunity, Paperclip routes it to the right leadership function and specialist agents, agents prepare evidence-backed outputs, quality checks validate the result, and approved implementation work is handed to people through Perfex CRM.

The main business loops are:

- Find products and pages with measurable upside.
- Understand which search intents and page changes matter.
- Produce implementation-ready briefs, not vague recommendations.
- Route website changes to human implementers.
- Track whether the change helped downloads, order-page visits, purchases, rankings, clicks, and impressions.

## The Operating Model

DiskInternals work in Paperclip should start from a business question:

- Which product should receive attention next?
- Which URL should be refreshed?
- Which search cluster deserves a page, article, or internal-linking update?
- Which funnel step loses users?
- Which country or language has enough signal for localization?
- Which completed website change should be indexed and measured?

Paperclip then turns that question into a workflow. The user should not need to choose every agent manually. The user should describe the business goal, provide known constraints, and state the desired output. The manager agents are responsible for routing.

## Leadership Functions

### CEO

The CEO function is used for strategic priorities and business risk. It should answer questions such as:

- Which product lines are most important for growth?
- Are we optimizing for downloads, purchases, visibility, or launch readiness?
- Which risks need human approval before agents proceed?
- Which completed work produced enough measurable impact to continue?

Use CEO-level tasks when the decision changes priority, budget, scope, or business direction.

### CMO

The CMO function is the Growth PM for DiskInternals. It turns business goals into a backlog and coordinates the right specialist lanes.

CMO is the right entry point for tasks such as:

- Build a semantic core for a product or new market.
- Decide which pages should be refreshed first.
- Create a backlog for VMFS, RAID, Linux Reader, Linux Writer, checkout, or localization.
- Route a prepared recommendation into SEO, CRO, localization, internal linking, or Perfex handoff.
- Review whether a specialist result is usable or needs validation.

When in doubt, business-growth tasks should start with CMO.

### CTO

The CTO function owns technical reliability of the growth system. CTO work is not about writing marketing copy. It is about making sure agents can trust the data, plugins, MCP adapters, BigQuery exports, crawler behavior, and operational guardrails.

Use CTO-level tasks for:

- BigQuery data availability and schema issues.
- Plugin configuration and MCP access problems.
- Agent execution failures or stuck workflows.
- Crawl rate limits and URL inventory reliability.
- Analytics event quality and attribution gaps.
- Production deployment and server health of Paperclip itself.

### OPS And Human Interaction

OPS and Human Interaction roles exist to keep work from silently hanging. They help with:

- Human decision requests.
- Blocked tasks.
- Escalation and reminders.
- Checking whether parent and child issues are correctly connected.
- Making sure completed child work is handed back to the parent coordinator.

## Specialist Agent Groups

### SEO

SEO owns search-driven growth. This includes semantic cores, blog strategy, article briefs, article writing, article validation, search performance analysis, internal linking, indexation, and page refresh recommendations.

Typical SEO outputs:

- Semantic core with accepted, review, parked, and rejected keywords.
- Keyword clusters and SERP segments.
- Page-to-keyword targeting recommendations.
- Blog brief or article draft.
- Article validation report.
- Internal linking plan.
- Reindexing or monitoring queue.

Important rule: blog work belongs to SEO.

### MKT

MKT owns market, audience, product, offer, and funnel understanding. MKT is used before or alongside SEO when the product or buyer context is unclear.

Typical MKT outputs:

- Product discovery.
- Audience and use-case analysis.
- Offer and funnel strategy.
- Conversion brief.
- Campaign or landing-page positioning.

MKT should not own blog production. MKT can clarify who the page is for, what the business offer is, and which objections the page must answer.

### DATA

DATA agents work with BigQuery-backed GA4/GSC exports, product/page scoring, URL inventory, and opportunity reports. They help convert raw traffic and funnel data into prioritized work.

Typical DATA outputs:

- Product proxy score.
- Page action score.
- GSC opportunity report.
- GA4 funnel report.
- URL inventory and normalization checks.
- Data quality warnings.

For DiskInternals, BigQuery is the operational source of truth for GA4/GSC-derived data.

### CRO

CRO owns conversion experiments. It works on download, order, checkout, CTA, popup, and uncertainty-reduction scenarios.

Typical CRO outputs:

- Experiment hypothesis.
- Target URLs and user segment.
- Proposed copy, CTA, popup, or layout change.
- Success metric and guardrail metric.
- Measurement window and rollback rule.

CRO work runs alongside SEO when a page has enough traffic or product value to justify a conversion experiment.

### Localization

Localization work is signal-gated. A country or language is not enough by itself. Localization should use country demand, GSC signal, product priority, funnel signal, and implementation cost.

Typical outputs:

- Localization candidate queue.
- Market-specific page or content brief.
- Risk notes for translation, product fit, support, and compliance.
- Follow-up metrics after publication.

### QA

QA protects DiskInternals from unsafe or low-quality output. QA should reject:

- Unsupported recovery guarantees.
- Incorrect compatibility claims.
- Wrong product routing.
- Unsourced price or discount statements.
- Cannibalization between pages.
- Implementation briefs that lack affected URLs, acceptance criteria, or measurement logic.

### ADS

ADS owns paid-search and ad-performance work. It should be used when a task involves paid campaigns, paid keywords, ad copy, or landing-page feedback from paid traffic. ADS should not be used as the owner of organic semantic-core or blog work.

### SOC

SOC is the logical lane for social content planning and social publishing calendars. It is distinct from SEO blog production and MKT funnel strategy. If social content becomes active, it should be routed to SOC instead of being hidden under blog or market research roles.

## Main Business Workflows

### 1. Product Opportunity Workflow

Business task: decide which product deserves growth work next.

Configured process:

1. CMO receives the business goal.
2. DATA pulls BigQuery-backed product and URL signals.
3. MKT clarifies product, audience, and use cases when needed.
4. CMO turns the result into a prioritized backlog.
5. Specialist agents receive child issues for SEO, CRO, localization, internal linking, or Perfex handoff.
6. CEO receives a business-level summary when the decision affects priority.

Expected result: a prioritized list of product/page opportunities with business rationale, affected URLs, expected metric impact, and next owner.

### 2. Semantic Core Workflow

Business task: understand search demand for a product, page group, or new market.

Configured process:

1. CMO checks whether product discovery already exists.
2. If product context is missing, MKT Product Discovery runs first.
3. SEO Semantic Core Strategist uses the Semantic Core MCP plugin.
4. The semantic run should cover all relevant layers:
   - `core_product_intent`
   - `adjacent_use_case_intent`
   - `audience_need_intent`
   - `audience_interest_intent`
5. SEO reviews accepted, review, parked, and rejected keywords.
6. Validation checks keyword relevance, volume fields, clusters, SERP segments, and page targeting.
7. CMO decides how the semantic core becomes page briefs, article briefs, internal links, or monitoring targets.

Expected result: a semantic-core artifact with geo and global volume fields, keyword clusters, SERP segments, review queue, and proposed page targets.

### 3. Existing Page Refresh Workflow

Business task: improve an existing URL that has traffic, impressions, rankings, or conversion potential.

Configured process:

1. DATA identifies the URL through BigQuery reports, sitemap inventory, GSC queries, or page action score.
2. CMO routes the opportunity to SEO, CRO, internal linking, localization, or QA.
3. SEO prepares search-intent and content recommendations.
4. CRO adds conversion recommendations if the page has funnel value.
5. QA validates claims, product routing, and implementation clarity.
6. Perfex preview is prepared for human implementation.
7. After human verification, indexing and follow-up monitoring start.

Expected result: an implementation-ready brief with exact URL, changes, rationale, acceptance criteria, and measurement plan.

### 4. New Page Or Article Workflow

Business task: create a new page or article because existing pages do not cover a valuable intent.

Configured process:

1. CMO checks whether the intent belongs to product page, hub page, support page, article, or localization.
2. SEO uses semantic-core evidence and SERP analysis.
3. MKT clarifies product positioning when the offer or audience is unclear.
4. SEO prepares a brief or draft.
5. SEO validator and QA review the result.
6. CMO decides whether the output becomes a Perfex implementation task.

Expected result: a validated brief or draft with target keyword cluster, user intent, page purpose, content structure, claims checklist, and follow-up metric.

### 5. CRO Experiment Workflow

Business task: improve downloads, order-page visits, checkout progress, or purchase intent.

Configured process:

1. DATA identifies the funnel issue from BigQuery.
2. CMO routes the issue to CRO.
3. CRO proposes an experiment with target pages and measurable hypothesis.
4. QA checks that the experiment does not create misleading claims.
5. Perfex handoff prepares the human implementation task.
6. Follow-up compares the defined metric windows after implementation.

Expected result: a controlled experiment proposal, not a generic design request.

### 6. Localization Workflow

Business task: decide whether a market deserves localized content or page adaptation.

Configured process:

1. DATA checks country, query, page, and funnel signal.
2. Localization agent reviews business fit and product priority.
3. SEO checks search intent and SERP fit for the target language.
4. CMO decides whether to create a page, refresh a localized page, or park the opportunity.
5. Perfex handoff is used only when the task is implementation-ready.

Expected result: localization candidate with evidence, target URLs, target language/market, page type, risk notes, and follow-up metric.

### 7. Human Implementation Handoff

Business task: turn an approved Paperclip recommendation into a task for the person who changes the website.

Configured process:

1. Agent prepares a Perfex-ready payload.
2. Payload includes affected URLs, exact requested changes, source evidence, QA checklist, acceptance criteria, and related Paperclip issue.
3. During setup, Perfex writes are disabled by default and previews are preferred.
4. A human approves real creation when writes are enabled.
5. Perfex status and comments are read back.
6. Only verified completed work with changed URLs enters indexing and follow-up measurement.

Expected result: a clear human task, not a vague agent recommendation.

## Plugins And What They Are For

### BigQuery Growth Data

Used for GA4/GSC-derived reports, URL inventory, product/page scoring, sitemap data, crawl state, and opportunity routing. It should be the normal data path for growth decisions.

### Semantic Core MCP

Used to generate semantic cores across product, adjacent use-case, audience need, and audience interest layers. It returns keyword volumes, clusters, SERP segments, review queues, costs, and Paperclip import payloads.

### Winning Structure MCP

Used to analyze SERP structure and recommend page/content structure. Its output should be reviewed before it becomes an implementation task.

### Perfex CRM

Used for human website implementation handoff. It should create or preview implementation tasks with affected URLs, exact changes, QA checklist, and Paperclip references. Real writes remain approval-gated until enabled.

### SEO Performance Loop

Used for post-publication and search-performance follow-up. It connects completed changes to later visibility and performance checks.

### Exa, Serper, DataForSEO, Bright Data

Used for research, SERP, keyword, volume, and external data needs. These tools should be used with clear scope. Bright Data can create real provider cost quickly, so large scraping tasks need explicit approval.

### Telegram

Used for human notifications, approvals, errors, and completion summaries. Completion messages should explain what happened in human terms, while detailed evidence remains in Paperclip.

### File Browser

Used for file visibility and artifact inspection in the Paperclip interface.

## How To Create A Good Task

A good task starts with the business reason, not the agent name.

Use this structure:

```md
Business goal:
What business result should improve?

Scope:
Which product, URLs, market, language, or funnel step is involved?

Known input:
Existing keywords, comments, analytics observations, product notes, or constraints.

Expected output:
Semantic core, page brief, CRO experiment, localization candidate, Perfex preview, validation, or monitoring report.

Decision needed:
What should the manager decide after the agent work?
```

Good examples:

- "Find the best page opportunities for VMFS Recovery where GSC impressions are high but clicks are weak, then propose refresh tasks."
- "Build a semantic core for VMFS Recovery for Mac users and split it into page targets."
- "Check whether Linux Writer needs a product page, comparison page, or support article based on search demand."
- "Prepare a CRO experiment for product pages where download clicks are strong but order-page visits are weak."
- "Create a Perfex preview for the approved RAID Recovery page refresh."

Weak examples:

- "Do SEO."
- "Make a page better."
- "Ask an agent to research."
- "Create content."

## What To Expect From Completed Work

A completed task should make the next step clear. The result should answer:

- What was found?
- Why does it matter for DiskInternals?
- Which product or URL is affected?
- What action is recommended?
- Who should do the next step?
- What must be approved?
- How will success be measured?

If a completion message says only that the task is done, open the Paperclip issue and inspect the latest comment or artifact. Completion summaries should be human-readable, but Paperclip remains the source for full details.

## Approval Gates

Human approval is required before:

- Publishing or changing website content.
- Creating real Perfex tasks when write mode is disabled.
- Running costly or broad scraping.
- Launching tracking changes.
- Starting production experiments.
- Making claims about recovery success, compatibility, pricing, or discounts.
- Treating a localization or new page recommendation as approved implementation.

## Reading Statuses

- `todo`: ready for an agent or manager to pick up.
- `in_progress`: someone is actively working or a run is expected.
- `blocked`: work cannot proceed until a named blocker is removed.
- `in_review`: output needs validation or decision.
- `done`: the task is complete, but parent coordination may still need a separate decision.

Parent and child tasks are separate. A child task being done does not automatically mean the whole business workflow is done.

## Practical Examples

### VMFS Recovery For Mac Semantic Core

Business goal: prepare search demand and page structure for a Mac-focused VMFS/VMDK recovery product path.

Expected routing:

1. CMO receives the task.
2. CMO checks existing product discovery and seed keywords.
3. MKT fills product/audience gaps if needed.
4. SEO Semantic Core Strategist runs all semantic layers through the plugin.
5. SEO validation reviews clusters, volumes, rejected/parked keywords, and page targets.
6. CMO decides which page briefs or implementation tasks should be created.

### Existing Product Page Refresh

Business goal: improve a product page that has search visibility but weak conversion.

Expected routing:

1. DATA confirms URL and funnel signal.
2. SEO checks keyword and SERP fit.
3. CRO checks CTA, download, order, and popup opportunity.
4. QA validates claims and product routing.
5. Perfex preview is prepared for human implementation.
6. After human verification, indexing and follow-up monitoring start.

### Localization Candidate

Business goal: decide whether a country/language deserves localized work.

Expected routing:

1. DATA checks country and query signals.
2. Localization agent checks business fit.
3. SEO checks search intent and page type.
4. CMO approves, parks, or routes to implementation.

## Operator Checklist

Before creating a task:

- Name the product, URL, market, or funnel step.
- State the business outcome.
- Add known input or constraints.
- Ask for a concrete output.
- Say whether implementation is allowed, preview-only, or decision-only.

Before approving implementation:

- Check affected URLs.
- Check exact requested changes.
- Check QA notes.
- Check expected metrics.
- Check rollback or follow-up plan.
- Confirm whether the task should go to Perfex.

After implementation:

- Confirm the human implementer marked the work verified.
- Check changed URLs.
- Trigger indexing only for meaningful high-value changes.
- Measure follow-up windows through BigQuery-backed reports.
