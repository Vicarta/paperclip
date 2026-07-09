import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { Router, type Request } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@paperclipai/db";
import { badRequest, notFound, unauthorized } from "../errors.js";

type JsonRecord = Record<string, unknown>;

const SEMANTIC_CORE_PLUGIN_KEY = "paperclip.semantic-core-mcp-agent-tools";
const ENTITY_IMPORT_CANDIDATE = "semantic-core-import-candidate";
const ENTITY_PORTAL_REVIEW_DECISION = "semantic-core-portal-review-decision";
const ENTITY_PORTAL_GROUP_DECISION = "semantic-core-portal-review-group-decision";
const ENTITY_PORTAL_KEYWORD_ACTION = "semantic-core-portal-keyword-action";

const humanDecisionSchema = z.enum([
  "accept",
  "reject",
  "defer",
  "revise",
  "product_discovery",
  "keep_review",
]);

const itemDecisionSchema = z.object({
  companySlug: z.string().min(1),
  portalUserEmail: z.string().email().optional().nullable(),
  humanDecision: humanDecisionSchema,
  notes: z.string().max(2_000).optional().nullable(),
  overrideReason: z.string().max(1_000).optional().nullable(),
  rejectReason: z.string().max(1_000).optional().nullable(),
  humanConnectionAssessment: z.enum([
    "service_match",
    "brand_match",
    "topic_match",
    "no_match",
    "unsure",
  ]).optional().nullable(),
  humanConnectionNote: z.string().max(1_000).optional().nullable(),
});

const groupDecisionSchema = z.object({
  companySlug: z.string().min(1),
  portalUserEmail: z.string().email().optional().nullable(),
  humanDecision: z.enum(["accept", "reject", "defer"]),
  selectedItemIds: z.array(z.string().min(1)).min(1),
  canonicalItemId: z.string().min(1).optional().nullable(),
  notes: z.string().max(2_000).optional().nullable(),
  rejectReason: z.string().max(1_000).optional().nullable(),
  overrideReason: z.string().max(1_000).optional().nullable(),
});

const keywordActionSchema = z.object({
  keyword: z.string().min(1).max(300),
  action: z.enum(["add", "accept", "reject", "defer", "remove", "restore"]).default("add"),
  notes: z.string().max(1_000).optional().nullable(),
  portalUserEmail: z.string().email().optional().nullable(),
});

type CompanyRow = {
  id: string;
  name: string;
  issue_prefix: string;
  brand_color: string | null;
};

type PluginEntityRow = {
  id: string;
  entity_type: string;
  external_id: string | null;
  title: string | null;
  status: string | null;
  data: unknown;
  created_at: Date | string;
  updated_at: Date | string;
};

type SemanticItem = {
  itemId: string;
  keywordId: string;
  keyword: string;
  canReview: boolean;
  lifecycleMembership: string | null;
  recommendation: {
    label: string | null;
    sourceSignal: string | null;
    machineMembership: string | null;
  };
  recommendedPageUrl: string | null;
  clusterName: string | null;
  locale: string | null;
  intentLabel: string | null;
  productConnection: string | null;
  geoSearchVolume: number | null;
  globalSearchVolume: number | null;
  rationale: string | null;
  status: string | null;
  batchTitle: string | null;
  lastDecisionNote: string | null;
  latestStageLabel: string | null;
  latestEvidenceSummary: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  sourceCount: number | null;
  sources: Array<Record<string, unknown>>;
  history: Array<Record<string, unknown>>;
  warnings: string[];
};

type PortalDecision = {
  decisionId: string;
  itemId: string | null;
  keyword: string;
  humanDecision: string;
  notes: string | null;
  portalUserEmail: string | null;
  createdAt: string | null;
};

