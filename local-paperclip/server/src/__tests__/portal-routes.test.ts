import { describe, expect, it } from "vitest";
import {
  acceptedInventoryKeywordSet,
  buildPortalSemanticCoreReviewGroups,
  buildSemanticCoreInventory,
  buildPortalReviewContext,
  companyMatchesPortalSlug,
  isHistoricallyAcceptedReviewDuplicate,
  isHistoricallyResolvedReviewDuplicate,
  isPortalClientReviewableItem,
  isPortalVisibleSemanticCoreBatch,
  isAuthorizedPortalToken,
  mapPortalReviewBatch,
  mapPortalReviewBatchWithProgress,
  mapPortalReviewItem,
  portalSemanticCoreReviewGroupId,
  resolvedInventoryKeywordSet,
  splitPortalReviewGroupDecisionItems,
  slugifyCompany,
} from "../routes/portal.js";

describe("portal route helpers", () => {
  it("authorizes portal service tokens with exact timing-safe equality only", () => {
    expect(isAuthorizedPortalToken("secret-token", "secret-token")).toBe(true);
    expect(isAuthorizedPortalToken("secret-token", "other-token")).toBe(false);
    expect(isAuthorizedPortalToken("secret-token", undefined)).toBe(false);
    expect(isAuthorizedPortalToken(undefined, "secret-token")).toBe(false);
  });

  it("resolves human company slugs without requiring tenant slugs in portal URLs", () => {
    const company = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Astrogen",
      issuePrefix: "AST",
    };

    expect(slugifyCompany("Astrogen")).toBe("astrogen");
    expect(companyMatchesPortalSlug(company, "astrogen")).toBe(true);
    expect(companyMatchesPortalSlug(company, "ast")).toBe(true);
    expect(companyMatchesPortalSlug(company, company.id)).toBe(true);
    expect(companyMatchesPortalSlug(company, "diskinternals")).toBe(false);
  });

  it("maps semantic-core review items to a client-safe projection", () => {
    const mapped = mapPortalReviewItem({
      id: "item-1",
      displayKeyword: "натальна карта онлайн",
      currentMachineMembership: "review",
      recommendedHumanDecision: "accept",
      humanDecision: null,
      decisionStatus: "pending",
      productBindingStatus: "brand_binding",
      domainTopicMatch: "high",
      domainTopicMatchScore: "0.91",
      acceptanceConfidence: "0.88",
      reviewPriority: 1,
      humanReviewRequired: true,
      humanReviewReason: "locale edge case",
      evidenceSummary: "Brand query with high topic match.",
      policyWarnings: ["unsupported_locale"],
      localeWarningSeverity: "explainable_edge_case",
      geoSearchVolume: 120,
      globalSearchVolume: 300,
      validationOutcome: null,
      validationReasons: [],
      humanConnectionAssessment: null,
      humanConnectionNote: null,
      policyVersion: "policy-v2",
      updatedAt: new Date("2026-05-07T08:00:00Z"),
      latestPayload: { raw: true },
      sourceOccurrences: [{ raw: true }],
      artifactRowPointer: "accepted:1",
    } as any);

    expect(mapped).toMatchObject({
      itemId: "item-1",
      keyword: "натальна карта онлайн",
      topicMatchScore: 0.91,
      confidence: 0.88,
      warnings: ["Потрібне пояснення через мовну особливість запиту."],
    });
    expect(mapped).not.toHaveProperty("latestPayload");
    expect(mapped).not.toHaveProperty("sourceOccurrences");
    expect(mapped).not.toHaveProperty("artifactRowPointer");
    expect(mapped.warnings).not.toContain("unsupported_locale");
  });

  it("maps review batches without exposing internal workflow labels", () => {
    const mapped = mapPortalReviewBatch({
      id: "batch-1",
      projectId: "project-1",
      siteId: null,
      sourceRunId: "run-1",
      layer: "core_product_intent",
      importReadiness: "ready_after_review",
      status: "unsafe_blocked",
      acceptedCount: 10,
      reviewCount: 5,
      parkedCount: 100,
      rejectedCount: 1,
      unresolvedReviewCount: 5,
      warningCounts: { no_entity_anchor: 90 },
      policyVersion: "conservative_acceptance_v2",
      updatedAt: new Date("2026-05-07T08:00:00Z"),
    } as any);

    expect(mapped).toMatchObject({
      batchId: "batch-1",
      stageLabel: "Перший етап: базові запити",
      statusLabel: "На розгляді",
      counts: {
        accepted: 10,
        review: 5,
        rejected: 1,
        unresolved: 5,
      },
    });
    expect(mapped).not.toHaveProperty("layer");
    expect(mapped).not.toHaveProperty("status");
    expect(mapped).not.toHaveProperty("projectId");
    expect(mapped).not.toHaveProperty("siteId");
    expect(mapped).not.toHaveProperty("sourceRunId");
    expect(mapped).not.toHaveProperty("importReadiness");
    expect(mapped.counts).not.toHaveProperty("parked");
    expect(mapped).not.toHaveProperty("warningCounts");
  });

  it("maps active review batch counts from the client-visible queue", () => {
    const mapped = mapPortalReviewBatchWithProgress(reviewBatch({
      id: "batch-layer-3",
      layer: "audience_need_intent",
      clientReviewStatus: "not_applicable",
      reviewCount: 157,
      unresolvedReviewCount: 157,
    }), {
      total: 0,
      pending: 0,
      decided: 0,
      accepted: 0,
      rejected: 0,
      deferred: 0,
      needsAttention: 0,
    });

    expect(mapped).toMatchObject({
      stageLabel: "Третій етап: потреби аудиторії",
      statusLabel: "Нових рішень немає",
      counts: {
        review: 0,
        unresolved: 0,
      },
    });
  });


  it("does not expose obvious app/system/store fragments to the client review queue", () => {
    for (const keyword of ["settings Налаштування", "Google Store", "play_apps Бібліотека та пристрої"]) {
      expect(isPortalClientReviewableItem(reviewItem({
        displayKeyword: keyword,
        currentMachineMembership: "parked",
        productBindingStatus: "unknown",
        domainTopicMatch: "none",
        policyWarnings: ["no_entity_anchor"],
      }))).toBe(false);
    }
  });

  it("keeps internally noisy candidates out of the portal even when they are in review", () => {
    expect(isPortalClientReviewableItem(reviewItem({
      displayKeyword: "2026 ASTROGEN",
      currentMachineMembership: "review",
      productBindingStatus: "brand_binding",
      domainTopicMatch: "high",
      policyWarnings: ["competitor_content_evidence"],
    }))).toBe(false);

    expect(isPortalClientReviewableItem(reviewItem({
      displayKeyword: "Dmitriy Grepan",
      currentMachineMembership: "review",
      productBindingStatus: "unknown",
      domainTopicMatch: "none",
      policyWarnings: [],
    }))).toBe(false);
  });

  it("keeps a client-visible item visible after a blocked validation outcome", () => {
    expect(isPortalClientReviewableItem(reviewItem({
      displayKeyword: "натальна карта онлайн",
      currentMachineMembership: "review",
      productBindingStatus: "canonized_product",
      domainTopicMatch: "high",
      decisionStatus: "blocked",
      validationOutcome: "blocked",
    }))).toBe(true);
  });

  it("allows client-reviewable Astrogen service/topic terms", () => {
    expect(isPortalClientReviewableItem(reviewItem({
      displayKeyword: "сумісність знаків зодіаку",
      currentMachineMembership: "review",
      humanReviewRequired: true,
      productBindingStatus: "topic_only",
      domainTopicMatch: "high",
      policyWarnings: [],
    }))).toBe(true);
  });

  it("keeps stale past-year astrology queries out of client review and inventory", () => {
    const currentYear = new Date().getUTCFullYear();
    const staleYear = currentYear - 1;
    const batch = reviewBatch({ clientReviewStatus: "in_review" });

    expect(isPortalClientReviewableItem(reviewItem({
      displayKeyword: `гороскоп на ${staleYear} рік`,
      currentMachineMembership: "review",
      humanReviewRequired: true,
      productBindingStatus: "canonized_product",
      domainTopicMatch: "high",
      searchQueryEligibility: "observed_search_demand",
    }))).toBe(false);

    expect(isPortalClientReviewableItem(reviewItem({
      displayKeyword: `гороскоп на ${currentYear} рік`,
      currentMachineMembership: "review",
      humanReviewRequired: true,
      productBindingStatus: "canonized_product",
      domainTopicMatch: "high",
      searchQueryEligibility: "observed_search_demand",
    }))).toBe(true);

    const inventory = buildSemanticCoreInventory([
      reviewRow({
        reviewBatchId: batch.id,
        displayKeyword: `гороскоп на ${staleYear} рік`,
        normalizedKeyword: `гороскоп на ${staleYear} рік`,
        currentMachineMembership: "candidate_review",
        humanReviewRequired: true,
        humanReviewReason: "traffic_relevance_decision",
        productBindingStatus: "canonized_product",
        domainTopicMatch: "high",
        searchQueryEligibility: "observed_search_demand",
      }),
    ], [batch]);

    expect(inventory).toEqual([]);
  });

  it("keeps currently pending client-review items out of the candidate inventory", () => {
    const activeBatch = reviewBatch({
      id: "batch-layer-3",
      clientReviewStatus: "in_review",
      clientReviewProcessedAt: null,
    });
    const earlierBatch = reviewBatch({
      id: "batch-layer-2",
      clientReviewStatus: "completed",
      clientReviewProcessedAt: new Date("2026-05-10T10:00:00Z"),
    });

    const inventory = buildSemanticCoreInventory([
      reviewRow({
        reviewBatchId: earlierBatch.id,
        displayKeyword: "1 жовтня знак зодіаку",
        normalizedKeyword: "1 жовтня знак зодіаку",
        sourceArtifactType: "parked",
        currentMachineMembership: "parked",
        humanReviewRequired: false,
        humanReviewReason: "no_entity_anchor",
        productBindingStatus: "unknown",
        domainTopicMatch: "none",
      }),
      reviewRow({
        reviewBatchId: activeBatch.id,
        displayKeyword: "1 жовтня знак зодіаку",
        normalizedKeyword: "1 жовтня знак зодіаку",
        currentMachineMembership: "candidate_review",
        humanReviewRequired: true,
        humanReviewReason: "traffic_relevance_decision",
        humanDecision: null,
        decisionStatus: "pending",
        productBindingStatus: "canonized_product",
        domainTopicMatch: "high",
        searchQueryEligibility: "observed_search_demand",
      }),
    ], [activeBatch, earlierBatch], [], { excludeOpenReviewQueueItems: true });

    expect(inventory).toEqual([]);
  });

  it("returns decided active-review items to inventory with their final lifecycle status", () => {
    const activeBatch = reviewBatch({
      id: "batch-layer-3",
      clientReviewStatus: "in_review",
      clientReviewProcessedAt: null,
    });

    const inventory = buildSemanticCoreInventory([
      reviewRow({
        reviewBatchId: activeBatch.id,
        displayKeyword: "1 жовтня знак зодіаку",
        normalizedKeyword: "1 жовтня знак зодіаку",
        currentMachineMembership: "candidate_review",
        humanReviewRequired: true,
        humanReviewReason: "traffic_relevance_decision",
        humanDecision: "accept",
        decisionStatus: "decided",
        productBindingStatus: "canonized_product",
        domainTopicMatch: "high",
        searchQueryEligibility: "observed_search_demand",
      }),
    ], [activeBatch], [], { excludeOpenReviewQueueItems: true });

    expect(inventory).toHaveLength(1);
    expect(inventory[0]).toMatchObject({
      keyword: "1 жовтня знак зодіаку",
      status: "accepted",
      lifecycleMembership: "accepted",
    });
  });

  it("keeps machine-accepted keywords out of the client decision queue", () => {
    expect(isPortalClientReviewableItem(reviewItem({
      displayKeyword: "натальна карта онлайн",
      currentMachineMembership: "accepted",
      humanReviewRequired: false,
      productBindingStatus: "canonized_product",
      domainTopicMatch: "high",
      policyWarnings: [],
    }))).toBe(false);
  });

  it("keeps not-search-query diagnostics out of portal review and inventory", () => {
    const diagnostic = reviewItem({
      displayKeyword: "потреба у впевненості перед консультацією",
      currentMachineMembership: "review",
      humanReviewRequired: true,
      productBindingStatus: "topic_only",
      domainTopicMatch: "high",
      searchQueryEligibility: "not_search_query",
    });
    expect(isPortalClientReviewableItem(diagnostic)).toBe(false);

    const batch = reviewBatch({ clientReviewStatus: "completed" });
    const inventory = buildSemanticCoreInventory([
      reviewRow({
        reviewBatchId: batch.id,
        displayKeyword: "потреба у впевненості перед консультацією",
        normalizedKeyword: "потреба у впевненості перед консультацією",
        currentMachineMembership: "rejected_noise",
        searchQueryEligibility: "not_search_query",
        latestPayload: {
          layer_membership: "rejected_noise",
          rejected_reason: "not_search_query",
        },
      }),
    ], [batch]);

    expect(inventory).toEqual([]);
  });

  it("keeps off-topic parked entity conflicts out of portal inventory", () => {
    const batch = reviewBatch({ clientReviewStatus: "in_review" });

    const inventory = buildSemanticCoreInventory([
      reviewRow({
        reviewBatchId: batch.id,
        displayKeyword: "gemini ai",
        normalizedKeyword: "gemini ai",
        sourceArtifactType: "parked",
        currentMachineMembership: "parked",
        recommendedHumanDecision: "reject",
        humanReviewRequired: false,
        humanReviewReason: "off_topic_entity_conflict",
        productBindingStatus: "unknown",
        domainTopicMatch: "none",
        policyWarnings: ["off_topic_entity_conflict"],
        latestPayload: {
          layer_membership: "parked_outside_layer",
          parked_reason: "off_topic_entity_conflict",
        },
      }),
    ], [batch]);

    expect(inventory).toEqual([]);
  });

  it("keeps superseded semantic-core batches out of portal inventory", () => {
    const supersededBatch = reviewBatch({
      id: "batch-stale-layer-3",
      status: "superseded",
      layer: "audience_need_intent",
      updatedAt: new Date("2026-05-10T08:00:00Z"),
    });
    const visibleBatch = reviewBatch({
      id: "batch-current-layer-3",
      status: "in_review",
      layer: "audience_need_intent",
      updatedAt: new Date("2026-05-11T08:00:00Z"),
    });

    expect(isPortalVisibleSemanticCoreBatch(supersededBatch)).toBe(false);

    const inventory = buildSemanticCoreInventory([
      reviewRow({
        reviewBatchId: supersededBatch.id,
        displayKeyword: "старий повторний кандидат",
        normalizedKeyword: "старий повторний кандидат",
        currentMachineMembership: "review",
        humanReviewRequired: true,
      }),
      reviewRow({
        reviewBatchId: visibleBatch.id,
        displayKeyword: "поточний кандидат",
        normalizedKeyword: "поточний кандидат",
        currentMachineMembership: "parked",
        humanReviewRequired: false,
      }),
    ], [visibleBatch]);

    expect(inventory.map((item) => item.keyword)).toEqual(["поточний кандидат"]);
  });

  it("keeps keywords accepted in earlier batches out of later pending review queues", () => {
    const layer1Batch = reviewBatch({
      id: "batch-layer-1",
      layer: "core_product_intent",
      clientReviewStatus: "completed",
      updatedAt: new Date("2026-05-07T08:00:00Z"),
    });
    const layer2Batch = reviewBatch({
      id: "batch-layer-2",
      layer: "adjacent_use_case_intent",
      updatedAt: new Date("2026-05-08T08:00:00Z"),
    });
    const acceptedLayer1 = reviewRow({
      reviewBatchId: layer1Batch.id,
      displayKeyword: "Astrogen",
      normalizedKeyword: "astrogen",
      currentMachineMembership: "accepted",
      humanReviewRequired: false,
    });
    const repeatedLayer2 = reviewRow({
      reviewBatchId: layer2Batch.id,
      displayKeyword: "Astrogen",
      normalizedKeyword: "astrogen",
      currentMachineMembership: "review",
      humanReviewRequired: true,
    });

    const accepted = acceptedInventoryKeywordSet([acceptedLayer1, repeatedLayer2], [layer1Batch, layer2Batch], layer2Batch);

    expect(accepted.has("astrogen")).toBe(true);
    expect(isPortalClientReviewableItem(repeatedLayer2)).toBe(true);
    expect(isHistoricallyAcceptedReviewDuplicate(repeatedLayer2, accepted)).toBe(true);
  });

  it("keeps keywords rejected in earlier batches out of later pending review queues", () => {
    const layer2Batch = reviewBatch({
      id: "batch-layer-2",
      layer: "adjacent_use_case_intent",
      clientReviewStatus: "completed",
      updatedAt: new Date("2026-05-08T08:00:00Z"),
    });
    const layer3Batch = reviewBatch({
      id: "batch-layer-3",
      layer: "audience_need_intent",
      updatedAt: new Date("2026-05-10T08:00:00Z"),
    });
    const rejectedLayer2 = reviewRow({
      reviewBatchId: layer2Batch.id,
      displayKeyword: "гороскоп від глоби на тиждень",
      normalizedKeyword: "гороскоп від глоби на тиждень",
      currentMachineMembership: "review",
      humanReviewRequired: true,
      humanDecision: "reject",
      decisionStatus: "decided",
      updatedAt: new Date("2026-05-08T09:00:00Z"),
    });
    const repeatedLayer3 = reviewRow({
      reviewBatchId: layer3Batch.id,
      displayKeyword: "гороскоп від глоби на тиждень",
      normalizedKeyword: "гороскоп від глоби на тиждень",
      currentMachineMembership: "review",
      humanReviewRequired: true,
      humanDecision: null,
      decisionStatus: "pending",
      updatedAt: new Date("2026-05-10T09:00:00Z"),
    });

    const resolved = resolvedInventoryKeywordSet(
      [rejectedLayer2, repeatedLayer3],
      [layer2Batch, layer3Batch],
      layer3Batch,
    );

    expect(resolved.has("гороскоп від глоби на тиждень")).toBe(true);
    expect(isPortalClientReviewableItem(repeatedLayer3)).toBe(true);
    expect(isHistoricallyResolvedReviewDuplicate(repeatedLayer3, resolved)).toBe(true);
  });

  it("builds a complete accepted semantic-core inventory across batches", () => {
    const layer1Batch = reviewBatch({
      id: "batch-layer-1",
      layer: "core_product_intent",
      clientReviewStatus: "completed",
      updatedAt: new Date("2026-05-07T08:00:00Z"),
    });
    const layer2Batch = reviewBatch({
      id: "batch-layer-2",
      layer: "adjacent_use_case_intent",
      updatedAt: new Date("2026-05-08T08:00:00Z"),
    });

    const inventory = buildSemanticCoreInventory([
      reviewRow({
        reviewBatchId: layer1Batch.id,
        displayKeyword: "Astrogen",
        normalizedKeyword: "astrogen",
        currentMachineMembership: "accepted",
        humanReviewRequired: false,
        geoSearchVolume: 10,
        globalSearchVolume: 8100,
      }),
      reviewRow({
        reviewBatchId: layer2Batch.id,
        displayKeyword: "гороскоп близнюки на тиждень",
        normalizedKeyword: "гороскоп близнюки на тиждень",
        currentMachineMembership: "review",
        humanReviewRequired: true,
      }),
    ], [layer1Batch, layer2Batch]);

    expect(inventory.find((item) => item.keywordId === "astrogen")).toMatchObject({
      keyword: "Astrogen",
      status: "accepted",
      geoSearchVolume: 10,
      globalSearchVolume: 8100,
      latestStageLabel: "Перший етап: базові запити",
    });
    expect(inventory.filter((item) => item.status === "accepted").map((item) => item.keyword)).toEqual(["Astrogen"]);
  });

  it("does not let a later pending duplicate override an earlier final inventory decision label", () => {
    const layer2Batch = reviewBatch({
      id: "batch-layer-2",
      layer: "adjacent_use_case_intent",
      clientReviewStatus: "completed",
      updatedAt: new Date("2026-05-08T08:00:00Z"),
    });
    const layer3Batch = reviewBatch({
      id: "batch-layer-3",
      layer: "audience_need_intent",
      updatedAt: new Date("2026-05-10T08:00:00Z"),
    });

    const inventory = buildSemanticCoreInventory([
      reviewRow({
        reviewBatchId: layer2Batch.id,
        displayKeyword: "гороскоп близнюки на тиждень",
        normalizedKeyword: "гороскоп близнюки на тиждень",
        currentMachineMembership: "review",
        humanReviewRequired: true,
        humanDecision: "accept",
        decisionStatus: "decided",
        updatedAt: new Date("2026-05-08T09:00:00Z"),
      }),
      reviewRow({
        reviewBatchId: layer3Batch.id,
        displayKeyword: "гороскоп близнюки на тиждень",
        normalizedKeyword: "гороскоп близнюки на тиждень",
        currentMachineMembership: "review",
        humanReviewRequired: true,
        humanDecision: null,
        decisionStatus: "pending",
        updatedAt: new Date("2026-05-10T09:00:00Z"),
      }),
    ], [layer2Batch, layer3Batch]);

    expect(inventory[0]).toMatchObject({
      status: "accepted",
      recommendation: {
        sourceSignal: "human_accepted",
        label: "Погоджено людиною",
      },
      latestStageLabel: "Другий етап: суміжні запити",
    });
  });

  it("does not mark machine-accepted keywords from an active batch as client-approved inventory", () => {
    const activeBatch = reviewBatch({
      id: "batch-layer-2",
      layer: "adjacent_use_case_intent",
      clientReviewStatus: "in_review",
      clientReviewProcessedAt: null,
      updatedAt: new Date("2026-05-08T08:00:00Z"),
    });

    const inventory = buildSemanticCoreInventory([
      reviewRow({
        reviewBatchId: activeBatch.id,
        displayKeyword: "гороскоп на тиждень 4 10 квітня",
        normalizedKeyword: "гороскоп на тиждень 4 10 квітня",
        currentMachineMembership: "accepted",
        humanReviewRequired: false,
        humanDecision: null,
        decisionStatus: "pending",
      }),
    ], [activeBatch]);

    expect(inventory[0]).toMatchObject({
      keyword: "гороскоп на тиждень 4 10 квітня",
      status: "candidate",
      lifecycleMembership: "candidate",
      recommendation: {
        sourceSignal: "machine_recommended_accept",
        label: "Рекомендовано до погодження",
        machineMembership: "accepted",
      },
    });
    expect(JSON.stringify(inventory[0])).not.toContain("Автоматично погоджено");
  });

  it("keeps completed machine-accepted keywords in the active semantic core while preserving recommendation source", () => {
    const completedBatch = reviewBatch({
      id: "batch-layer-1",
      layer: "core_product_intent",
      clientReviewStatus: "completed",
      clientReviewProcessedAt: new Date("2026-05-07T09:00:00Z"),
      updatedAt: new Date("2026-05-07T08:00:00Z"),
    });

    const inventory = buildSemanticCoreInventory([
      reviewRow({
        reviewBatchId: completedBatch.id,
        displayKeyword: "Astrogen",
        normalizedKeyword: "astrogen",
        currentMachineMembership: "accepted",
        humanReviewRequired: false,
        humanDecision: null,
        decisionStatus: "pending",
      }),
    ], [completedBatch]);

    expect(inventory[0]).toMatchObject({
      keyword: "Astrogen",
      status: "accepted",
      lifecycleMembership: "accepted",
      recommendation: {
        sourceSignal: "machine_recommended_accept",
        label: "Рекомендовано до погодження",
        machineMembership: "accepted",
      },
    });
  });

  it("requires locale edge cases to have strong brand/product evidence before portal exposure", () => {
    expect(isPortalClientReviewableItem(reviewItem({
      displayKeyword: "astrogen натальна карта",
      currentMachineMembership: "accepted",
      humanReviewRequired: true,
      productBindingStatus: "brand_binding",
      domainTopicMatch: "high",
      policyWarnings: ["unsupported_locale"],
      localeWarningSeverity: "explainable_edge_case",
      sourcePrecisionClass: "high",
    }))).toBe(true);

    expect(isPortalClientReviewableItem(reviewItem({
      displayKeyword: "синастрия онлайн",
      currentMachineMembership: "review",
      humanReviewRequired: true,
      productBindingStatus: "topic_only",
      domainTopicMatch: "high",
      policyWarnings: ["mixed_language"],
      localeWarningSeverity: "needs_review",
      sourcePrecisionClass: "medium",
    }))).toBe(false);
  });

  it("builds Ukrainian client review context while the queue is in progress", () => {
    const context = buildPortalReviewContext({
      layer: "core_product_intent",
    } as any, [
      reviewItem({ humanDecision: "accept", decisionStatus: "decided" }),
      reviewItem({ humanDecision: null, decisionStatus: "pending" }),
      reviewItem({ humanDecision: "defer", decisionStatus: "decided" }),
    ]);

    expect(context).toMatchObject({
      title: "Розгляд запитів для семантичного ядра",
      stageLabel: "Перший етап: базові запити",
      progress: {
        total: 3,
        pending: 1,
        decided: 2,
        accepted: 1,
        rejected: 0,
        deferred: 1,
        needsAttention: 0,
      },
    });
    expect(context.description).toContain("відібрані для вашого розгляду");
    expect(context.clientTask).toContain("Ваше завдання");
    expect(context.clientTask).toContain("обовʼязковий етап");
    expect(context.clientTask).toContain("подальша підготовка");
    expect(context.nextStep).toContain("якнайшвидше");
    expect(JSON.stringify(context)).not.toContain("Paperclip");
    expect(JSON.stringify(context)).not.toContain("core_product_intent");
    expect(JSON.stringify(context)).not.toContain("unsafe_blocked");
  });

  it("explains the internal next step after client review is complete", () => {
    const context = buildPortalReviewContext({
      layer: "core_product_intent",
    } as any, [
      reviewItem({ humanDecision: "accept", decisionStatus: "decided" }),
      reviewItem({ humanDecision: "reject", decisionStatus: "decided" }),
      reviewItem({ humanDecision: "defer", decisionStatus: "decided" }),
    ]);

    expect(context.stageLabel).toBe("Клієнтський розгляд завершено");
    expect(context.progress).toMatchObject({
      total: 3,
      pending: 0,
      decided: 3,
      accepted: 1,
      rejected: 1,
      deferred: 1,
    });
    expect(context.nextStep).toContain("внутрішню перевірку готовності");
    expect(context.nextStep).not.toContain("Paperclip");
    expect(context.nextStep).not.toContain("import_readiness");
  });

  it("does not ask the client to act when a batch has no new client-visible decisions", () => {
    const context = buildPortalReviewContext({
      layer: "audience_need_intent",
    } as any, []);

    expect(context).toMatchObject({
      stageLabel: "Третій етап: потреби аудиторії: нових рішень немає",
      progress: {
        total: 0,
        pending: 0,
      },
    });
    expect(context.clientTask).toBe("Дій з вашого боку зараз не потрібно.");
    expect(context.description).toContain("не повертаються на повторний розгляд");
  });

  it("builds client-safe semantic-core review groups from Paperclip-owned grouping signals", () => {
    const first = reviewRow({
      id: "11111111-1111-4111-8111-111111111111",
      displayKeyword: "гороскоп близнюки",
      normalizedKeyword: "гороскоп близнюки",
      latestPayload: {
        semantic_group_id: "horoscope-gemini",
        canonical_keyword: "гороскоп близнюки",
        decision_trace: ["internal-only"],
      },
      acceptanceConfidence: "0.81",
      geoSearchVolume: 900,
      globalSearchVolume: 1200,
      evidenceSummary: "Internal MCP evidence should not be exposed.",
    });
    const second = reviewRow({
      id: "22222222-2222-4222-8222-222222222222",
      displayKeyword: "гороскоп для близнюків",
      normalizedKeyword: "гороскоп для близнюків",
      latestPayload: {
        semantic_group_id: "horoscope-gemini",
        canonical_keyword: "гороскоп близнюки",
        raw_warning: "unsafe_blocked",
      },
      acceptanceConfidence: "0.77",
      geoSearchVolume: 500,
      globalSearchVolume: 800,
    });

    const groups = buildPortalSemanticCoreReviewGroups([first, second]);
    const expectedGroupId = portalSemanticCoreReviewGroupId("batch-1", "horoscope-gemini");

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      groupId: expectedGroupId,
      canonicalItemId: first.id,
      canonicalKeyword: "гороскоп близнюки",
      status: "pending",
      statusLabel: "Потребує рішення",
      counts: {
        total: 2,
        pending: 2,
      },
      geoSearchVolume: 1400,
      globalSearchVolume: 2000,
    });
    expect(groups[0].variants.map((variant) => variant.keyword)).toEqual([
      "гороскоп близнюки",
      "гороскоп для близнюків",
    ]);
    expect(JSON.stringify(groups[0])).not.toContain("semantic_group_id");
    expect(JSON.stringify(groups[0])).not.toContain("decision_trace");
    expect(JSON.stringify(groups[0])).not.toContain("unsafe_blocked");
    expect(JSON.stringify(groups[0])).not.toContain("MCP");
  });

  it("splits group decisions so omitted variants stay unchanged", () => {
    const group = buildPortalSemanticCoreReviewGroups([
      reviewRow({
        id: "11111111-1111-4111-8111-111111111111",
        displayKeyword: "гороскоп близнюки",
        latestPayload: { semantic_group_id: "horoscope-gemini" },
      }),
      reviewRow({
        id: "22222222-2222-4222-8222-222222222222",
        displayKeyword: "гороскоп для близнюків",
        normalizedKeyword: "гороскоп для близнюків",
        latestPayload: { semantic_group_id: "horoscope-gemini" },
      }),
    ])[0];

    const split = splitPortalReviewGroupDecisionItems(group, [
      "11111111-1111-4111-8111-111111111111",
    ]);

    expect(split).toEqual({
      selectedItemIds: ["11111111-1111-4111-8111-111111111111"],
      omittedItemIds: ["22222222-2222-4222-8222-222222222222"],
      invalidItemIds: [],
    });

    expect(splitPortalReviewGroupDecisionItems(group, [
      "33333333-3333-4333-8333-333333333333",
    ]).invalidItemIds).toEqual(["33333333-3333-4333-8333-333333333333"]);
  });
});

