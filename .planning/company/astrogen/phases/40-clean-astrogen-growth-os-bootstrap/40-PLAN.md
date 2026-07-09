---
phase: 40
name: clean-astrogen-growth-os-bootstrap
wave: 1
depends_on: [39]
autonomous: true
files_modified:
  - .planning/company/astrogen/phases/40-clean-astrogen-growth-os-bootstrap/
  - ops/paperclip-astrogen-clean/
  - local-paperclip/
requirements:
  - AST-GOV-01
  - AST-GOV-02
  - AST-GOV-03
  - AST-GOV-04
  - AST-GOV-06
  - AST-GOV-07
  - AST-SEO-04
  - AST-SEO-10
  - AST-SEO-13
  - AST-SEO-16
  - AST-SEO-18
  - AST-INT-01
  - AST-INT-02
  - AST-INT-03
  - AST-INT-05
  - AST-HIA-01
  - AST-HIA-03
---

# Plan: Clean Astrogen Growth OS Bootstrap

<objective>
Create the clean Astrogen Paperclip operating system from an explicit manifest:
agents, secret refs, plugins, typed workflows, routines, transition issues, and
verification gates for traffic growth, SEO/GEO optimization, and article
production, without copying the old production database or old prompt chaos.
</objective>

<must_haves>
- Source-controlled manifest exists and contains no plaintext secrets.
- Secret values are transferred only through the Paperclip secret service or
  server-side encrypted provider.
- Required plugins are installed, scoped to Astrogen, and smoke-tested.
- Core Astrogen agents exist with short role-bound contracts and no idle LLM
  timer polling.
- Paid ads and social agents are parked or disabled, not routinely executing.
- Typed workflows define states, transitions, required artifacts, owners, retry
  policy, and completion gates.
- Routines are created disabled first and activated only after their plugin and
  workflow smoke tests pass.
- Old live Paperclip remains untouched during bootstrap.
- Current live work is triaged into a small transition pack, not bulk-imported.
</must_haves>

## Execution Waves

### Wave 1: Manifest Source Of Truth

Create the clean Astrogen manifest directory under
`ops/paperclip-astrogen-clean/`.

Planned files:

- `manifests/astrogen-company.yaml`
- `manifests/secrets.yaml`
- `manifests/plugins.yaml`
- `manifests/agents.yaml`
- `manifests/workflows.yaml`
- `manifests/routines.yaml`
- `manifests/transition-pack.yaml`
- `scripts/export-clean-manifest`
- `scripts/diff-clean-manifest`
- `scripts/apply-clean-manifest`
- `scripts/verify-clean-manifest`

Rules:

- manifests contain ids, names, keys, package names, status, scopes, and secret
  refs only;
- no secret value, token, password, cookie, or private key material;
- every item has `desiredState`, `owner`, and `verification`.

### Wave 2: Secret Ref Migration

Migrate only the active Astrogen secret refs needed for Phase 40:

Required now:

- `astrogen_payload_cms_api_key`
- `crawlobserver-api-key`
- `search-console-mcp-astrogen-token`
- `telegram.bot_token.astrogen_ai_bot`
- `resend-api-key`
- `openrouter_api_key_4texts`
- `openrouter_api_key_4images`

Required for SEO provider fallback:

- `dataforseo-api-login`
- `dataforseo-api-password`
- `serper-api-key`
- `exa-api-key`

Optional until verified:

- `collaborator-api-key`
- `bright-data-api-token`

Explicitly do not activate:

- disabled legacy `openrouter-api-key`;
- cross-company DiskInternals/Perfex/BigQuery credentials.

Verification:

- each secret exists in clean company metadata;
- secret can be resolved by a server-side smoke without printing value;
- plugin config references the new clean secret id/key, not the old company id.

### Wave 3: Plugin Install And Company Scope

Install or register plugins in the clean instance in this order:

1. `paperclip-plugin-telegram`
2. `paperclip.payload-cms-agent-tools`
3. `paperclip.gsc-bing-ga4-mcp-agent-tools`
4. `paperclip.crawlobserver-agent-tools`
5. `paperclip.seo-performance-loop`
6. `paperclip.openrouter-image-agent-tools`
7. `paperclip.collaborator-agent-tools`

Hold disabled until separately justified:

- `paperclip.semantic-core-mcp-agent-tools`
- `paperclip.dataforseo-agent-tools`
- `paperclip.serper-agent-tools`
- `paperclip.exa-agent-tools`
- `paperclip.bright-data-agent-tools`
- `paperclip.winning-structure-mcp-agent-tools`
- `paperclip.search-console-mcp-agent-tools`
- `paperclip.diskinternals-bigquery-growth`
- `paperclip.perfex-crm-agent-tools`