export function portalRoutes(db: Db) {
  const router = Router();

  router.use((req, _res, next) => {
    if (!process.env.PAPERCLIP_PORTAL_SERVICE_TOKEN?.trim()) {
      throw unauthorized("Portal service token is not configured");
    }
    if (!isAuthorizedPortalToken(extractPortalBearerToken(req), process.env.PAPERCLIP_PORTAL_SERVICE_TOKEN)) {
      throw unauthorized("Portal service token required");
    }
    next();
  });

  router.get("/companies/:companySlug/semantic-core/review", async (req, res) => {
    const company = await resolvePortalCompanyBySlug(db, req.params.companySlug as string);
    if (!company) throw notFound("Portal company not found");

    const snapshot = await loadSemanticSnapshot(db, company.id);
    const decisions = await loadPortalDecisions(db, company.id);
    const items = applyItemDecisions(snapshot.reviewItems, decisions).filter((item) =>
      normalizeStatus(item.status) === "pending_review",
    );

    res.json({
      ok: true,
      company: mapPortalCompany(company),
      batches: snapshot.batch ? [snapshot.batch] : [],
      activeBatch: snapshot.batch,
      reviewContext: buildReviewContext(snapshot.batch, items),
      summary: reviewSummary(items),
      items,
      decisions: decisions.map(mapPortalDecision),
    });
  });

  router.get("/companies/:companySlug/semantic-core", async (req, res) => {
    const company = await resolvePortalCompanyBySlug(db, req.params.companySlug as string);
    if (!company) throw notFound("Portal company not found");

    const snapshot = await loadSemanticSnapshot(db, company.id);
    const [decisions, keywordActions] = await Promise.all([
      loadPortalDecisions(db, company.id),
      loadPortalKeywordActions(db, company.id),
    ]);
    const statusFilter = typeof req.query.status === "string" ? normalizeStatus(req.query.status) : null;
    const search = typeof req.query.search === "string" ? normalizeKeyword(req.query.search) : "";
    let items = mergeInventory(snapshot.inventoryItems, decisions, keywordActions);
    if (statusFilter) items = items.filter((item) => normalizeStatus(item.status) === statusFilter);
    if (search) items = items.filter((item) => normalizeKeyword(item.keyword).includes(search));

    res.json({
      ok: true,
      company: mapPortalCompany(company),
      context: {
        title: "Семантичне ядро",
        description: "Повний живий список запитів, погоджених, відкладених, відхилених або доданих вручну.",
        currentReviewQueueTitle: "Потребують рішення",
      },
      summary: inventorySummary(mergeInventory(snapshot.inventoryItems, decisions, keywordActions)),
      items,
      decisions: decisions.map(mapPortalDecision),
    });
  });

  router.get("/companies/:companySlug/semantic-core/review-groups", async (req, res) => {
    const company = await resolvePortalCompanyBySlug(db, req.params.companySlug as string);
    if (!company) throw notFound("Portal company not found");

    const snapshot = await loadSemanticSnapshot(db, company.id);
    const decisions = await loadPortalDecisions(db, company.id);
    const items = applyItemDecisions(snapshot.reviewItems, decisions).filter((item) =>
      normalizeStatus(item.status) === "pending_review",
    );
    const groups = buildReviewGroups(snapshot.batch?.batchId ?? "semantic-core", items);

    res.json({
      ok: true,
      company: mapPortalCompany(company),
      batches: snapshot.batch ? [snapshot.batch] : [],
      activeBatch: snapshot.batch,
      reviewContext: buildReviewContext(snapshot.batch, items),
      summary: {
        groups: groups.length,
        variants: items.length,
        pendingGroups: groups.filter((group) => group.status === "pending").length,
        pendingVariants: items.length,
        decidedVariants: 0,
      },
      groups,
    });
  });

  router.post("/semantic-core/review-items/:itemId/decision", async (req, res) => {
    const input = itemDecisionSchema.safeParse(req.body);
    if (!input.success) throw badRequest("Invalid portal semantic-core decision", input.error.flatten());

    const company = await resolvePortalCompanyBySlug(db, input.data.companySlug);
    if (!company) throw notFound("Portal company not found");

    const snapshot = await loadSemanticSnapshot(db, company.id);
    const item = [...snapshot.reviewItems, ...snapshot.inventoryItems]
      .find((candidate) => candidate.itemId === req.params.itemId || candidate.keywordId === req.params.itemId);
    if (!item) throw notFound("Portal review item not found");

    const decision = await insertPortalEntity(db, {
      companyId: company.id,
      entityType: ENTITY_PORTAL_REVIEW_DECISION,
      externalId: `decision:${item.itemId}:${Date.now()}:${randomUUID()}`,
      title: `Portal semantic-core decision: ${item.keyword}`,
      status: input.data.humanDecision,
      data: {
        itemId: item.itemId,
        keywordId: item.keywordId,
        keyword: item.keyword,
        source: "portal",
        ...input.data,
        portalUserEmail: input.data.portalUserEmail?.toLowerCase() ?? null,
      },
    });

    res.json({
      ok: true,
      item: applyDecisionToItem(item, entityToDecision(decision)),
      decision: mapPortalDecision(entityToDecision(decision)),
    });
  });

  router.post("/semantic-core/review-groups/:groupId/decision", async (req, res) => {
    const input = groupDecisionSchema.safeParse(req.body);
    if (!input.success) throw badRequest("Invalid portal semantic-core group decision", input.error.flatten());

    const company = await resolvePortalCompanyBySlug(db, input.data.companySlug);
    if (!company) throw notFound("Portal company not found");

    const snapshot = await loadSemanticSnapshot(db, company.id);
    const decisions = await loadPortalDecisions(db, company.id);
    const items = applyItemDecisions(snapshot.reviewItems, decisions).filter((item) =>
      normalizeStatus(item.status) === "pending_review",
    );
    const groups = buildReviewGroups(snapshot.batch?.batchId ?? "semantic-core", items);
    const group = groups.find((candidate) => candidate.groupId === req.params.groupId);
    if (!group) throw notFound("Portal semantic-core review group not found");

    const groupItemIds = new Set(group.variants.map((variant) => variant.itemId));
    const selectedItemIds = [...new Set(input.data.selectedItemIds)];
    const invalidItemIds = selectedItemIds.filter((itemId) => !groupItemIds.has(itemId));
    if (invalidItemIds.length > 0) {
      throw badRequest("Selected review items do not belong to this group", { invalidItemIds });
    }

    const canonicalItemId = input.data.canonicalItemId ?? group.canonicalItemId;
    if (canonicalItemId && !groupItemIds.has(canonicalItemId)) {
      throw badRequest("Canonical review item does not belong to this group");
    }

    await insertPortalEntity(db, {
      companyId: company.id,
      entityType: ENTITY_PORTAL_GROUP_DECISION,
      externalId: `group-decision:${group.groupId}:${Date.now()}:${randomUUID()}`,
      title: `Portal semantic-core group decision: ${group.canonicalKeyword}`,
      status: input.data.humanDecision,
      data: {
        ...input.data,
        source: "portal",
        groupId: group.groupId,
        canonicalItemId,
        selectedItemIds,
        omittedItemIds: group.variants.map((variant) => variant.itemId).filter((itemId) => !selectedItemIds.includes(itemId)),
        portalUserEmail: input.data.portalUserEmail?.toLowerCase() ?? null,
      },
    });

    const affected = [];
    for (const itemId of selectedItemIds) {
      const item = items.find((candidate) => candidate.itemId === itemId);
      if (!item) continue;
      affected.push(await insertPortalEntity(db, {
        companyId: company.id,
        entityType: ENTITY_PORTAL_REVIEW_DECISION,
        externalId: `decision:${item.itemId}:${Date.now()}:${randomUUID()}`,
        title: `Portal semantic-core decision: ${item.keyword}`,
        status: input.data.humanDecision,
        data: {
          source: "portal_group",
          groupId: group.groupId,
          itemId: item.itemId,
          keywordId: item.keywordId,
          keyword: item.keyword,
          companySlug: input.data.companySlug,
          portalUserEmail: input.data.portalUserEmail?.toLowerCase() ?? null,
          humanDecision: input.data.humanDecision,
          notes: input.data.notes ?? null,
          rejectReason: input.data.rejectReason ?? null,
          overrideReason: input.data.overrideReason ?? null,
        },
      }));
    }

    res.json({
      ok: true,
      group,
      decisionSummary: {
        groupId: group.groupId,
        humanDecision: input.data.humanDecision,
        canonicalItemId,
        affectedItemIds: affected.map((entity) => asString(asRecord(entity.data).itemId)).filter(Boolean),
      },
    });
  });

  router.post("/companies/:companySlug/semantic-core/keywords", async (req, res) => {
    const company = await resolvePortalCompanyBySlug(db, req.params.companySlug as string);
    if (!company) throw notFound("Portal company not found");

    const input = keywordActionSchema.safeParse(req.body);
    if (!input.success) throw badRequest("Invalid semantic-core keyword action", input.error.flatten());

    const keyword = input.data.keyword.trim();
    const normalizedKeyword = normalizeKeyword(keyword);
    const status = statusForKeywordAction(input.data.action);
    const action = await insertPortalEntity(db, {
      companyId: company.id,
      entityType: ENTITY_PORTAL_KEYWORD_ACTION,
      externalId: `keyword-action:${normalizedKeyword}:${Date.now()}:${randomUUID()}`,
      title: `Portal semantic-core keyword action: ${keyword}`,
      status,
      data: {
        source: "portal",
        keyword,
        keywordId: normalizedKeyword,
        normalizedKeyword,
        action: input.data.action,
        status,
        notes: input.data.notes ?? null,
        portalUserEmail: input.data.portalUserEmail?.toLowerCase() ?? null,
      },
    });

    res.status(201).json({
      ok: true,
      action: {
        actionId: action.id,
        keywordId: normalizedKeyword,
        keyword,
        action: input.data.action,
        status,
        notes: input.data.notes ?? null,
        portalUserEmail: input.data.portalUserEmail?.toLowerCase() ?? null,
        createdAt: toIso(action.created_at),
      },
    });
  });

  return router;
}

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

