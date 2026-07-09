# Phase 40: Clean Astrogen Growth OS Bootstrap - Context

**Gathered:** 2026-07-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the minimal production-ready Astrogen operating model inside the clean
Paperclip instance created in Phase 39.

This phase covers:

- source-controlled Astrogen manifest for agents, plugins, secret refs, routines,
  typed workflows, and verification gates;
- migration of secret metadata and secret values into the clean instance without
  committing or printing plaintext values;
- installation/configuration of the Astrogen-required plugin set;
- creation of the clean Astrogen agent roster;
- activation of only the routines needed for traffic growth, SEO, GEO, article
  production, technical SEO, and reporting;
- transition planning for current live tasks without bulk-importing the old issue
  backlog.

This phase does not cover:

- copying the old production database;
- importing all historic issues/comments/runs;
- keeping compatibility with obsolete agent contracts;
- activating paid ads or social-media operating cycles;
- public internet exposure of the clean instance.
</domain>

<baseline>
## Current Clean Instance

Clean Paperclip:

- URL: `http://ubuntu-oc.tailbd4e1c.ts.net:3210`
- Compose project: `paperclip-astrogen-clean`
- Company: `Astrogen`, prefix `AST`
- Current clean counts: `0` agents, `0` plugins, `0` routines, `0` company
  secrets.

Existing live Paperclip remains separate on `127.0.0.1:3200`.

## Current Live Astrogen Inventory Snapshot

Live Astrogen agent snapshot:

- `38` active-or-attention agents;
- `4` terminated agents;
- `1` OpenRouter text agent;
- `1` Hermes gateway agent;
- many agents currently have `runtime_config.heartbeat.enabled=true`, which is
  not the desired clean operating model for token cost.

Live Astrogen routines:

| Routine | Assignee | Schedule | Decision for clean |
| --- | --- | --- | --- |
| `Astrogen GSC indexing audit` | `SEO GSC Indexing Auditor` | daily `06:20 Europe/Kiev` | recreate after plugin smoke |
| `Three-daily Astrogen SEO blog article cadence` | `Chief Marketing Officer` | `10:00,15:00,19:00 Europe/Kiev` | recreate disabled first, then activate after article dry run |
| `Weekly Astrogen SEO action cycle` | `SEO Performance Analyst` | Wednesday `09:00 Europe/Kiev` | recreate after SEO evidence smoke |
| `Weekly Paperclip GitHub release check` | `Chief Technical Officer` | Tuesday `06:00 Europe/Kiev` | recreate after runtime provenance check |

Open live issue state at planning time:

- `todo`: 3
- `in_progress`: 3
- `in_review`: 6
- `blocked`: 86
- `backlog`: 9
- historic `done/cancelled`: not imported into clean by default

## Secret Metadata To Migrate

The following are secret names/keys only. Values must be copied through the
Paperclip secret service or server-side encrypted provider, never through Git,
planning docs, shell history, comments, Telegram, or issue descriptions.

| Clean secret key | Purpose |
| --- | --- |
| `astrogen_payload_cms_api_key` | Payload CMS API access |
| `crawlobserver-api-key` | CrawlObserver API |
| `search-console-mcp-astrogen-token` | GSC/GA4 MCP tenant token |
| `telegram.bot_token.astrogen_ai_bot` | Astrogen Telegram bot |
| `resend-api-key` | detailed SEO report email transport |
| `openrouter_api_key_4texts` | OpenRouter text model lane |
| `openrouter_api_key_4images` | OpenRouter image plugin lane |
| `dataforseo-api-login` | DataForSEO login |
| `dataforseo-api-password` | DataForSEO password |
| `serper-api-key` | Serper search fallback |
| `exa-api-key` | Exa research connector |
| `collaborator-api-key` | off-page/link-collaboration connector |
| `bright-data-api-token` | optional web data connector, only if verified |

Do not migrate the disabled legacy `openrouter-api-key` as an active default.

## Plugin Baseline

Current live plugin registry includes:

- ready or intended for Astrogen clean: Telegram, Payload CMS, GSC/Bing/GA4,
  CrawlObserver, OpenRouter image, SEO Performance Loop, Collaborator;
- useful after smoke/need: DataForSEO, Serper, Exa, Bright Data;
- exclude from Astrogen clean by default: DiskInternals BigQuery, Perfex CRM,
  old Search Console plugin superseded by GSC/Bing/GA4, Winning Structure until a
  clean Astrogen contract exists.

No plugin should rely on a single global secret when the credential is
company-specific.
</baseline>

<decisions>
## Locked Decisions

1. Do not clone the old Astrogen company or database into the clean instance.
2. Use an allowlist manifest for agents/plugins/secrets/routines/workflows.
3. Secret values must move through server-side secret operations only.
4. Plugin settings must be company-scoped where the credential or project scope
   belongs to Astrogen.
5. The clean system must be event/routine driven. No idle LLM timer polling for
   managers or specialists.
6. Agent contracts should be shorter and role-bound, with explicit handoff and
   blocker rules rather than long accumulated prompt patches.
7. Workflows must be typed state machines with allowed transitions, required
   artifacts, owner, retry/cooldown policy, and completion evidence.
8. Paid ads and social agents may exist as parked future capacity, but no paid or
   social routine should be active in this phase.
9. Current live tasks should be triaged into a small transition pack. Do not
   import historic noise or all blocked issues.
10. Every activation step needs smoke evidence before the next layer is enabled.

## Claude's Discretion

- Exact implementation mechanism for the manifest applier can be API-first,
  CLI-first, or a controlled server-side bootstrap script, depending on what the
  current Paperclip runtime exposes safely.
- Roster can be split into multiple waves if agent creation APIs or model adapter
  config require extra discovery.
- Paid/social parked agents may be created immediately or represented only in
  the manifest until their first approved campaign.
</decisions>

<specifics>
## Required Operating Model

Primary business goal:

```text
more qualified traffic
-> stronger SEO/GEO visibility
-> better internal linking and topical authority
-> steady Ukrainian blog production
-> technical SEO hygiene
-> concise owner reporting
```

GEO here means answer-engine / AI-search visibility: clearer entity facts,
sourceable expertise, structured article answers, topical depth, and monitoring
of query/page evidence that can influence AI answer surfaces.

Core workflows to model:

- Semantic Core Lifecycle
- SEO Performance Loop
- Article Cadence
- Article Delivery Pipeline
- Technical SEO Finding Lifecycle
- Human Decision / Telegram Writeback
- Product Launch SEO Package
- GEO Content/Entity Optimization Review
- Paid Ads Readiness, disabled
- Social Content Readiness, disabled

Expected clean output shape:

```text
manifest export/diff/apply
-> secrets created as refs
-> plugins installed and scoped
-> core agents created
-> workflows/routines created disabled
-> smoke each plugin and agent lane
-> activate only SEO/GEO/content routines
-> create transition issues for current live tasks worth carrying forward
```
</specifics>

<deferred>
## Deferred Ideas

- Direct paid campaign execution.
- Direct social posting.
- Backlink purchase/outreach execution.
- Client portal migration.
- Historic issue archive migration.
- Public internet exposure of clean Paperclip.
</deferred>

---

*Phase: 40-clean-astrogen-growth-os-bootstrap*
*Context gathered: 2026-07-02*
