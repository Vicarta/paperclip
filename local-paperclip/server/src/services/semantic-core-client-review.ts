import { eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  issueComments,
  issues,
  seoOpsSemanticCoreKeywordActions,
  seoOpsSemanticCoreReviewBatches,
  seoOpsSemanticCoreReviewItems,
} from "@paperclipai/db";

type JsonRecord = Record<string, unknown>;
type SemanticCoreReviewBatchRow = typeof seoOpsSemanticCoreReviewBatches.$inferSelect;
type SemanticCoreReviewItemRow = typeof seoOpsSemanticCoreReviewItems.$inferSelect;
type SemanticCoreKeywordActionRow = typeof seoOpsSemanticCoreKeywordActions.$inferSelect;

export type SemanticCoreClientReviewActor = {
  actorType: "agent" | "user" | "portal";
  actorId: string;
  agentId?: string | null;
  runId?: string | null;
};

export function isSemanticCoreClientReviewableItem(item: Pick<SemanticCoreReviewItemRow,
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
  const membership = item.currentMachineMembership?.toLowerCase();
  if (membership === "rejected_noise" || item.searchQueryEligibility === "not_search_query") return false;
  if (membership !== "review" && item.humanReviewRequired !== true) return false;

  const keyword = item.displayKeyword.toLowerCase();
  if (isObviousPortalNoiseKeyword(keyword)) return false;
  if (isStaleHistoricalYearKeyword(keyword)) return false;

  const warnings = normalizedWarnings(item.policyWarnings);
  if (warnings.some(isInternalOnlyPolicyWarning)) return false;

  const localeSeverity = item.localeWarningSeverity ?? "none";
  const hasLocaleWarning = warnings.some(isLocalePolicyWarning) || localeSeverity !== "none";
  if (hasLocaleWarning) {
    if (localeSeverity !== "explainable_edge_case") return false;
    if (item.domainTopicMatch !== "high") return false;
    if (item.productBindingStatus !== "canonized_product" && item.productBindingStatus !== "brand_binding") return false;
    if (item.sourcePrecisionClass !== "high" && item.sourcePrecisionClass !== "medium") return false;
  }

  const hasStrongBinding =
    item.productBindingStatus === "canonized_product"
    || item.productBindingStatus === "brand_binding"
    || item.productBindingStatus === "proposed_product";
  const hasTopicConnection =
    item.domainTopicMatch === "high"
    || item.domainTopicMatch === "medium";
  const hasTopicOnlyConnection =
    item.productBindingStatus === "topic_only"
    && hasTopicConnection;

  return hasStrongBinding || hasTopicOnlyConnection;
}

export function isStaleHistoricalYearKeyword(keyword: string, referenceDate = new Date()) {
  const currentYear = referenceDate.getUTCFullYear();
  const years = keyword.match(/\b20\d{2}\b/g) ?? [];
  return years.some((yearText) => Number(yearText) < currentYear);
}

export function semanticCoreClientReviewProgress(
  items: Pick<SemanticCoreReviewItemRow, "decisionStatus" | "humanDecision" | "validationOutcome">[],
) {
  const accepted = items.filter((item) => item.humanDecision === "accept").length;
  const rejected = items.filter((item) => item.humanDecision === "reject").length;
  const deferred = items.filter((item) => item.humanDecision === "defer").length;
  const decided = items.filter((item) => Boolean(item.humanDecision)).length;
  const needsAttention = items.filter((item) =>
    item.decisionStatus === "blocked" || item.validationOutcome === "blocked",
  ).length;

  return {
    total: items.length,
    pending: items.filter((item) => !item.humanDecision && item.decisionStatus === "pending").length,
    decided,
    accepted,
    rejected,
    deferred,
    needsAttention,
  };
}

