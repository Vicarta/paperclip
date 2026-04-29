# PR, QA, Approval, And Indexing Workflow

## Agent Output Types

Agents may produce:
- recommendation document;
- content brief;
- refreshed content draft;
- CTA/popup copy variant;
- internal linking queue;
- website patch;
- pull request.

Agents may not publish directly to production.

## PR Requirements

Every PR or patch-ready artifact must include:
- affected URLs;
- related `DIS` issue;
- product lane;
- source data or score;
- expected metric movement;
- screenshots or rendered preview if UI/content layout changes;
- rollback notes;
- QA checklist;
- indexing recommendation.

## QA Checklist

Reject or return for revision if the artifact contains:
- fake or implied recovery guarantee;
- unsupported compatibility claim;
- wrong product recommendation;
- unsupported price, discount, or sale claim;
- cannibalizing SEO target;
- generic popup copy detached from page/product context;
- localization without country/product/funnel signal;
- missing safety warning where recovery actions could cause data loss.

## Approval Gates

Approval required before:
- production publication;
- GA4/GTM/tracking changes;
- popup experiment launch;
- checkout/order flow change;
- manual indexing batch;
- AI assistant deployment;
- broad localization rollout.

## Indexing Policy

Priority 1:
- product pages;
- hubs;
- high-value refreshed pages;
- GSC opportunity pages;
- pages with changed title/H1/core content/CTA/internal links.

Priority 2:
- new commercial articles;
- localized winners;
- pages with position 4-20 opportunity.

Do not manually submit:
- tiny text edits;
- low-value thin updates;
- pages without meaningful change;
- bulk template-only changes.

## Follow-Up Windows

For submitted URLs, schedule checks at:
- 7 days;
- 14 days;
- 28 days.

Track:
- GSC impressions/clicks/position;
- organic sessions;
- downloads;
- visit_order_page;
- purchases if attributed.
