---
phase: 47
status: completed
created: 2026-07-14
---

# Phase 47 Validation Strategy

## Automated

- Winning Structure plugin tests and typecheck pass.
- Manifest verifier confirms five tools, secret ref, private URL, cost capability,
  required case fields and legal pipeline transitions.
- Native pipeline sync is idempotent and does not duplicate stages or cases.
- Prompt-policy fixtures reject fake evidence, generic value blocks, recursive
  humanization, AI scores, keyword-density gates and unsupported niche claims.

## Live

- Clean app and DB remain healthy; old Paperclip remains untouched.
- Plugin loads with all required tools and a company-scoped secret.
- Validation smoke returns `valid=true` or typed validation errors without secret leakage.
- One new-article canary and one refresh canary preserve one run per revision,
  import result before retention expiry, complete final MC audit and stop at CMS draft.
- A deliberately paused fixture resumes the same run after an authorized decision.
- A high-risk ownership decision remains review-bound while another article case proceeds.

## Evidence

- Test output and build provenance.
- Pipeline sync/verify JSON.
- Live plugin health/tool inventory without token values.
- Canary case IDs, MCP run IDs/hashes, imported document IDs, CMS admin URLs,
  and explicit no-publish proof.

## Completed Evidence

- Source verification passed on 2026-07-15: Phase 47 manifest verifier,
  33 core pipeline tests, 23 Winning Structure plugin tests, 8 email plugin
  tests, and the server TypeScript check.
- Clean production app is healthy on
  `paperclip-app:v2026.626.0-vicarta.67-email-contract-20260715T0148Z`.
  The Phase 47 core delivery-recovery change was introduced in `.66`; `.67`
  adds only the tested email change-report input normalization.
- Winning Structure loaded all five tools from the private company-scoped
  configuration. The provider-reported cost event exists with
  `amountMicros=0`, preserving the provider's zero-cost response rather than
  silently dropping accounting evidence.
- Refresh canary case `f58bf6a8-0d48-439f-9534-fe33020c7a16` reached
  `delivered`: Winning Structure run
  `wsrun_20260714160900714831_5ebe73f984`, CMS draft
  [123](https://cms.astrogen.com.ua/admin/collections/blogPosts/123), existing
  cover and OG media `176` preserved, Telegram delivery proof `1267`, no
  publish.
- New-article canary case `f2d24183-891e-4767-b84d-6c5181b46030` reached
  `delivered`: Winning Structure run
  `wsrun_20260714165215651225_c53621c844`, CMS draft
  [126](https://cms.astrogen.com.ua/admin/collections/blogPosts/126), one
  `1344x768` image accepted within the 20% per-axis tolerance after QA,
  Telegram delivery proof `1268`, no publish.
- CTO change-report task `AST-373` completed through a real heartbeat. The
  allowlisted email was sent idempotently and recorded one Resend cost event
  of `1000` micros.