export function buildSemanticCoreClientReviewSnapshot(
  batch: Pick<SemanticCoreReviewBatchRow,
    | "id"
    | "sourceRunId"
    | "layer"
    | "importReadiness"
    | "policyVersion"
    | "clientReviewRevision"
  >,
  items: SemanticCoreReviewItemRow[],
  clientReviewItems: SemanticCoreReviewItemRow[],
  progress = semanticCoreClientReviewProgress(clientReviewItems),
) {
  const acceptedSeedItems = items
    .filter(isAcceptedSeedItem)
    .sort((left, right) => left.normalizedKeyword.localeCompare(right.normalizedKeyword));
  const rejectedItems = clientReviewItems
    .filter((item) => item.humanDecision === "reject")
    .sort((left, right) => left.normalizedKeyword.localeCompare(right.normalizedKeyword));
  const deferredItems = clientReviewItems
    .filter((item) => item.humanDecision === "defer")
    .sort((left, right) => left.normalizedKeyword.localeCompare(right.normalizedKeyword));

  return {
    version: "semantic_core_client_review_snapshot.v1",
    reviewBatchId: batch.id,
    sourceRunId: batch.sourceRunId,
    layer: batch.layer,
    importReadiness: batch.importReadiness,
    policyVersion: batch.policyVersion,
    revision: batch.clientReviewRevision,
    progress,
    decisionSignature: clientReviewDecisionSignature(clientReviewItems),
    acceptedSeedCount: acceptedSeedItems.length,
    acceptedSeeds: acceptedSeedItems.map(mapSnapshotItem),
    rejectedCount: rejectedItems.length,
    rejected: rejectedItems.map(mapSnapshotItem),
    deferredCount: deferredItems.length,
    deferred: deferredItems.map(mapSnapshotItem),
    nextAction: nextActionForImportReadiness(batch.importReadiness),
  };
}

export function buildSemanticCoreMcpReviewDecisionsPayload(
  batch: Pick<SemanticCoreReviewBatchRow,
    | "id"
    | "mcpProjectId"
    | "sourceRunId"
    | "clientReviewRevision"
  >,
  items: SemanticCoreReviewItemRow[],
) {
  const decisions = items
    .filter((item) => Boolean(item.humanDecision))
    .sort((left, right) => left.displayKeyword.localeCompare(right.displayKeyword))
    .map((item) => {
      const latestPayload = asRecord(item.latestPayload);
      const action = mcpDecisionAction(item.humanDecision);
      const productBinding = action === "accept"
        ? readNonEmptyString(latestPayload.product_binding)
          ?? readNonEmptyString(latestPayload.productBinding)
          ?? (item.productBindingStatus && item.productBindingStatus !== "unknown" ? item.productBindingStatus : null)
        : null;

      return compactRecord({
        keyword_text: item.displayKeyword,
        normalized_keyword: item.normalizedKeyword,
        language_code: readNonEmptyString(latestPayload.language_code) ?? "uk",
        location_code: readLocationCode(latestPayload.location_code) ?? 2804,
        device_context: readNonEmptyString(latestPayload.device_context) ?? "*",
        decision: action,
        reason: mcpDecisionReason(item.humanDecision),
        product_binding: productBinding,
        notes: readNonEmptyString(item.humanConnectionNote),
        paperclip_item_id: item.id,
        paperclip_human_connection_assessment: readNonEmptyString(item.humanConnectionAssessment),
      });
    });

  return {
    project_id: batch.mcpProjectId,
    run_id: batch.sourceRunId,
    decision_source: "paperclip_client_portal",
    review_batch_id: batch.id,
    review_marker: `semantic-core-client-review:${batch.id}:r${batch.clientReviewRevision}`,
    decision_count: decisions.length,
    decisions,
  };
}

