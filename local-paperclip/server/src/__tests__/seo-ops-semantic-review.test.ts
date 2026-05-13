import { describe, expect, it } from "vitest";
import {
  applySemanticCoreImportGuards,
  isChiefTechnicalOfficerAgent,
  normalizePreparedSemanticCoreImport,
  semanticCoreDecisionWriteBlockReason,
  validateSemanticCoreHumanDecision,
} from "../routes/seo-ops.js";
import {
  buildSemanticCoreMcpReviewDecisionsPayload,
  deriveSemanticCoreClientReviewState,
  historicalAcceptedKeywordSetBeforeBatch,
  historicalResolvedKeywordSetBeforeBatch,
} from "../services/semantic-core-client-review.js";

describe("seo ops semantic-core review helpers", () => {
  it("blocks CTO agents from writing semantic-core review decisions", () => {
    expect(isChiefTechnicalOfficerAgent({
      name: "Chief Technical Officer",
      role: "executive",
      title: null,
    })).toBe(true);
    expect(isChiefTechnicalOfficerAgent({
      name: "SEO Semantic Core Strategist",
      role: "specialist",
      title: null,
    })).toBe(false);

    const blockReason = semanticCoreDecisionWriteBlockReason(
      {
        actorType: "agent",
        actorId: "run-1",
        agentId: "055dc55c-90b9-4d73-8382-46299c526f14",
      },
      {
        id: "055dc55c-90b9-4d73-8382-46299c526f14",
        name: "Chief Technical Officer",
        role: "executive",
        title: "CTO",
      },
      null,
    );

    expect(blockReason).toBe("Chief Technical Officer cannot write semantic-core review decisions");
  });

  it("blocks agents from writing decisions for another agent's linked issue", () => {
    const blockReason = semanticCoreDecisionWriteBlockReason(
      {
        actorType: "agent",
        actorId: "run-1",
        agentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      },
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        name: "Semantic Core Agent",
        role: "seo",
        title: null,
      },
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    );

    expect(blockReason).toBe("Semantic-core review decisions can only be written by the linked issue assignee");
    expect(semanticCoreDecisionWriteBlockReason(
      {
        actorType: "portal",
        actorId: "user-1",
      },
      null,
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    )).toBeNull();
  });

  it("groups duplicate keywords across prepared import artifacts", () => {
    const normalized = normalizePreparedSemanticCoreImport({
      policy_version: "conservative_acceptance_v2",
      artifacts: {
        accepted_keywords: [
          {
            keyword_text: "Keyword One",
            membership: "accepted",
            product_binding_status: "canonized_product",
            domain_topic_match: "high",
            acceptance_confidence: 0.91,
            locale_warning_severity: "none",
            accepted_locale_warning_overridden: false,
            source_precision_class: "high",
            geo_search_volume: 120,
            global_search_volume: 300,
          },
        ],
        review_queue: [
          {
            keyword_text: " keyword   one ",
            membership: "review",
            human_review_reason: "mixed_language",
            policy_warnings: ["mixed_language"],
          },
        ],
        parked_outside_layer: [
          {
            keyword_text: "Keyword Two",
            layer_membership: "parked_outside_layer",
            parked_reason: "no_entity_anchor",
          },
        ],
      },
    });

    expect(normalized.items).toHaveLength(2);
    const duplicate = normalized.items.find((item) => item.normalizedKeyword === "keyword one");
    expect(duplicate?.sourceOccurrences).toHaveLength(2);
    expect(duplicate?.currentMachineMembership).toBe("accepted");
    expect(duplicate?.policyWarnings).toContain("mixed_language");
    expect(duplicate?.sourcePrecisionClass).toBe("high");
    expect(normalized.items.find((item) => item.normalizedKeyword === "keyword two")?.currentMachineMembership)
      .toBe("parked");
    expect(normalized.acceptedCount).toBe(1);
    expect(normalized.parkedCount).toBe(1);
    expect(normalized.warningCounts.mixed_language).toBe(1);
  });

  it("keeps not-search-query MCP rows as rejected diagnostics instead of review candidates", () => {
    const normalized = normalizePreparedSemanticCoreImport({
      policy_version: "semantic-core-search-query-only",
      artifacts: {
        accepted_keywords: [],
        review_candidates: [
          {
            keyword_text: "потреба у впевненості перед консультацією",
            layer_membership: "rejected_noise",
            rejected_reason: "not_search_query",
            search_query_eligibility: "not_search_query",
            query_shape_score: 0.12,
            human_review_required: true,
            domain_topic_match: "high",
            product_binding_status: "topic_only",
          },
        ],
        parked_outside_layer: [],
      },
    });

    expect(normalized.items).toHaveLength(1);
    expect(normalized.items[0]).toMatchObject({
      displayKeyword: "потреба у впевненості перед консультацією",
      currentMachineMembership: "rejected_noise",
      searchQueryEligibility: "not_search_query",
      queryShapeScore: 0.12,
    });
    expect(normalized.reviewCount).toBe(0);
    expect(normalized.rejectedCount).toBe(1);
  });

  it("guards imported broad-layer rows before client portal exposure", () => {
    const normalized = normalizePreparedSemanticCoreImport({
      policy_version: "traffic-policy",
      review_candidates: [
        {
          keyword_text: "гороскоп",
          normalized_keyword: "гороскоп",
          layer_membership: "candidate_review",
          human_review_required: true,
          product_binding_status: "canonized_product",
          domain_topic_match: "high",
          source_precision_class: "high",
          geo_search_volume: 550000,
        },
        {
          keyword_text: "гороскоп на сегодня",
          normalized_keyword: "гороскоп на сегодня",
          layer_membership: "candidate_review",
          human_review_required: true,
          product_binding_status: "canonized_product",
          domain_topic_match: "high",
          source_precision_class: "high",
        },
        {
          keyword_text: "натальна карта",
          normalized_keyword: "натальна карта",
          layer_membership: "candidate_review",
          human_review_required: true,
          product_binding_status: "canonized_product",
          domain_topic_match: "high",
          source_precision_class: "high",
        },
      ],
    });

    expect(normalized.reviewCount).toBe(3);

    const guarded = applySemanticCoreImportGuards(normalized.items, {
      historicallyResolvedKeywords: new Set(["натальна карта"]),
    });

    const horoscope = guarded.find((item) => item.normalizedKeyword === "гороскоп");
    expect(horoscope?.humanReviewRequired).toBe(true);
    expect(horoscope?.latestPayload.review_group_id).toBe("horoscope:general:general");

    const russianLeakage = guarded.find((item) => item.normalizedKeyword === "гороскоп на сегодня");
    expect(russianLeakage?.currentMachineMembership).toBe("parked");
    expect(russianLeakage?.humanReviewRequired).toBe(false);
    expect(russianLeakage?.policyWarnings).toContain("language_lane_quarantine");

    const priorFinal = guarded.find((item) => item.normalizedKeyword === "натальна карта");
    expect(priorFinal?.currentMachineMembership).toBe("parked");
    expect(priorFinal?.humanReviewRequired).toBe(false);
    expect(priorFinal?.policyWarnings).toContain("prior_final_duplicate");
  });

  it("blocks unsafe human accept decisions while allowing non-accept decisions", () => {
    const blocked = validateSemanticCoreHumanDecision(
      {
        policyWarnings: ["competitor_content", "mixed_language"],
        productBindingStatus: "unknown",
        currentMachineMembership: "review",
        humanReviewReason: "manual review",
      },
      "accept",
      null,
    );
    expect(blocked.validationOutcome).toBe("blocked");
    expect(blocked.validationReasons).toContain("competitor_content_evidence_cannot_be_accepted_directly");
    expect(blocked.validationReasons).toContain("locale_warning_requires_valid_override");
    expect(blocked.validationReasons).toContain("locale_warning_requires_explainable_edge_case_severity");
    expect(blocked.validationReasons).toContain("unknown_product_binding_requires_resolution");

    const deferred = validateSemanticCoreHumanDecision(
      {
        policyWarnings: ["competitor_content"],
        productBindingStatus: "unknown",
        currentMachineMembership: "review",
        humanReviewReason: "manual review",
      },
      "keep_review",
      null,
    );
    expect(deferred.validationOutcome).toBe("ok");
  });

  it("allows a locale-warning accept only when the v2 edge-case override criteria are met", () => {
    const result = validateSemanticCoreHumanDecision(
      {
        policyWarnings: ["unsupported_locale"],
        productBindingStatus: "brand_binding",
        domainTopicMatch: "high",
        localeWarningSeverity: "explainable_edge_case",
        sourcePrecisionClass: "medium",
        currentMachineMembership: "review",
        humanReviewReason: "locale warning",
      },
      "accept",
      "brand or loanword edge case reviewed by human",
    );
    expect(result.validationOutcome).toBe("ok");
    expect(result.validationReasons).toEqual([]);
  });

  it("blocks locale-warning accept decisions with unsafe severity even if human supplied a reason", () => {
    const result = validateSemanticCoreHumanDecision(
      {
        policyWarnings: ["mixed_language"],
        productBindingStatus: "brand_binding",
        domainTopicMatch: "high",
        localeWarningSeverity: "unsafe",
        sourcePrecisionClass: "high",
        currentMachineMembership: "review",
        humanReviewReason: "locale warning",
      },
      "accept",
      "human reviewed",
    );
    expect(result.validationOutcome).toBe("blocked");
    expect(result.validationReasons).toContain("locale_warning_severity_cannot_be_auto_accepted");
  });

  it("marks client review complete based on client-visible items, not hidden internal pending rows", () => {
    const state = deriveSemanticCoreClientReviewState(reviewBatch(), [
      reviewItem({
        id: "11111111-1111-4111-8111-111111111111",
        displayKeyword: "натальна карта онлайн",
        normalizedKeyword: "натальна карта онлайн",
        currentMachineMembership: "review",
        productBindingStatus: "canonized_product",
        domainTopicMatch: "high",
        humanDecision: "accept",
        decisionStatus: "decided",
      }),
      reviewItem({
        id: "22222222-2222-4222-8222-222222222222",
        displayKeyword: "Google Store",
        normalizedKeyword: "google store",
        currentMachineMembership: "parked",
        productBindingStatus: "unknown",
        domainTopicMatch: "none",
        humanDecision: null,
        decisionStatus: "pending",
        policyWarnings: ["no_entity_anchor"],
      }),
    ]);

    expect(state.clientReviewStatus).toBe("completed");
    expect(state.completed).toBe(true);
    expect(state.progress).toMatchObject({
      total: 1,
      pending: 0,
      decided: 1,
      accepted: 1,
      needsAttention: 0,
    });
    expect(state.snapshot.acceptedSeedCount).toBe(1);
    expect(state.snapshot.acceptedSeeds).toHaveLength(1);
  });

  it("does not let a hidden historical accepted duplicate block client review completion", () => {
    const layer1Batch = reviewBatch({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      layer: "core_product_intent",
      clientReviewStatus: "completed",
      updatedAt: new Date("2026-05-08T08:00:00Z"),
    });
    const layer2Batch = reviewBatch({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
      layer: "adjacent_use_case_intent",
      updatedAt: new Date("2026-05-10T17:00:00Z"),
    });
    const acceptedLayer1 = reviewItem({
      id: "11111111-1111-4111-8111-111111111111",
      reviewBatchId: layer1Batch.id,
      displayKeyword: "Astrogen",
      normalizedKeyword: "astrogen",
      currentMachineMembership: "accepted",
      humanReviewRequired: false,
      productBindingStatus: "brand_binding",
      domainTopicMatch: "high",
      decisionStatus: "pending",
    });
    const repeatedLayer2 = reviewItem({
      id: "22222222-2222-4222-8222-222222222222",
      reviewBatchId: layer2Batch.id,
      displayKeyword: "Astrogen",
      normalizedKeyword: "astrogen",
      currentMachineMembership: "review",
      humanReviewRequired: true,
      productBindingStatus: "canonized_product",
      domainTopicMatch: "high",
      policyWarnings: ["high_demand_conflict"],
      humanReviewReason: "high_demand_conflict",
      humanDecision: null,
      decisionStatus: "pending",
    });
    const decidedLayer2 = reviewItem({
      id: "33333333-3333-4333-8333-333333333333",
      reviewBatchId: layer2Batch.id,
      displayKeyword: "сумісність знаків зодіаку",
      normalizedKeyword: "сумісність знаків зодіаку",
      currentMachineMembership: "review",
      humanReviewRequired: true,
      productBindingStatus: "topic_only",
      domainTopicMatch: "high",
      humanDecision: "accept",
      decisionStatus: "decided",
    });
    const historicallyAcceptedKeywords = historicalAcceptedKeywordSetBeforeBatch(
      layer2Batch,
      [acceptedLayer1, repeatedLayer2, decidedLayer2],
      [layer1Batch, layer2Batch],
    );

    const state = deriveSemanticCoreClientReviewState(layer2Batch, [repeatedLayer2, decidedLayer2], {
      historicallyAcceptedKeywords,
    });

    expect(historicallyAcceptedKeywords.has("astrogen")).toBe(true);
    expect(state.clientReviewStatus).toBe("completed");
    expect(state.completed).toBe(true);
    expect(state.progress).toMatchObject({
      total: 1,
      pending: 0,
      decided: 1,
      accepted: 1,
    });
    expect(state.snapshot.acceptedSeedCount).toBe(1);
    expect(state.snapshot.acceptedSeeds.map((item) => item.keyword)).toEqual(["сумісність знаків зодіаку"]);
  });

  it("does not let a hidden historical rejected duplicate re-enter client review", () => {
    const layer2Batch = reviewBatch({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
      layer: "adjacent_use_case_intent",
      clientReviewStatus: "completed",
      updatedAt: new Date("2026-05-10T17:00:00Z"),
    });
    const layer3Batch = reviewBatch({
      id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc3",
      layer: "audience_need_intent",
      updatedAt: new Date("2026-05-11T08:00:00Z"),
    });
    const rejectedLayer2 = reviewItem({
      id: "11111111-1111-4111-8111-111111111111",
      reviewBatchId: layer2Batch.id,
      displayKeyword: "гороскоп від глоби на тиждень",
      normalizedKeyword: "гороскоп від глоби на тиждень",
      currentMachineMembership: "review",
      humanReviewRequired: true,
      humanDecision: "reject",
      decisionStatus: "decided",
      updatedAt: new Date("2026-05-10T17:20:00Z"),
    });
    const repeatedLayer3 = reviewItem({
      id: "22222222-2222-4222-8222-222222222222",
      reviewBatchId: layer3Batch.id,
      displayKeyword: "гороскоп від глоби на тиждень",
      normalizedKeyword: "гороскоп від глоби на тиждень",
      currentMachineMembership: "review",
      humanReviewRequired: true,
      productBindingStatus: "topic_only",
      domainTopicMatch: "high",
      humanDecision: null,
      decisionStatus: "pending",
      updatedAt: new Date("2026-05-11T08:10:00Z"),
    });
    const historicallyResolvedKeywords = historicalResolvedKeywordSetBeforeBatch(
      layer3Batch,
      [rejectedLayer2, repeatedLayer3],
      [layer2Batch, layer3Batch],
    );

    const state = deriveSemanticCoreClientReviewState(layer3Batch, [repeatedLayer3], {
      historicallyResolvedKeywords,
    });

    expect(historicallyResolvedKeywords.has("гороскоп від глоби на тиждень")).toBe(true);
    expect(state.clientReviewStatus).toBe("not_applicable");
    expect(state.progress).toMatchObject({
      total: 0,
      pending: 0,
    });
  });

  it("keeps explicit re-review duplicates in the client-visible completion set", () => {
    const state = deriveSemanticCoreClientReviewState(reviewBatch(), [
      reviewItem({
        displayKeyword: "Astrogen",
        normalizedKeyword: "astrogen",
        currentMachineMembership: "review",
        productBindingStatus: "canonized_product",
        domainTopicMatch: "high",
        humanDecision: null,
        decisionStatus: "pending",
        policyWarnings: ["force_client_review"],
      }),
    ], {
      historicallyAcceptedKeywords: new Set(["astrogen"]),
    });

    expect(state.clientReviewStatus).toBe("in_review");
    expect(state.progress).toMatchObject({
      total: 1,
      pending: 1,
    });
  });

  it("builds an MCP review decisions payload from Paperclip human decisions", () => {
    const batch = reviewBatch({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
      mcpProjectId: "astrogen-layer2",
      sourceRunId: "run_layer2",
      clientReviewRevision: 83,
    });
    const payload = buildSemanticCoreMcpReviewDecisionsPayload(batch, [
      reviewItem({
        id: "11111111-1111-4111-8111-111111111111",
        displayKeyword: "гороскоп близнюки на тиждень",
        normalizedKeyword: "гороскоп близнюки на тиждень",
        humanDecision: "accept",
        productBindingStatus: "canonized_product",
        humanConnectionAssessment: "service_match",
        latestPayload: {
          language_code: "uk",
          location_code: "2804",
          device_context: "desktop",
          product_binding: "seed-9",
        },
      }),
      reviewItem({
        id: "22222222-2222-4222-8222-222222222222",
        displayKeyword: "гороскоп від глоби на тиждень",
        normalizedKeyword: "гороскоп від глоби на тиждень",
        humanDecision: "reject",
        humanConnectionAssessment: "no_match",
        humanConnectionNote: "Конкретний сторонній астролог.",
        latestPayload: {
          language_code: "uk",
          location_code: 2804,
          device_context: "desktop",
        },
      }),
      reviewItem({
        id: "33333333-3333-4333-8333-333333333333",
        displayKeyword: "pending keyword",
        normalizedKeyword: "pending keyword",
        humanDecision: null,
      }),
    ]);

    expect(payload).toMatchObject({
      project_id: "astrogen-layer2",
      run_id: "run_layer2",
      decision_source: "paperclip_client_portal",
      review_batch_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
      review_marker: "semantic-core-client-review:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2:r83",
      decision_count: 2,
    });
    expect(payload.decisions).toEqual([
      expect.objectContaining({
        keyword_text: "гороскоп близнюки на тиждень",
        decision: "accept",
        product_binding: "seed-9",
        location_code: 2804,
      }),
      expect.objectContaining({
        keyword_text: "гороскоп від глоби на тиждень",
        decision: "reject",
        reason: "low_business_fit",
        notes: "Конкретний сторонній астролог.",
      }),
    ]);
  });

  it("does not mark client review complete while any client-visible item is pending", () => {
    const state = deriveSemanticCoreClientReviewState(reviewBatch(), [
      reviewItem({
        id: "11111111-1111-4111-8111-111111111111",
        displayKeyword: "натальна карта онлайн",
        normalizedKeyword: "натальна карта онлайн",
        currentMachineMembership: "review",
        productBindingStatus: "canonized_product",
        domainTopicMatch: "high",
        humanDecision: "accept",
        decisionStatus: "decided",
      }),
      reviewItem({
        id: "22222222-2222-4222-8222-222222222222",
        displayKeyword: "сумісність знаків зодіаку",
        normalizedKeyword: "сумісність знаків зодіаку",
        currentMachineMembership: "review",
        productBindingStatus: "topic_only",
        domainTopicMatch: "high",
        humanDecision: null,
        decisionStatus: "pending",
      }),
    ]);

    expect(state.clientReviewStatus).toBe("in_review");
    expect(state.completed).toBe(false);
    expect(state.progress.pending).toBe(1);
  });

  it("marks imported batches with no client-visible questions as not applicable", () => {
    const state = deriveSemanticCoreClientReviewState(reviewBatch({
      importReadiness: "ready_no_client_review",
    }), [
      reviewItem({
        id: "11111111-1111-4111-8111-111111111111",
        displayKeyword: "потреба у впевненості перед консультацією",
        normalizedKeyword: "потреба у впевненості перед консультацією",
        currentMachineMembership: "rejected_noise",
        searchQueryEligibility: "not_search_query",
        humanReviewRequired: true,
        humanDecision: null,
        decisionStatus: "pending",
      }),
      reviewItem({
        id: "22222222-2222-4222-8222-222222222222",
        displayKeyword: "гороскоп на завтра",
        normalizedKeyword: "гороскоп на завтра",
        currentMachineMembership: "parked",
        humanReviewRequired: false,
        humanDecision: null,
        decisionStatus: "pending",
      }),
    ]);

    expect(state.clientReviewStatus).toBe("not_applicable");
    expect(state.progress).toMatchObject({
      total: 0,
      pending: 0,
    });
  });

  it("routes blocked client-visible decisions to internal attention instead of completion", () => {
    const state = deriveSemanticCoreClientReviewState(reviewBatch(), [
      reviewItem({
        id: "11111111-1111-4111-8111-111111111111",
        displayKeyword: "натальна карта онлайн",
        normalizedKeyword: "натальна карта онлайн",
        currentMachineMembership: "review",
        productBindingStatus: "canonized_product",
        domainTopicMatch: "high",
        humanDecision: "accept",
        decisionStatus: "blocked",
        validationOutcome: "blocked",
      }),
    ]);

    expect(state.clientReviewStatus).toBe("needs_internal_attention");
    expect(state.completed).toBe(false);
    expect(state.progress.needsAttention).toBe(1);
    expect(state.snapshot.acceptedSeedCount).toBe(0);
  });
});