Company-scoped settings required:

- Payload CMS: Astrogen CMS base URL and secret ref.
- GSC/Bing/GA4: Astrogen site URL, GA4 property, allowed tools, MCP token ref.
- CrawlObserver: Astrogen project id/base URL/API key ref.
- Telegram: Astrogen bot token, chat/topic config, Paperclip public URL.
- SEO Performance Loop: article cadence, report language `uk`, email transport
  through Resend secret ref, thresholds/cooldowns. Article cadence is configured
  but disabled until the article slot allocator smoke passes.
- OpenRouter image: image key ref, model, cost accounting mode.
- Collaborator: parked off-page/backlink provider config; no routine activation
  until external publisher catalog access is explicitly approved.
- Semantic Core/DataForSEO/Serper/Exa: manifest entries only until packaging and
  smoke checks prove the tools can load in the clean runtime.

Verification:

- plugin registry reports required plugins `ready`;
- each required plugin exposes its expected tools;
- each smoke resolves secrets by ref without printing them;
- no plugin reads another company's credential.

### Wave 4: Agent Roster Bootstrap

Create core agents in dependency order.

Governance:

- `CEO`
- `Chief Marketing Officer`
- `Chief Technical Officer`
- `OPS Human Interaction Agent`
- `OPS Observability Agent`

SEO/GEO:

- `SEO Performance Analyst`
- `SEO GSC Indexing Auditor`
- `SEO Semantic Core Strategist`
- `SEO Semantic Core Validator`

Article and CMS:

- `SEO Blog Content Strategist`
- `SEO Blog Content Plan Validator`
- `MKT Blog Brief Strategist`
- `SEO Blog Article Writer (Claude)`
- `SEO Blog Article Writer (ChatGPT)`
- `SEO Blog Article Validator`
- `SEO Blog Humanizer`
- `SEO Blog Article Layout Editor`
- `SEO Blog Article Layout Validator`
- `SEO Blog Image Runtime Executor`
- `SEO CMS Technical Fixer`

Growth strategy:

- `MKT Product Discovery Analyst`
- `MKT Growth Strategy Architect`
- `MKT Competitive Intelligence Analyst`

Parked future agents:

- `ADS Paid Ads Copy Strategist`
- `SOC Instagram Account Auditor`
- `SOC Instagram Content Strategist`
- `SOC Instagram Content Plan Validator`
- `SOC Social Content Strategist`

Do not recreate:

- terminated smoke agents;
- `MKT Legacy PFB Hypothesis Analyst`;
- `Stage 65 Image Runtime Specialist`;
- one-off external gateway agents unless a new explicit integration requires
  them.

Agent policy:

- `wakeOnDemand=true`;
- no idle timer polling;
- `skipIfNoActionableWork=true`;
- max concurrent runs `1` unless explicitly justified;
- manager agents route work through child issues and typed workflow states;
- OpenRouter writer has no local tool claims and must return canonical artifact
  through the issue protocol.

Verification:

- every active agent has a manager/reporting path;
- every specialist has only the plugin/tool capabilities it needs;
- no active agent has a routine LLM heartbeat timer;
- parked paid/social agents have no active routines.

### Wave 5: Typed Workflow Definitions

Implement workflow definitions as source-controlled configuration and, where
Paperclip supports it, runtime-enforced state machines.

Required workflows:

1. `semantic_core_lifecycle`
2. `seo_performance_loop`
3. `article_cadence`
4. `article_delivery_pipeline`
5. `technical_seo_finding`
6. `human_decision_telegram_writeback`
7. `product_launch_seo_package`
8. `geo_entity_content_optimization`
9. `paid_ads_readiness_disabled`
10. `social_readiness_disabled`

Every workflow must define:

- state enum;
- allowed transitions;
- owning role/agent per state;
- required input document/artifact;
- required completion evidence;
- retry/cooldown policy;
- blocker classes;
- budget/cost notes;
- owner-facing notification rule.

Runtime should reject or flag:

- done without required artifact;
- parent done before required children;
- article delivery without CMS draft URL;
- SEO report completion without action queue or explicit watch/cooldown
  decisions;
- human-decision wait without a decision brief and resume path;
- routine issue closed with no meaningful side effect.

### Wave 6: Routines Created Disabled, Then Activated

Create routines disabled first. In Phase 40, "created" means `status=paused`
and each schedule trigger has `enabled=false`. Activation is a later explicit
operator action after smoke gates, not an automatic part of bootstrap.