export async function syncSemanticCoreClientReviewCompletion(
  db: Db,
  reviewBatchId: string,
  actor: SemanticCoreClientReviewActor,
) {
  const batch = await db
    .select()
    .from(seoOpsSemanticCoreReviewBatches)
    .where(eq(seoOpsSemanticCoreReviewBatches.id, reviewBatchId))
    .then((rows) => rows[0] ?? null);
  if (!batch) return null;

  const items = await db
    .select()
    .from(seoOpsSemanticCoreReviewItems)
    .where(eq(seoOpsSemanticCoreReviewItems.reviewBatchId, reviewBatchId));
  const [allCompanyItems, companyBatches, keywordActions] = await Promise.all([
    db
      .select()
      .from(seoOpsSemanticCoreReviewItems)
      .where(eq(seoOpsSemanticCoreReviewItems.companyId, batch.companyId)),
    db
      .select()
      .from(seoOpsSemanticCoreReviewBatches)
      .where(eq(seoOpsSemanticCoreReviewBatches.companyId, batch.companyId)),
    db
      .select()
      .from(seoOpsSemanticCoreKeywordActions)
      .where(eq(seoOpsSemanticCoreKeywordActions.companyId, batch.companyId)),
  ]);
  const historicallyResolvedKeywords = historicalResolvedKeywordSetBeforeBatch(
    batch,
    allCompanyItems,
    companyBatches,
    keywordActions,
  );
  const state = deriveSemanticCoreClientReviewState(batch, items, { historicallyResolvedKeywords });

  const now = new Date();
  const wasCompleted = batch.clientReviewStatus === "completed";
  const shouldPostHandoff =
    state.completed
    && Boolean(batch.linkedIssueId)
    && (!wasCompleted || state.decisionStateChanged);

  const [updatedBatch] = await db
    .update(seoOpsSemanticCoreReviewBatches)
    .set({
      clientReviewStatus: state.clientReviewStatus,
      clientReviewCompletedAt: state.completed ? (batch.clientReviewCompletedAt ?? now) : null,
      clientReviewRevision: state.revision,
      clientReviewProgress: state.progress,
      clientReviewSnapshot: state.snapshot,
      status: state.completed ? "client_review_completed" : batch.status === "client_review_completed" ? "in_review" : batch.status,
      updatedAt: now,
    })
    .where(eq(seoOpsSemanticCoreReviewBatches.id, batch.id))
    .returning();

  if (shouldPostHandoff && batch.linkedIssueId) {
    await postClientReviewCompletionHandoff(db, updatedBatch, state.snapshot, actor, wasCompleted);
  }

  return {
    batch: updatedBatch,
    progress: state.progress,
    snapshot: state.snapshot,
    completed: state.completed,
    handoffPosted: shouldPostHandoff,
  };
}

export function deriveSemanticCoreClientReviewState(
  batch: SemanticCoreReviewBatchRow,
  items: SemanticCoreReviewItemRow[],
  options: { historicallyAcceptedKeywords?: Set<string>; historicallyResolvedKeywords?: Set<string> } = {},
) {
  const hiddenHistoricalKeywords = options.historicallyResolvedKeywords
    ?? options.historicallyAcceptedKeywords
    ?? new Set<string>();
  const clientReviewItems = items.filter((item) =>
    isSemanticCoreClientReviewableItem(item)
    && !isHistoricallyResolvedClientReviewDuplicate(item, hiddenHistoricalKeywords),
  );
  const progress = semanticCoreClientReviewProgress(clientReviewItems);
  const completed = progress.total > 0 && progress.pending === 0 && progress.needsAttention === 0;
  const hasAttentionBlocker = progress.needsAttention > 0;
  const previousSnapshot = asRecord(batch.clientReviewSnapshot);
  const nextSignature = clientReviewDecisionSignature(clientReviewItems);
  const previousSignature = typeof previousSnapshot.decisionSignature === "string"
    ? previousSnapshot.decisionSignature
    : null;
  const decisionStateChanged = previousSignature !== nextSignature;
  const revision = decisionStateChanged ? batch.clientReviewRevision + 1 : batch.clientReviewRevision;
  const snapshot = buildSemanticCoreClientReviewSnapshot(
    { ...batch, clientReviewRevision: revision },
    items,
    clientReviewItems,
    progress,
  );
  const clientReviewStatus = hasAttentionBlocker
    ? "needs_internal_attention"
    : completed
      ? (batch.clientReviewProcessedAt && decisionStateChanged ? "revision_after_processing" : "completed")
      : progress.total > 0
        ? "in_review"
        : "not_applicable";

  return {
    clientReviewStatus,
    completed,
    decisionStateChanged,
    revision,
    progress,
    snapshot,
  };
}