function slugifyCompany(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function resolvePortalCompanyBySlug(db: Db, companySlug: string) {
  const rows = Array.from(await db.execute(sql<CompanyRow>`
    select id, name, issue_prefix, brand_color
    from companies
    where status = 'active'
    order by created_at asc
  `)) as unknown as CompanyRow[];
  const normalizedSlug = slugifyCompany(companySlug);
  return rows.find((company) =>
    company.id === companySlug
    || slugifyCompany(company.name) === normalizedSlug
    || company.issue_prefix.toLowerCase() === normalizedSlug,
  ) ?? null;
}

function mapPortalCompany(company: CompanyRow) {
  return {
    companyId: company.id,
    name: company.name,
    slug: slugifyCompany(company.name),
    issuePrefix: company.issue_prefix,
    brandColor: company.brand_color,
  };
}

async function loadSemanticSnapshot(db: Db, companyId: string) {
  const [candidate] = Array.from(await db.execute(sql<PluginEntityRow>`
    select pe.id, pe.entity_type, pe.external_id, pe.title, pe.status, pe.data, pe.created_at, pe.updated_at
    from plugin_entities pe
    join plugins p on p.id = pe.plugin_id
    where (
        pe.company_id = ${companyId}
        or pe.data->>'companyId' = ${companyId}
      )
      and p.plugin_key = ${SEMANTIC_CORE_PLUGIN_KEY}
      and pe.entity_type = ${ENTITY_IMPORT_CANDIDATE}
    order by pe.updated_at desc
    limit 1
  `)) as unknown as PluginEntityRow[];

  if (!candidate) {
    return {
      batch: null,
      reviewItems: [] as SemanticItem[],
      inventoryItems: [] as SemanticItem[],
    };
  }

  const data = asRecord(candidate.data);
  const importPayload = asRecord(data.importPayload);
  const artifacts = asRecord(importPayload.artifacts);
  const runId = asString(data.runId) ?? asString(importPayload.run_id) ?? candidate.external_id ?? candidate.id;
  const layer = asString(importPayload.layer) ?? asString(asRecord(importPayload.project).layer);
  const batch = {
    batchId: candidate.id,
    sourceRunId: runId,
    stageLabel: stageLabelForLayer(layer),
    statusLabel: "На розгляді",
    counts: {
      accepted: arrayFrom(artifacts.accepted_keywords).length,
      review: reviewRowsFromArtifacts(artifacts).length,
      rejected: arrayFrom(artifacts.rejected_noise).length + arrayFrom(artifacts.rejected_keywords).length,
      unresolved: reviewRowsFromArtifacts(artifacts).length,
    },
    updatedAt: toIso(candidate.updated_at),
  };

  return {
    batch,
    reviewItems: reviewRowsFromArtifacts(artifacts).map((row, index) =>
      semanticItemFromRow(row, {
        source: "review",
        runId,
        batchTitle: candidate.title,
        index,
        canReview: true,
        defaultStatus: "pending_review",
        layer,
      }),
    ),
    inventoryItems: inventoryRowsFromArtifacts(artifacts).map((entry, index) =>
      semanticItemFromRow(entry.row, {
        source: entry.status,
        runId,
        batchTitle: candidate.title,
        index,
        canReview: false,
        defaultStatus: entry.status,
        layer,
      }),
    ),
  };
}

function reviewRowsFromArtifacts(artifacts: JsonRecord) {
  return [
    ...arrayFrom(artifacts.review_candidates),
    ...arrayFrom(artifacts.review_keywords),
    ...arrayFrom(artifacts.review),
  ].filter(isRecord);
}

function inventoryRowsFromArtifacts(artifacts: JsonRecord) {
  return [
    ...arrayFrom(artifacts.accepted_keywords).filter(isRecord).map((row) => ({ row, status: "accepted" })),
    ...arrayFrom(artifacts.semantic_core_keywords).filter(isRecord).map((row) => ({ row, status: "accepted" })),
    ...arrayFrom(artifacts.parked_outside_layer).filter(isRecord).map((row) => ({ row, status: "deferred" })),
    ...arrayFrom(artifacts.parked_keywords).filter(isRecord).map((row) => ({ row, status: "deferred" })),
    ...arrayFrom(artifacts.rejected_noise).filter(isRecord).map((row) => ({ row, status: "rejected" })),
    ...arrayFrom(artifacts.rejected_keywords).filter(isRecord).map((row) => ({ row, status: "rejected" })),
  ];
}

function semanticItemFromRow(row: JsonRecord, opts: {
  source: string;
  runId: string;
  batchTitle: string | null;
  index: number;
  canReview: boolean;
  defaultStatus: string;
  layer: string | null;
}): SemanticItem {
  const keyword = firstString(row, [
    "display_keyword",
    "keyword_text",
    "normalized_keyword",
    "keyword",
    "query",
  ]) ?? `keyword-${opts.index + 1}`;
  const normalized = normalizeKeyword(firstString(row, ["normalized_keyword", "keyword_text", "keyword", "query"]) ?? keyword);
  const itemId = firstString(row, ["item_id", "review_item_id", "id"])
    ?? stableId("sci", `${opts.runId}:${opts.source}:${normalized}:${opts.index}`);
  const evidenceSummary = firstString(row, [
    "evidence_summary",
    "rationale",
    "reason",
    "decision_trace_summary",
  ]);
  const machineMembership = firstString(row, [
    "membership",
    "current_machine_membership",
    "machine_membership",
    "state",
  ]) ?? opts.source;

  return {
    itemId,
    keywordId: normalized,
    keyword,
    canReview: opts.canReview,
    lifecycleMembership: opts.defaultStatus,
    recommendation: {
      label: recommendationLabel(firstString(row, ["recommended_human_decision", "recommended_decision"]), machineMembership),
      sourceSignal: opts.source,
      machineMembership,
    },
    recommendedPageUrl: firstString(row, ["recommended_page_url", "target_url", "url"]),
    clusterName: firstString(row, ["cluster_name", "cluster", "cluster_id"]),
    locale: firstString(row, ["locale", "language_code", "language"]),
    intentLabel: firstString(row, ["intent_label", "intent", "layer"]) ?? opts.layer,
    productConnection: firstString(row, ["product_binding_status", "product_connection", "domain_topic_match"]),
    geoSearchVolume: firstNumber(row, ["geo_search_volume", "search_volume"]),
    globalSearchVolume: firstNumber(row, ["global_search_volume"]),
    rationale: evidenceSummary,
    status: opts.defaultStatus,
    batchTitle: opts.batchTitle,
    lastDecisionNote: null,
    latestStageLabel: stageLabelForLayer(opts.layer),
    latestEvidenceSummary: evidenceSummary,
    firstSeenAt: firstString(row, ["created_at", "first_seen_at"]),
    lastSeenAt: firstString(row, ["updated_at", "last_seen_at"]),
    sourceCount: null,
    sources: clientSafeSources(row),
    history: [],
    warnings: clientSafeWarnings(row),
  };
}

async function loadPortalDecisions(db: Db, companyId: string) {
  const rows = Array.from(await db.execute(sql<PluginEntityRow>`
    select pe.id, pe.entity_type, pe.external_id, pe.title, pe.status, pe.data, pe.created_at, pe.updated_at
    from plugin_entities pe
    join plugins p on p.id = pe.plugin_id
    where (
        pe.company_id = ${companyId}
        or pe.data->>'companyId' = ${companyId}
      )
      and p.plugin_key = ${SEMANTIC_CORE_PLUGIN_KEY}
      and pe.entity_type = ${ENTITY_PORTAL_REVIEW_DECISION}
    order by pe.created_at desc
    limit 10000
  `)) as unknown as PluginEntityRow[];
  return rows.map(entityToDecision);
}

async function loadPortalKeywordActions(db: Db, companyId: string) {
  return Array.from(await db.execute(sql<PluginEntityRow>`
    select pe.id, pe.entity_type, pe.external_id, pe.title, pe.status, pe.data, pe.created_at, pe.updated_at
    from plugin_entities pe
    join plugins p on p.id = pe.plugin_id
    where (
        pe.company_id = ${companyId}
        or pe.data->>'companyId' = ${companyId}
      )
      and p.plugin_key = ${SEMANTIC_CORE_PLUGIN_KEY}
      and pe.entity_type = ${ENTITY_PORTAL_KEYWORD_ACTION}
    order by pe.created_at desc
    limit 10000
  `)) as unknown as PluginEntityRow[];
}

function entityToDecision(entity: PluginEntityRow): PortalDecision {
  const data = asRecord(entity.data);
  return {
    decisionId: entity.id,
    itemId: asString(data.itemId),
    keyword: asString(data.keyword) ?? "-",
    humanDecision: asString(data.humanDecision) ?? entity.status ?? "pending_review",
    notes: asString(data.notes),
    portalUserEmail: asString(data.portalUserEmail),
    createdAt: toIso(entity.created_at),
  };
}

function applyItemDecisions(items: SemanticItem[], decisions: PortalDecision[]) {
  const latestByItem = new Map<string, PortalDecision>();
  for (const decision of decisions) {
    if (!decision.itemId || latestByItem.has(decision.itemId)) continue;
    latestByItem.set(decision.itemId, decision);
  }
  return items.map((item) => applyDecisionToItem(item, latestByItem.get(item.itemId) ?? latestByItem.get(item.keywordId) ?? null));
}

function applyDecisionToItem(item: SemanticItem, decision: PortalDecision | null): SemanticItem {
  if (!decision) return item;
  return {
    ...item,
    status: decisionStatusValue(decision.humanDecision),
    lifecycleMembership: decisionStatusValue(decision.humanDecision),
    lastDecisionNote: decision.notes,
    history: [
      {
        label: "Рішення порталу",
        state: decisionStatusValue(decision.humanDecision),
        decision: decision.humanDecision,
        note: decision.notes,
        date: decision.createdAt,
      },
      ...item.history,
    ],
  };
}

function mergeInventory(items: SemanticItem[], decisions: PortalDecision[], keywordActions: PluginEntityRow[]) {
  const byKeyword = new Map<string, SemanticItem>();
  for (const item of applyItemDecisions(items, decisions)) {
    byKeyword.set(item.keywordId, { ...item, canReview: false });
  }

  for (const action of [...keywordActions].reverse()) {
    const data = asRecord(action.data);
    const keyword = asString(data.keyword) ?? asString(data.displayKeyword);
    if (!keyword) continue;
    const keywordId = normalizeKeyword(asString(data.normalizedKeyword) ?? keyword);
    const status = normalizeStatus(asString(data.status) ?? action.status ?? "candidate");
    const current = byKeyword.get(keywordId);
    byKeyword.set(keywordId, {
      ...(current ?? emptySemanticItem(keywordId, keyword)),
      keyword,
      keywordId,
      itemId: current?.itemId ?? stableId("manual", keywordId),
      status,
      lifecycleMembership: status,
      lastDecisionNote: asString(data.notes),
      history: [
        ...(current?.history ?? []),
        {
          label: "Дія порталу",
          state: status,
          decision: asString(data.action),
          note: asString(data.notes),
          date: toIso(action.created_at),
        },
      ],
      firstSeenAt: current?.firstSeenAt ?? toIso(action.created_at),
      lastSeenAt: toIso(action.created_at),
    });
  }

  return [...byKeyword.values()].sort((left, right) =>
    statusSort(left.status) - statusSort(right.status) || left.keyword.localeCompare(right.keyword, "uk"),
  );
}

async function insertPortalEntity(db: Db, input: {
  companyId: string;
  entityType: string;
  externalId: string;
  title: string;
  status: string;
  data: JsonRecord;
}) {
  const pluginId = await resolveSemanticCorePluginId(db);
  const [row] = Array.from(await db.execute(sql<PluginEntityRow>`
    insert into plugin_entities (
      plugin_id,
      company_id,
      entity_type,
      scope_kind,
      scope_id,
      external_id,
      title,
      status,
      data,
      created_at,
      updated_at
    )
    values (
      ${pluginId},
      ${input.companyId},
      ${input.entityType},
      'company',
      ${input.companyId},
      ${input.externalId},
      ${input.title},
      ${input.status},
      ${JSON.stringify(input.data)}::jsonb,
      now(),
      now()
    )
    returning id, entity_type, external_id, title, status, data, created_at, updated_at
  `)) as unknown as PluginEntityRow[];
  return row;
}

async function resolveSemanticCorePluginId(db: Db) {
  const [row] = Array.from(await db.execute(sql<{ id: string }>`
    select id from plugins where plugin_key = ${SEMANTIC_CORE_PLUGIN_KEY} limit 1
  `)) as unknown as Array<{ id: string }>;
  if (!row) {
    throw notFound("Semantic Core plugin is not installed");
  }
  return row.id;
}

function buildReviewContext(batch: { stageLabel: string } | null, items: SemanticItem[]) {
  const summary = reviewSummary(items);
  return {
    title: "Розгляд запитів для семантичного ядра",
    stageLabel: batch?.stageLabel ?? "Розгляд запитів",
    description: "Це запити, відібрані для клієнтського рішення перед включенням у семантичне ядро.",
    clientTask: summary.total > 0
      ? "Погодьте релевантні запити, відхиліть нерелевантні або відкладіть сумнівні."
      : "Дій з вашого боку зараз не потрібно.",
    nextStep: summary.pending > 0
      ? "Після рішень щодо всіх запитів Paperclip продовжить внутрішню перевірку."
      : "Клієнтський розгляд завершено або наразі немає активної черги.",
    progress: summary,
  };
}

function buildReviewGroups(batchId: string, items: SemanticItem[]) {
  const grouped = new Map<string, SemanticItem[]>();
  for (const item of items) {
    const key = normalizeKeyword(item.clusterName ?? item.keyword);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  return [...grouped.entries()].map(([groupKey, groupItems]) => {
    const canonical = [...groupItems].sort((left, right) =>
      (right.geoSearchVolume ?? 0) - (left.geoSearchVolume ?? 0)
      || left.keyword.length - right.keyword.length,
    )[0];
    return {
      groupId: stableId("scrg", `${batchId}:${groupKey}`),
      batchId,
      canonicalItemId: canonical.itemId,
      canonicalKeyword: canonical.keyword,
      variants: groupItems.map((item) => ({
        itemId: item.itemId,
        keyword: item.keyword,
        isCanonical: item.itemId === canonical.itemId,
        decisionState: "pending",
        decisionLabel: "Потребує рішення",
        selectedByDefault: true,
        geoSearchVolume: item.geoSearchVolume,
        globalSearchVolume: item.globalSearchVolume,
        confidence: null,
        matchScore: null,
        warnings: item.warnings,
        note: item.latestEvidenceSummary,
        updatedAt: item.lastSeenAt,
      })),
      variantCount: groupItems.length,
      geoSearchVolumeTotal: sumNullable(groupItems.map((item) => item.geoSearchVolume)),
      globalSearchVolumeTotal: sumNullable(groupItems.map((item) => item.globalSearchVolume)),
      confidence: "medium",
      groupingReason: canonical.clusterName,
      warning: null,
      status: "pending",
      statusLabel: "Потребує рішення",
      counts: {
        total: groupItems.length,
        pending: groupItems.length,
        accepted: 0,
        rejected: 0,
        deferred: 0,
        needsAttention: 0,
      },
      source: "paperclip",
    };
  }).sort((left, right) => left.canonicalKeyword.localeCompare(right.canonicalKeyword, "uk"));
}

function reviewSummary(items: SemanticItem[]) {
  const total = items.length;
  const pending = items.filter((item) => normalizeStatus(item.status) === "pending_review").length;
  return {
    total,
    pending,
    decided: total - pending,
    blocked: 0,
  };
}

function inventorySummary(items: SemanticItem[]) {
  return {
    total: items.length,
    accepted: items.filter((item) => normalizeStatus(item.status) === "accepted").length,
    candidate: items.filter((item) => normalizeStatus(item.status) === "candidate").length,
    deferred: items.filter((item) => normalizeStatus(item.status) === "deferred").length,
    rejected: items.filter((item) => normalizeStatus(item.status) === "rejected").length,
    removed: items.filter((item) => normalizeStatus(item.status) === "removed").length,
  };
}

function mapPortalDecision(decision: PortalDecision) {
  return decision;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function arrayFrom(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstString(row: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = asString(row[key]);
    if (value) return value;
  }
  return null;
}

function firstNumber(row: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeKeyword(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeStatus(value: unknown) {
  const normalized = asString(value)?.toLowerCase().replace(/[\s-]+/g, "_") ?? "";
  if (normalized === "accept" || normalized === "accepted" || normalized === "approved") return "accepted";
  if (normalized === "reject" || normalized === "rejected") return "rejected";
  if (normalized === "defer" || normalized === "deferred") return "deferred";
  if (normalized === "remove" || normalized === "removed") return "removed";
  if (normalized === "pending" || normalized === "review") return "pending_review";
  return normalized || "candidate";
}

function decisionStatusValue(decision: string) {
  if (decision === "accept") return "accepted";
  if (decision === "reject") return "rejected";
  if (decision === "defer") return "deferred";
  return "pending_review";
}

function statusForKeywordAction(action: string) {
  switch (action) {
    case "accept":
    case "add":
    case "restore":
      return "accepted";
    case "reject":
      return "rejected";
    case "defer":
      return "deferred";
    case "remove":
      return "removed";
    default:
      return "candidate";
  }
}

function statusSort(status: string | null) {
  return {
    accepted: 0,
    candidate: 1,
    pending_review: 2,
    deferred: 3,
    rejected: 4,
    removed: 5,
  }[normalizeStatus(status)] ?? 10;
}

function recommendationLabel(decision: string | null, membership: string | null) {
  if (decision === "accept" || membership === "accepted") return "Рекомендовано погодити";
  if (decision === "reject" || membership === "rejected") return "Рекомендовано відхилити";
  if (decision === "defer" || membership === "parked") return "Рекомендовано відкласти";
  return null;
}

function stageLabelForLayer(layer: string | null) {
  switch (layer) {
    case "core_product_intent":
      return "Перший етап: базові запити";
    case "adjacent_use_case_intent":
      return "Другий етап: суміжні запити";
    case "audience_need_intent":
      return "Третій етап: потреби аудиторії";
    case "audience_interest_intent":
      return "Четвертий етап: інтереси аудиторії";
    default:
      return "Розгляд запитів";
  }
}

function clientSafeWarnings(row: JsonRecord) {
  const warnings = [
    ...arrayFrom(row.policy_warnings),
    ...arrayFrom(row.policyWarnings),
    row.locale_warning_severity,
    row.warning,
  ].map((value) => asString(value)?.toLowerCase()).filter((value): value is string => Boolean(value));
  const labels = new Set<string>();
  if (warnings.some((warning) =>
    warning.includes("locale")
    || warning.includes("language")
    || warning.includes("mixed_language")
    || warning.includes("unsupported"),
  )) {
    labels.add("Потрібне пояснення через мовну особливість запиту.");
  }
  return [...labels];
}

function clientSafeSources(row: JsonRecord) {
  const sources = arrayFrom(row.source_occurrences).filter(isRecord);
  return sources.slice(0, 5).map((source, index) => ({
    label: asString(source.label) ?? `Джерело ${index + 1}`,
    state: asString(source.state) ?? asString(source.status),
    sourceType: asString(source.source_type) ?? asString(source.sourceType) ?? asString(source.source),
    date: asString(source.seen_at) ?? asString(source.created_at),
  }));
}

function emptySemanticItem(keywordId: string, keyword: string): SemanticItem {
  return {
    itemId: stableId("manual", keywordId),
    keywordId,
    keyword,
    canReview: false,
    lifecycleMembership: "candidate",
    recommendation: { label: null, sourceSignal: "manual_lifecycle_action", machineMembership: null },
    recommendedPageUrl: null,
    clusterName: null,
    locale: null,
    intentLabel: null,
    productConnection: null,
    geoSearchVolume: null,
    globalSearchVolume: null,
    rationale: null,
    status: "candidate",
    batchTitle: null,
    lastDecisionNote: null,
    latestStageLabel: null,
    latestEvidenceSummary: null,
    firstSeenAt: null,
    lastSeenAt: null,
    sourceCount: null,
    sources: [],
    history: [],
    warnings: [],
  };
}

function stableId(prefix: string, input: string) {
  return `${prefix}_${createHash("sha256").update(input).digest("hex").slice(0, 32)}`;
}

function sumNullable(values: Array<number | null>) {
  const numeric = values.filter((value): value is number => typeof value === "number");
  return numeric.length > 0 ? numeric.reduce((sum, value) => sum + value, 0) : null;
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}
