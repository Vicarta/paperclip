import { createHash, timingSafeEqual } from "node:crypto";
import { Router, type Request } from "express";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@paperclipai/db";
import {
  companies,
  seoOpsSemanticCoreKeywordActions,
  seoOpsSemanticCoreReviewBatches,
  seoOpsSemanticCoreReviewDecisions,
  seoOpsSemanticCoreReviewGroupDecisions,
  seoOpsSemanticCoreReviewItems,
} from "@paperclipai/db";
import { badRequest, forbidden, notFound, unauthorized } from "../errors.js";
import {
  applySemanticCoreReviewDecision,
  updateDecisionSchema,
} from "./seo-ops.js";
import {
  isSemanticCoreClientReviewableItem,
  isStaleHistoricalYearKeyword,
  semanticCoreClientReviewProgress,
} from "../services/semantic-core-client-review.js";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

const portalDecisionSchema = updateDecisionSchema.extend({
  companySlug: z.string().min(1),
  portalUserEmail: z.string().email().optional().nullable(),
  humanConnectionAssessment: z.enum([
    "service_match",
    "brand_match",
    "topic_match",
    "no_match",
    "unsure",
  ]).optional().nullable(),
  humanConnectionNote: z.string().optional().nullable(),
});

const portalGroupDecisionSchema = updateDecisionSchema.pick({
  notes: true,
  rejectReason: true,
  overrideReason: true,
}).extend({
  companySlug: z.string().min(1),
  portalUserEmail: z.string().email().optional().nullable(),
  humanDecision: z.enum(["accept", "reject", "defer"]),
  selectedItemIds: z.array(z.string().uuid()).min(1),
  canonicalItemId: z.string().uuid().optional().nullable(),
});

const keywordLifecycleActionSchema = z.object({
  keyword: z.string().min(1).max(300),
  action: z.enum(["add", "accept", "reject", "defer", "remove", "restore"]).default("add"),
  status: z.enum(["accepted", "candidate", "deferred", "rejected", "removed"]).optional(),
  notes: z.string().max(1000).optional().nullable(),
  portalUserEmail: z.string().email().optional().nullable(),
});

type PortalCompanyRow = typeof companies.$inferSelect;
type PortalReviewBatchRow = typeof seoOpsSemanticCoreReviewBatches.$inferSelect;
type PortalReviewItemRow = typeof seoOpsSemanticCoreReviewItems.$inferSelect;
type PortalReviewDecisionRow = typeof seoOpsSemanticCoreReviewDecisions.$inferSelect;
type PortalReviewGroupDecisionRow = typeof seoOpsSemanticCoreReviewGroupDecisions.$inferSelect;
type PortalKeywordActionRow = typeof seoOpsSemanticCoreKeywordActions.$inferSelect;
type PortalSemanticCoreLifecycleMembership = "accepted" | "candidate" | "deferred" | "rejected" | "removed";
type PortalSemanticCoreRecommendationSignal =
  | "human_accepted"
  | "human_rejected"
  | "human_deferred"
  | "manual_lifecycle_action"
  | "machine_recommended_accept"
  | "machine_needs_review"
  | "machine_parked"
  | "machine_rejected"
  | "unknown";

type PortalSemanticCoreInventoryItem = {
  keywordId: string;
  keyword: string;
  status: PortalSemanticCoreLifecycleMembership;
  lifecycleMembership: PortalSemanticCoreLifecycleMembership;
  recommendation: {
    sourceSignal: PortalSemanticCoreRecommendationSignal;
    label: string;
    machineMembership: string | null;
    recommendedHumanDecision: string | null;
  };
  geoSearchVolume: number | null;
  globalSearchVolume: number | null;
  sourceCount: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  latestStageLabel: string;
  latestEvidenceSummary: string | null;
  sources: Array<{
    batchId: string;
    stageLabel: string;
    state: string;
    sourceSignal: PortalSemanticCoreRecommendationSignal;
    humanDecision: string | null;
    sourceType: string;
    seenAt: string | null;
  }>;
  history: Array<{
    action: string;
    status: string;
    notes: string | null;
    createdAt: string | null;
  }>;
};

type PortalSemanticCoreReviewGroupVariant = {
  itemId: string;
  keyword: string;
  isCanonical: boolean;
  decisionState: "pending" | "accepted" | "rejected" | "deferred" | "needs_attention";
  decisionLabel: string;
  selectedByDefault: boolean;
  geoSearchVolume: number | null;
  globalSearchVolume: number | null;
  confidence: number | null;
  matchScore: number | null;
  warnings: string[];
  note: string | null;
  updatedAt: string | null;
};

type PortalSemanticCoreReviewGroup = {
  groupId: string;
  batchId: string;
  canonicalItemId: string;
  canonicalKeyword: string;
  groupConfidence: number | null;
  status: "pending" | "decided" | "mixed" | "needs_attention";
  statusLabel: string;
  counts: {
    total: number;
    pending: number;
    accepted: number;
    rejected: number;
    deferred: number;
    needsAttention: number;
  };
  geoSearchVolume: number | null;
  globalSearchVolume: number | null;
  warnings: string[];
  variants: PortalSemanticCoreReviewGroupVariant[];
  updatedAt: string | null;
};

export function isAuthorizedPortalToken(providedToken: string | null | undefined, expectedToken: string | null | undefined) {
  if (!providedToken || !expectedToken) return false;
  const provided = Buffer.from(providedToken);
  const expected = Buffer.from(expectedToken);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

export function extractPortalBearerToken(req: Request) {
  const authorization = req.header("authorization") ?? "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice("bearer ".length).trim();
  }
  return req.header("x-paperclip-portal-token")?.trim() || null;
}