export function isHistoricallyAcceptedClientReviewDuplicate(
  item: Pick<SemanticCoreReviewItemRow, "normalizedKeyword" | "displayKeyword" | "policyWarnings" | "humanReviewReason">,
  historicallyAcceptedKeywords: Set<string>,
) {
  return isHistoricallyResolvedClientReviewDuplicate(item, historicallyAcceptedKeywords);
}

export function isHistoricallyResolvedClientReviewDuplicate(
  item: Pick<SemanticCoreReviewItemRow, "normalizedKeyword" | "displayKeyword" | "policyWarnings" | "humanReviewReason">,
  historicallyResolvedKeywords: Set<string>,
) {
  const keywordId = normalizeClientReviewKeyword(item.normalizedKeyword || item.displayKeyword);
  if (!keywordId || !historicallyResolvedKeywords.has(keywordId)) return false;
  const warnings = normalizedWarnings(item.policyWarnings);
  const reason = item.humanReviewReason?.toLowerCase() ?? "";
  return !warnings.some((warning) => warning.includes("re_review") || warning.includes("force_client_review"))
    && !reason.includes("re-review")
    && !reason.includes("повтор");
}

export function historicalAcceptedKeywordSetBeforeBatch(
  batch: Pick<SemanticCoreReviewBatchRow, "updatedAt">,
  items: SemanticCoreReviewItemRow[],
  batches: SemanticCoreReviewBatchRow[],
  actions: SemanticCoreKeywordActionRow[] = [],
) {
  return historicalKeywordSetBeforeBatch(batch, items, batches, actions, new Set(["accepted"]));
}

export function historicalResolvedKeywordSetBeforeBatch(
  batch: Pick<SemanticCoreReviewBatchRow, "updatedAt">,
  items: SemanticCoreReviewItemRow[],
  batches: SemanticCoreReviewBatchRow[],
  actions: SemanticCoreKeywordActionRow[] = [],
) {
  return historicalKeywordSetBeforeBatch(batch, items, batches, actions, new Set([
    "accepted",
    "rejected",
    "deferred",
    "removed",
  ]));
}

function historicalKeywordSetBeforeBatch(
  batch: Pick<SemanticCoreReviewBatchRow, "updatedAt">,
  items: SemanticCoreReviewItemRow[],
  batches: SemanticCoreReviewBatchRow[],
  actions: SemanticCoreKeywordActionRow[],
  statuses: Set<string>,
) {
  const batchById = new Map(batches.map((candidate) => [candidate.id, candidate]));
  const beforeTime = timestampMs(batch.updatedAt);
  const groups = new Map<string, {
    items: SemanticCoreReviewItemRow[];
    actions: SemanticCoreKeywordActionRow[];
  }>();

  for (const item of items) {
    const itemBatch = batchById.get(item.reviewBatchId);
    if (!itemBatch || timestampMs(itemBatch.updatedAt) >= beforeTime) continue;
    const keywordId = normalizeClientReviewKeyword(item.normalizedKeyword || item.displayKeyword);
    if (!keywordId) continue;
    const group = groups.get(keywordId) ?? { items: [], actions: [] };
    group.items.push(item);
    groups.set(keywordId, group);
  }

  for (const action of actions) {
    if (timestampMs(action.createdAt) >= beforeTime) continue;
    const keywordId = normalizeClientReviewKeyword(action.normalizedKeyword || action.displayKeyword);
    if (!keywordId) continue;
    const group = groups.get(keywordId) ?? { items: [], actions: [] };
    group.actions.push(action);
    groups.set(keywordId, group);
  }

  return new Set([...groups.entries()]
    .filter(([, group]) => statuses.has(historicalKeywordStatus(group, batchById)))
    .map(([keywordId]) => keywordId));
}

function isAcceptedSeedItem(item: SemanticCoreReviewItemRow) {
  if (item.decisionStatus === "blocked" || item.validationOutcome === "blocked") return false;
  if (item.humanDecision === "reject" || item.humanDecision === "defer") return false;
  if (item.humanDecision === "accept") return true;
  if (item.currentMachineMembership !== "accepted") return false;
  if (item.productBindingStatus === "unknown") return false;

  const warnings = normalizedWarnings(item.policyWarnings);
  if (warnings.some(isInternalOnlyPolicyWarning)) return false;

  const localeSeverity = item.localeWarningSeverity ?? "none";
  if (warnings.some(isLocalePolicyWarning) || localeSeverity !== "none") {
    return item.acceptedLocaleWarningOverridden === true
      && localeSeverity === "explainable_edge_case"
      && (item.productBindingStatus === "canonized_product" || item.productBindingStatus === "brand_binding")
      && item.domainTopicMatch === "high"
      && (item.sourcePrecisionClass === "high" || item.sourcePrecisionClass === "medium");
  }

  return true;
}

