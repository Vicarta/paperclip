# DiskInternals Paperclip Growth OS

## What This Is

This project sets up DiskInternals in Paperclip as a growth operating system, not as a bulk content generator. The system coordinates DiskInternals agents around BigQuery-backed GA4/GSC exports, product attribution, SEO refresh, CRO, internal linking, localization, indexing, and PR-based website changes.

The Paperclip company already exists as DiskInternals, with `CMO` acting as the Growth PM function under `CEO`. The launch must use the live DiskInternals company only: `969d66ff-d77e-4dbf-8759-1a17c2bb17c2`, issue prefix `DIS`.

## Core Value

Every Paperclip action should turn trustworthy product, URL, and funnel data into measurable growth work for visitors, trial downloads, order-page visits, and license purchases.

## Requirements

### Validated

- ✓ DiskInternals Paperclip company exists with company ID `969d66ff-d77e-4dbf-8759-1a17c2bb17c2` and issue prefix `DIS`.
- ✓ Current company has 25 live agents including `CEO`, `CMO`, `CTO`, SEO, MKT, ADS, and OPS roles.
- ✓ DiskInternals currently has one active goal: `Growth of website visitors, trial downloads, and license purchases`.
- ✓ BigQuery export is already working and is the only operational source for GA4/GSC-derived data.
- ✓ Direct GA4/GSC access is not available to agents; agent access must be mediated through BigQuery-backed Paperclip plugin tools.
- ✓ Agents may prepare website patches and PRs, but publication/release remains approval-gated.

### Active

- [ ] Enforce DiskInternals-only operational guardrails before every Paperclip action.
- [ ] Make `CMO` the acting Growth PM instead of creating a separate Growth PM agent.
- [ ] Normalize agent roles so SEO owns blog work, MKT owns market, offer, funnel, and audience work, ADS owns paid ads, OPS owns monitoring/human handoff, and SOC is reserved for social content work.
- [ ] Plan all current agents and proposed missing specialist agents before execution.
- [ ] Build BigQuery-first growth data contracts, URL inventory, normalization, and plugin-mediated reports.
- [ ] Fix or work around product attribution gaps before scaling content.
- [ ] Include Linux Writer as an upcoming low-price product in product mapping and funnel planning.
- [ ] Build the first pilot around RAID Recovery, VMFS Recovery, Linux Reader/Linux Writer funnel, and Download/Order/Checkout flows.
- [ ] Convert agent output into patches/PRs with QA, approval, indexing, and follow-up telemetry.
- [ ] Avoid day-based planning; use phase sequence and recurring operating loops instead.

### Out of Scope

- Mass article generation before product attribution is reliable - this would optimize activity rather than revenue.
- A separate Growth PM agent - `CMO` owns the Growth PM function for this launch.
- Autonomous publishing to production - agents may prepare patches/PRs, not release without approval.
- Immediate AI assistant launch - guided selector and guardrails come first.
- Blanket localization by country traffic alone - localization requires country, product, funnel, and GSC signal.
- Bulk reindexing after every small edit - only meaningful high-value changed URLs should be submitted.
- Treating `file_download` as revenue - it is an intent signal, not a sale.

## Context

- Paperclip instance: `https://ubuntu-oc.tailbd4e1c.ts.net:4447`
- DiskInternals company ID: `969d66ff-d77e-4dbf-8759-1a17c2bb17c2`
- DiskInternals issue prefix: `DIS`
- Astrogen company ID to avoid: `c33f6b81-5ced-4270-9288-b46a32f6337a`
- Local `~/.paperclip/context.json` points to Astrogen by default, so every Paperclip API action must explicitly use DiskInternals company ID.
- Scheduled heartbeat should remain limited to `CEO`, `CMO`, and `CTO`; specialist agents stay wake-on-demand unless a routine is explicitly approved.
- Organic Search is the primary growth channel.
- Product-level ecommerce attribution is currently the largest analytics gap.
- Pilot allocation is confirmed:
  - RAID Recovery: 35%
  - VMFS Recovery: 25%
  - Linux Reader / Linux Writer / freeware-to-paid funnel: 25%
  - Download / Order / Checkout flow: 15%
- Linux Writer is expected soon and should be planned as a low-price Windows-to-Linux-filesystem write/edit product, distinct from recovery products.

## Constraints

- **Company isolation**: All Paperclip work must use DiskInternals company ID and `DIS` prefix - this is a shared instance and Astrogen is the local default.
- **Approval governance**: Agents can prepare patches/PRs, but site publication, tracking changes, and production experiments require human approval.
- **Data availability**: BigQuery export is the operational source of truth for GA4/GSC-derived data; direct GA4/GSC access is not available.
- **Budget**: Specialist agents should stay demand-woken unless a routine has a clear operating value.
- **Content ownership**: Blog work belongs to SEO. Social content planning belongs to SOC, not MKT.
- **Analytics integrity**: Do not scale content, localization, popups, or AI assistant before attribution and guardrails exist.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| `CMO` acts as Growth PM | Avoids creating a redundant manager while keeping growth accountability under CEO. | - Pending |
| Plan all agents now | Existing roles overlap; cleanup is required before automatic delegation. | - Pending |
| Blog belongs to SEO | MKT blog roles duplicate SEO roles and create ownership ambiguity. | - Pending |
| SOC is the social content lane | Social content plans should not be hidden under MKT blog roles. | - Pending |
| BigQuery is the current operational data source | GA4/GSC data is available only through BigQuery export, so contracts and plugin tools must be BigQuery-first. | - Pending |
| Paperclip plugin mediates data access | Agents should consume allowlisted BigQuery reports, not raw credentials, direct GA4/GSC access, or arbitrary SQL. | - Pending |
| Agents may prepare patches/PRs | This enables concrete website work while preserving approval governance. | - Pending |
| Linux Writer is part of pilot planning | It changes the Linux Reader funnel from pure freeware routing into a low-price product path. | - Pending |
| No day-based launch plan | The company should run continuously through phases and routines, not fixed calendar windows. | - Pending |

---
*Last updated: 2026-04-29 after DiskInternals GSD initialization*
