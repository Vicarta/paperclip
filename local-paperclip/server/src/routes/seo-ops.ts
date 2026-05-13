import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@paperclipai/db";
import {
  agents,
  issues,
  seoOpsSemanticCoreKeywordActions,
  seoOpsSemanticCoreReviewBatches,
  seoOpsSemanticCoreReviewDecisions,
  seoOpsSemanticCoreReviewItems,
} from "@paperclipai/db";
import { validate } from "../middleware/validate.js";
import { badRequest, forbidden, notFound } from "../errors.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import {
  buildSemanticCoreMcpReviewDecisionsPayload,
  historicalResolvedKeywordSetBeforeBatch,
  syncSemanticCoreClientReviewCompletion,
} from "../services/semantic-core-client-review.js";

type JsonRecord = Record<string, unknown>;

const decisionSchema = z.enum([
  "accept",
  "reject",
  "defer",
  "revise",
  "product_discovery",
  "keep_review",
]);

const importReviewBatchSchema = z.object({
  companyId: z.string().uuid(),
  projectId: z.string().uuid(),
  siteId: z.string().uuid().optional().nullable(),
  clientKey: z.string().min(1).default("semantic-core"),
  mcpProjectId: z.string().min(1),
  sourceRunId: z.string().min(1),
  layer: z.string().min(1),
  linkedIssueId: z.string().uuid().optional().nullable(),
  preparePaperclipImport: z.record(z.unknown()),
});

export const updateDecisionSchema = z.object({
  humanDecision: decisionSchema,
  notes: z.string().optional().nullable(),
  rejectReason: z.string().optional().nullable(),
  overrideReason: z.string().optional().nullable(),
});

export type SemanticCoreReviewDecisionInput = z.infer<typeof updateDecisionSchema>;
export type SemanticCoreReviewActor = {
  actorType: "agent" | "user" | "portal";
  actorId: string;
  agentId?: string | null;
  runId?: string | null;
};

type SemanticCoreDecisionAgentIdentity = {
  id: string;
  name: string | null;
  role: string | null;
  title: string | null;
};

export function isChiefTechnicalOfficerAgent(agent: Pick<SemanticCoreDecisionAgentIdentity, "name" | "role" | "title">) {
  const identity = [agent.name, agent.role, agent.title]
    .filter((part): part is string => typeof part === "string")
    .join(" ")
    .toLowerCase();
  return /\bchief technical officer\b/.test(identity) || /\bcto\b/.test(identity);
}

export function semanticCoreDecisionWriteBlockReason(
  actor: SemanticCoreReviewActor,
  actorAgent: SemanticCoreDecisionAgentIdentity | null,
  linkedIssueAssigneeAgentId?: string | null,
) {
  if (actor.actorType !== "agent") return null;
  if (!actor.agentId) return "Agent identity is required to write semantic-core review decisions";
  if (!actorAgent) return "Agent identity was not found for semantic-core review decision";
  if (isChiefTechnicalOfficerAgent(actorAgent)) {
    return "Chief Technical Officer cannot write semantic-core review decisions";
  }
  if (linkedIssueAssigneeAgentId && linkedIssueAssigneeAgentId !== actor.agentId) {
    return "Semantic-core review decisions can only be written by the linked issue assignee";
  }
  return null;
}

const connectionAssessmentSchema = z.enum([
  "service_match",
  "brand_match",
  "topic_match",
  "no_match",
  "unsure",
]);

const updateConnectionSchema = z.object({
  humanConnectionAssessment: connectionAssessmentSchema.nullable(),
  humanConnectionNote: z.string().optional().nullable(),
});

const bulkDecisionSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1),
  humanDecision: decisionSchema,
  notes: z.string().optional().nullable(),
  overrideReason: z.string().optional().nullable(),
});