function historicalKeywordStatus(
  group: {
    items: SemanticCoreReviewItemRow[];
    actions: SemanticCoreKeywordActionRow[];
  },
  batchById: Map<string, SemanticCoreReviewBatchRow>,
) {
  const latestAction = [...group.actions].sort((a, b) => timestampMs(a.createdAt) - timestampMs(b.createdAt)).at(-1);
  if (latestAction) return latestAction.status;

  const latestHumanDecision = [...group.items]
    .sort((a, b) => timestampMs(a.updatedAt) - timestampMs(b.updatedAt))
    .reverse()
    .find((item) => item.decisionStatus === "decided" && item.humanDecision);
  if (latestHumanDecision?.humanDecision === "accept") return "accepted";
  if (latestHumanDecision?.humanDecision === "reject") return "rejected";
  if (latestHumanDecision?.humanDecision === "defer") return "deferred";

  if (group.items.some((item) => {
    const batch = batchById.get(item.reviewBatchId);
    const batchCompleted = batch?.clientReviewStatus === "completed" || Boolean(batch?.clientReviewProcessedAt);
    return item.currentMachineMembership === "accepted" && item.humanReviewRequired !== true && batchCompleted;
  })) {
    return "accepted";
  }

  return "candidate";
}

function mapSnapshotItem(item: SemanticCoreReviewItemRow) {
  return {
    itemId: item.id,
    keyword: item.displayKeyword,
    normalizedKeyword: item.normalizedKeyword,
    currentState: item.currentMachineMembership,
    humanDecision: item.humanDecision,
    productConnection: item.productBindingStatus,
    topicMatch: item.domainTopicMatch,
    geoSearchVolume: item.geoSearchVolume,
    globalSearchVolume: item.globalSearchVolume,
    policyVersion: item.policyVersion,
  };
}

function clientReviewDecisionSignature(items: SemanticCoreReviewItemRow[]) {
  return JSON.stringify(items
    .map((item) => ({
      id: item.id,
      humanDecision: item.humanDecision,
      decisionStatus: item.decisionStatus,
      validationOutcome: item.validationOutcome,
      updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : String(item.updatedAt),
    }))
    .sort((left, right) => left.id.localeCompare(right.id)));
}

function nextActionForImportReadiness(importReadiness: string | null) {
  switch (importReadiness) {
    case "ready_accepted_only":
    case "ready_after_review":
      return "internal_validation_then_next_layer";
    case "unsafe_for_import":
    case "needs_policy_fix":
      return "internal_policy_resolution_required";
    default:
      return "internal_validation_required";
  }
}

