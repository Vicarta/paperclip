# Dry-Run Layer 3 Issue Payload

This is a non-running verification payload. Do not submit it to a live agent until the MCP server contract update is ready.

## Title

Run Astrogen semantic-core layer 3 from validated layer 2 seed set

## Assignee

SEO Semantic Core Strategist

## Required Context

Company: Astrogen

Layer: `audience_need_intent`

Primary goal: qualified organic traffic growth from the target audience.

Funnel scope: all stages. The searcher does not need to be near purchase intent.

Target audience: people interested in astrology, horoscopes, zodiac signs, natal charts, synastry, compatibility, relationships, money/career/children astrology, and broader life questions that can be connected to astrology.

Language/geo/device:
- keyword language: Ukrainian
- geo: Ukraine
- device: configured project default unless the active issue states otherwise

Prior final keyword source:
- use Paperclip semantic-core final decisions from completed layer 1 and layer 2 batches;
- pass prior `accepted`, `rejected`, `deferred`, and `removed` keywords to MCP as prior final keywords;
- do not return prior final decisions as normal pending client-review items unless an explicit `force_re_review_keywords` list is provided.

## MCP Preconditions

- Do not run live while MCP server is still being updated for traffic-aware layer policies.
- After MCP readiness, call `get-paperclip-import-schema`.
- Confirm the schema supports or can preserve:
  - `search_query_eligibility`;
  - `query_shape_score`;
  - `traffic_evidence_status`;
  - `topic_domain_match`;
  - `matched_topic_domains`;
  - `product_binding_status`;
  - `service_pathway_status`;
  - `editorial_bridge_status`;
  - `traffic_opportunity_class`;
  - `layer_membership`;
  - `parked_reason`;
  - `rejected_reason`;
  - `human_review_reason`;
  - `evidence_summary`;
  - `decision_trace`.

## Layer 3 Policy

`audience_need_intent` means broad astrology traffic.

Register the broad layer config in project config before running the layer:

```json
{
  "requires_product_binding": false,
  "requires_service_pathway": false,
  "requires_topic_domain_match": true,
  "review_uncertain_topic_matches": true,
  "allowed_topic_domains": [
    {
      "domain_id": "project_defined_topic",
      "labels": ["астрологія", "гороскоп", "знак зодіаку", "зодіак", "натальна карта", "синастрія", "сумісність", "планети", "доми"],
      "include_terms": ["астрологія", "гороскоп", "знак зодіаку", "зодіак", "натальна карта", "синастрія", "сумісність", "планети", "доми", "овен", "телець", "близнюки", "рак", "лев", "діва", "терези", "скорпіон", "стрілець", "козеріг", "водолій", "риби"],
      "exclude_terms": [],
      "semantic_profiles": ["astrogen_astrology_core"]
    }
  ]
}
```

Product binding and service pathway are not required.

Required:
- plausible search-query shape;
- traffic evidence;
- astrology topic-domain match;
- Ukrainian lane isolation.

Allowed topical domains include:
- astrology;
- horoscope;
- zodiac signs;
- natal chart;
- synastry;
- compatibility;
- planets / houses / aspects;
- money, career, relationships, children, and family through astrology.

Examples that should remain potentially valid if they have query shape and demand:
- `гороскоп рака на сьогодні`
- `гороскоп водолій на завтра`
- `діви знак зодіаку`
- `3 жовтня знак зодіаку`
- `який знак зодіаку у вересні`
- `гороскоп на тиждень близнюки`

Do not park only because:
- `product_binding_status = unknown`;
- `no_entity_anchor`;
- top-of-funnel intent.

Do not expose to client review:
- `search_query_eligibility = not_search_query`;
- `layer_membership = rejected_noise`;
- `rejected_reason = not_search_query`;
- raw audience/JTBD/content-plan phrases.

## Expected Output

After the run:
- call `prepare-paperclip-import`;
- summarize accepted/review/parked/rejected counts;
- show sample rows from each bucket;
- state whether broad astrology traffic was preserved or incorrectly filtered;
- create a validator handoff before any client portal exposure.

## Validator Must Check

- Product binding was not required for layer 3.
- Broad astrology queries were not parked only for `no_entity_anchor`.
- Prior final layer 1/2 decisions did not reappear as normal pending review.
- Non-search content-plan phrases stayed internal.
- Client-visible review rows are understandable and decision-worthy.