| Routine | Owner | Activation gate |
| --- | --- | --- |
| Daily deterministic evidence collection | plugin/backend collector, reviewed by `SEO Performance Analyst` only on findings | plugin smoke, registry write test, max URL/page quota |
| Daily due-URL GSC indexing audit | `SEO GSC Indexing Auditor` | URL Inspection smoke, due-URL quota, cooldown ledger |
| Article slot allocator | `Chief Marketing Officer` | full article dry run to CMS draft, daily cap, backlog budget check |
| Weekly Astrogen SEO action cycle | `SEO Performance Analyst` | GSC/GA4/CrawlObserver/Payload joined evidence smoke |
| Weekly Paperclip release check | `Chief Technical Officer` | clean runtime provenance check |

Do not activate paid ads or social routines in Phase 40.

Routines must create execution issues with concrete scope. They must not wake
manager agents just to ask "anything to do?".

Cycle safety invariants:

- no expensive LLM routine may use `always_enqueue`;
- no expensive LLM routine may use `enqueue_missed_with_cap`;
- missed schedules use `skip_missed`;
- concurrency is `coalesce_if_active` or `skip_if_active`;
- at most one active issue per routine key/workflow slot;
- catch-up article work must be a separate approved transition issue with a
  budget and count cap, never automatic scheduler behavior;
- Telegram is for owner-facing summaries and decisions, not internal routine
  state spam.

### Wave 7: Transition Pack From Old Live

Create a clean transition pack instead of importing old issues.

Input audit:

- `todo`, `in_progress`, and `in_review` issues from live Astrogen;
- blocked issues only when still strategically valid and not stale;
- active routines and current cadence/reporting obligations.

Output:

- one transition parent issue in clean Paperclip;
- child issues only for still-valid current work, with old identifiers linked in
  the description;
- explicit cancelled/not-migrated list for stale categories;
- link back to old issue identifiers in descriptions, not raw DB ids when avoidable.

Do not migrate:

- old done/cancelled history;
- stale blocked technical claims already fixed;
- smoke/test issues;
- issues tied to obsolete agent contracts.

### Wave 8: End-To-End Smoke

Run these smoke paths before declaring Phase 40 complete. If a plugin/routine
fails smoke, Phase 40 may still leave the clean foundation in place, but the
routine stays paused and verification records the gap.

1. Plugin smoke:
   - Payload CMS health/build state.
   - GSC/GA4 permitted tool call.
   - CrawlObserver project/session listing.
   - Telegram dry notification to allowed channel/topic.
   - OpenRouter image dry run with cost ledger.
   - Semantic Core MCP mock or low-cost validation call.

2. Agent smoke:
   - CMO creates a bounded child issue.
   - SEO Performance Analyst produces a small evidence document.
   - Article writer returns canonical artifact protocol.
   - CMS Technical Fixer creates or validates a draft in dry/safe mode where
     supported.

3. Workflow smoke:
   - one article pipeline reaches `cms_draft_created` or safe dry-run equivalent;
   - one SEO evidence loop reaches `classify_actions`;
   - one human-decision workflow creates a decision brief and can resume after
     writeback.

4. Cost smoke:
   - no active idle timer LLM heartbeat;
   - no unbounded repeated wakeups;
   - provider cost events exist for paid provider calls where supported.

## Execution Safety

- Do not stop, restart, or mutate old live Paperclip during Phase 40.
- Do not print secret values.
- Do not run article cadence repeatedly before the dry run passes.
- Do not run article catch-up automatically.
- Do not enable paid/social routines.
- Do not use DB writes when a stable Paperclip API/CLI path exists.
- If direct DB bootstrap is unavoidable, it must be idempotent, auditable, backed
  up, and followed by API-level readback verification.

## Verification

- `curl -fsS http://ubuntu-oc.tailbd4e1c.ts.net:3210/api/health`
- clean company counts match manifest targets;
- `verify-clean-manifest` reports no drift;
- required secret refs exist and resolve in server-side smoke without value
  exposure;
- required plugins are `ready`;
- plugin tool discovery works for the relevant agents;
- active agent roster matches allowlist;
- no active agent has unauthorized idle timer polling;
- routines are disabled before smoke and remain paused if gates are not proven;
- no routine uses `always_enqueue` or `enqueue_missed_with_cap` for expensive
  LLM work;
- article/SEO/human-decision dry runs complete required states;
- old live `http://127.0.0.1:3200/api/health` remains `ok`.

## Completion Criteria

- [ ] Manifest source of truth created.
- [ ] Secrets migrated as refs, no values exposed.
- [ ] Required plugins installed and company-scoped.
- [ ] Core agents created and verified.
- [ ] Paid/social agents parked or manifest-only.
- [ ] Typed workflows defined.
- [ ] Routines created paused with disabled triggers and safe concurrency.
- [ ] Transition pack created from current live work.
- [ ] End-to-end smoke passes, or remaining activation gaps are documented with
      routines left paused.
- [ ] GSD summary and verification files updated.
