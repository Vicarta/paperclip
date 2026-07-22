# Phase 50 Plan: Content Portfolio And Curriculum Authority

## Goal

Maintain a visible rolling Astrogen content plan with 25 validated future topics
distributed across five editorial tracks. Audience segments are used to prevent
repetitive concentration, not as quotas and never as a reason to invent filler.

## Portfolio Targets

| Content portfolio track | Eligible topics |
| --- | ---: |
| `western_astrology_learning` | 12 |
| `audience_applied_questions` | 5 |
| `audience_trends` | 3 |
| `trust_expert_method_boundaries` | 3 |
| `commercial_unmet_demand` | 2 |

Every counted topic has exactly one `contentPortfolioTrack`. A topic may retain
one primary and optional secondary audience segments for diversity reporting,
but those fields have no hard quota.

## Invariants

- Only native topic cases at `ready` or `reserved` count.
- One `intentClusterKey` contributes to one topic row regardless of phrase,
  provider-row, or validation-run count.
- Trend Topic Generator fills only `audience_trends`; it cannot be used as
  filler for the other four tracks.
- Calendar-date and ephemeral daily-horoscope themes remain excluded.
- A western-astrology pillar, prerequisite, deepening, or example node may pass
  without accepted Semantic Core demand or a classic SERP value gap only when
  the approved curriculum graph proves a missing teaching node, unique owner,
  distinct teaching contribution, prerequisite/next-step links, and no
  cannibalization. SERP analysis and Winning Structure remain mandatory.
- The curriculum is strictly progressive: one article introduces exactly one
  new astrology concept. Adjacent definitions, twelve-item overviews,
  comparisons, FAQ answers, examples, and workflows count as additional
  concepts even when described as supporting context. Published prerequisites
  may be mentioned and linked but not retaught.
- Non-curriculum tracks use the normal demand/evidence source appropriate to
  their lane. No source may manufacture evidence for another lane.
- Every counted row preserves ownership, duplicate/cannibalization verdict,
  incoming/outgoing internal-link plan, safety boundaries, and evidence lineage.
- The visible source of truth is the `next-content-plan` case document containing
  the same native case IDs and track values enforced by the transition gate.
- Daily article production remains capped at three and is independent of the
  25-topic planning SLO.

## Work Plan

1. Add `contentPortfolioTrack` to search-demand and topic contracts and preserve
   it through guarded breakdown.
2. Extend native grouped stage-count validation with per-group minimums and
   enforce the 12/5/3/3/2 matrix at growth verification.
3. Replace all five-per-segment completion language in manifests, routines,
   workflows, bootstrap contracts, launchers, and planning state.
4. Restrict low-inventory trend discovery to `audience_trends=3`; select audience
   segments only to diversify those three topics.
5. Encode the western-astrology learning graph exception with typed curriculum
   proof, one-concept native transition gates, and no waiver of ownership, SERP
   analysis, internal links, safety, or Winning Structure.
6. Back up live state, deploy the runtime schema extension, sync policies and
   native pipelines, then verify live quota config without creating article or
   topic tasks manually.
7. Let the canonical refill continue through native automation until all track
   deficits are closed or a bounded first-class continuation is scheduled.

## Acceptance

- Native growth verification cannot reach `measured` unless ready plus reserved
  topics satisfy 12/5/3/3/2 and total at least 25.
- Trend routines cannot claim completion for non-trend track deficits.
- Audience segment imbalance is reported and corrected editorially but never
  blocks solely because a segment count is below five.
- Western-astrology prerequisite exceptions are explicit, typed, and auditable.
- A western-astrology case cannot reach article strategy, draft, CMS delivery,
  or final delivery without exactly one introduced concept and stage-specific
  curriculum proof.
- `next-content-plan` matches the native cases counted by the quota gate.
- No CMS publication, proactive Telegram watch, or old Paperclip change occurs.

## Rollback

- Restore the pre-sync clean Postgres backup and prior pipeline revisions.
- Restore the previous source-controlled policies and app image.
- Leave existing CMS drafts and the external Semantic Core service unchanged.
