# Phase 15 Summary: Paperclip Document Annotations And Secret Config Rollout

## Result

Phase 15 adds the operating contracts needed to use the useful `v2026.529.0`
collaboration/config capabilities in production workflows:

- issue documents are now the expected surface for owner decisions, article
  review packets, detailed SEO reports, and material technical-finding batches;
- inline annotations are the expected review mechanism when the reviewer needs
  to point at exact text, table rows, URLs, metrics, or CMS fields;
- accepted artifacts must be locked/frozen after approval, with later changes
  routed through a revision document or child issue;
- plugin settings must use company-scoped secret references, not plaintext
  credentials, and UI config should use SecretBindingPicker-compatible fields
  where Paperclip exposes them.

## Files Updated

- `.planning/agency-core/ROADMAP.md`
- `.planning/agency-core/governance/AGENT_EXECUTION_GOVERNANCE.md`
- `.planning/agency-core/processes/SEO_PERFORMANCE_LOOP.md`
- `.planning/company/astrogen/process/68-seo-blog-article-layout.md`
- `ops/paperclip-production/manifests/plugins.md`
- `ops/paperclip-production/manifests/astrogen-agents.md`
- `astrogen-ukraine` live-contract repo:
  - `docs/foundation/HUMAN_DECISION_REQUEST.md`
  - `docs/foundation/OUTPUT_CONTRACTS.md`
  - `docs/process/69-weekly-blog-telegram-report.md`
  - `agents/cmo/AGENTS.md`

## Follow-Up

Roll the same Agency Core document/annotation rules into other company contract
repos, starting with DiskInternals, only after confirming their current artifact
and notification conventions.
