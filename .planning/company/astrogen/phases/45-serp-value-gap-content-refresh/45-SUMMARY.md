# Phase 45 Summary: SERP Value-Gap Content Refresh

Executed on 2026-07-09 for `paperclip-astrogen-clean`.

## What Changed

- Added requirement `AST-SEO-19`: existing-article `content_refresh` must be
  driven by relevant keyphrase and SERP value-gap analysis.
- Added a clean workflow contract:
  `serp_value_gap_content_refresh`.
- Updated clean source manifests and bootstrap:
  - `ops/paperclip-astrogen-clean/manifests/workflows.yaml`
  - `ops/paperclip-astrogen-clean/manifests/routines.yaml`
  - `ops/paperclip-astrogen-clean/scripts/bootstrap-astrogen-growth-os.mjs`
- Updated local Astrogen CMO contract with the new manager routing rule.
- Clarified older Phase 34/35 planning language so `content_refresh` is not
  confused with deterministic CMS/internal-link/relatedPosts/layout work.

## Live Clean Changes

Backup before live DB routine edits:

`/home/paperclip/backups/phase45-serp-refresh-20260709T104754Z/paperclip.dump`

Updated live AGENTS.md in `paperclip-astrogen-clean-app-1`:

- Chief Marketing Officer
- SEO Blog Content Strategist
- SEO Blog Content Plan Validator
- MKT Competitive Intelligence Analyst
- MKT Blog Brief Strategist
- SEO Blog Article Writer
- SEO Blog Article Validator
- SEO Performance Analyst

Updated live routine revisions:

- `Astrogen article slot allocator`: revision `6`
- `Weekly Astrogen SEO/GEO action cycle`: revision `8`

Both routines now have variables:

- `serpValueGapContentRefresh=enabled`
- `contentRefreshRequiresSerpValueGap=true`
- `contentRefreshNoGenericEditorialBlocks=true`

## Contract Outcome

`content_refresh` now means:

- analyze relevant keyphrases;
- inspect SERP competitors;
- identify missing user questions or decision criteria;
- define Astrogen's information-gain angle;
- update existing article body/content only where that closes the value gap.

It does not mean:

- generic `Коротко` insertion;
- generic FAQ insertion;
- generic CTA adjustment;
- relatedPosts-only work;
- internal-link-only work;
- metadata-only work;
- comparison block insertion without SERP/user-value justification.

Those remain separate lanes: editorial/layout backfill, deterministic CMS/SEO
fixing, or title/meta CTR work.

## Verification

- Clean app health:
  `{"status":"ok","deploymentMode":"authenticated","deploymentExposure":"private","bootstrapStatus":"ready","bootstrapInviteActive":false}`
- Live AGENTS.md verification: all 8 target agent files contain one `Phase 45`
  block.
- Live routine verification: both target routines have Phase 45 description,
  Phase 45 variables, current routine revision rows, and `latest_revision_id`
  pointing at the Phase 45 revision row.
- Recent heartbeat check: `active_or_queued_runs=0`, `failed_runs=0`.
- Source checks:
  - `node --check ops/paperclip-astrogen-clean/scripts/bootstrap-astrogen-growth-os.mjs`
  - Ruby YAML parse for clean `workflows.yaml` and `routines.yaml`

## Not Done

- Did not generate images.
- Did not publish CMS content.
- Did not enable Telegram proactive watches.
- Did not touch old Paperclip.
- Did not create a new content-refresh task manually; this phase changes the
  workflow contract so the next scheduler/SEO cycle routes it correctly when
  evidence supports it.
