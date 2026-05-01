# DiskInternals Agent Audit And Operating Model

**Company:** DiskInternals
**Company ID:** `969d66ff-d77e-4dbf-8759-1a17c2bb17c2`
**Issue prefix:** `DIS`
**Captured:** 2026-04-29

## Management

| Agent | Current Title | Target Role | Recommendation |
|-------|---------------|-------------|----------------|
| CEO | Chief Executive Officer | Executive sponsor and final escalation | Keep. Receives concise growth impact reports and approves strategic changes. |
| CMO | Chief Marketing Officer | Acting Growth PM | Keep. Owns weekly growth backlog, sprint priority, pilot scope, and agent coordination. |
| CTO | Chief Technical Officer | Data, tracking, attribution, BigQuery, crawler limits, and website-change technical owner | Keep. Owns BigQuery/plugin contracts, GA4 parameter QA, ecommerce attribution, and technical PR review. |

## SEO Lane

| Agent | Current Title | Target Role | Recommendation |
|-------|---------------|-------------|----------------|
| SEO Performance Analyst | SEO Performance Analyst | GSC opportunity and search telemetry analyst | Keep. Primary consumer of `gsc_url_query_opportunities` and SEO performance loop. |
| SEO Semantic Core Strategist | SEO Semantic Core Strategist | Semantic core and query-cluster owner | Keep. Supports RAID, VMFS, Linux Reader/Linux Writer, and expansion products. |
| SEO Semantic Core Validator | SEO Semantic Core Validator | Semantic core QA | Keep. Validates keyword clusters and avoids cannibalization. |
| SEO Blog Content Strategist | SEO Blog Content Strategist | Blog refresh and SEO content strategy owner | Keep. Sole strategic owner for blog work. |
| SEO Blog Content Plan Validator | SEO Blog Content Plan Validator | Blog content plan QA | Keep. Validates SEO blog plans, refresh strategy, and cannibalization risk. |
| SEO Blog Article Writer | SEO Blog Article Writer | SEO article and refresh draft producer | Keep. Produces drafts/patches only after briefs and approval gates. |
| SEO Blog Article Validator | SEO Blog Article Validator | SEO article QA | Keep. Checks accuracy, SERP fit, product routing, and safety claims. |

## MKT Lane

| Agent | Current Title | Target Role | Recommendation |
|-------|---------------|-------------|----------------|
| MKT Product Discovery Analyst | Product Discovery Analyst | Product portfolio and product proxy scoring analyst | Keep. Strong fit for Product Portfolio Agent function. |
| MKT Competitive Intelligence Analyst | Competitive Intelligence Analyst | Competitor and SERP business-context analyst | Keep. Feeds brief and CRO hypotheses, not blog ownership. |
| MKT Audience Segmentation Strategist | Audience Segmentation Strategist | Audience and country/product segment strategist | Keep. Supports localization and funnel segmentation. |
| MKT Audience Simulation Analyst | Audience Simulation Analyst | Persona and intent simulation | Keep. Supports CRO, selector scenarios, and product routing. |
| MKT Segment Validation Analyst | Segment Validation Analyst | Segment validation and demand QA | Keep. Validates country/product/localization assumptions. |
| MKT Validation Preparation Analyst | Validation Preparation Analyst | Validation plan preparation | Keep. Turns hypotheses into testable validation tasks. |
| MKT PFB Hypothesis Analyst | PFB Hypothesis Analyst | Funnel/block hypothesis analyst | Keep or rename. Useful for popup/product-fit block hypotheses if PFB means product-fit block. |
| MKT Content Plan Creator | Content Plan Creator | Non-blog campaign, funnel, and product-page content plan creator | Keep but constrain. Should not own SEO blog plans. |
| MKT Blog Content Strategist | Blog Content Strategist | Repurpose to MKT Offer & Funnel Strategist | Rename/repurpose. Blog strategy belongs to SEO. |
| MKT Blog Content Plan Validator | Blog Content Plan Validator | Repurpose to MKT Campaign/Funnel Plan Validator | Rename/repurpose. Validates non-blog funnel/campaign plans only. |
| MKT Blog Brief Strategist | Blog Brief Strategist | Repurpose to MKT Conversion Brief Strategist or future SOC role | Rename/repurpose. Blog briefs belong to SEO; social briefs belong to SOC. |

## ADS Lane

| Agent | Current Title | Target Role | Recommendation |
|-------|---------------|-------------|----------------|
| ADS Paid Ads Copy Strategist | Paid Ads Copy Strategist | Paid ads copy and offer variant producer | Keep. Hold for paid ads work; not central to initial SEO/CRO pilot. |
| ADS Ad Simulation Critique Analyst | Ad Simulation Critique Analyst | Paid ads critique and simulation QA | Keep. Hold for paid ads validation. |

## OPS Lane

| Agent | Current Title | Target Role | Recommendation |
|-------|---------------|-------------|----------------|
| OPS Human Interaction Agent | Human Interaction Agent | Human approval handoff and notification support | Keep. Supports approval and Telegram/human escalation. |
| OPS Observability Agent | Observability Agent | Routine, run, plugin, and budget observability | Keep. Reports to CTO and monitors operating reliability. |

## Missing Specialist Roles

| Proposed Role | Create Now? | Suggested Reporting | Why |
|---------------|-------------|---------------------|-----|
| DATA Growth Analytics Agent | Yes | CTO | Owns BigQuery report contracts, GA4/GSC export-derived normalized reports, scoring inputs, and marts. |
| GA4 Funnel Agent | Optional | CTO or DATA agent | Can be separate if funnel volume grows; otherwise fold into DATA Growth Analytics initially. |
| CRO Funnel Experiment Agent | Yes | CMO | Owns popup/CTA/product-fit block experiments and funnel hypotheses. |
| SEO Internal Linking & Indexation Agent | Yes | CMO or SEO lane | Owns internal link queues and changed URL indexing policy. |
| Localization Opportunity Agent | Yes | CMO | Owns es/fr/de and country-product signal gating. |
| QA / Compliance Agent | Yes | CMO with CTO escalation | Owns recovery-safety claims, product routing correctness, compatibility, price/discount guardrails. |
| SOC Content Plan Strategist | Later | CMO | Social content planning belongs here, but it is not required for the initial SEO/CRO growth launch. |

## Role Normalization Actions

1. Keep `CMO` as Growth PM.
2. Keep all SEO blog roles; route all blog work through SEO.
3. Rename or repurpose MKT blog-prefixed agents before assigning autonomous work.
4. Do not create SOC work under MKT blog names.
5. Add missing specialist agents only after Phase 1 approval.
6. Keep specialist agents wake-on-demand by default.
