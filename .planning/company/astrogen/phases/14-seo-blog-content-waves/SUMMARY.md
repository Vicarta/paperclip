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