async function postClientReviewCompletionHandoff(
  db: Db,
  batch: SemanticCoreReviewBatchRow,
  snapshot: JsonRecord,
  actor: SemanticCoreClientReviewActor,
  wasCompleted: boolean,
) {
  if (!batch.linkedIssueId) return;
  const issue = await db
    .select()
    .from(issues)
    .where(eq(issues.id, batch.linkedIssueId))
    .then((rows) => rows[0] ?? null);
  if (!issue || issue.companyId !== batch.companyId) return;

  const progress = asRecord(snapshot.progress);
  const revision = typeof snapshot.revision === "number" ? snapshot.revision : batch.clientReviewRevision;
  const marker = `semantic-core-client-review:${batch.id}:r${revision}`;
  const body = [
    "## Semantic core client review handoff",
    "",
    wasCompleted
      ? `Client-visible review decisions changed after completion. Marker: \`${marker}\`.`
      : `Client-visible review is complete. Marker: \`${marker}\`.`,
    "",
    `- Batch: \`${batch.id}\``,
    `- Source run: \`${batch.sourceRunId}\``,
    `- Layer: \`${batch.layer}\``,
    `- Decisions: ${progress.decided ?? 0}/${progress.total ?? 0} decided; ${progress.accepted ?? 0} accepted, ${progress.rejected ?? 0} rejected, ${progress.deferred ?? 0} deferred.`,
    `- Accepted seed candidates: ${snapshot.acceptedSeedCount ?? 0}`,
    `- Next action: \`${snapshot.nextAction ?? "internal_validation_required"}\``,
    `- MCP review decisions payload: \`GET /api/seo/semantic-core/review-batches/${batch.id}/mcp-review-decisions\``,
    "",
    "Proceed by submitting the MCP review decisions payload, rerunning the same semantic layer with those decisions, then running `prepare_paperclip_import` for the new run. Hidden internal candidates should not reopen the client queue unless policy validation requires a new client-visible question.",
  ].join("\n");

  await postHandoffComment(db, issue.id, issue.companyId, body, actor);
  await unblockIssueForClientReviewCompletion(db, issue.id, issue.status);

  if (issue.parentId) {
    const parent = await db
      .select()
      .from(issues)
      .where(eq(issues.id, issue.parentId))
      .then((rows) => rows[0] ?? null);
    if (parent && parent.companyId === issue.companyId) {
      await postHandoffComment(db, parent.id, parent.companyId, body, actor);
      await unblockIssueForClientReviewCompletion(db, parent.id, parent.status);
    }
  }
}

async function postHandoffComment(
  db: Db,
  issueId: string,
  companyId: string,
  body: string,
  actor: SemanticCoreClientReviewActor,
) {
  await db.insert(issueComments).values({
    companyId,
    issueId,
    authorAgentId: actor.actorType === "agent" ? actor.agentId ?? null : null,
    authorUserId: actor.actorType === "agent" ? null : actor.actorId,
    createdByRunId: actor.runId ?? null,
    body,
  });
}

async function unblockIssueForClientReviewCompletion(db: Db, issueId: string, currentStatus: string) {
  await db
    .update(issues)
    .set({
      status: currentStatus === "blocked" ? "todo" : currentStatus,
      updatedAt: new Date(),
    })
    .where(eq(issues.id, issueId));
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function compactRecord(value: JsonRecord) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== null && entry !== undefined && entry !== ""),
  );
}

function readNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readLocationCode(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return null;
}

function mcpDecisionAction(decision: string | null) {
  switch (decision) {
    case "accept":
      return "accept";
    case "reject":
      return "reject";
    case "defer":
    case "revise":
    case "product_discovery":
    case "keep_review":
    default:
      return "candidate_review";
  }
}

function mcpDecisionReason(decision: string | null) {
  switch (decision) {
    case "reject":
      return "low_business_fit";
    case "defer":
    case "revise":
    case "product_discovery":
    case "keep_review":
      return "ambiguous_intent";
    case "accept":
    default:
      return "low_confidence";
  }
}

function normalizeClientReviewKeyword(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function timestampMs(value: Date | string) {
  return value instanceof Date ? value.getTime() : Date.parse(value);
}

function normalizedWarnings(warnings: string[] | null | undefined) {
  return (warnings ?? []).map((warning) => warning.toLowerCase());
}

function isLocalePolicyWarning(warning: string) {
  return warning.includes("locale")
    || warning.includes("mixed_language")
    || warning.includes("unsupported_language")
    || warning.includes("unsupported_locale");
}

function isInternalOnlyPolicyWarning(warning: string) {
  return warning.includes("competitor")
    || warning.includes("content_parsing")
    || warning.includes("serp_content")
    || warning.includes("ui_noise")
    || warning.includes("no_entity_anchor");
}

function isObviousPortalNoiseKeyword(keyword: string) {
  return /\bgoogle\s+store\b/.test(keyword)
    || /\bapp\s+store\b/.test(keyword)
    || /\bplay_apps\b/.test(keyword)
    || /\bsettings\b/.test(keyword)
    || /\bналаштування\b/.test(keyword)
    || /\bбібліотека\s+та\s+пристрої\b/.test(keyword);
}
