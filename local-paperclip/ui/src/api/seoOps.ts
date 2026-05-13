import { api } from "./client";

export type SemanticCoreReviewBatch = {
  id: string;
  companyId: string;
  projectId: string;
  sourceRunId: string;
  layer: string;
  importReadiness: string | null;
  unsafeReasons: string[];
  qualityReport: Record<string, unknown>;
  policyVersion: string | null;
  acceptedCount: number;
  reviewCount: number;
  parkedCount: number;
  rejectedCount: number;
  unresolvedReviewCount: number;
  warningCounts: Record<string, number>;
  status: string;
  mcpReviewArtifactId: string | null;
  reviewedRerunId: string | null;
  blockerReasons: string[];
  updatedAt: string;
};

export type SemanticCoreReviewItem = {
  id: string;
  reviewBatchId: string;
  displayKeyword: string;
  normalizedKeyword: string;
  currentMachineMembership: string;
  recommendedHumanDecision: string | null;
  humanDecision: string | null;
  decisionStatus: string;
  productBindingStatus: string | null;
  domainTopicMatch: string | null;
  domainTopicMatchScore: string | null;
  acceptanceConfidence: string | null;
  reviewPriority: number | null;
  humanReviewRequired: boolean;
  humanReviewReason: string | null;
  evidenceSummary: string | null;
  policyWarnings: string[];
  localeWarningSeverity: string | null;
  acceptedLocaleWarningOverridden: boolean;
  localeOverrideReason: string | null;
  humanDecisionApplied: boolean;
  humanDecisionBlockedReason: string | null;
  sourcePrecisionClass: string | null;
  humanConnectionAssessment: string | null;
  humanConnectionNote: string | null;
  geoSearchVolume: number | null;
  globalSearchVolume: number | null;
  latestPayload: Record<string, unknown>;
  sourceOccurrences: unknown[];
  validationOutcome: string | null;
  validationReasons: string[];
  policyVersion: string | null;
};

export type SemanticCoreReviewDecision = {
  id: string;
  reviewItemId: string;
  previousDecision: string | null;
  newDecision: string;
  validationOutcome: string;
  validationReasons: string[];
  notes: string | null;
  createdAt: string;
};

export const seoOpsApi = {
  listSemanticCoreReviewBatches(companyId: string) {
    return api.get<SemanticCoreReviewBatch[]>(
      `/seo/semantic-core/review-batches?companyId=${encodeURIComponent(companyId)}`,
    );
  },
  getSemanticCoreReviewBatch(batchId: string) {
    return api.get<{
      batch: SemanticCoreReviewBatch;
      items: SemanticCoreReviewItem[];
      decisions: SemanticCoreReviewDecision[];
    }>(`/seo/semantic-core/review-batches/${encodeURIComponent(batchId)}`);
  },
  updateSemanticCoreReviewDecision(
    itemId: string,
    body: {
      humanDecision: "accept" | "reject" | "defer" | "revise" | "product_discovery" | "keep_review";
      notes?: string | null;
      overrideReason?: string | null;
    },
  ) {
    return api.patch<SemanticCoreReviewItem>(
      `/seo/semantic-core/review-items/${encodeURIComponent(itemId)}/decision`,
      body,
    );
  },
  updateSemanticCoreReviewConnection(
    itemId: string,
    body: {
      humanConnectionAssessment: "service_match" | "brand_match" | "topic_match" | "no_match" | "unsure" | null;
      humanConnectionNote?: string | null;
    },
  ) {
    return api.patch<SemanticCoreReviewItem>(
      `/seo/semantic-core/review-items/${encodeURIComponent(itemId)}/connection`,
      body,
    );
  },
  bulkUpdateSemanticCoreReviewDecision(
    batchId: string,
    body: {
      itemIds: string[];
      humanDecision: "accept" | "reject" | "defer" | "revise" | "product_discovery" | "keep_review";
      notes?: string | null;
      overrideReason?: string | null;
    },
  ) {
    return api.post<{ updatedCount: number; items: SemanticCoreReviewItem[] }>(
      `/seo/semantic-core/review-batches/${encodeURIComponent(batchId)}/bulk-decisions`,
      body,
    );
  },
};
