# Pilot Backlog System

## Confirmed Allocation

| Lane | Share | Primary Purpose |
|------|------:|-----------------|
| RAID Recovery | 35% | Large traffic and direct commercial recovery intent |
| VMFS Recovery | 25% | Strategic core product and high-value recovery intent |
| Linux Reader / Linux Writer funnel | 25% | Freeware/utility traffic routed to paid writer or recovery paths |
| Download / Thank You / Checkout flow | 15% | Shortest path from trial to order to purchase |

## Work Type Mix

- Existing article refresh before net-new article volume.
- Product page CRO blocks.
- Internal linking tasks.
- Scenario-based popup/CTA variants.
- New articles only where score and gap justify them.
- Localization tests only where country, GSC, product, and funnel signals align.

## RAID Lane

Backlog sources:
- RAID product page traffic and funnel data.
- RAID articles with GSC position 4-20.
- Pages with weak product links to RAID Recovery.
- CTA/popup uncertainty: unknown RAID parameters, preview before purchase, safe recovery steps.

Outputs:
- refresh tasks;
- product-page CRO tasks;
- internal links;
- popup/CTA variants;
- indexing candidates.

## VMFS Lane

Backlog sources:
- VMFS product page and articles.
- Datastore not mounting, VMDK visibility, ESXi/VMware query clusters.
- Pages with strong impressions and weak download/order signal.

Outputs:
- refresh tasks;
- product routing blocks;
- internal links;
- popup/CTA variants;
- indexing candidates.

## Linux Reader / Linux Writer Lane

Separate intents:
- Linux Reader: free read/view utility.
- Linux Writer: low-price write/edit utility from Windows to Linux file systems.
- Recovery products: when the user needs to recover files, not just read/write.

Routing:

```text
Read Linux disk -> Linux Reader
Write/edit files on Linux file system from Windows -> Linux Writer
Recover missing/deleted/damaged files -> relevant recovery product
```

Do not push recovery products where user only needs a utility. Do not route recovery intent to Linux Writer.

## Download / Thank You / Checkout Lane

Focus:
- safety message after download;
- correct product next step;
- preview-before-purchase guidance;
- product discovery on download pages;
- source-page and product attribution preservation.

## Backlog Acceptance Criteria

Every backlog item must include:
- target URL or URL group;
- product lane;
- source signal;
- expected metric movement;
- owner agent;
- QA requirement;
- indexing/follow-up need.