const rerunGateSchema = z.object({
  status: z.string().optional(),
  mcpReviewArtifactId: z.string().optional().nullable(),
  reviewedRerunId: z.string().optional().nullable(),
  latestImportReadinessPayload: z.record(z.unknown()).optional(),
  importReadiness: z.string().optional().nullable(),
  unsafeReasons: z.array(z.string()).optional(),
  blockerReasons: z.array(z.string()).optional(),
});

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function firstNonEmptyArray(...values: unknown[]) {
  for (const value of values) {
    const array = asArray(value);
    if (array.length > 0) return array;
  }
  return [];
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function intOrNull(value: unknown) {
  const valueNumber = numberOrNull(value);
  return valueNumber === null ? null : Math.trunc(valueNumber);
}

function normalizeKeyword(value: unknown) {
  return text(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function artifactEntries(payload: JsonRecord) {
  const artifacts = asRecord(payload.artifacts);
  const entries: Array<{ sourceArtifactType: string; rows: unknown[] }> = [
    { sourceArtifactType: "accepted", rows: firstNonEmptyArray(artifacts.accepted_keywords, payload.accepted_keywords) },
    {
      sourceArtifactType: "review",
      rows: firstNonEmptyArray(
        artifacts.review_keywords,
        artifacts.review_queue,
        artifacts.review_candidates,
        payload.review_candidates,
      ),
    },
    {
      sourceArtifactType: "parked",
      rows: firstNonEmptyArray(
        artifacts.parked_keywords,
        artifacts.parked_outside_layer,
        payload.parked_outside_layer,
      ),
    },
    { sourceArtifactType: "rejected", rows: firstNonEmptyArray(artifacts.rejected_keywords, payload.rejected_keywords) },
    { sourceArtifactType: "rejected_noise", rows: firstNonEmptyArray(artifacts.rejected_noise, payload.rejected_noise) },
    {
      sourceArtifactType: "serp_evidence",
      rows: firstNonEmptyArray(artifacts.serp_competitor_candidates, payload.serp_competitor_candidates),
    },
    { sourceArtifactType: "recall", rows: firstNonEmptyArray(artifacts.recall_ledger, payload.recall_ledger) },
  ];
  return entries.filter((entry) => entry.rows.length > 0);
}

function keywordFromRow(row: JsonRecord) {
  return text(row.keyword_text)
    || text(row.keyword)
    || text(row.query)
    || text(row.normalized_keyword)
    || text(row.display_keyword);
}

function warningList(row: JsonRecord) {
  const explicit = asArray(row.policy_warnings)
    .concat(asArray(row.warnings))
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
  const reason = text(row.human_review_reason) || text(row.parked_reason) || text(row.rejected_reason) || text(row.reason);
  if (reason) explicit.push(reason);
  return [...new Set(explicit)];
}

function classifyMembership(sourceArtifactType: string, row: JsonRecord) {
  if (isNotSearchQueryRow(row)) return "rejected_noise";
  const membership = text(row.membership)
    || text(row.layer_membership)
    || text(row.current_machine_membership)
    || (sourceArtifactType === "serp_evidence" ? "evidence" : sourceArtifactType);
  return membership === "parked_outside_layer" ? "parked" : membership;
}

function isNotSearchQueryRow(row: JsonRecord) {
  return text(row.search_query_eligibility) === "not_search_query"
    || text(row.rejected_reason) === "not_search_query"
    || text(row.layer_membership) === "rejected_noise";
}

export function validateSemanticCoreHumanDecision(
  item: {
    policyWarnings: string[];
    productBindingStatus: string | null;
    domainTopicMatch?: string | null;
    localeWarningSeverity?: string | null;
    acceptedLocaleWarningOverridden?: boolean;
    sourcePrecisionClass?: string | null;
    currentMachineMembership: string;
    humanReviewReason: string | null;
  },
  humanDecision: z.infer<typeof decisionSchema>,
  overrideReason?: string | null,
) {
  if (humanDecision !== "accept") {
    return { validationOutcome: "ok", validationReasons: [] as string[] };
  }

  const warnings = item.policyWarnings.map((warning) => warning.toLowerCase());
  const reasons: string[] = [];
  const hasLocaleWarning = warnings.some((warning) =>
    warning.includes("locale") || warning.includes("mixed_language") || warning.includes("unsupported_language"),
  );
  const hasCompetitorWarning = warnings.some((warning) =>
    warning.includes("competitor")
    || warning.includes("content_parsing")
    || warning.includes("serp_content")
    || warning.includes("ui_noise"),
  );
  const hasNoEntityAnchor = warnings.some((warning) => warning.includes("no_entity_anchor"));
  const localeSeverity = item.localeWarningSeverity ?? "none";

  if ((hasLocaleWarning || localeSeverity !== "none") && (localeSeverity === "needs_review" || localeSeverity === "unsafe")) {
    reasons.push("locale_warning_severity_cannot_be_auto_accepted");
  }
  if (hasLocaleWarning) {
    const hasOverride = Boolean(overrideReason) || item.acceptedLocaleWarningOverridden === true;
    const hasValidTopic = item.domainTopicMatch === "high";
    const hasValidBinding = item.productBindingStatus === "canonized_product" || item.productBindingStatus === "brand_binding";
    const hasValidPrecision = item.sourcePrecisionClass === "high" || item.sourcePrecisionClass === "medium";
    if (!hasOverride) reasons.push("locale_warning_requires_valid_override");
    if (localeSeverity !== "explainable_edge_case") reasons.push("locale_warning_requires_explainable_edge_case_severity");
    if (!hasValidTopic) reasons.push("locale_override_requires_high_domain_topic_match");
    if (!hasValidBinding) reasons.push("locale_override_requires_canonized_or_brand_binding");
    if (!hasValidPrecision) reasons.push("locale_override_requires_high_or_medium_source_precision");
  }
  if (hasCompetitorWarning) {
    reasons.push("competitor_content_evidence_cannot_be_accepted_directly");
  }
  if (hasNoEntityAnchor && item.productBindingStatus !== "canonized_product" && item.productBindingStatus !== "brand_binding") {
    reasons.push("no_entity_anchor_requires_product_binding_or_discovery");
  }
  if (item.productBindingStatus === "unknown") {
    reasons.push("unknown_product_binding_requires_resolution");
  }

  return {
    validationOutcome: reasons.length > 0 ? "blocked" : "ok",
    validationReasons: reasons,
  };
}

export async function assertSemanticCoreReviewDecisionWriteAccess(
  db: Db,
  batch: typeof seoOpsSemanticCoreReviewBatches.$inferSelect,
  actor: SemanticCoreReviewActor,
) {
  if (actor.actorType !== "agent") return;

  const actorAgent = actor.agentId
    ? await db
      .select({
        id: agents.id,
        name: agents.name,
        role: agents.role,
        title: agents.title,
      })
      .from(agents)
      .where(eq(agents.id, actor.agentId))
      .then((rows) => rows[0] ?? null)
    : null;

  const linkedIssue = batch.linkedIssueId
    ? await db
      .select({ assigneeAgentId: issues.assigneeAgentId })
      .from(issues)
      .where(eq(issues.id, batch.linkedIssueId))
      .then((rows) => rows[0] ?? null)
    : null;

  const blockReason = semanticCoreDecisionWriteBlockReason(
    actor,
    actorAgent,
    linkedIssue?.assigneeAgentId ?? null,
  );
  if (blockReason) throw forbidden(blockReason);
}

export async function applySemanticCoreReviewDecision(
  db: Db,
  itemId: string,
  input: SemanticCoreReviewDecisionInput,
  actor: SemanticCoreReviewActor,
) {
  const item = await db
    .select()
    .from(seoOpsSemanticCoreReviewItems)
    .where(eq(seoOpsSemanticCoreReviewItems.id, itemId))
    .then((rows) => rows[0] ?? null);
  if (!item) throw notFound("Semantic-core review item not found");
  const batch = await db
    .select()
    .from(seoOpsSemanticCoreReviewBatches)
    .where(eq(seoOpsSemanticCoreReviewBatches.id, item.reviewBatchId))
    .then((rows) => rows[0] ?? null);
  if (!batch) throw notFound("Semantic-core review batch not found");
  await assertSemanticCoreReviewDecisionWriteAccess(db, batch, actor);

  const validation = validateSemanticCoreHumanDecision({
    policyWarnings: item.policyWarnings,
    productBindingStatus: item.productBindingStatus,
    domainTopicMatch: item.domainTopicMatch,
    localeWarningSeverity: item.localeWarningSeverity,
    acceptedLocaleWarningOverridden: item.acceptedLocaleWarningOverridden,
    sourcePrecisionClass: item.sourcePrecisionClass,
    currentMachineMembership: item.currentMachineMembership,
    humanReviewReason: item.humanReviewReason,
  }, input.humanDecision, input.overrideReason);

  const [updated] = await db
    .update(seoOpsSemanticCoreReviewItems)
    .set({
      humanDecision: input.humanDecision,
      decisionStatus: validation.validationOutcome === "ok" ? "decided" : "blocked",
      validationOutcome: validation.validationOutcome,
      validationReasons: validation.validationReasons,
      updatedAt: new Date(),
    })
    .where(eq(seoOpsSemanticCoreReviewItems.id, item.id))
    .returning();

  await db.insert(seoOpsSemanticCoreReviewDecisions).values({
    companyId: item.companyId,
    projectId: item.projectId,
    reviewBatchId: item.reviewBatchId,
    reviewItemId: item.id,
    actorAgentId: actor.actorType === "agent" ? actor.agentId ?? null : null,
    actorUserId: actor.actorType === "user" || actor.actorType === "portal" ? actor.actorId : null,
    previousDecision: item.humanDecision,
    newDecision: input.humanDecision,
    notes: input.notes ?? null,
    validationOutcome: validation.validationOutcome,
    validationReasons: validation.validationReasons,
    payload: {
      rejectReason: input.rejectReason ?? null,
      overrideReason: input.overrideReason ?? null,
      source: actor.actorType,
      runId: actor.runId ?? null,
    },
  });

  const unresolved = await db
    .select({ id: seoOpsSemanticCoreReviewItems.id })
    .from(seoOpsSemanticCoreReviewItems)
    .where(and(
      eq(seoOpsSemanticCoreReviewItems.reviewBatchId, item.reviewBatchId),
      eq(seoOpsSemanticCoreReviewItems.decisionStatus, "pending"),
    ));
  await db
    .update(seoOpsSemanticCoreReviewBatches)
    .set({
      unresolvedReviewCount: unresolved.length,
      status: validation.validationOutcome === "blocked" ? "unsafe_blocked" : batch.status,
      updatedAt: new Date(),
    })
    .where(eq(seoOpsSemanticCoreReviewBatches.id, item.reviewBatchId));

  await syncSemanticCoreClientReviewCompletion(db, item.reviewBatchId, actor);

  return updated;
}

function summarizeWarnings(items: Array<{ policyWarnings: string[] }>) {
  const counts: Record<string, number> = {};
  for (const item of items) {
    for (const warning of item.policyWarnings) {
      const key = warning.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "warning";
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  return counts;
}

export type NormalizedSemanticCoreReviewItem = {
  normalizedKeyword: string;
  displayKeyword: string;
  duplicateGroupKey: string;
  sourceArtifactType: string;
  currentMachineMembership: string;
  recommendedHumanDecision: string | null;
  productBindingStatus: string | null;
  domainTopicMatch: string | null;
  domainTopicMatchScore: number | null;
  acceptanceConfidence: number | null;
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
  searchQueryEligibility: string | null;
  queryShapeScore: number | null;
  sourcePrecisionClass: string | null;
  geoSearchVolume: number | null;
  globalSearchVolume: number | null;
  latestPayload: JsonRecord;
  sourceOccurrences: unknown[];
  policyVersion: string | null;
};

export function applySemanticCoreImportGuards(
  items: NormalizedSemanticCoreReviewItem[],
  options: {
    historicallyResolvedKeywords?: Set<string>;
  } = {},
) {
  const historicallyResolvedKeywords = options.historicallyResolvedKeywords ?? new Set<string>();

  return items.map((item) => {
    let next = withPaperclipReviewGroup(item);
    const keywordId = normalizeKeyword(next.normalizedKeyword || next.displayKeyword);
    if (keywordId && historicallyResolvedKeywords.has(keywordId) && !isForcedSemanticCoreReReview(next)) {
      next = markSemanticCoreImportInternalOnly(next, "prior_final_duplicate");
    }
    if (hasObviousRussianLanguageLeakage(next.displayKeyword)) {
      next = markSemanticCoreImportInternalOnly(next, "language_lane_quarantine");
    }
    return next;
  });
}

function recalculatePreparedSemanticCoreImport(items: NormalizedSemanticCoreReviewItem[]) {
  return {
    acceptedCount: items.filter((item) => item.currentMachineMembership === "accepted").length,
    reviewCount: items.filter((item) => isReviewMembership(item.currentMachineMembership)).length,
    parkedCount: items.filter((item) => item.currentMachineMembership === "parked").length,
    rejectedCount: items.filter((item) =>
      item.currentMachineMembership === "rejected" || item.currentMachineMembership === "rejected_noise",
    ).length,
    warningCounts: summarizeWarnings(items),
  };
}

function isReviewMembership(membership: string) {
  return membership === "review" || membership === "candidate_review";
}

function markSemanticCoreImportInternalOnly(item: NormalizedSemanticCoreReviewItem, reason: string) {
  return {
    ...item,
    currentMachineMembership: "parked",
    recommendedHumanDecision: item.recommendedHumanDecision === "accept" ? "keep_review" : item.recommendedHumanDecision,
    humanReviewRequired: false,
    humanReviewReason: reason,
    policyWarnings: [...new Set([...item.policyWarnings, reason, "internal_only"])],
    latestPayload: {
      ...item.latestPayload,
      paperclip_internal_only: true,
      paperclip_internal_only_reason: reason,
      human_review_required: false,
      human_review_reason: reason,
      layer_membership: "parked_outside_layer",
      recommended_human_decision: item.recommendedHumanDecision === "accept"
        ? "keep_review"
        : item.recommendedHumanDecision,
    },
  };
}

function isForcedSemanticCoreReReview(item: NormalizedSemanticCoreReviewItem) {
  const warnings = item.policyWarnings.map((warning) => warning.toLowerCase());
  const reason = item.humanReviewReason?.toLowerCase() ?? "";
  return warnings.some((warning) => warning.includes("re_review") || warning.includes("force_client_review"))
    || reason.includes("re-review")
    || reason.includes("повтор");
}

function hasObviousRussianLanguageLeakage(keyword: string) {
  const normalized = normalizeKeyword(keyword);
  return normalized.includes("сегодня")
    || normalized.includes("сейчас")
    || normalized.includes("бесплатно")
    || normalized.includes("астрологичес")
    || normalized.includes("программ")
    || normalized.includes("совместимост")
    || normalized.includes("зодиака")
    || normalized.includes("весы");
}

function withPaperclipReviewGroup(item: NormalizedSemanticCoreReviewItem) {
  const group = semanticCoreImportReviewGroup(item);
  if (!group) return item;
  return {
    ...item,
    latestPayload: {
      ...item.latestPayload,
      review_group_id: group.groupId,
      canonical_keyword: group.canonicalKeyword,
      canonical_keyword_normalized: group.canonicalKeywordNormalized,
    },
  };
}

function semanticCoreImportReviewGroup(item: NormalizedSemanticCoreReviewItem) {
  const keyword = normalizeKeyword(item.normalizedKeyword || item.displayKeyword);
  if (!keyword) return null;
  const sign = zodiacSignForKeyword(keyword);
  const period = horoscopePeriodForKeyword(keyword);

  if (keyword.includes("гороскоп") || keyword.includes("ґороскоп")) {
    const groupId = `horoscope:${sign ?? "general"}:${period ?? "general"}`;
    return {
      groupId,
      canonicalKeyword: [
        "гороскоп",
        sign ? zodiacSignDisplay(sign) : null,
        period ? horoscopePeriodDisplay(period) : null,
      ].filter(Boolean).join(" "),
      canonicalKeywordNormalized: groupId,
    };
  }

  if (keyword.includes("знак зод") || keyword.includes("знаки зод")) {
    const mode = keyword.includes("дат") ? "dates" : keyword.includes("місяц") ? "months" : sign ?? "general";
    const groupId = `zodiac:${mode}`;
    return {
      groupId,
      canonicalKeyword: mode === "dates"
        ? "знаки зодіаку дати"
        : mode === "months"
          ? "знаки зодіаку по місяцях"
          : sign
            ? `${zodiacSignDisplay(sign)} знак зодіаку`
            : "знаки зодіаку",
      canonicalKeywordNormalized: groupId,
    };
  }

  if (keyword.includes("наталь") && (keyword.includes("суміс") || keyword.includes("совмест"))) {
    return {
      groupId: "compatibility:natal-chart",
      canonicalKeyword: "натальна карта сумісності",
      canonicalKeywordNormalized: "compatibility:natal-chart",
    };
  }

  if (keyword.includes("синастр") || keyword.includes("суміс")) {
    return {
      groupId: "compatibility:general",
      canonicalKeyword: "сумісність",
      canonicalKeywordNormalized: "compatibility:general",
    };
  }

  if (keyword.includes("наталь")) {
    return {
      groupId: "natal-chart:general",
      canonicalKeyword: "натальна карта",
      canonicalKeywordNormalized: "natal-chart:general",
    };
  }

  if (keyword.includes("ретроград") && keyword.includes("меркур")) {
    return {
      groupId: "astrology:retrograde-mercury",
      canonicalKeyword: "ретроградний меркурій",
      canonicalKeywordNormalized: "astrology:retrograde-mercury",
    };
  }

  const productBinding = text(item.latestPayload.product_binding) || item.productBindingStatus;
  if (productBinding && productBinding !== "unknown" && productBinding !== "topic_only") {
    return {
      groupId: `product:${normalizeKeyword(productBinding)}`,
      canonicalKeyword: item.displayKeyword,
      canonicalKeywordNormalized: `product:${normalizeKeyword(productBinding)}`,
    };
  }

  return null;
}

function horoscopePeriodForKeyword(keyword: string) {
  if (keyword.includes("сьогодні") || keyword.includes("насьогодні") || keyword.includes("сегодня")) return "today";
  if (keyword.includes("завтра")) return "tomorrow";
  if (keyword.includes("тиждень") || keyword.includes("недел")) return "week";
  if (keyword.includes("місяц") || keyword.includes("месяц")) return "month";
  if (/\b20\d{2}\b/.test(keyword)) return "year";
  return null;
}

function horoscopePeriodDisplay(period: string) {
  switch (period) {
    case "today":
      return "на сьогодні";
    case "tomorrow":
      return "на завтра";
    case "week":
      return "на тиждень";
    case "month":
      return "на місяць";
    case "year":
      return "на рік";
    default:
      return "";
  }
}

function zodiacSignForKeyword(keyword: string) {
  const candidates: Array<[string, RegExp]> = [
    ["aries", /\b(овен|овна|овни)\b/u],
    ["taurus", /\b(телець|тельця|телец)\b/u],
    ["gemini", /\b(близнюк\p{L}*|близнец\p{L}*)\b/u],
    ["cancer", /\b(рак|рака|раки)\b/u],
    ["leo", /\b(лев|льва|леви)\b/u],
    ["virgo", /\b(діва|діви|дева|девы)\b/u],
    ["libra", /\b(терези|весы)\b/u],
    ["scorpio", /\b(скорпіон\p{L}*|скорпион\p{L}*)\b/u],
    ["sagittarius", /\b(стрілець|стрільця|стрелец|стрельца)\b/u],
    ["capricorn", /\b(козеріг|козерог\p{L}*)\b/u],
    ["aquarius", /\b(водолій|водоле\p{L}*)\b/u],
    ["pisces", /\b(риби|риба|рыбы)\b/u],
  ];
  return candidates.find(([, pattern]) => pattern.test(keyword))?.[0] ?? null;
}

function zodiacSignDisplay(sign: string) {
  switch (sign) {
    case "aries":
      return "овен";
    case "taurus":
      return "телець";
    case "gemini":
      return "близнюки";
    case "cancer":
      return "рак";
    case "leo":
      return "лев";
    case "virgo":
      return "діва";
    case "libra":
      return "терези";
    case "scorpio":
      return "скорпіон";
    case "sagittarius":
      return "стрілець";
    case "capricorn":
      return "козеріг";
    case "aquarius":
      return "водолій";
    case "pisces":
      return "риби";
    default:
      return sign;
  }
}

export function normalizePreparedSemanticCoreImport(payload: JsonRecord) {
  const artifactRows = new Map<string, NormalizedSemanticCoreReviewItem>();

  for (const entry of artifactEntries(payload)) {
    entry.rows.forEach((rawRow, index) => {
      const row = asRecord(rawRow);
      const displayKeyword = keywordFromRow(row);
      const normalizedKeyword = normalizeKeyword(displayKeyword);
      if (!normalizedKeyword) return;
      const existing = artifactRows.get(normalizedKeyword);
      const occurrence = {
        sourceArtifactType: entry.sourceArtifactType,
        rowIndex: index,
        artifactRowPointer: text(row.artifact_row_pointer) || `${entry.sourceArtifactType}:${index}`,
      };
      const next: NormalizedSemanticCoreReviewItem = {
        normalizedKeyword,
        displayKeyword: existing?.displayKeyword ?? displayKeyword,
        duplicateGroupKey: normalizedKeyword,
        sourceArtifactType: existing?.sourceArtifactType ?? entry.sourceArtifactType,
        currentMachineMembership: existing?.currentMachineMembership ?? classifyMembership(entry.sourceArtifactType, row),
        recommendedHumanDecision: existing?.recommendedHumanDecision ?? (text(row.recommended_human_decision) || null),
        productBindingStatus: existing?.productBindingStatus ?? (text(row.product_binding_status) || null),
        domainTopicMatch: existing?.domainTopicMatch ?? (text(row.domain_topic_match) || null),
        domainTopicMatchScore: existing?.domainTopicMatchScore ?? numberOrNull(row.domain_topic_match_score),
        acceptanceConfidence: existing?.acceptanceConfidence ?? numberOrNull(row.acceptance_confidence),
        reviewPriority: existing?.reviewPriority ?? intOrNull(row.review_priority),
        humanReviewRequired: existing?.humanReviewRequired ?? Boolean(row.human_review_required),
        humanReviewReason: existing?.humanReviewReason ?? (text(row.human_review_reason) || text(row.parked_reason) || null),
        evidenceSummary: existing?.evidenceSummary ?? (text(row.evidence_summary) || text(row.reason) || null),
        policyWarnings: [...new Set([...(existing?.policyWarnings ?? []), ...warningList(row)])],
        localeWarningSeverity: existing?.localeWarningSeverity ?? (text(row.locale_warning_severity) || null),
        acceptedLocaleWarningOverridden: existing?.acceptedLocaleWarningOverridden ?? row.accepted_locale_warning_overridden === true,
        localeOverrideReason: existing?.localeOverrideReason ?? (text(row.locale_override_reason) || null),
        humanDecisionApplied: existing?.humanDecisionApplied ?? row.human_decision_applied === true,
        humanDecisionBlockedReason: existing?.humanDecisionBlockedReason ?? (text(row.human_decision_blocked_reason) || null),
        searchQueryEligibility: existing?.searchQueryEligibility ?? (text(row.search_query_eligibility) || null),
        queryShapeScore: existing?.queryShapeScore ?? numberOrNull(row.query_shape_score),
        sourcePrecisionClass: existing?.sourcePrecisionClass ?? (text(row.source_precision_class) || null),
        geoSearchVolume: existing?.geoSearchVolume ?? intOrNull(row.geo_search_volume ?? row.search_volume),
        globalSearchVolume: existing?.globalSearchVolume ?? intOrNull(row.global_search_volume),
        latestPayload: row,
        sourceOccurrences: [...(existing?.sourceOccurrences ?? []), occurrence],
        policyVersion: existing?.policyVersion ?? (text(row.policy_version) || text(payload.policy_version) || null),
      };
      artifactRows.set(normalizedKeyword, next);
    });
  }

  const items = [...artifactRows.values()];
  return {
    items,
    acceptedCount: items.filter((item) => item.currentMachineMembership === "accepted").length,
    reviewCount: items.filter((item) => isReviewMembership(item.currentMachineMembership)).length,
    parkedCount: items.filter((item) => item.currentMachineMembership === "parked").length,
    rejectedCount: items.filter((item) =>
      item.currentMachineMembership === "rejected" || item.currentMachineMembership === "rejected_noise",
    ).length,
    warningCounts: summarizeWarnings(items),
  };
}

export function seoOpsRoutes(db: Db) {
  const router = Router();

  async function getBatch(batchId: string) {
    return db
      .select()
      .from(seoOpsSemanticCoreReviewBatches)
      .where(eq(seoOpsSemanticCoreReviewBatches.id, batchId))
      .then((rows) => rows[0] ?? null);
  }

  router.get("/seo/semantic-core/review-batches", async (req, res) => {
    const companyId = text(req.query.companyId);
    if (!companyId) throw badRequest("companyId is required");
    assertCompanyAccess(req, companyId);

    const rows = await db
      .select()
      .from(seoOpsSemanticCoreReviewBatches)
      .where(eq(seoOpsSemanticCoreReviewBatches.companyId, companyId))
      .orderBy(desc(seoOpsSemanticCoreReviewBatches.updatedAt))
      .limit(50);
    res.json(rows);
  });

  router.get("/seo/semantic-core/review-batches/:batchId", async (req, res) => {
    const batch = await getBatch(req.params.batchId as string);
    if (!batch) throw notFound("Semantic-core review batch not found");
    assertCompanyAccess(req, batch.companyId);
    const [items, decisions] = await Promise.all([
      db
        .select()
        .from(seoOpsSemanticCoreReviewItems)
        .where(eq(seoOpsSemanticCoreReviewItems.reviewBatchId, batch.id))
        .orderBy(seoOpsSemanticCoreReviewItems.reviewPriority, seoOpsSemanticCoreReviewItems.displayKeyword),
      db
        .select()
        .from(seoOpsSemanticCoreReviewDecisions)
        .where(eq(seoOpsSemanticCoreReviewDecisions.reviewBatchId, batch.id))
        .orderBy(desc(seoOpsSemanticCoreReviewDecisions.createdAt))
        .limit(100),
    ]);
    res.json({ batch, items, decisions });
  });

  router.get("/seo/semantic-core/review-batches/:batchId/mcp-review-decisions", async (req, res) => {
    const batch = await getBatch(req.params.batchId as string);
    if (!batch) throw notFound("Semantic-core review batch not found");
    assertCompanyAccess(req, batch.companyId);
    const items = await db
      .select()
      .from(seoOpsSemanticCoreReviewItems)
      .where(eq(seoOpsSemanticCoreReviewItems.reviewBatchId, batch.id));
    res.json(buildSemanticCoreMcpReviewDecisionsPayload(batch, items));
  });

  router.post(
    "/seo/semantic-core/review-batches/import",
    validate(importReviewBatchSchema),
    async (req, res) => {
      const input = req.body as z.infer<typeof importReviewBatchSchema>;
      assertCompanyAccess(req, input.companyId);
      const actor = getActorInfo(req);
      const payload = input.preparePaperclipImport;
      const normalized = normalizePreparedSemanticCoreImport(payload);
      const [allCompanyItems, companyBatches, keywordActions] = await Promise.all([
        db
          .select()
          .from(seoOpsSemanticCoreReviewItems)
          .where(eq(seoOpsSemanticCoreReviewItems.companyId, input.companyId)),
        db
          .select()
          .from(seoOpsSemanticCoreReviewBatches)
          .where(eq(seoOpsSemanticCoreReviewBatches.companyId, input.companyId)),
        db
          .select()
          .from(seoOpsSemanticCoreKeywordActions)
          .where(eq(seoOpsSemanticCoreKeywordActions.companyId, input.companyId)),
      ]);
      const historicallyResolvedKeywords = historicalResolvedKeywordSetBeforeBatch(
        { updatedAt: new Date() },
        allCompanyItems,
        companyBatches,
        keywordActions,
      );
      const items = applySemanticCoreImportGuards(normalized.items, { historicallyResolvedKeywords });
      const {
        acceptedCount,
        reviewCount,
        parkedCount,
        rejectedCount,
        warningCounts,
      } = recalculatePreparedSemanticCoreImport(items);

      const [batch] = await db
        .insert(seoOpsSemanticCoreReviewBatches)
        .values({
          companyId: input.companyId,
          projectId: input.projectId,
          siteId: input.siteId ?? null,
          clientKey: input.clientKey,
          mcpProjectId: input.mcpProjectId,
          sourceRunId: input.sourceRunId,
          layer: input.layer,
          importReadiness: text(payload.import_readiness) || null,
          unsafeReasons: asArray(payload.unsafe_reasons).filter((item): item is string => typeof item === "string"),
          qualityReport: asRecord(payload.quality_report),
          policyVersion: text(payload.policy_version) || null,
          acceptedCount,
          reviewCount,
          parkedCount,
          rejectedCount,
          unresolvedReviewCount: items.filter((item) => item.humanReviewRequired).length,
          warningCounts,
          status: "in_review",
          latestImportReadinessPayload: payload,
          linkedIssueId: input.linkedIssueId ?? null,
          createdByAgentId: actor.agentId ?? null,
          createdByUserId: actor.actorType === "user" ? actor.actorId : null,
        })
        .onConflictDoUpdate({
          target: [
            seoOpsSemanticCoreReviewBatches.companyId,
            seoOpsSemanticCoreReviewBatches.projectId,
            seoOpsSemanticCoreReviewBatches.sourceRunId,
            seoOpsSemanticCoreReviewBatches.layer,
          ],
          set: {
            importReadiness: text(payload.import_readiness) || null,
            unsafeReasons: asArray(payload.unsafe_reasons).filter((item): item is string => typeof item === "string"),
            qualityReport: asRecord(payload.quality_report),
            policyVersion: text(payload.policy_version) || null,
            acceptedCount,
            reviewCount,
            parkedCount,
            rejectedCount,
            unresolvedReviewCount: items.filter((item) => item.humanReviewRequired).length,
            warningCounts,
            status: "in_review",
            latestImportReadinessPayload: payload,
            updatedAt: new Date(),
          },
        })
        .returning();

      for (const item of items) {
        await db
          .insert(seoOpsSemanticCoreReviewItems)
          .values({
            companyId: input.companyId,
            projectId: input.projectId,
            reviewBatchId: batch.id,
            normalizedKeyword: item.normalizedKeyword,
            displayKeyword: item.displayKeyword,
            duplicateGroupKey: item.duplicateGroupKey,
            sourceArtifactType: item.sourceArtifactType,
            sourceRunId: input.sourceRunId,
            currentMachineMembership: item.currentMachineMembership,
            recommendedHumanDecision: item.recommendedHumanDecision,
            productBindingStatus: item.productBindingStatus,
            domainTopicMatch: item.domainTopicMatch,
            domainTopicMatchScore: item.domainTopicMatchScore === null ? null : String(item.domainTopicMatchScore),
            acceptanceConfidence: item.acceptanceConfidence === null ? null : String(item.acceptanceConfidence),
            reviewPriority: item.reviewPriority,
            humanReviewRequired: item.humanReviewRequired,
            humanReviewReason: item.humanReviewReason,
            evidenceSummary: item.evidenceSummary,
            policyWarnings: item.policyWarnings,
            localeWarningSeverity: item.localeWarningSeverity,
            acceptedLocaleWarningOverridden: item.acceptedLocaleWarningOverridden,
            localeOverrideReason: item.localeOverrideReason,
            humanDecisionApplied: item.humanDecisionApplied,
            humanDecisionBlockedReason: item.humanDecisionBlockedReason,
            searchQueryEligibility: item.searchQueryEligibility,
            queryShapeScore: item.queryShapeScore === null ? null : String(item.queryShapeScore),
            sourcePrecisionClass: item.sourcePrecisionClass,
            geoSearchVolume: item.geoSearchVolume,
            globalSearchVolume: item.globalSearchVolume,
            latestPayload: item.latestPayload,
            sourceOccurrences: item.sourceOccurrences,
            policyVersion: item.policyVersion,
          })
          .onConflictDoUpdate({
            target: [
              seoOpsSemanticCoreReviewItems.reviewBatchId,
              seoOpsSemanticCoreReviewItems.duplicateGroupKey,
            ],
            set: {
              displayKeyword: item.displayKeyword,
              sourceArtifactType: item.sourceArtifactType,
              currentMachineMembership: item.currentMachineMembership,
              recommendedHumanDecision: item.recommendedHumanDecision,
              productBindingStatus: item.productBindingStatus,
              domainTopicMatch: item.domainTopicMatch,
              domainTopicMatchScore: item.domainTopicMatchScore === null ? null : String(item.domainTopicMatchScore),
              acceptanceConfidence: item.acceptanceConfidence === null ? null : String(item.acceptanceConfidence),
              reviewPriority: item.reviewPriority,
              humanReviewRequired: item.humanReviewRequired,
              humanReviewReason: item.humanReviewReason,
              evidenceSummary: item.evidenceSummary,
              policyWarnings: item.policyWarnings,
              localeWarningSeverity: item.localeWarningSeverity,
              acceptedLocaleWarningOverridden: item.acceptedLocaleWarningOverridden,
              localeOverrideReason: item.localeOverrideReason,
              humanDecisionApplied: item.humanDecisionApplied,
              humanDecisionBlockedReason: item.humanDecisionBlockedReason,
              searchQueryEligibility: item.searchQueryEligibility,
              queryShapeScore: item.queryShapeScore === null ? null : String(item.queryShapeScore),
              sourcePrecisionClass: item.sourcePrecisionClass,
              geoSearchVolume: item.geoSearchVolume,
              globalSearchVolume: item.globalSearchVolume,
              latestPayload: item.latestPayload,
              sourceOccurrences: item.sourceOccurrences,
              policyVersion: item.policyVersion,
              updatedAt: new Date(),
            },
          });
      }

      const synced = await syncSemanticCoreClientReviewCompletion(db, batch.id, actor);

      res.status(201).json({
        batch: synced?.batch ?? batch,
        importedItemCount: items.length,
        clientReviewProgress: synced?.progress ?? null,
      });
    },
  );

  router.patch(
    "/seo/semantic-core/review-items/:itemId/decision",
    validate(updateDecisionSchema),
    async (req, res) => {
      const actor = getActorInfo(req);
      const item = await db
        .select()
        .from(seoOpsSemanticCoreReviewItems)
        .where(eq(seoOpsSemanticCoreReviewItems.id, req.params.itemId as string))
        .then((rows) => rows[0] ?? null);
      if (!item) throw notFound("Semantic-core review item not found");
      assertCompanyAccess(req, item.companyId);
      const updated = await applySemanticCoreReviewDecision(db, item.id, req.body as z.infer<typeof updateDecisionSchema>, actor);
      res.json(updated);
    },
  );

  router.patch(
    "/seo/semantic-core/review-items/:itemId/connection",
    validate(updateConnectionSchema),
    async (req, res) => {
      const item = await db
        .select()
        .from(seoOpsSemanticCoreReviewItems)
        .where(eq(seoOpsSemanticCoreReviewItems.id, req.params.itemId as string))
        .then((rows) => rows[0] ?? null);
      if (!item) throw notFound("Semantic-core review item not found");
      assertCompanyAccess(req, item.companyId);
      const input = req.body as z.infer<typeof updateConnectionSchema>;
      const [updated] = await db
        .update(seoOpsSemanticCoreReviewItems)
        .set({
          humanConnectionAssessment: input.humanConnectionAssessment,
          humanConnectionNote: input.humanConnectionNote ?? item.humanConnectionNote,
          updatedAt: new Date(),
        })
        .where(eq(seoOpsSemanticCoreReviewItems.id, item.id))
        .returning();
      res.json(updated);
    },
  );

  router.post(
    "/seo/semantic-core/review-batches/:batchId/bulk-decisions",
    validate(bulkDecisionSchema),
    async (req, res) => {
      const batch = await getBatch(req.params.batchId as string);
      if (!batch) throw notFound("Semantic-core review batch not found");
      assertCompanyAccess(req, batch.companyId);
      const input = req.body as z.infer<typeof bulkDecisionSchema>;
      const actor = getActorInfo(req);
      await assertSemanticCoreReviewDecisionWriteAccess(db, batch, actor);
      const updated = [];
      for (const itemId of input.itemIds) {
        updated.push(await applySemanticCoreReviewDecision(db, itemId, input, actor));
      }
      res.json({ updatedCount: updated.length, items: updated });
    },
  );

  router.post(
    "/seo/semantic-core/review-batches/:batchId/rerun-gate",
    validate(rerunGateSchema),
    async (req, res) => {
      const batch = await getBatch(req.params.batchId as string);
      if (!batch) throw notFound("Semantic-core review batch not found");
      assertCompanyAccess(req, batch.companyId);
      const input = req.body as z.infer<typeof rerunGateSchema>;
      const [updated] = await db
        .update(seoOpsSemanticCoreReviewBatches)
        .set({
          status: input.status ?? batch.status,
          mcpReviewArtifactId: input.mcpReviewArtifactId ?? batch.mcpReviewArtifactId,
          reviewedRerunId: input.reviewedRerunId ?? batch.reviewedRerunId,
          latestImportReadinessPayload: input.latestImportReadinessPayload ?? batch.latestImportReadinessPayload,
          importReadiness: input.importReadiness ?? batch.importReadiness,
          unsafeReasons: input.unsafeReasons ?? batch.unsafeReasons,
          blockerReasons: input.blockerReasons ?? batch.blockerReasons,
          updatedAt: new Date(),
        })
        .where(eq(seoOpsSemanticCoreReviewBatches.id, batch.id))
        .returning();
      res.json(updated);
    },
  );

  return router;
}
