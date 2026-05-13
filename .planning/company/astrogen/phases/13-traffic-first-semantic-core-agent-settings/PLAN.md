# Phase 13: Traffic-First Semantic Core Agent Settings

## Problem

Astrogen semantic-core generation recently treated broad astrology search demand as weak because it lacked direct product/entity binding. That contradicted the business goal.

For Astrogen, the primary semantic-core goal is organic traffic growth from people interested in astrology, horoscopes, zodiac signs, natal charts, compatibility, relationships, money/career astrology, and adjacent life questions that can be connected to astrology. The user's funnel stage is not the deciding factor.

Queries such as `гороскоп рака на сьогодні`, `гороскоп водолій на завтра`, and `діви знак зодіаку` are valuable target-audience traffic, not generic noise, if they are real search queries with demand and fit the configured astrology traffic strategy.

## Goal

Update Astrogen Paperclip agent settings so every semantic-core run starts from an explicit traffic-first Astrogen policy and every agent understands its responsibility.

The updated contracts must prevent another run where layer 3 or layer 4 is judged by direct product-binding rules.

## Scope

- Astrogen live agent settings in Paperclip.
- Astrogen planning docs and issue handoff templates.
- Astrogen-specific traffic policy passed by Paperclip to MCP.
- No MCP-server code changes in this phase.
- No DiskInternals changes.

## Agents To Update

Discover current live agent ids/instruction paths before editing, then update:

- `Chief Marketing Officer`
- `SEO Semantic Core Strategist` or the current Astrogen semantic-core generator agent
- `SEO Semantic Core Validator` or the current Astrogen semantic-core QA agent
- `Chief Technical Officer`
- `OPS Human Interaction Agent` / HIA role used for owner-facing updates
- optionally `CEO` only for escalation language

Known current Astrogen agent ids from the entity map:

- CMO: `b3b833ea-86f5-43b6-9773-64ad6fc3ddb5`
- MKT Growth Strategy Architect: `60580dc2-44b7-4dae-8467-2acb7d32c721`

Do not assume other ids; verify through Paperclip before live edits.

## Astrogen Traffic Strategy

Agent settings must use this Astrogen-specific principle:

```text
The primary goal of Astrogen semantic-core work is to increase organic traffic from the target audience. A query can be valuable even when the searcher is not currently looking for a paid product or service. Any astrology-related search demand can be valuable if it can bring relevant visitors and can be served honestly by Astrogen content or tools.
```

Target audience includes people searching for:

- daily, weekly, monthly, yearly horoscopes;
- zodiac signs and date/sign meanings;
- natal chart, houses, planets, aspects, interpretation;
- synastry, compatibility, relationships, partners;
- astrology for money, career, children, family, self-knowledge;
- astrology-based explanations, calculators, tools, and educational content;
- broader life-interest topics when an astrology editorial bridge is credible.

## Astrogen Layer Semantics

### Layer 1: Direct Product / Brand Demand

Examples:

- `Astrogen`
- `астроген натальна карта`
- `натальна карта онлайн`
- `синастрія онлайн`
- `консультація астролога`

Rules:

- Product/brand/service binding required.
- Strong topic fit required.
- Conservative auto-acceptance is appropriate.

### Layer 2: Adjacent Astrology Use Cases

Examples:

- `сумісність за датою народження`
- `гороскоп сумісності`
- `натальна карта дитини`
- `астрологія грошей`
- `кар'єра в натальній карті`

Rules:

- Exact product binding is useful but not mandatory.
- Service/landing pathway is required.
- Client review should ask whether the use case is a relevant Astrogen direction.

### Layer 3: Broad Astrology Traffic

Examples:

- `гороскоп рака на сьогодні`
- `гороскоп водолій на завтра`
- `діви знак зодіаку`
- `3 жовтня знак зодіаку`
- `який знак зодіаку у вересні`
- `гороскоп на тиждень близнюки`

Rules:

- Product binding is not required.
- Search-query shape is required.
- Traffic evidence is required.
- Astrology topical match is required.
- Do not park solely for `no_entity_anchor`.
- Date-specific or stale archive queries should be classified separately:
  - evergreen/date-sign queries can be valuable;
  - obsolete old-week queries may be parked unless Astrogen intentionally builds archive traffic.

### Layer 4: Broad Audience Interests With Astrology Bridge

Examples:

- relationship questions connected to compatibility;
- career/money questions connected to natal chart or astrology;
- parenting/children questions connected to child chart;
- lifestyle/gifts/planning questions connected to zodiac or astrology.

Rules:

- Product binding is not required.
- Query must still be a real search query, not a content-plan topic.
- A credible astrology editorial bridge is required.
- Extremely broad unrelated topics are not accepted unless the query itself contains the bridge or the configured bridge is specific.

## Required Astrogen MCP Config From Agents

CMO/Strategist handoff should produce a project config block equivalent to:

```json
{
  "traffic_strategy": {
    "primary_goal": "qualified_organic_traffic_growth",
    "funnel_scope": "all_stages",
    "target_audience_definition": "people interested in astrology, horoscopes, zodiac signs, natal charts, synastry, compatibility, relationships, money/career/children astrology, and broader life questions that can be connected to astrology",
    "content_role": "traffic_acquisition_first",
    "broad_topical_relevance_policy": "astrology_related_queries_are_target_audience_even_without_direct_product_binding"
  },
  "semantic_expansion": {
    "layer_policies": {
      "core_product_intent": {
        "requires_product_binding": true,
        "requires_service_pathway": false,
        "requires_topic_domain_match": true,
        "requires_editorial_bridge": false,
        "client_review_mode": "product_relevance"
      },
      "adjacent_use_case_intent": {
        "requires_product_binding": false,
        "requires_service_pathway": true,
        "requires_topic_domain_match": true,
        "requires_editorial_bridge": false,
        "client_review_mode": "service_pathway_relevance"
      },
      "audience_need_intent": {
        "requires_product_binding": false,
        "requires_service_pathway": false,
        "requires_topic_domain_match": true,
        "review_uncertain_topic_matches": true,
        "requires_editorial_bridge": false,
        "client_review_mode": "traffic_relevance",
        "allowed_topic_domains": [
          {
            "domain_id": "project_defined_topic",
            "labels": ["астрологія", "гороскоп", "знак зодіаку", "зодіак", "натальна карта", "синастрія", "сумісність", "планети", "доми"],
            "include_terms": ["астрологія", "гороскоп", "знак зодіаку", "зодіак", "натальна карта", "синастрія", "сумісність", "планети", "доми", "овен", "телець", "близнюки", "рак", "лев", "діва", "терези", "скорпіон", "стрілець", "козеріг", "водолій", "риби"],
            "exclude_terms": [],
            "semantic_profiles": ["astrogen_astrology_core"]
          }
        ]
      },
      "audience_interest_intent": {
        "requires_product_binding": false,
        "requires_service_pathway": false,
        "requires_topic_domain_match": true,
        "review_uncertain_topic_matches": true,
        "requires_editorial_bridge": true,
        "client_review_mode": "traffic_relevance",
        "allowed_topic_domains": [
          {
            "domain_id": "project_defined_topic",
            "labels": ["астрологічний міст до ширших інтересів аудиторії"],
            "include_terms": ["знак зодіаку", "за датою народження", "натальна карта", "сумісність", "астрологія", "гороскоп", "планети"],
            "exclude_terms": [],
            "semantic_profiles": ["astrogen_astrology_bridge"]
          }
        ],
        "allowed_editorial_bridges": [
          {
            "bridge_id": "astrology_bridge",
            "labels": ["через астрологію", "за знаком зодіаку", "за датою народження", "натальна карта", "сумісність", "астрологічний прогноз"]
          }
        ]
      }
    }
  }
}
```

The final field names must match the MCP server contract after implementation. The agent setting must preserve the meaning even if the exact schema changes.

## CMO Settings Changes

CMO must:

- own Astrogen traffic policy before every broad semantic-core run;
- explicitly say that all astrology-related traffic is strategically valuable unless excluded;
- create semantic-core child issues with the traffic policy included;
- not ask for layer 3/4 generation without allowed topic domains/editorial bridges;
- decide whether stale archive traffic is in or out of scope;
- route ambiguous strategic questions to the human in Ukrainian;
- keep CTO out of keyword decision authority.

CMO should ask the human only for strategy decisions, not individual obvious astrology keywords.

## SEO Semantic Core Strategist Settings Changes

Strategist must:

- use Astrogen traffic policy in `register_project`;
- call `get_paperclip_import_schema` after MCP changes;
- validate project config before live generation;
- pass prior final keywords from Paperclip;
- run layer 3 only after layer 2 client decisions and internal validation are complete;
- treat broad horoscope/zodiac/date-sign queries as valid layer 3 candidates when query shape, demand, and astrology topic match pass;
- not classify broad astrology demand as noise solely because there is no product binding;
- keep non-search audience phrases out of client review;
- summarize whether each layer produced:
  - direct core;
  - adjacent use cases;
  - broad astrology traffic;
  - broader editorial-bridge opportunities.

