# Phase 8: Semantic Core Agent Traffic Strategy Contracts

## Problem

Paperclip semantic-core agent contracts still lean too heavily on a product-binding interpretation of keyword quality. That is safe for direct product/service layers, but wrong for traffic-growth layers where the company intentionally wants broad top-of-funnel traffic from its target audience.

The MCP server should remain company-agnostic. It should not know that a specific client's broad topical traffic is valuable. Paperclip agents must provide that business strategy through project config, layer policy, review instructions, and validation criteria.

## Goal

Create a reusable Paperclip operating contract for semantic-core work where:

- CMO/Growth owns the company traffic strategy and layer intent;
- SEO Semantic Core Strategist translates that strategy into MCP `register_project` config;
- SEO Semantic Core Validator validates results against the active layer policy, not a universal product-binding rule;
- CTO handles MCP/plugin/schema/tooling blockers only and does not override semantic decisions;
- HIA/portal text explains client review in business language;
- prior final keyword decisions remain authoritative and do not re-enter review unless explicitly forced.

## Scope

- Agency-core process documentation.
- Shared agent instruction snippets/templates for live Paperclip agent settings.
- Paperclip issue handoff contract between CMO, SEO Semantic Core Strategist, SEO Semantic Core Validator, CTO, HIA, and portal/client-facing roles.
- No MCP-server implementation in this phase.
- No client-specific hardcoded keywords in shared contracts.

## Required Agent Contract Changes

### CMO / Growth PM

CMO owns the semantic-core business brief before live generation.

CMO must define, per company/project:

- primary traffic goal;
- funnel scope;
- target audience definition;
- allowed topical domains;
- excluded topical domains;
- whether broad top-of-funnel traffic is valuable;
- whether each layer requires product binding, service pathway, topical match, or editorial bridge;
- which ambiguous high-traffic classes should go to client review;
- which broad opportunities should stay internal.

CMO must not create a layer-generation child issue that only says "run layer 3". The child issue must include a traffic-strategy block and explicit layer policies.

### SEO Semantic Core Strategist

The strategist owns MCP execution and must:

- call `get-paperclip-import-schema` after any MCP contract update;
- register projects with full `traffic_strategy` and `semantic_expansion.layer_policies`;
- validate project config before live runs;
- run layers in order unless a human explicitly approves a rerun/skip;
- pass `prior_final_keywords` for later layers;
- never treat broad topical traffic as invalid solely because `product_binding_status = unknown` when the active layer policy disables product binding;
- reject/diagnose raw audience notes, JTBD phrases, and content-plan topics as non-keyword material when MCP marks them `not_search_query`;
- preserve `search_query_eligibility`, `query_shape_score`, `traffic_evidence_status`, `topic_domain_match`, `service_pathway_status`, `editorial_bridge_status`, `traffic_opportunity_class`, `evidence_summary`, and `decision_trace`;
- create a concise layer summary explaining how many keywords were accepted, reviewed, parked, rejected, and why.

### SEO Semantic Core Validator

The validator owns quality approval before import or client exposure.

Validator checks must be layer-aware:

- Layer 1 requires product/brand/service binding.
- Layer 2 requires service/use-case pathway.
- Layer 3 may accept broad topical traffic if topic-domain match and traffic evidence pass.
- Layer 4 may accept broader audience-interest traffic only with configured editorial bridge.

Validator must explicitly fail or return for revision if:

- product-binding rules are applied to a layer that disabled them;
- broad topical traffic is parked only due to `no_entity_anchor`;
- raw audience statements appear as client review keywords;
- prior accepted/rejected/deferred keywords reappear as normal review candidates;
- high-volume unrelated traffic is escalated without topical match or bridge;
- MCP outputs lack the required diagnostic fields after the contract says they should exist.

### CTO

CTO is limited to technical enablement:

- MCP availability;
- plugin routing;
- schema/import contract;
- database migrations;
- deployment;
- observability;
- silent-noop recovery.

CTO must not:

- write semantic-core human decisions;
- override CMO traffic strategy;
- approve/reject keywords;
- move keywords between lifecycle states;
- change a strategist's semantic outcome except by opening a technical blocker or contract-fix issue.

### CEO / Executive Oversight

CEO only resolves priority or strategy conflicts:

- whether a company wants broad top-of-funnel traffic;
- whether a broad layer is worth spend;
- whether to pause generation pending human strategy approval.

CEO should not participate in keyword-level decisions by default.

### HIA / Client Communication

HIA must translate technical layer status into simple client-facing language:

- explain that some keywords are for direct service demand;
- some are for broader target-audience traffic;
- client decisions are needed only when business relevance is ambiguous;
- avoid raw MCP labels such as `no_entity_anchor`, `parked`, `layer_membership`, or `unsafe_for_import`.

## Shared Layer Policy Model

Agent instructions should use this shared mental model:

| Layer | Business Meaning | Required Fit |
|---|---|---|
| `core_product_intent` | Direct brand/product/service demand | product or brand binding |
| `adjacent_use_case_intent` | Adjacent use cases that can map to products/pages | service or landing pathway |
| `audience_need_intent` | Broad topical search demand from target audience | search query + traffic evidence + allowed topic-domain match |
| `audience_interest_intent` | Broader audience interests that can attract target audience | search query + traffic evidence + configured editorial bridge |

`no_entity_anchor` is not a universal blocker. It is a blocker only when the active layer policy requires product/entity binding.

## Required Agent-Provided MCP Config

CMO/Strategist handoff must include a project policy block equivalent to:

```json
{
  "traffic_strategy": {
    "primary_goal": "qualified_organic_traffic_growth",
    "funnel_scope": "all_stages",
    "target_audience_definition": "configured per company",
    "content_role": "traffic_acquisition_first"
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
            "labels": ["configured per company"],
            "include_terms": ["configured per company"],
            "exclude_terms": [],
            "semantic_profiles": []
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
            "labels": ["configured per company"],
            "include_terms": ["configured per company"],
            "exclude_terms": [],
            "semantic_profiles": []
          }
        ]
      }
    }
  }
}
```

The exact JSON can evolve with the MCP server, but the semantic responsibilities must remain.

## Issue Handoff Contract

Semantic-core generation child issues must include:

- company and project scope;
- target language/geo/device;
- traffic strategy;
- layer to run;
- layer policy;
- allowed topics/bridges;
- excluded topics;
- prior final keyword source;
- expected client-review behavior;
- spend/cache mode;
- validation issue owner after generation.

Validation child issues must include:

- source run id;
- import readiness;
- quality report;
- layer policy used;
- expected layer behavior;
- explicit checks for broad traffic vs product-binding mistakes;
- accept/return/block decision.

## Acceptance Criteria

- Shared `SEMANTIC_CORE_MCP_AGENT_INSTRUCTIONS` describes traffic-strategy-aware layer policies.
- Live agent contracts can be updated from reusable snippets without client-specific hardcoding.
- CMO contract requires a traffic strategy before production layer generation.
- SEO Semantic Core Strategist contract requires `traffic_strategy` and `layer_policies` in project registration when broad layers are used.
- Validator contract checks broad traffic against the configured layer policy.
- CTO contract explicitly forbids semantic decision writes and keyword lifecycle overrides.
- HIA contract has client-safe explanation rules for broad traffic layers.
- Tests or manual verification prove that a layer 3 issue can be created with broad topical traffic allowed without changing MCP code.

## Verification

- Inspect live agent instructions after update for CMO, SEO Semantic Core Strategist, SEO Semantic Core Validator, CTO, HIA.
- Create one dry-run Paperclip issue payload for a generic company showing traffic strategy and layer policy.
- Confirm the strategist prompt would register MCP config rather than relying on implicit defaults.
- Confirm the validator prompt would reject product-binding-only gating in a broad traffic layer.
- Confirm CTO cannot write semantic-core review decisions through Paperclip decision endpoints.

## Dependencies

- MCP server support for configurable traffic strategy and layer policies.
- Paperclip plugin support for preserving new MCP fields.
- Existing semantic-core client review and inventory endpoints.

## Non-Goals

- Do not implement MCP classification changes here.
- Do not hardcode Astrogen, astrology, horoscope, zodiac, or any other niche into agency-core contracts.
- Do not change client portal UI copy except through separately planned portal work.

## Execution Result

Completed on 2026-05-11.

Reusable contract now exists in `.planning/agency-core/processes/SEMANTIC_CORE_MCP_AGENT_INSTRUCTIONS.md`:
- Paperclip agents own company-specific traffic strategy.
- MCP receives traffic strategy and layer policy through project config.
- `core_product_intent`, `adjacent_use_case_intent`, `audience_need_intent`, and `audience_interest_intent` have distinct required-fit rules.
- `no_entity_anchor` / unknown product binding are not universal blockers.
- Broad top-of-funnel traffic can be valid when it is a real search query with evidence and target-audience fit.

The Astrogen live implementation of this shared contract is recorded in `.planning/company/astrogen/phases/13-traffic-first-semantic-core-agent-settings/PLAN.md`.
