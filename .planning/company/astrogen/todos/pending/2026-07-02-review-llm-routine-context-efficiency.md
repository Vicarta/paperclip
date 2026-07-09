---
created: 2026-07-02T20:41:21.208Z
title: Review LLM routine context efficiency
area: planning
files:
  - .planning/company/astrogen/STATE.md
  - .planning/company/astrogen/phases/41-clean-activation-gates/41-VERIFICATION.md
  - ops/paperclip-astrogen-clean/scripts/bootstrap-astrogen-growth-os.mjs
  - ops/paperclip-astrogen-clean/manifests/routines.yaml
---

## Problem

Phase 41 activation proved that the clean Astrogen SEO/release routines work
through the intended Paperclip harness. The enabled routines completed real
scheduler-backed issues: AST-9 daily evidence, AST-10 GSC indexing audit,
AST-12 weekly SEO/GEO action cycle, and AST-6/AST-7 release check.

Those LLM routine runs still used large input contexts because Codex/Paperclip
injects broad run context and agents may need to call plugin tools. This is not
a current activation blocker because Codex is running on a subscription, but it
should remain visible as a future reliability/efficiency question. The goal is
not just cost reduction: smaller routine context can reduce drift, long runs,
raw JSON sprawl, and accidental over-analysis in recurring cycles.

Current mitigation already applied:

- canonical Astrogen scope fixed to `https://astrogen.com.ua`,
  `sc-domain:astrogen.com.ua`, and `https://cms.astrogen.com.ua/api`;
- plugin access routed through `/api/agents/me/plugin-tools`;
- output caps added: max 10 rows/source by default and no raw plugin JSON dumps.

## Solution

TBD after observing several normal scheduled cycles. Likely options:

- keep current LLM routines if reliability remains acceptable;
- add code-backed preaggregation for GSC/CMS/CrawlObserver so LLM agents receive
  only compact evidence packets;
- split deterministic collection from LLM reasoning more strictly;
- add routine-level efficiency KPIs that track run duration, raw/cached tokens,
  output bytes, created follow-up count, and completion quality.
