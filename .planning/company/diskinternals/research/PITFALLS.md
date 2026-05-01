# Research: Pitfalls And Guardrails

## Critical Pitfalls

1. Local Paperclip context points to Astrogen.
   - Guardrail: every API action must explicitly use DiskInternals company ID and `DIS` prefix.

2. Blog ownership is duplicated.
   - Guardrail: SEO owns blog work; MKT blog-prefixed agents must be renamed, repurposed, or held.

3. Product attribution is incomplete.
   - Guardrail: use Product Proxy Score until ecommerce attribution is fixed.

4. Agents may try to bypass the BigQuery source of truth.
   - Guardrail: agents use allowlisted BigQuery-backed Paperclip plugin reports; `bq` CLI is ops-only, and arbitrary SQL/direct GA4/GSC access is out of scope.

5. Linux Writer is upcoming.
   - Guardrail: include placeholder mapping and launch status, but do not fabricate URLs, pricing, or claims.

6. Popup strategy can become generic discount spam.
   - Guardrail: only contextual uncertainty-reducer variants are in scope.

7. Localization can overfit country traffic.
   - Guardrail: require country demand plus GSC plus product/funnel signal.

8. AI assistant can produce unsafe recovery advice.
   - Guardrail: guided selector first; assistant only after safety and telemetry prerequisites.

9. Specialist routines can burn budget.
   - Guardrail: keep only `CEO`, `CMO`, and `CTO` scheduled by default.

10. PRs can become unreviewable.
    - Guardrail: every PR needs affected URLs, rationale, expected metric movement, QA checklist, and rollback notes.