function reviewBatch(overrides: Record<string, unknown> = {}) {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    sourceRunId: "run_1",
    layer: "core_product_intent",
    importReadiness: "ready_after_review",
    policyVersion: "policy-v2",
    clientReviewStatus: "not_started",
    clientReviewRevision: 0,
    clientReviewProcessedAt: null,
    clientReviewSnapshot: {},
    ...overrides,
  } as any;
}

function reviewItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    companyId: "company-1",
    projectId: "project-1",
    reviewBatchId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    normalizedKeyword: "натальна карта онлайн",
    displayKeyword: "натальна карта онлайн",
    duplicateGroupKey: "натальна карта онлайн",
    sourceArtifactType: "review",
    sourceRunId: "run_1",
    artifactRowPointer: null,
    currentMachineMembership: "review",
    recommendedHumanDecision: null,
    humanDecision: null,
    decisionStatus: "pending",
    productBindingStatus: "topic_only",
    domainTopicMatch: "high",
    domainTopicMatchScore: null,
    acceptanceConfidence: null,
    reviewPriority: null,
    humanReviewRequired: true,
    humanReviewReason: null,
    evidenceSummary: null,
    policyWarnings: [],
    localeWarningSeverity: null,
    acceptedLocaleWarningOverridden: false,
    localeOverrideReason: null,
    humanDecisionApplied: false,
    humanDecisionBlockedReason: null,
    searchQueryEligibility: null,
    queryShapeScore: null,
    sourcePrecisionClass: "high",
    humanConnectionAssessment: null,
    humanConnectionNote: null,
    geoSearchVolume: null,
    globalSearchVolume: null,
    latestPayload: {},
    sourceOccurrences: [],
    validationOutcome: null,
    validationReasons: [],
    policyVersion: "policy-v2",
    createdAt: new Date("2026-05-08T00:00:00Z"),
    updatedAt: new Date("2026-05-08T00:00:00Z"),
    ...overrides,
  } as any;
}
