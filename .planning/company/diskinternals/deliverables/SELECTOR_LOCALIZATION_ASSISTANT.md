# Guided Selector, Localization, And Assistant Readiness

## Guided Selector Comes First

The first interactive helper should be a rule-based guided product selector, not an AI assistant.

Core questions:
1. What happened?
   - RAID failed
   - VMFS datastore not mounting
   - Need to read Linux/Mac disk
   - Need to write/edit Linux file system from Windows
   - Deleted/formatted partition
   - Database file issue
   - Office/mail file issue
2. What storage/media is involved?
3. What file system or environment?
4. Is the disk/array visible?
5. Recommended product, trial/download path, and safety warning.

## Linux Reader / Linux Writer Logic

```text
Need to read/view Linux file system from Windows -> Linux Reader
Need to create/edit files on Linux file system from Windows -> Linux Writer
Need to recover missing/deleted/damaged files -> recovery product
```

Linux Writer is a low-price utility path, not a recovery product.

## Localization Policy

Localization requires:
- country demand;
- GSC impressions/clicks/position;
- product/funnel signal;
- product priority;
- feasible page candidate.

Markets:
- US / UK / India: English remains base.
- Mexico: evaluate Spanish funnel carefully.
- France: refresh/expand French pages with proven traffic and product signal.
- Germany: refresh/expand German pages with proven traffic and product signal.
- China: investigate first; do not automatically localize.

## AI Assistant Readiness

Do not launch AI assistant until these exist:
- approved product knowledge base;
- interaction logs;
- GA4 events;
- support ticket routing;
- no-guarantee recovery policy;
- approved safety messages;
- product recommendation QA;
- limited rollout page group.

Assistant events:
- `assistant_open`
- `assistant_scenario_selected`
- `assistant_product_recommended`
- `assistant_download_click`
- `assistant_support_ticket_click`