function reviewItem(overrides: Partial<Parameters<typeof isPortalClientReviewableItem>[0]> = {}) {
  return {
    displayKeyword: "натальна карта онлайн",
    currentMachineMembership: "review",
    humanReviewRequired: true,
    decisionStatus: "pending",
    productBindingStatus: "topic_only",
    domainTopicMatch: "high",
    policyWarnings: [],
    localeWarningSeverity: null,
    searchQueryEligibility: null,
    sourcePrecisionClass: "high",
    validationOutcome: null,
    ...overrides,
  };
}

function reviewBatch(overrides: Record<string, unknown> = {}) {
  return {
    id: "batch-1",
    companyId: "company-1",
    projectId: "project-1",
    siteId: null,
    semanticCoreRunId: null,
    clientKey: "semantic-core",
    mcpProjectId: "astrogen",
    sourceRunId: "run-1",
    layer: "core_product_intent",
    importReadiness: null,
    unsafeReasons: [],
    qualityReport: {},
    policyVersion: null,
    acceptedCount: 0,
    reviewCount: 0,
    parkedCount: 0,
    rejectedCount: 0,
    unresolvedReviewCount: 0,
    warningCounts: {},
    status: "in_review",
    mcpReviewArtifactId: null,
    reviewedRerunId: null,
    latestImportReadinessPayload: {},
    blockerReasons: [],
    clientReviewStatus: "not_started",
    clientReviewCompletedAt: null,
    clientReviewProcessedAt: null,
    clientReviewRevision: 0,
    clientReviewProgress: {},
    clientReviewSnapshot: {},
    linkedIssueId: null,
    createdByAgentId: null,
    createdByUserId: null,
    createdAt: new Date("2026-05-07T08:00:00Z"),
    updatedAt: new Date("2026-05-07T08:00:00Z"),
    ...overrides,
  } as any;
}

function reviewRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    companyId: "company-1",
    projectId: "project-1",
    reviewBatchId: "batch-1",
    keywordId: null,
    normalizedKeyword: "натальна карта онлайн",
    displayKeyword: "натальна карта онлайн",
    duplicateGroupKey: "натальна карта онлайн",
    sourceArtifactType: "review",
    sourceRunId: "run-1",
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
    policyVersion: null,
    createdAt: new Date("2026-05-07T08:00:00Z"),
    updatedAt: new Date("2026-05-07T08:00:00Z"),
    ...overrides,
  } as any;
}