## SEO Semantic Core Validator Settings Changes

Validator must:

- validate layer 3 against broad astrology traffic rules, not direct product rules;
- flag as a bug if layer 3 parks high-volume astrology queries only for `no_entity_anchor`;
- verify `not_search_query` rows are not exposed to the client;
- verify broad non-astrology layer 4 candidates have a real editorial bridge;
- verify previous decisions are not shown again as normal pending review;
- approve import/client review only when the layer's business intent is respected.

Validator output should include:

- layer policy used;
- sample accepted/review/parked/rejected rows;
- whether high-volume target-audience traffic was preserved;
- whether any broad traffic was incorrectly filtered;
- recommendation: accept, return for policy/config fix, or block.

## CTO Settings Changes

CTO must be constrained:

- may fix MCP/plugin/schema/deployment/DB/observability;
- may create technical blocker issues;
- may verify that agent contracts and tools can support the policy;
- must not approve/reject keywords;
- must not write semantic-core review decisions;
- must not override strategist/validator semantic classification;
- must not close semantic-core generation issues as done unless the assigned semantic owner has produced the required artifacts.

## HIA Settings Changes

HIA must explain broad traffic simply:

```text
Ці запити можуть приводити людей, які цікавляться астрологією. Вони можуть бути корисними навіть тоді, коли людина ще не шукає конкретну послугу.
```

HIA must avoid:

- `product_binding`;
- `no_entity_anchor`;
- `layer_membership`;
- `parked`;
- raw MCP policy labels.

## Live Update Steps

1. Inspect current Astrogen live agents and instruction paths.
2. Record current instruction hashes/snapshots for rollback.
3. Update CMO instructions with traffic-policy ownership and issue handoff requirements.
4. Update SEO Semantic Core Strategist instructions with Astrogen layer policy and MCP config requirements.
5. Update SEO Semantic Core Validator instructions with layer-aware validation checks.
6. Update CTO instructions with semantic-decision boundary.
7. Update HIA instructions with client-facing explanation language.
8. Create or update a reusable Astrogen semantic-core issue template.
9. Run a dry-read verification: ask each agent what it would do for layer 3 without starting a live run.
10. Only after verification, create a new controlled semantic-core layer 3 rerun issue.

## Acceptance Criteria

- CMO contract includes Astrogen traffic-first semantic-core strategy.
- Strategist contract says layer 3 broad astrology traffic does not require product binding.
- Validator contract would reject the previous `no_entity_anchor`-only layer 3 failure.
- CTO contract explicitly forbids semantic decision writes/overrides.
- HIA contract explains broad traffic in Ukrainian without internal labels.
- A sample layer 3 issue generated by CMO contains traffic strategy, allowed topic domains, prior final keyword requirement, and validation handoff.
- No DiskInternals agent or planning file is changed.

## Verification

- Compare live agent instruction snapshots before/after.
- Use Paperclip API to fetch updated agent configs and confirm required clauses.
- Create a non-running dry-run prompt/comment for layer 3 and verify:
  - daily horoscope and zodiac queries are treated as potentially valuable traffic;
  - raw audience notes remain non-keywords;
  - product binding is required only for layer 1;
  - validator has an explicit check for incorrect `no_entity_anchor` filtering.
- Confirm no live MCP run starts during contract verification.

## Follow-Up After Settings Are Updated

After the agent settings are verified, run a new layer 3 only with:

- updated MCP support for traffic-aware layer policies;
- Astrogen traffic policy in registered project config;
- prior final keywords from Paperclip;
- clear validation child issue;
- client portal exposure only after validator acceptance.

## Execution Result

Completed on 2026-05-11.

Live Astrogen updates applied:
- `/home/paperclip/astrogen/agents/cmo/AGENTS.md`
- `/home/paperclip/astrogen/agents/seo-semantic-core-strategist/AGENTS.md`
- `/home/paperclip/astrogen/agents/seo-semantic-core-validator/AGENTS.md`
- `/home/paperclip/astrogen/agents/cto/AGENTS.md`
- `/home/paperclip/astrogen/agents/human-interaction-agent/AGENTS.md`
- `/home/paperclip/astrogen/docs/process/53-seo-semantic-core.md`
- `/home/paperclip/astrogen/docs/process/54-seo-semantic-core-validation.md`
- `/home/paperclip/astrogen/docs/records/2026-05-11-semantic-core-layer-handoff-template.md`

Backups and after-hashes are stored at `/home/paperclip/astrogen/backups/agent-contracts-20260511T160709Z`.

Deferred: live MCP schema verification and new layer 3 run, because the MCP server is still being updated for the matching contract.
