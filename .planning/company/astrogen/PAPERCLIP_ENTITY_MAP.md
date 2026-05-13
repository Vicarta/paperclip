# Paperclip Entity Map: Astrogen

## Company

| Entity | Value |
|---|---|
| Company | Astrogen |
| Company ID | `c33f6b81-5ced-4270-9288-b46a32f6337a` |
| Issue prefix | `AST` |
| Primary human language | Ukrainian |
| Primary domain | `astrogen.com.ua` |
| GSC site | `sc-domain:astrogen.com.ua` |

## Shared Plugins To Verify In Astrogen Context

| Plugin | Purpose | Astrogen Status |
|---|---|---|
| GSC Bing GA4 MCP Agent Tools | Replacement adapter for GSC/Bing/GA4/PageSpeed MCP data | Created locally; deploy/configure in Astrogen context |
| Search Console MCP Agent Tools | Legacy GSC/page/query/inspection adapter | Replace with `GSC Bing GA4 MCP Agent Tools` |
| Semantic Core MCP Agent Tools | Semantic core runs and import validation | Verify before use |
| Winning Structure MCP Agent Tools | SERP-based page structure recommendations | Verify before use |
| SEO Performance Loop | Published article registry and monitoring loop | Verify enabled/configured |
| Telegram | Human-facing notifications and handoff | Verify message style/config |
| DataForSEO / Serper / Exa | Keyword/SERP/research support | Verify budget and guardrails |

## Notes

- Do not assume a plugin tested in DiskInternals is enabled or correctly configured for Astrogen.
- Do not copy DiskInternals project IDs, agent IDs, budgets, or task references into Astrogen operations.

## Key Agents

| Agent | Agent ID | Reports To | Purpose |
|---|---|---|---|
| Chief Marketing Officer | `b3b833ea-86f5-43b6-9773-64ad6fc3ddb5` | CEO | Manager for marketing/product/SEO/content workflows. |
| MKT Growth Strategy Architect | `60580dc2-44b7-4dae-8467-2acb7d32c721` | CMO | Stage 15 owner for strategic opportunity briefs after product discovery and before downstream execution. |

## Live Contract Files

| Contract | Live Path |
|---|---|
| Growth Strategy Architect agent instructions | `/home/paperclip/astrogen/agents/growth-strategy-architect/AGENTS.md` |
| Stage 15 Strategic Opportunity Brief process | `/home/paperclip/astrogen/docs/process/15-strategic-opportunity-brief.md` |
| CMO routing rule | `/home/paperclip/astrogen/agents/cmo/AGENTS.md` |
| SEO Blog Content Strategist instructions | `/home/paperclip/astrogen/agents/seo-blog-content-strategist/AGENTS.md` |
| SEO Blog Content Plan Validator instructions | `/home/paperclip/astrogen/agents/seo-blog-content-plan-validator/AGENTS.md` |
| SEO Blog Content Plan process | `/home/paperclip/astrogen/docs/process/56-seo-blog-content-plan.md` |
| SEO Blog Content Plan Validation process | `/home/paperclip/astrogen/docs/process/58-seo-blog-content-plan-validation.md` |

## Validation Issues

| Issue | Result |
|---|---|
| `AST-689` | CMO plan-only test for `https://astrogen.com.ua/free-horoscope`; CMO planned Stage 10 Product Discovery -> Stage 15 Strategic Opportunity Brief -> human strategy approval; no child issues were created. |
| `AST-690` | Direct `MKT Growth Strategy Architect` smoke test for `/free-horoscope`; produced a speculative Ukrainian Stage 15 brief, preserved missing-discovery caveat, and created no child issues. |
