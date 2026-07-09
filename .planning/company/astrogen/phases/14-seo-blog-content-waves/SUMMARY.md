# Phase 14 Summary: SEO Blog Content Waves

## Completed

- Added Astrogen Phase 14 to the roadmap.
- Added Astrogen SEO requirements for article opportunities, paced waves, human priority controls, and batch-first LLM keyword evaluation.
- Updated Astrogen state with the agreed blog-only pipeline:
  `semantic core -> article opportunities -> SERP-checked shortlist clusters -> human priorities -> paced waves -> validation -> article production -> performance feedback`.
- Extended the shared SEO Performance Loop process with blog opportunity, wave, SERP grouping, and performance feedback contracts.
- Extended Semantic Core MCP agent instructions with downstream batch-first Paperclip LLM evaluation rules.

## Key Decisions

- No new agent is needed at this stage.
- `SEO Blog Content Strategist` owns blog opportunity/backlog/wave planning.
- `SEO Blog Content Plan Validator` owns wave QA.
- SERP similarity checks are run for shortlisted wave candidates and ambiguous cluster boundaries, not the entire semantic core.
- Cluster demand must be normalized; raw volume sums are evidence, not the final score.
- Human control should steer priorities and exclusions at topic/opportunity level rather than manually sorting every keyword.

## Verification

- No live MCP run was started.
- No Paperclip live-agent settings were edited from this local context.
- `outputs/` remains ignored by Git.

## Clean Astrogen Reapply - 2026-07-09

- Reapplied the Phase 14 operating contract to the clean Astrogen Paperclip
  instance after the July clean rebuild.
- Enabled `paperclip.serper-agent-tools` for Astrogen with company-scoped
  `serper-api-key`, `https://google.serper.dev`, and
  `estimated_per_request` cost accounting.
- Updated the clean `Astrogen article slot allocator` live routine so article
  production must pass the SERP value-gap gate before brief creation.
- Updated clean live agent contracts for CMO, SEO Blog Content Strategist, SEO
  Blog Content Plan Validator, MKT Competitive Intelligence Analyst, MKT Blog
  Brief Strategist, SEO Blog Article Writer, and SEO Blog Article Validator.
- Updated clean bootstrap source so future clean rebuilds preserve the Serper
  plugin config and Phase 14 article workflow invariants.
- Backup before DB changes:
  `/home/paperclip/backups/astrogen-clean-phase14-serp-value-gap/paperclip-20260709-081857.dump`.

## Clean Verification - 2026-07-09

- Clean app health passed on `http://127.0.0.1:3210/api/health`.
- Plugin loader registered `paperclip.serper-agent-tools:google-search` and
  reported `succeeded=8 failed=0`.
- Live DB verification showed `paperclip.serper-agent-tools` status `ready`,
  company settings enabled, active managed `serper-api-key`, and article
  allocator variables `phase14ContentWaves=enabled`,
  `serpValueGapGate=enabled`, `serpValueGapProvider=paperclip.serper-agent-tools`,
  `serpValueGapGeo=ua`, `serpValueGapLanguage=uk`,
  `serpValueGapTopResults=10`, and `briefRequiresInformationGain=true`.
- Local plugin tests passed:
  `pnpm --filter @paperclipai/plugin-serper-agent-tools test` (4/4).
- No article task was manually created or pushed during this reapply.
