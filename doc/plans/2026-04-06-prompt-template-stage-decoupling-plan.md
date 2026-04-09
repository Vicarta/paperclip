# Prompt Template Stage Decoupling Plan

## Goal

Remove numeric stage IDs from live agent prompt templates and enforce the correct layering:
- `promptTemplate` = optional and blank by default
- `AGENTS.md` + process docs + current issue = active stage/slot contract

## Execution Checklist

- [x] Confirm that active Astrogen agents still contain `Run Stage NN ...` prompt templates in live Paperclip config.
- [x] Define the normalization rule in project docs.
- [x] Replace stage-number prompt templates for active Astrogen SEO and Instagram lane agents with role-based versions.
- [x] Verify via live query that the targeted agents no longer contain numeric `Stage NN` prompt templates.
- [x] Re-evaluate whether prompt templates are needed at all for the live Astrogen fleet.
- [x] Clear live Astrogen `promptTemplate` values entirely so the fleet is back to `blank-by-default`.
- [x] Add a Paperclip UI guardrail so operator-facing prompt-template help warns against hardcoded stage numbers.
- [x] Deploy the Paperclip UI guardrail to the live server.
- [ ] Smoke-check one updated agent in the live UI.

## Targeted Live Agents

- `SEO Semantic Core Strategist`
- `SEO Semantic Core Validator`
- `SEO Blog Content Strategist`
- `SEO Blog Content Plan Validator`
- `Instagram Account Auditor`
- `Instagram Content Strategist`
- `Instagram Content Plan Validator`

## Replacement Principle

Good prompt templates:
- are omitted unless there is a real runtime need;
- stay role-based;
- keep stable guardrails;
- avoid numeric stage IDs;
- avoid duplicating repo workflow text.

Bad prompt templates:
- exist only to restate what already lives in `AGENTS.md`;
- start with `Run Stage 53 ...` or similar;
- restate the full process contract;
- hardcode a slot that is already explicit in the issue and repo instructions.

## Status Note

The live Astrogen fleet was normalized beyond the initial SEO and Instagram target list.
The policy was then tightened further: active Astrogen agents no longer carry any live `promptTemplate` values unless a future runtime need is demonstrated.

The remaining open item is a visual UI click-through confirmation on a live agent detail page.