export function slugifyCompany(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function companyMatchesPortalSlug(company: Pick<PortalCompanyRow, "id" | "name" | "issuePrefix">, slug: string) {
  const normalizedSlug = slugifyCompany(slug);
  return (
    company.id === slug ||
    slugifyCompany(company.name) === normalizedSlug ||
    company.issuePrefix.toLowerCase() === normalizedSlug
  );
}

export function mapPortalReviewBatch(batch: PortalReviewBatchRow) {
  return {
    batchId: batch.id,
    stageLabel: stageLabelForLayer(batch.layer),
    statusLabel: portalReviewBatchStatusLabel(batch),
    counts: {
      accepted: batch.acceptedCount,
      review: batch.reviewCount,
      rejected: batch.rejectedCount,
      unresolved: batch.unresolvedReviewCount,
    },
    updatedAt: toIso(batch.updatedAt),
  };
}

function portalReviewBatchStatusLabel(batch: Pick<PortalReviewBatchRow, "clientReviewStatus">) {
  switch (batch.clientReviewStatus) {
    case "completed":
      return "Розгляд завершено";
    case "not_applicable":
      return "Нових рішень немає";
    case "needs_internal_attention":
      return "Потребує внутрішньої перевірки";
    default:
      return "На розгляді";
  }
}

export function mapPortalReviewBatchWithProgress(
  batch: PortalReviewBatchRow,
  progress: ReturnType<typeof portalProgressCounts>,
) {
  return {
    ...mapPortalReviewBatch(batch),
    counts: {
      accepted: progress.accepted,
      review: progress.total,
      rejected: progress.rejected,
      unresolved: progress.pending,
    },
  };
}

export function mapPortalReviewItem(item: PortalReviewItemRow) {
  return {
    itemId: item.id,
    keyword: item.displayKeyword,
    currentState: item.currentMachineMembership,
    recommendedDecision: item.recommendedHumanDecision,
    humanDecision: item.humanDecision,
    decisionStatus: item.decisionStatus,
    productConnection: item.productBindingStatus,
    topicMatch: item.domainTopicMatch,
    topicMatchScore: decimalOrNull(item.domainTopicMatchScore),
    confidence: decimalOrNull(item.acceptanceConfidence),
    reviewPriority: item.reviewPriority,
    humanReviewRequired: item.humanReviewRequired,
    humanReviewReason: item.humanReviewReason,
    evidenceSummary: item.evidenceSummary,
    warnings: clientSafeWarnings(item),
    geoSearchVolume: item.geoSearchVolume,
    globalSearchVolume: item.globalSearchVolume,
    validationOutcome: item.validationOutcome,
    validationReasons: item.validationReasons,
    humanConnectionAssessment: item.humanConnectionAssessment,
    humanConnectionNote: item.humanConnectionNote,
    policyVersion: item.policyVersion,
    updatedAt: toIso(item.updatedAt),
  };
}

export function buildPortalReviewContext(
  batch: PortalReviewBatchRow | null,
  items: Pick<PortalReviewItemRow, "decisionStatus" | "humanDecision" | "validationOutcome">[],
) {
  const progress = portalProgressCounts(items);
  const isComplete = progress.total > 0 && progress.pending === 0;
  const hasNoClientItems = Boolean(batch) && progress.total === 0;

  return {
    title: "Розгляд запитів для семантичного ядра",
    stageLabel: hasNoClientItems
      ? `${stageLabelForLayer(batch?.layer ?? null)}: нових рішень немає`
      : isComplete ? "Клієнтський розгляд завершено" : stageLabelForLayer(batch?.layer ?? null),
    description: hasNoClientItems
      ? "На цьому етапі немає нових запитів, які потребують вашого рішення. Раніше погоджені, відхилені або відкладені запити не повертаються на повторний розгляд без окремої причини."
      : "Це запити, які відібрані для вашого розгляду перед включенням у семантичне ядро, на основі якого будуть формуватися статті для сайту, пости в соцмережах, рекламні тексти та інші матеріали.",
    clientTask: hasNoClientItems
      ? "Дій з вашого боку зараз не потрібно."
      : "Ваше завдання: погодити релевантні запити, відхилити нерелевантні, відкласти сумнівні. Це обовʼязковий етап: поки всі запити не отримають рішення, подальша підготовка семантичного ядра та матеріалів не запускається.",
    nextStep: hasNoClientItems
      ? "Далі потрібна внутрішня перевірка якості цього етапу та підготовка наступного корисного набору запитів."
      : isComplete
      ? "Ваш розгляд завершено. Далі запити пройдуть внутрішню перевірку готовності до включення в семантичне ядро; після цього буде підготовлено наступний етап."
      : "Будь ласка, пройдіть цю чергу якнайшвидше. Після того як ви приймете рішення щодо всіх запитів, буде виконано внутрішню перевірку готовності до наступного етапу.",
    progress,
  };
}

export function mapPortalReviewDecision(decision: PortalReviewDecisionRow) {
  return {
    decisionId: decision.id,
    itemId: decision.reviewItemId,
    decision: decision.newDecision,
    notes: decision.notes,
    validationOutcome: decision.validationOutcome,
    validationReasons: decision.validationReasons,
    createdAt: toIso(decision.createdAt),
  };
}

export function portalSemanticCoreReviewGroupId(batchId: string, groupKey: string) {
  const hash = createHash("sha256").update(`${batchId}\0${groupKey}`).digest("hex").slice(0, 32);
  return `scrg_${hash}`;
}

export function buildPortalSemanticCoreReviewGroups(
  items: PortalReviewItemRow[],
  canonicalOverrides: Map<string, string> = new Map(),
) {
  const grouped = new Map<string, PortalReviewItemRow[]>();
  for (const item of items) {
    const groupKey = portalReviewGroupKey(item);
    const key = `${item.reviewBatchId}\0${groupKey}`;
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }

  return [...grouped.entries()]
    .map(([key, groupItems]) => {
      const [batchId, groupKey] = key.split("\0");
      const groupId = portalSemanticCoreReviewGroupId(batchId, groupKey);
      return mapPortalReviewGroup(batchId, groupKey, groupItems, canonicalOverrides.get(groupId) ?? null);
    })
    .sort((left, right) =>
      reviewGroupSort(left) - reviewGroupSort(right)
      || (right.groupConfidence ?? -1) - (left.groupConfidence ?? -1)
      || left.canonicalKeyword.localeCompare(right.canonicalKeyword, "uk"),
    );
}

export function splitPortalReviewGroupDecisionItems(
  group: PortalSemanticCoreReviewGroup,
  selectedItemIds: string[],
) {
  const groupItemIds = new Set(group.variants.map((variant) => variant.itemId));
  const uniqueSelectedItemIds = [...new Set(selectedItemIds)];
  const invalidItemIds = uniqueSelectedItemIds.filter((itemId) => !groupItemIds.has(itemId));
  const omittedItemIds = group.variants
    .map((variant) => variant.itemId)
    .filter((itemId) => !uniqueSelectedItemIds.includes(itemId));

  return {
    selectedItemIds: uniqueSelectedItemIds,
    omittedItemIds,
    invalidItemIds,
  };
}

export function normalizePortalKeyword(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function semanticCoreInventoryStatusCounts(items: PortalSemanticCoreInventoryItem[]) {
  return {
    total: items.length,
    accepted: items.filter((item) => item.status === "accepted").length,
    candidate: items.filter((item) => item.status === "candidate").length,
    deferred: items.filter((item) => item.status === "deferred").length,
    rejected: items.filter((item) => item.status === "rejected").length,
    removed: items.filter((item) => item.status === "removed").length,
  };
}

export function isPortalVisibleSemanticCoreBatch(batch: Pick<PortalReviewBatchRow, "status">) {
  return !["superseded", "cancelled", "archived"].includes(batch.status);
}

export function acceptedInventoryKeywordSet(
  items: PortalReviewItemRow[],
  batches: PortalReviewBatchRow[],
  beforeBatch: PortalReviewBatchRow | null = null,
  actions: PortalKeywordActionRow[] = [],
) {
  return inventoryKeywordSetByStatuses(items, batches, beforeBatch, actions, new Set(["accepted"]));
}

export function resolvedInventoryKeywordSet(
  items: PortalReviewItemRow[],
  batches: PortalReviewBatchRow[],
  beforeBatch: PortalReviewBatchRow | null = null,
  actions: PortalKeywordActionRow[] = [],
) {
  return inventoryKeywordSetByStatuses(items, batches, beforeBatch, actions, new Set([
    "accepted",
    "rejected",
    "deferred",
    "removed",
  ]));
}

function inventoryKeywordSetByStatuses(
  items: PortalReviewItemRow[],
  batches: PortalReviewBatchRow[],
  beforeBatch: PortalReviewBatchRow | null,
  actions: PortalKeywordActionRow[],
  statuses: Set<PortalSemanticCoreLifecycleMembership>,
) {
  return new Set(
    buildSemanticCoreInventory(items, batches, actions, { beforeBatch })
      .filter((item) => statuses.has(item.status))
      .map((item) => item.keywordId),
  );
}

export function buildSemanticCoreInventory(
  items: PortalReviewItemRow[],
  batches: PortalReviewBatchRow[],
  actions: PortalKeywordActionRow[] = [],
  options: { beforeBatch?: PortalReviewBatchRow | null; excludeOpenReviewQueueItems?: boolean } = {},
): PortalSemanticCoreInventoryItem[] {
  const batchById = new Map(batches.map((batch) => [batch.id, batch]));
  const beforeTime = options.beforeBatch ? timestampMs(options.beforeBatch.updatedAt) : null;
  const openReviewKeywordIds = options.excludeOpenReviewQueueItems
    ? openReviewQueueKeywordIds(items, batchById)
    : new Set<string>();
  const groups = new Map<string, {
    keywordId: string;
    keyword: string;
    items: PortalReviewItemRow[];
    actions: PortalKeywordActionRow[];
  }>();

  for (const item of items) {
    const batch = batchById.get(item.reviewBatchId);
    if (!batch) continue;
    if (beforeTime !== null && batch && timestampMs(batch.updatedAt) >= beforeTime) continue;
    const keywordId = normalizePortalKeyword(item.normalizedKeyword || item.displayKeyword);
    if (!keywordId) continue;
    if (shouldExcludeOpenReviewInventoryDuplicate(item, keywordId, openReviewKeywordIds)) continue;
    if (isInternalDiagnosticInventoryItem(item)) continue;
    const group = groups.get(keywordId) ?? { keywordId, keyword: item.displayKeyword, items: [], actions: [] };
    group.items.push(item);
    if (!group.keyword || item.displayKeyword.length < group.keyword.length) group.keyword = item.displayKeyword;
    groups.set(keywordId, group);
  }

  for (const action of actions) {
    if (beforeTime !== null && timestampMs(action.createdAt) >= beforeTime) continue;
    const keywordId = normalizePortalKeyword(action.normalizedKeyword || action.displayKeyword);
    if (!keywordId) continue;
    const group = groups.get(keywordId) ?? { keywordId, keyword: action.displayKeyword, items: [], actions: [] };
    group.actions.push(action);
    if (!group.keyword) group.keyword = action.displayKeyword;
    groups.set(keywordId, group);
  }

  return [...groups.values()]
    .map((group) => mapInventoryGroup(group, batchById))
    .sort((a, b) => statusSort(a.status) - statusSort(b.status) || a.keyword.localeCompare(b.keyword, "uk"));
}

export function isPortalClientReviewableItem(item: Pick<PortalReviewItemRow,
  | "displayKeyword"
  | "currentMachineMembership"
  | "humanReviewRequired"
  | "productBindingStatus"
  | "domainTopicMatch"
  | "policyWarnings"
  | "localeWarningSeverity"
  | "searchQueryEligibility"
  | "sourcePrecisionClass"
>) {
  return isSemanticCoreClientReviewableItem(item);
}

export function isHistoricallyAcceptedReviewDuplicate(
  item: Pick<PortalReviewItemRow, "normalizedKeyword" | "displayKeyword" | "policyWarnings" | "humanReviewReason">,
  historicallyAcceptedKeywords: Set<string>,
) {
  return isHistoricallyResolvedReviewDuplicate(item, historicallyAcceptedKeywords);
}

export function isHistoricallyResolvedReviewDuplicate(
  item: Pick<PortalReviewItemRow, "normalizedKeyword" | "displayKeyword" | "policyWarnings" | "humanReviewReason">,
  historicallyResolvedKeywords: Set<string>,
) {
  const keywordId = normalizePortalKeyword(item.normalizedKeyword || item.displayKeyword);
  if (!keywordId || !historicallyResolvedKeywords.has(keywordId)) return false;
  const warnings = item.policyWarnings.map((warning) => warning.toLowerCase());
  const reason = item.humanReviewReason?.toLowerCase() ?? "";
  return !warnings.some((warning) => warning.includes("re_review") || warning.includes("force_client_review"))
    && !reason.includes("re-review")
    && !reason.includes("повтор");
}

export function portalRoutes(db: Db) {
  const router = Router();

  router.use((req, _res, next) => {
    if (!isAuthorizedPortalToken(extractPortalBearerToken(req), process.env.PAPERCLIP_PORTAL_SERVICE_TOKEN)) {
      throw unauthorized("Portal service token required");
    }
    next();
  });

  router.get("/companies/:companySlug/semantic-core/review", async (req, res) => {
    const company = await resolvePortalCompanyBySlug(db, req.params.companySlug as string);
    if (!company) throw notFound("Portal company not found");

    const requestedBatchId = typeof req.query.batchId === "string" ? req.query.batchId : null;
    const batches = await db
      .select()
      .from(seoOpsSemanticCoreReviewBatches)
      .where(eq(seoOpsSemanticCoreReviewBatches.companyId, company.id))
      .orderBy(desc(seoOpsSemanticCoreReviewBatches.updatedAt))
      .limit(20);

    const visibleBatches = batches.filter(isPortalVisibleSemanticCoreBatch);
    const activeBatch = requestedBatchId
      ? visibleBatches.find((batch) => batch.id === requestedBatchId) ?? null
      : visibleBatches[0] ?? null;

    if (!activeBatch) {
      const summary = { total: 0, pending: 0, decided: 0, blocked: 0 };
      res.json({
        ok: true,
        company: mapPortalCompany(company),
        batches: visibleBatches.map(mapPortalReviewBatch),
        activeBatch: null,
        reviewContext: buildPortalReviewContext(null, []),
        summary,
        items: [],
        decisions: [],
      });
      return;
    }

    if (requestedBatchId && activeBatch.id !== requestedBatchId) {
      throw notFound("Portal review batch not found");
    }

    const [items, allCompanyItems, decisions, keywordActions] = await Promise.all([
      db
        .select()
        .from(seoOpsSemanticCoreReviewItems)
        .where(eq(seoOpsSemanticCoreReviewItems.reviewBatchId, activeBatch.id))
        .orderBy(seoOpsSemanticCoreReviewItems.reviewPriority, seoOpsSemanticCoreReviewItems.displayKeyword),
      db
        .select()
        .from(seoOpsSemanticCoreReviewItems)
        .where(eq(seoOpsSemanticCoreReviewItems.companyId, company.id)),
      db
        .select()
        .from(seoOpsSemanticCoreReviewDecisions)
        .where(eq(seoOpsSemanticCoreReviewDecisions.reviewBatchId, activeBatch.id))
        .orderBy(desc(seoOpsSemanticCoreReviewDecisions.createdAt))
        .limit(100),
      db
        .select()
        .from(seoOpsSemanticCoreKeywordActions)
        .where(eq(seoOpsSemanticCoreKeywordActions.companyId, company.id)),
    ]);

    const historicalResolvedKeywords = resolvedInventoryKeywordSet(
      allCompanyItems,
      visibleBatches,
      activeBatch,
      keywordActions,
    );
    const visibleItems = items.filter((item) =>
      isPortalClientReviewableItem(item)
      && !isHistoricallyResolvedReviewDuplicate(item, historicalResolvedKeywords),
    );
    const visibleItemIds = new Set(visibleItems.map((item) => item.id));
    const visibleDecisions = decisions.filter((decision) => visibleItemIds.has(decision.reviewItemId));
    const progress = semanticCoreClientReviewProgress(visibleItems);
    const summary = {
      total: progress.total,
      pending: progress.pending,
      decided: progress.decided,
      blocked: progress.needsAttention,
    };

    res.json({
      ok: true,
      company: mapPortalCompany(company),
      batches: visibleBatches.map(mapPortalReviewBatch),
      activeBatch: mapPortalReviewBatchWithProgress(activeBatch, progress),
      reviewContext: buildPortalReviewContext(activeBatch, visibleItems),
      summary,
      items: visibleItems.map(mapPortalReviewItem),
      decisions: visibleDecisions.map(mapPortalReviewDecision),
    });
  });

  router.get("/companies/:companySlug/semantic-core/review-groups", async (req, res) => {
    const company = await resolvePortalCompanyBySlug(db, req.params.companySlug as string);
    if (!company) throw notFound("Portal company not found");

    const requestedBatchId = typeof req.query.batchId === "string" ? req.query.batchId : null;
    const batches = await db
      .select()
      .from(seoOpsSemanticCoreReviewBatches)
      .where(eq(seoOpsSemanticCoreReviewBatches.companyId, company.id))
      .orderBy(desc(seoOpsSemanticCoreReviewBatches.updatedAt))
      .limit(20);

    const visibleBatches = batches.filter(isPortalVisibleSemanticCoreBatch);
    const activeBatch = requestedBatchId
      ? visibleBatches.find((batch) => batch.id === requestedBatchId) ?? null
      : visibleBatches[0] ?? null;

    if (!activeBatch) {
      res.json({
        ok: true,
        company: mapPortalCompany(company),
        batches: visibleBatches.map(mapPortalReviewBatch),
        activeBatch: null,
        reviewContext: buildPortalReviewContext(null, []),
        summary: {
          groups: 0,
          variants: 0,
          pendingGroups: 0,
          pendingVariants: 0,
          decidedVariants: 0,
        },
        groups: [],
      });
      return;
    }

    if (requestedBatchId && activeBatch.id !== requestedBatchId) {
      throw notFound("Portal review batch not found");
    }

    const [items, allCompanyItems, keywordActions, groupDecisions] = await Promise.all([
      db
        .select()
        .from(seoOpsSemanticCoreReviewItems)
        .where(eq(seoOpsSemanticCoreReviewItems.reviewBatchId, activeBatch.id))
        .orderBy(seoOpsSemanticCoreReviewItems.reviewPriority, seoOpsSemanticCoreReviewItems.displayKeyword),
      db
        .select()
        .from(seoOpsSemanticCoreReviewItems)
        .where(eq(seoOpsSemanticCoreReviewItems.companyId, company.id)),
      db
        .select()
        .from(seoOpsSemanticCoreKeywordActions)
        .where(eq(seoOpsSemanticCoreKeywordActions.companyId, company.id)),
      db
        .select()
        .from(seoOpsSemanticCoreReviewGroupDecisions)
        .where(eq(seoOpsSemanticCoreReviewGroupDecisions.reviewBatchId, activeBatch.id))
        .orderBy(desc(seoOpsSemanticCoreReviewGroupDecisions.createdAt))
        .limit(500),
    ]);

    const historicalResolvedKeywords = resolvedInventoryKeywordSet(
      allCompanyItems,
      visibleBatches,
      activeBatch,
      keywordActions,
    );
    const visibleItems = items.filter((item) =>
      isPortalClientReviewableItem(item)
      && !isHistoricallyResolvedReviewDuplicate(item, historicalResolvedKeywords),
    );
    const progress = semanticCoreClientReviewProgress(visibleItems);
    const groups = buildPortalSemanticCoreReviewGroups(visibleItems, latestCanonicalOverrides(groupDecisions));
    const pendingGroups = groups.filter((group) => group.status === "pending" || group.status === "needs_attention").length;

    res.json({
      ok: true,
      company: mapPortalCompany(company),
      batches: visibleBatches.map(mapPortalReviewBatch),
      activeBatch: mapPortalReviewBatchWithProgress(activeBatch, progress),
      reviewContext: buildPortalReviewContext(activeBatch, visibleItems),
      summary: {
        groups: groups.length,
        variants: visibleItems.length,
        pendingGroups,
        pendingVariants: progress.pending,
        decidedVariants: progress.decided,
      },
      groups,
    });
  });

  router.get("/companies/:companySlug/semantic-core", async (req, res) => {
    const company = await resolvePortalCompanyBySlug(db, req.params.companySlug as string);
    if (!company) throw notFound("Portal company not found");

    const statusFilter = typeof req.query.status === "string" ? req.query.status : null;
    const search = typeof req.query.search === "string" ? normalizePortalKeyword(req.query.search) : "";

    const [batches, items, keywordActions] = await Promise.all([
      db
        .select()
        .from(seoOpsSemanticCoreReviewBatches)
        .where(eq(seoOpsSemanticCoreReviewBatches.companyId, company.id))
        .orderBy(desc(seoOpsSemanticCoreReviewBatches.updatedAt)),
      db
        .select()
        .from(seoOpsSemanticCoreReviewItems)
        .where(eq(seoOpsSemanticCoreReviewItems.companyId, company.id)),
      db
        .select()
        .from(seoOpsSemanticCoreKeywordActions)
        .where(eq(seoOpsSemanticCoreKeywordActions.companyId, company.id))
        .orderBy(desc(seoOpsSemanticCoreKeywordActions.createdAt)),
    ]);

    const visibleBatches = batches.filter(isPortalVisibleSemanticCoreBatch);
    let inventoryItems = buildSemanticCoreInventory(items, visibleBatches, keywordActions, {
      excludeOpenReviewQueueItems: true,
    });
    if (statusFilter) inventoryItems = inventoryItems.filter((item) => item.status === normalizeInventoryStatus(statusFilter));
    if (search) inventoryItems = inventoryItems.filter((item) => normalizePortalKeyword(item.keyword).includes(search));

    res.json({
      ok: true,
      company: mapPortalCompany(company),
      context: {
        title: "Семантичне ядро",
        description: "Це повний живий список запитів, які вже погоджені, відкладені, відхилені або додані вручну.",
        currentReviewQueueTitle: "Потребують рішення",
      },
      summary: semanticCoreInventoryStatusCounts(buildSemanticCoreInventory(items, visibleBatches, keywordActions, {
        excludeOpenReviewQueueItems: true,
      })),
      items: inventoryItems,
    });
  });

  router.post("/companies/:companySlug/semantic-core/keywords", async (req, res) => {
    const company = await resolvePortalCompanyBySlug(db, req.params.companySlug as string);
    if (!company) throw notFound("Portal company not found");
    const input = keywordLifecycleActionSchema.safeParse(req.body);
    if (!input.success) throw badRequest("Invalid semantic-core keyword action", input.error.flatten());

    const status = input.data.status ?? statusForLifecycleAction(input.data.action);
    const normalizedKeyword = normalizePortalKeyword(input.data.keyword);
    const projectId = await latestPortalSemanticCoreProjectId(db, company.id);
    const [action] = await db
      .insert(seoOpsSemanticCoreKeywordActions)
      .values({
        companyId: company.id,
        projectId,
        normalizedKeyword,
        displayKeyword: input.data.keyword.trim(),
        action: input.data.action,
        status,
        notes: input.data.notes ?? null,
        actorUserId: input.data.portalUserEmail ? `portal:${input.data.portalUserEmail.toLowerCase()}` : "portal:unknown",
        payload: {
          source: "portal",
          validation: "manual_keyword_requires_policy_processing",
        },
      })
      .returning();

    res.status(201).json({ ok: true, action: mapPortalKeywordAction(action) });
  });

  router.post("/semantic-core/review-items/:itemId/decision", async (req, res) => {
    const itemId = req.params.itemId as string;
    const input = portalDecisionSchema.safeParse(req.body);
    if (!input.success) throw badRequest("Invalid portal semantic-core decision", input.error.flatten());

    const company = await resolvePortalCompanyBySlug(db, input.data.companySlug);
    if (!company) throw notFound("Portal company not found");

    const item = await db
      .select()
      .from(seoOpsSemanticCoreReviewItems)
      .where(eq(seoOpsSemanticCoreReviewItems.id, itemId))
      .then((rows) => rows[0] ?? null);
    if (!item || item.companyId !== company.id) {
      throw notFound("Portal review item not found");
    }

    if (input.data.humanConnectionAssessment !== undefined || input.data.humanConnectionNote !== undefined) {
      await db
        .update(seoOpsSemanticCoreReviewItems)
        .set({
          humanConnectionAssessment: input.data.humanConnectionAssessment ?? item.humanConnectionAssessment,
          humanConnectionNote: input.data.humanConnectionNote ?? item.humanConnectionNote,
          updatedAt: new Date(),
        })
        .where(eq(seoOpsSemanticCoreReviewItems.id, item.id));
    }

    const actorId = input.data.portalUserEmail ? `portal:${input.data.portalUserEmail.toLowerCase()}` : "portal:unknown";
    const updated = await applySemanticCoreReviewDecision(db, item.id, input.data, {
      actorType: "portal",
      actorId,
      agentId: null,
      runId: null,
    });

    if (updated.companyId !== company.id) {
      throw forbidden("Portal decision company mismatch");
    }

    res.json({ ok: true, item: mapPortalReviewItem(updated) });
  });

  router.post("/semantic-core/review-groups/:groupId/decision", async (req, res) => {
    const groupId = req.params.groupId as string;
    const input = portalGroupDecisionSchema.safeParse(req.body);
    if (!input.success) throw badRequest("Invalid portal semantic-core group decision", input.error.flatten());

    const company = await resolvePortalCompanyBySlug(db, input.data.companySlug);
    if (!company) throw notFound("Portal company not found");

    const [batches, allCompanyItems, keywordActions] = await Promise.all([
      db
        .select()
        .from(seoOpsSemanticCoreReviewBatches)
        .where(eq(seoOpsSemanticCoreReviewBatches.companyId, company.id))
        .orderBy(desc(seoOpsSemanticCoreReviewBatches.updatedAt))
        .limit(50),
      db
        .select()
        .from(seoOpsSemanticCoreReviewItems)
        .where(eq(seoOpsSemanticCoreReviewItems.companyId, company.id)),
      db
        .select()
        .from(seoOpsSemanticCoreKeywordActions)
        .where(eq(seoOpsSemanticCoreKeywordActions.companyId, company.id)),
    ]);

    const visibleBatches = batches.filter(isPortalVisibleSemanticCoreBatch);
    let targetBatch: PortalReviewBatchRow | null = null;
    let targetGroup: PortalSemanticCoreReviewGroup | null = null;
    let targetItems: PortalReviewItemRow[] = [];

    for (const batch of visibleBatches) {
      const batchItems = allCompanyItems.filter((item) => item.reviewBatchId === batch.id);
      const historicalResolvedKeywords = resolvedInventoryKeywordSet(
        allCompanyItems,
        visibleBatches,
        batch,
        keywordActions,
      );
      const visibleItems = batchItems.filter((item) =>
        isPortalClientReviewableItem(item)
        && !isHistoricallyResolvedReviewDuplicate(item, historicalResolvedKeywords),
      );
      const groups = buildPortalSemanticCoreReviewGroups(visibleItems);
      const group = groups.find((candidate) => candidate.groupId === groupId) ?? null;
      if (!group) continue;
      targetBatch = batch;
      targetGroup = group;
      targetItems = visibleItems.filter((item) => group.variants.some((variant) => variant.itemId === item.id));
      break;
    }

    if (!targetBatch || !targetGroup) throw notFound("Portal semantic-core review group not found");

    const selection = splitPortalReviewGroupDecisionItems(targetGroup, input.data.selectedItemIds);
    if (selection.invalidItemIds.length > 0) {
      throw badRequest("Selected review items do not belong to this group", {
        invalidItemIds: selection.invalidItemIds,
      });
    }

    const canonicalItemId = input.data.canonicalItemId ?? targetGroup.canonicalItemId;
    if (!targetGroup.variants.some((variant) => variant.itemId === canonicalItemId)) {
      throw badRequest("Canonical review item does not belong to this group");
    }

    const actorId = input.data.portalUserEmail ? `portal:${input.data.portalUserEmail.toLowerCase()}` : "portal:unknown";
    const actor = {
      actorType: "portal" as const,
      actorId,
      agentId: null,
      runId: null,
    };
    const itemById = new Map(targetItems.map((item) => [item.id, item]));
    const updated = [];

    for (const itemId of selection.selectedItemIds) {
      if (!itemById.has(itemId)) {
        throw badRequest("Selected review item is not client-reviewable in this group", { itemId });
      }
      updated.push(await applySemanticCoreReviewDecision(db, itemId, {
        humanDecision: input.data.humanDecision,
        notes: input.data.notes,
        rejectReason: input.data.rejectReason,
        overrideReason: input.data.overrideReason,
      }, actor));
    }

    await db.insert(seoOpsSemanticCoreReviewGroupDecisions).values({
      companyId: company.id,
      projectId: targetBatch.projectId,
      reviewBatchId: targetBatch.id,
      groupId,
      canonicalReviewItemId: canonicalItemId,
      actorAgentId: null,
      actorUserId: actorId,
      decision: input.data.humanDecision,
      selectedItemIds: selection.selectedItemIds,
      omittedItemIds: selection.omittedItemIds,
      notes: input.data.notes ?? null,
      rejectReason: input.data.rejectReason ?? null,
      overrideReason: input.data.overrideReason ?? null,
      payload: {
        source: "portal",
        portalUserEmail: input.data.portalUserEmail?.toLowerCase() ?? null,
      },
    });

    const refreshedItems = await db
      .select()
      .from(seoOpsSemanticCoreReviewItems)
      .where(eq(seoOpsSemanticCoreReviewItems.reviewBatchId, targetBatch.id));
    const refreshedGroups = buildPortalSemanticCoreReviewGroups(
      refreshedItems.filter((item) => targetGroup?.variants.some((variant) => variant.itemId === item.id)),
      new Map([[groupId, canonicalItemId]]),
    );

    res.json({
      ok: true,
      group: refreshedGroups.find((group) => group.groupId === groupId) ?? targetGroup,
      decisionSummary: {
        groupId,
        humanDecision: input.data.humanDecision,
        canonicalItemId,
        affectedItemIds: updated.map((item) => item.id),
        omittedItemIds: selection.omittedItemIds,
      },
    });
  });

  return router;
}

async function latestPortalSemanticCoreProjectId(db: Db, companyId: string) {
  const batch = await db
    .select({ projectId: seoOpsSemanticCoreReviewBatches.projectId })
    .from(seoOpsSemanticCoreReviewBatches)
    .where(eq(seoOpsSemanticCoreReviewBatches.companyId, companyId))
    .orderBy(desc(seoOpsSemanticCoreReviewBatches.updatedAt))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  return batch?.projectId ?? null;
}

async function resolvePortalCompanyBySlug(db: Db, companySlug: string) {
  const companiesRows = await db
    .select()
    .from(companies)
    .where(eq(companies.status, "active"));
  return companiesRows.find((company) => companyMatchesPortalSlug(company, companySlug)) ?? null;
}

function mapPortalCompany(company: PortalCompanyRow) {
  return {
    companyId: company.id,
    name: company.name,
    slug: slugifyCompany(company.name),
    issuePrefix: company.issuePrefix,
    brandColor: company.brandColor,
  };
}

function decimalOrNull(value: unknown) {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}

function toIsoOrNull(value: Date | string | null) {
  return value ? toIso(value) : null;
}

function timestampMs(value: Date | string) {
  return value instanceof Date ? value.getTime() : Date.parse(value);
}

function stageLabelForLayer(layer: string | null) {
  switch (layer) {
    case "core_product_intent":
      return "Перший етап: базові запити";
    case "adjacent_use_case_intent":
      return "Другий етап: суміжні запити";
    case "audience_need_intent":
      return "Третій етап: потреби аудиторії";
    default:
      return "Розгляд запитів";
  }
}

const portalProgressCounts = semanticCoreClientReviewProgress;

function clientSafeWarnings(item: Pick<PortalReviewItemRow, "policyWarnings" | "localeWarningSeverity">) {
  const labels = new Set<string>();
  const warnings = item.policyWarnings.map((warning) => warning.toLowerCase());

  if (warnings.some(isLocalePolicyWarning) || item.localeWarningSeverity === "explainable_edge_case") {
    labels.add("Потрібне пояснення через мовну особливість запиту.");
  }

  return [...labels];
}

function isLocalePolicyWarning(warning: string) {
  return warning.includes("locale")
    || warning.includes("mixed_language")
    || warning.includes("unsupported_language")
    || warning.includes("unsupported_locale");
}

function portalReviewGroupKey(item: Pick<PortalReviewItemRow,
  "reviewBatchId" | "duplicateGroupKey" | "normalizedKeyword" | "displayKeyword" | "latestPayload"
>) {
  const payload = asRecord(item.latestPayload);
  const explicitGroupKey = firstString(payload, [
    "review_group_id",
    "reviewGroupId",
    "semantic_group_id",
    "semanticGroupId",
    "keyword_group_id",
    "keywordGroupId",
    "canonical_group_key",
    "canonicalGroupKey",
    "canonical_keyword_normalized",
    "canonicalKeywordNormalized",
    "canonical_keyword",
    "canonicalKeyword",
  ]);
  return normalizePortalKeyword(
    explicitGroupKey
      ?? item.duplicateGroupKey
      ?? item.normalizedKeyword
      ?? item.displayKeyword,
  );
}

function mapPortalReviewGroup(
  batchId: string,
  groupKey: string,
  items: PortalReviewItemRow[],
  canonicalOverrideItemId: string | null = null,
): PortalSemanticCoreReviewGroup {
  const sortedItems = [...items].sort((left, right) =>
    portalReviewItemCanonicalScore(right) - portalReviewItemCanonicalScore(left)
    || left.displayKeyword.length - right.displayKeyword.length
    || left.displayKeyword.localeCompare(right.displayKeyword, "uk"),
  );
  const canonicalItem = items.find((item) => item.id === canonicalOverrideItemId)
    ?? explicitCanonicalItem(items)
    ?? sortedItems[0];
  const variants = items
    .map((item) => mapPortalReviewGroupVariant(item, canonicalItem.id))
    .sort((left, right) =>
      Number(right.isCanonical) - Number(left.isCanonical)
      || reviewVariantSort(left) - reviewVariantSort(right)
      || left.keyword.localeCompare(right.keyword, "uk"),
    );
  const counts = {
    total: variants.length,
    pending: variants.filter((variant) => variant.decisionState === "pending").length,
    accepted: variants.filter((variant) => variant.decisionState === "accepted").length,
    rejected: variants.filter((variant) => variant.decisionState === "rejected").length,
    deferred: variants.filter((variant) => variant.decisionState === "deferred").length,
    needsAttention: variants.filter((variant) => variant.decisionState === "needs_attention").length,
  };
  const status = reviewGroupStatus(counts);
  const warnings = [...new Set(items.flatMap(clientSafeWarnings))];

  return {
    groupId: portalSemanticCoreReviewGroupId(batchId, groupKey),
    batchId,
    canonicalItemId: canonicalItem.id,
    canonicalKeyword: canonicalKeywordText(canonicalItem),
    groupConfidence: maxNumber(items.flatMap((item) => [
      decimalOrNull(item.acceptanceConfidence),
      decimalOrNull(item.domainTopicMatchScore),
    ])),
    status,
    statusLabel: reviewGroupStatusLabel(status),
    counts,
    geoSearchVolume: sumNullableVolumes(items.map((item) => item.geoSearchVolume)),
    globalSearchVolume: sumNullableVolumes(items.map((item) => item.globalSearchVolume)),
    warnings,
    variants,
    updatedAt: toIsoOrNull(new Date(Math.max(...items.map((item) => timestampMs(item.updatedAt))))),
  };
}

function sumNullableVolumes(values: Array<number | null>) {
  const numericValues = values.filter((value): value is number => typeof value === "number");
  if (numericValues.length === 0) return null;
  return numericValues.reduce((sum, value) => sum + value, 0);
}

function mapPortalReviewGroupVariant(
  item: PortalReviewItemRow,
  canonicalItemId: string,
): PortalSemanticCoreReviewGroupVariant {
  const decisionState = portalReviewDecisionState(item);
  return {
    itemId: item.id,
    keyword: item.displayKeyword,
    isCanonical: item.id === canonicalItemId,
    decisionState,
    decisionLabel: portalReviewDecisionStateLabel(decisionState),
    selectedByDefault: decisionState === "pending",
    geoSearchVolume: item.geoSearchVolume,
    globalSearchVolume: item.globalSearchVolume,
    confidence: decimalOrNull(item.acceptanceConfidence),
    matchScore: decimalOrNull(item.domainTopicMatchScore),
    warnings: clientSafeWarnings(item),
    note: clientSafeReviewPrompt(item),
    updatedAt: toIsoOrNull(item.updatedAt),
  };
}

function explicitCanonicalItem(items: PortalReviewItemRow[]) {
  const canonicalKeywords = new Set(
    items
      .map((item) => {
        const payload = asRecord(item.latestPayload);
        return firstString(payload, [
          "canonical_keyword",
          "canonicalKeyword",
          "canonical_query",
          "canonicalQuery",
        ]);
      })
      .filter((keyword): keyword is string => Boolean(keyword))
      .map(normalizePortalKeyword),
  );
  if (canonicalKeywords.size === 0) return null;
  return items.find((item) =>
    canonicalKeywords.has(normalizePortalKeyword(item.normalizedKeyword))
    || canonicalKeywords.has(normalizePortalKeyword(item.displayKeyword)),
  ) ?? null;
}

function canonicalKeywordText(item: PortalReviewItemRow) {
  const payload = asRecord(item.latestPayload);
  return firstString(payload, [
    "canonical_keyword",
    "canonicalKeyword",
    "canonical_query",
    "canonicalQuery",
  ]) ?? item.displayKeyword;
}

function portalReviewItemCanonicalScore(item: PortalReviewItemRow) {
  return (
    (decimalOrNull(item.acceptanceConfidence) ?? 0)
    + (decimalOrNull(item.domainTopicMatchScore) ?? 0)
    + ((item.geoSearchVolume ?? 0) / 1_000_000)
    + ((item.globalSearchVolume ?? 0) / 10_000_000)
  );
}

function portalReviewDecisionState(
  item: Pick<PortalReviewItemRow, "humanDecision" | "decisionStatus" | "validationOutcome">,
): PortalSemanticCoreReviewGroupVariant["decisionState"] {
  if (item.decisionStatus === "blocked" || item.validationOutcome === "blocked") return "needs_attention";
  if (item.humanDecision === "accept") return "accepted";
  if (item.humanDecision === "reject") return "rejected";
  if (item.humanDecision === "defer") return "deferred";
  return "pending";
}

function portalReviewDecisionStateLabel(state: PortalSemanticCoreReviewGroupVariant["decisionState"]) {
  switch (state) {
    case "accepted":
      return "Погоджено";
    case "rejected":
      return "Відхилено";
    case "deferred":
      return "Відкладено";
    case "needs_attention":
      return "Потребує внутрішньої перевірки";
    default:
      return "Потребує рішення";
  }
}

function clientSafeReviewPrompt(item: Pick<PortalReviewItemRow, "humanReviewReason">) {
  const reason = item.humanReviewReason?.toLowerCase() ?? "";
  if (reason.includes("locale")) return "Є мовна особливість запиту, але він може бути релевантним.";
  if (reason.includes("product")) return "Потрібно підтвердити звʼязок із послугою або темою.";
  return null;
}

function reviewGroupStatus(counts: PortalSemanticCoreReviewGroup["counts"]): PortalSemanticCoreReviewGroup["status"] {
  if (counts.needsAttention > 0) return "needs_attention";
  if (counts.pending > 0) return "pending";
  const decidedKinds = [counts.accepted, counts.rejected, counts.deferred].filter((count) => count > 0).length;
  return decidedKinds > 1 ? "mixed" : "decided";
}

function reviewGroupStatusLabel(status: PortalSemanticCoreReviewGroup["status"]) {
  switch (status) {
    case "decided":
      return "Рішення прийнято";
    case "mixed":
      return "Є різні рішення";
    case "needs_attention":
      return "Потребує внутрішньої перевірки";
    default:
      return "Потребує рішення";
  }
}

function reviewGroupSort(group: PortalSemanticCoreReviewGroup) {
  return {
    needs_attention: 0,
    pending: 1,
    mixed: 2,
    decided: 3,
  }[group.status] ?? 10;
}

function reviewVariantSort(variant: PortalSemanticCoreReviewGroupVariant) {
  return {
    needs_attention: 0,
    pending: 1,
    accepted: 2,
    deferred: 3,
    rejected: 4,
  }[variant.decisionState] ?? 10;
}

function firstString(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function maxNumber(values: Array<number | null>) {
  const numbers = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return numbers.length > 0 ? Math.max(...numbers) : null;
}

function latestCanonicalOverrides(decisions: PortalReviewGroupDecisionRow[]) {
  const overrides = new Map<string, string>();
  for (const decision of decisions) {
    if (!decision.canonicalReviewItemId || overrides.has(decision.groupId)) continue;
    overrides.set(decision.groupId, decision.canonicalReviewItemId);
  }
  return overrides;
}

function mapInventoryGroup(
  group: {
    keywordId: string;
    keyword: string;
    items: PortalReviewItemRow[];
    actions: PortalKeywordActionRow[];
  },
  batchById: Map<string, PortalReviewBatchRow>,
): PortalSemanticCoreInventoryItem {
  const sortedItems = [...group.items].sort((a, b) => timestampMs(a.updatedAt) - timestampMs(b.updatedAt));
  const sortedActions = [...group.actions].sort((a, b) => timestampMs(a.createdAt) - timestampMs(b.createdAt));
  const latestAction = sortedActions.at(-1) ?? null;
  const latestItem = sortedItems.at(-1) ?? null;
  const firstItem = sortedItems[0] ?? null;
  const statusSourceItem = latestAction ? latestItem : inventoryStatusSourceItem(sortedItems, batchById);
  const displayContextItem = statusSourceItem ?? latestItem;
  const latestVolumeItem = [...sortedItems].reverse().find((item) =>
    item.geoSearchVolume !== null || item.globalSearchVolume !== null,
  ) ?? null;
  const status = latestAction?.status as PortalSemanticCoreInventoryItem["status"] | undefined
    ?? statusFromReviewItems(sortedItems, batchById);
  const recommendation = inventoryRecommendation(displayContextItem, latestAction);

  return {
    keywordId: group.keywordId,
    keyword: latestAction?.displayKeyword ?? latestItem?.displayKeyword ?? group.keyword,
    status,
    lifecycleMembership: status,
    recommendation,
    geoSearchVolume: latestVolumeItem?.geoSearchVolume ?? null,
    globalSearchVolume: latestVolumeItem?.globalSearchVolume ?? null,
    sourceCount: sortedItems.length + sortedActions.length,
    firstSeenAt: toIsoOrNull(firstItem?.createdAt ?? sortedActions[0]?.createdAt ?? null),
    lastSeenAt: toIsoOrNull(latestAction?.createdAt ?? latestItem?.updatedAt ?? null),
    latestStageLabel: stageLabelForLayer(displayContextItem ? batchById.get(displayContextItem.reviewBatchId)?.layer ?? null : null),
    latestEvidenceSummary: displayContextItem?.evidenceSummary ?? latestItem?.evidenceSummary ?? null,
    sources: sortedItems.map((item) => {
      const batch = batchById.get(item.reviewBatchId);
      return {
        batchId: item.reviewBatchId,
        stageLabel: stageLabelForLayer(batch?.layer ?? null),
        state: inventoryStateLabel(item),
        sourceSignal: inventoryRecommendation(item, null).sourceSignal,
        humanDecision: item.humanDecision,
        sourceType: sourceTypeLabel(item.sourceArtifactType),
        seenAt: toIsoOrNull(item.updatedAt),
      };
    }),
    history: sortedActions.map(mapPortalKeywordAction),
  };
}

function statusFromReviewItems(
  items: PortalReviewItemRow[],
  batchById: Map<string, PortalReviewBatchRow>,
): PortalSemanticCoreInventoryItem["status"] {
  const sourceItem = inventoryStatusSourceItem(items, batchById);
  if (sourceItem?.humanDecision === "accept") return "accepted";
  if (sourceItem?.humanDecision === "reject") return "rejected";
  if (sourceItem?.humanDecision === "defer") return "deferred";
  if (sourceItem?.currentMachineMembership === "accepted") {
    const batch = batchById.get(sourceItem.reviewBatchId);
    const batchCompleted = batch?.clientReviewStatus === "completed" || Boolean(batch?.clientReviewProcessedAt);
    if (!batchCompleted || sourceItem.humanReviewRequired === true) return "candidate";
    return "accepted";
  }
  return "candidate";
}

function isOpenReviewQueueInventoryDuplicate(item: PortalReviewItemRow, batch: PortalReviewBatchRow) {
  const clientReviewClosed =
    batch.clientReviewStatus === "completed"
    || batch.clientReviewStatus === "not_applicable"
    || Boolean(batch.clientReviewProcessedAt);
  if (clientReviewClosed || item.humanDecision) return false;
  return isSemanticCoreClientReviewableItem(item);
}

function openReviewQueueKeywordIds(
  items: PortalReviewItemRow[],
  batchById: Map<string, PortalReviewBatchRow>,
) {
  const keywordIds = new Set<string>();
  for (const item of items) {
    const batch = batchById.get(item.reviewBatchId);
    if (!batch || !isOpenReviewQueueInventoryDuplicate(item, batch)) continue;
    const keywordId = normalizePortalKeyword(item.normalizedKeyword || item.displayKeyword);
    if (keywordId) keywordIds.add(keywordId);
  }
  return keywordIds;
}

function shouldExcludeOpenReviewInventoryDuplicate(
  item: PortalReviewItemRow,
  keywordId: string,
  openReviewKeywordIds: Set<string>,
) {
  if (!openReviewKeywordIds.has(keywordId)) return false;
  if (item.humanDecision) return false;
  return item.currentMachineMembership !== "accepted";
}

function isInternalDiagnosticInventoryItem(item: Pick<PortalReviewItemRow,
  | "currentMachineMembership"
  | "displayKeyword"
  | "searchQueryEligibility"
  | "latestPayload"
  | "humanDecision"
  | "humanReviewReason"
  | "policyWarnings"
>) {
  const payload = asRecord(item.latestPayload);
  const parkedReason = typeof payload.parked_reason === "string" ? payload.parked_reason.toLowerCase() : "";
  const reviewReason = item.humanReviewReason?.toLowerCase() ?? "";
  const policyWarnings = Array.isArray(item.policyWarnings)
    ? item.policyWarnings.filter((warning): warning is string => typeof warning === "string")
    : [];
  const hasOffTopicEntityConflict = item.currentMachineMembership === "parked"
    && (
      parkedReason === "off_topic_entity_conflict"
      || reviewReason === "off_topic_entity_conflict"
      || policyWarnings.includes("off_topic_entity_conflict")
    );
  return !item.humanDecision
    && (
      item.currentMachineMembership === "rejected_noise"
      || isStaleHistoricalYearKeyword(item.displayKeyword)
      || item.searchQueryEligibility === "not_search_query"
      || payload.rejected_reason === "not_search_query"
      || payload.layer_membership === "rejected_noise"
      || hasOffTopicEntityConflict
    );
}

function inventoryStatusSourceItem(
  items: PortalReviewItemRow[],
  batchById: Map<string, PortalReviewBatchRow>,
) {
  const latestHumanDecision = [...items].reverse().find((item) =>
    item.decisionStatus === "decided" && item.humanDecision,
  );
  if (latestHumanDecision) return latestHumanDecision;

  return [...items].reverse().find((item) => {
    const batch = batchById.get(item.reviewBatchId);
    const batchCompleted = batch?.clientReviewStatus === "completed" || Boolean(batch?.clientReviewProcessedAt);
    return item.currentMachineMembership === "accepted" && item.humanReviewRequired !== true && batchCompleted;
  }) ?? items.at(-1) ?? null;
}

function statusSort(status: PortalSemanticCoreInventoryItem["status"]) {
  return {
    accepted: 0,
    candidate: 1,
    deferred: 2,
    rejected: 3,
    removed: 4,
  }[status] ?? 10;
}

function normalizeInventoryStatus(status: string) {
  switch (status) {
    case "accept":
    case "approved":
      return "accepted";
    case "reject":
      return "rejected";
    case "defer":
      return "deferred";
    default:
      return status;
  }
}

function statusForLifecycleAction(action: z.infer<typeof keywordLifecycleActionSchema>["action"]) {
  switch (action) {
    case "add":
    case "accept":
    case "restore":
      return "accepted";
    case "reject":
      return "rejected";
    case "defer":
      return "deferred";
    case "remove":
      return "removed";
  }
}

function mapPortalKeywordAction(action: PortalKeywordActionRow) {
  return {
    action: action.action,
    status: action.status,
    notes: action.notes,
    createdAt: toIsoOrNull(action.createdAt),
  };
}

function inventoryRecommendation(
  item: PortalReviewItemRow | null,
  latestAction: PortalKeywordActionRow | null,
): PortalSemanticCoreInventoryItem["recommendation"] {
  if (latestAction) {
    return {
      sourceSignal: "manual_lifecycle_action",
      label: labelForManualLifecycleAction(latestAction.action),
      machineMembership: item?.currentMachineMembership ?? null,
      recommendedHumanDecision: item?.recommendedHumanDecision ?? null,
    };
  }
  if (!item) {
    return {
      sourceSignal: "unknown",
      label: "Джерело не визначено",
      machineMembership: null,
      recommendedHumanDecision: null,
    };
  }
  const humanSignal = signalFromHumanDecision(item.humanDecision);
  if (humanSignal) {
    return {
      sourceSignal: humanSignal,
      label: inventoryStateLabel(item),
      machineMembership: item.currentMachineMembership,
      recommendedHumanDecision: item.recommendedHumanDecision,
    };
  }
  return {
    sourceSignal: signalFromMachineMembership(item.currentMachineMembership),
    label: inventoryStateLabel(item),
    machineMembership: item.currentMachineMembership,
    recommendedHumanDecision: item.recommendedHumanDecision,
  };
}

function signalFromHumanDecision(decision: string | null): PortalSemanticCoreRecommendationSignal | null {
  switch (decision) {
    case "accept":
      return "human_accepted";
    case "reject":
      return "human_rejected";
    case "defer":
      return "human_deferred";
    default:
      return null;
  }
}

function signalFromMachineMembership(membership: string): PortalSemanticCoreRecommendationSignal {
  switch (membership) {
    case "accepted":
      return "machine_recommended_accept";
    case "review":
      return "machine_needs_review";
    case "parked":
      return "machine_parked";
    case "rejected":
      return "machine_rejected";
    default:
      return "unknown";
  }
}

function labelForManualLifecycleAction(action: string) {
  switch (action) {
    case "add":
    case "accept":
    case "restore":
      return "Додано вручну";
    case "reject":
      return "Відхилено вручну";
    case "defer":
      return "Відкладено вручну";
    case "remove":
      return "Прибрано з ядра";
    default:
      return "Ручна зміна";
  }
}

function inventoryStateLabel(item: PortalReviewItemRow) {
  if (item.humanDecision === "accept") return "Погоджено людиною";
  if (item.humanDecision === "reject") return "Відхилено людиною";
  if (item.humanDecision === "defer") return "Відкладено";
  if (item.currentMachineMembership === "accepted") return "Рекомендовано до погодження";
  if (item.currentMachineMembership === "review") return "Потребує рішення";
  return "Кандидат";
}

function sourceTypeLabel(sourceType: string) {
  switch (sourceType) {
    case "accepted":
      return "Попередньо відібрано";
    case "review":
      return "Розгляд";
    case "parked":
      return "Відкладений кандидат";
    case "rejected":
      return "Відхилений кандидат";
    case "serp_evidence":
      return "SERP evidence";
    case "recall":
      return "Додаткове джерело";
    default:
      return "Джерело";
  }
}
