import {
  definePlugin,
  runWorker,
  type PluginContext,
  type ToolResult,
  type ToolRunContext,
} from "@paperclipai/plugin-sdk";
import {
  ENTITY_TYPES,
  PLUGIN_ID,
  TOOL_NAMES,
  type SemanticCoreMcpToolName,
} from "./constants.js";
import {
  callSemanticCoreMcpTool,
  extractResultObject,
  listSemanticCoreMcpTools,
  runLayerAndWait,
  runSemanticCoreSmoke,
  type SemanticCoreMcpPluginConfig,
  validatePaperclipImportPayload,
} from "./semantic-core-mcp-client.js";

type PluginSetupContext = Parameters<
  NonNullable<Parameters<typeof definePlugin>[0]["setup"]>
>[0];

const wrapperToolMap: Array<{
  paperclipToolName: (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];
  mcpToolName: SemanticCoreMcpToolName;
  displayName: string;
  description: string;
}> = [
  {
    paperclipToolName: TOOL_NAMES.getPaperclipImportSchema,
    mcpToolName: "get_paperclip_import_schema",
    displayName: "Semantic Core Get Paperclip Import Schema",
    description: "Call Semantic Core MCP `get_paperclip_import_schema`.",
  },
  {
    paperclipToolName: TOOL_NAMES.registerProject,
    mcpToolName: "register_project",
    displayName: "Semantic Core Register Project",
    description: "Register semantic-core project inputs with the MCP server.",
  },
  {
    paperclipToolName: TOOL_NAMES.validateProject,
    mcpToolName: "validate_project",
    displayName: "Semantic Core Validate Project",
    description: "Validate registered semantic-core project inputs.",
  },
  {
    paperclipToolName: TOOL_NAMES.runLayer,
    mcpToolName: "run_layer",
    displayName: "Semantic Core Run Layer",
    description: "Start one semantic-core layer run and return the MCP job id.",
  },
  {
    paperclipToolName: TOOL_NAMES.getJobStatus,
    mcpToolName: "get_job_status",
    displayName: "Semantic Core Get Job Status",
    description: "Poll a Semantic Core MCP async job.",
  },
  {
    paperclipToolName: TOOL_NAMES.listRuns,
    mcpToolName: "list_runs",
    displayName: "Semantic Core List Runs",
    description: "List Semantic Core runs for a project.",
  },
  {
    paperclipToolName: TOOL_NAMES.getKeywords,
    mcpToolName: "get_keywords",
    displayName: "Semantic Core Get Keywords",
    description: "Fetch accepted/review/parked/rejected keyword rows for a run.",
  },
  {
    paperclipToolName: TOOL_NAMES.getClusters,
    mcpToolName: "get_clusters",
    displayName: "Semantic Core Get Clusters",
    description: "Fetch keyword clusters for a run.",
  },
  {
    paperclipToolName: TOOL_NAMES.getSerpSegments,
    mcpToolName: "get_serp_segments",
    displayName: "Semantic Core Get SERP Segments",
    description: "Fetch SERP segmentation rows for a run.",
  },
  {
    paperclipToolName: TOOL_NAMES.generateTrendTopicReport,
    mcpToolName: "generate_trend_topic_report",
    displayName: "Semantic Core Generate Trend Topic Report",
    description:
      "Generate and durably store a project-isolated trend report without semantic import or direct topic creation.",
  },
  {
    paperclipToolName: TOOL_NAMES.preparePaperclipImport,
    mcpToolName: "prepare_paperclip_import",
    displayName: "Semantic Core Prepare Paperclip Import",
    description: "Prepare and validate a `paperclip_import.v1` payload for a completed run.",
  },
  {
    paperclipToolName: TOOL_NAMES.getReviewQueue,
    mcpToolName: "get_review_queue",
    displayName: "Semantic Core Get Review Queue",
    description: "Fetch Semantic Core review queue entries.",
  },
  {
    paperclipToolName: TOOL_NAMES.submitReviewDecisions,
    mcpToolName: "submit_review_decisions",
    displayName: "Semantic Core Submit Review Decisions",
    description: "Send Paperclip human/agent review decisions back to Semantic Core MCP.",
  },
  {
    paperclipToolName: TOOL_NAMES.getRunCosts,
    mcpToolName: "get_run_costs",
    displayName: "Semantic Core Get Run Costs",
    description: "Fetch provider/runtime cost metadata for a run.",
  },
];

const looseObjectSchema = {
  type: "object",
  additionalProperties: true,
} as const;

const ASTROGEN_SEMANTIC_PROJECT_ID = "astrogen-ukraine";
const ASTROGEN_TREND_PROJECT_ID = "astrogen-audience-trends-ukraine";
const ASTROGEN_ALLOWED_RESULT_PROJECT_IDS = new Set([
  ASTROGEN_SEMANTIC_PROJECT_ID,
  ASTROGEN_TREND_PROJECT_ID,
]);
const ASTROGEN_PRODUCT_SEED_PATTERN = [
  "астролог",
  "астрологія",
  "гороскоп",
  "зодіак",
  "таро",
  "таролог",
  "нумеролог",
  "нумерологія",
  "матриця долі",
  "дизайн людини",
  "human design",
  "натальна карта",
  "синастрія",
  "соляр",
  "astrology",
  "horoscope",
  "zodiac",
  "tarot",
  "tarologist",
  "numerology",
  "natal chart",
  "synastry",
  "solar return",
  "matrix of destiny",
].join("|");
const astrogenProductSeedRe = new RegExp(ASTROGEN_PRODUCT_SEED_PATTERN, "i");

function nowIso() {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readArray(value: unknown) {
  return Array.isArray(value) ? value : null;
}

function trendRequestPayload(args: unknown) {
  const request = isRecord(args) ? args : {};
  if (!isRecord(request.payload)) return request;
  const topLevel: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(request)) {
    if (key !== "payload") topLevel[key] = value;
  }
  return { ...request.payload, ...topLevel };
}

function textContainsAstrogenProductSeed(value: unknown): value is string {
  return typeof value === "string" && astrogenProductSeedRe.test(value);
}

function assertAstrogenAudienceTrendRequest(args: unknown) {
  const payload = trendRequestPayload(args);
  const projectId = readString(payload.project_id);
  if (
    projectId !== ASTROGEN_SEMANTIC_PROJECT_ID
    && projectId !== ASTROGEN_TREND_PROJECT_ID
  ) {
    return;
  }
  if (projectId !== ASTROGEN_TREND_PROJECT_ID) {
    throw new Error(
      `ASTROGEN_TREND_PROJECT_REQUIRED: generate_trend_topic_report must use project_id=${ASTROGEN_TREND_PROJECT_ID}; use ${ASTROGEN_SEMANTIC_PROJECT_ID} only for downstream semantic validation.`,
    );
  }
  const products = readArray(payload.products);
  if (products && products.length > 0) {
    throw new Error(
      "ASTROGEN_AUDIENCE_TREND_PRODUCTS_FORBIDDEN: trend discovery is audience-segment-first; pass products only to downstream validation/bridging, never to generate_trend_topic_report.",
    );
  }
  const project = isRecord(payload.project) ? payload.project : {};
  const guidanceTexts = [
    project.description,
    project.market,
    project.business_context,
    payload.company_goal,
  ];
  const audienceSegments = readArray(payload.audience_segments) ?? [];
  for (const segment of audienceSegments) {
    if (!isRecord(segment)) continue;
    guidanceTexts.push(segment.name, segment.description);
  }
  const productSeedText = guidanceTexts.find(textContainsAstrogenProductSeed);
  if (productSeedText) {
    throw new Error(
      `ASTROGEN_AUDIENCE_TREND_PRODUCT_SEED_FORBIDDEN: project, company_goal and audience_segments must describe audience situations, cultural signals and reader problems without Astrogen product/service terms. Move product terms to existing_content duplicate context or downstream semantic validation. Offending text: ${productSeedText.slice(0, 160)}`,
    );
  }
}

function readFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const number = readFiniteNumber(value);
  return number === null ? fallback : Math.min(max, Math.max(min, Math.trunc(number)));
}

async function getConfig(ctx: PluginSetupContext) {
  return (await ctx.config.get()) as SemanticCoreMcpPluginConfig;
}

function resultAsToolResult(result: { content: string; data: unknown }): ToolResult {
  return {
    content: result.content,
    data: result.data,
  };
}

async function callMcpTool(input: {
  ctx: PluginSetupContext;
  toolName: SemanticCoreMcpToolName;
  args?: unknown;
}): Promise<ToolResult> {
  const config = await getConfig(input.ctx);
  const result = await callSemanticCoreMcpTool({
    toolName: input.toolName,
    args: input.args,
    config,
    resolveSecret: (secretRef) => input.ctx.secrets.resolve(secretRef),
    fetchFn: input.ctx.http.fetch as typeof fetch,
  });

  return {
    content: result.content,
    data: result.data,
  };
}

async function storeEntity(input: {
  ctx: PluginContext;
  runCtx: ToolRunContext;
  entityType: string;
  externalId: string;
  title: string;
  status: string;
  data: Record<string, unknown>;
}) {
  await input.ctx.entities.upsert({
    entityType: input.entityType,
    scopeKind: "project",
    scopeId: input.runCtx.projectId,
    externalId: input.externalId,
    title: input.title,
    status: input.status,
    data: {
      ...input.data,
      companyId: input.runCtx.companyId,
      projectId: input.runCtx.projectId,
      agentId: input.runCtx.agentId,
      heartbeatRunId: input.runCtx.runId,
      storedAt: nowIso(),
    },
  });
}

async function maybeRecordImportCost(input: {
  ctx: PluginContext;
  runCtx: ToolRunContext;
  runId: string;
  importPayload: Record<string, unknown>;
}) {
  const stateKey = `cost-event:${input.runId}`;
  const previous = await input.ctx.state.get({
    scopeKind: "project",
    scopeId: input.runCtx.projectId,
    namespace: "semantic-core",
    stateKey,
  });
  if (previous) return;

  const cost = isRecord(input.importPayload.cost) ? input.importPayload.cost : {};
  const total = typeof cost.total === "number"
    ? cost.total
    : typeof cost.total_estimated === "number"
      ? cost.total_estimated
      : 0;
  const costCents = Math.max(0, Math.round(total * 100));
  const amountMicros = Math.max(0, Math.round(total * 1_000_000));
  if (amountMicros === 0) return;

  await input.ctx.costs.createEvent({
    companyId: input.runCtx.companyId,
    agentId: input.runCtx.agentId,
    projectId: input.runCtx.projectId,
    heartbeatRunId: input.runCtx.runId,
    issueId: null,
    goalId: null,
    billingCode: "semantic-core-mcp",
    provider: "semantic-core-builder",
    biller: "semantic-core-builder",
    billingType: "metered_api",
    model: "semantic-core-mcp",
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    costCents,
    amountMicros,
    occurredAt: nowIso(),
  });
  await input.ctx.state.set(
    {
      scopeKind: "project",
      scopeId: input.runCtx.projectId,
      namespace: "semantic-core",
      stateKey,
    },
    { recordedAt: nowIso(), costCents },
  );
}

function sumNumericEventField(events: Record<string, unknown>[], keys: string[]) {
  let total = 0;
  let found = false;
  for (const event of events) {
    for (const key of keys) {
      const value = readFiniteNumber(event[key]);
      if (value === null) continue;
      total += Math.max(0, value);
      found = true;
      break;
    }
  }
  return found ? total : null;
}

async function recordCompletedRunCost(input: {
  ctx: PluginContext;
  runCtx: ToolRunContext;
  runId: string;
  costPayload: unknown;
}) {
  const stateKey = `cost-event:${input.runId}`;
  const previous = await input.ctx.state.get({
    scopeKind: "project",
    scopeId: input.runCtx.projectId,
    namespace: "semantic-core",
    stateKey,
  });
  if (previous) return { recorded: false, amountMicros: 0 };

  const cost = isRecord(input.costPayload) ? input.costPayload : {};
  const events = (readArray(cost.events) ?? []).filter(isRecord);
  const actual = readFiniteNumber(cost.total_actual)
    ?? readFiniteNumber(cost.totalActual)
    ?? sumNumericEventField(events, ["actual_cost", "actualCost"]);
  const estimated = readFiniteNumber(cost.total_estimated)
    ?? readFiniteNumber(cost.totalEstimated)
    ?? readFiniteNumber(cost.total)
    ?? sumNumericEventField(events, ["estimated_cost", "estimatedCost"]);
  const amount = actual ?? estimated ?? 0;
  const amountMicros = Math.max(0, Math.round(amount * 1_000_000));

  await input.ctx.state.set(
    {
      scopeKind: "project",
      scopeId: input.runCtx.projectId,
      namespace: "semantic-core",
      stateKey,
    },
    {
      recordedAt: nowIso(),
      amountMicros,
      accountingMode: actual === null ? "estimated" : "provider_reported",
    },
  );
  if (amountMicros === 0) return { recorded: false, amountMicros };

  await input.ctx.costs.createEvent({
    companyId: input.runCtx.companyId,
    agentId: input.runCtx.agentId,
    projectId: input.runCtx.projectId,
    heartbeatRunId: input.runCtx.runId,
    issueId: null,
    goalId: null,
    billingCode: "semantic-core-mcp",
    provider: "semantic-core-builder",
    biller: "semantic-core-builder",
    billingType: "metered_api",
    model: "semantic-core-mcp",
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    costCents: Math.max(0, Math.round(amount * 100)),
    amountMicros,
    occurredAt: nowIso(),
  });
  return { recorded: true, amountMicros };
}

function readUsageTokens(metadata: Record<string, unknown>, keys: string[]) {
  const usage = isRecord(metadata.usage) ? metadata.usage : {};
  for (const key of keys) {
    const value = readFiniteNumber(usage[key]);
    if (value !== null) return Math.max(0, Math.trunc(value));
  }
  return 0;
}

async function recordTrendCostEvents(input: {
  ctx: PluginContext;
  runCtx: ToolRunContext;
  runId: string;
  result: Record<string, unknown>;
}) {
  const cost = isRecord(input.result.cost) ? input.result.cost : {};
  const events = (readArray(cost.events) ?? []).filter(isRecord);
  let recorded = 0;

  for (const [index, event] of events.entries()) {
    const currency = (readString(event.currency) ?? "USD").toUpperCase();
    const actualAmount = readFiniteNumber(event.actual_cost)
      ?? readFiniteNumber(event.actualCost);
    const amount = actualAmount
      ?? readFiniteNumber(event.estimated_cost)
      ?? readFiniteNumber(event.estimatedCost);
    if (currency !== "USD" || amount === null || amount <= 0) continue;

    const stateKey = `trend-cost-event:${input.runId}:${index}`;
    const previous = await input.ctx.state.get({
      scopeKind: "project",
      scopeId: input.runCtx.projectId,
      namespace: "semantic-core",
      stateKey,
    });
    if (previous) continue;

    const metadata = isRecord(event.metadata) ? event.metadata : {};
    const provider = readString(event.provider) ?? "semantic-core-trend";
    const model = readString(metadata.model) ?? readString(event.endpoint) ?? "trend-topic-report";
    const inputTokens = readUsageTokens(metadata, ["input_tokens", "prompt_tokens", "inputTokens"]);
    const outputTokens = readUsageTokens(metadata, ["output_tokens", "completion_tokens", "outputTokens"]);
    const cachedInputTokens = readUsageTokens(metadata, ["cached_input_tokens", "cachedInputTokens"]);
    const amountMicros = Math.round(amount * 1_000_000);

    await input.ctx.costs.createEvent({
      companyId: input.runCtx.companyId,
      agentId: input.runCtx.agentId,
      projectId: input.runCtx.projectId,
      heartbeatRunId: input.runCtx.runId,
      issueId: null,
      goalId: null,
      billingCode: "semantic-core-trend-topic",
      provider,
      biller: provider,
      billingType: "metered_api",
      model,
      inputTokens,
      cachedInputTokens,
      outputTokens,
      costCents: Math.round(amount * 100),
      amountMicros,
      occurredAt: nowIso(),
    });
    await input.ctx.state.set(
      {
        scopeKind: "project",
        scopeId: input.runCtx.projectId,
        namespace: "semantic-core",
        stateKey,
      },
      {
        recordedAt: nowIso(),
        amountMicros,
        accountingMode: actualAmount === null ? "estimated" : "provider_reported",
      },
    );
    recorded += 1;
  }

  return { telemetryEventCount: events.length, ledgerEventCount: recorded };
}

async function handleTrendTopicReport(input: {
  ctx: PluginSetupContext;
  args: unknown;
  runCtx: ToolRunContext;
}): Promise<ToolResult> {
  assertAstrogenAudienceTrendRequest(input.args);
  const config = await getConfig(input.ctx);
  const response = await callSemanticCoreMcpTool({
    toolName: "generate_trend_topic_report",
    args: input.args,
    config,
    resolveSecret: (secretRef) => input.ctx.secrets.resolve(secretRef),
    fetchFn: input.ctx.http.fetch as typeof fetch,
  });
  const result = extractResultObject(response);
  if (readString(result.status) !== "ok") return resultAsToolResult(response);

  const schemaVersion = readString(result.schema_version);
  const runId = readString(result.run_id);
  const projectId = readString(result.project_id);
  if (schemaVersion !== "trend_topic_report.v1" || !runId || !projectId) {
    throw new Error("Semantic Core trend result is missing trend_topic_report.v1 identity fields");
  }
  if (projectId !== input.runCtx.projectId && !ASTROGEN_ALLOWED_RESULT_PROJECT_IDS.has(projectId)) {
    throw new Error("Semantic Core trend result project_id does not match the Paperclip project scope");
  }
  const request = isRecord(input.args) ? input.args : {};
  const payload = isRecord(request.payload) ? request.payload : {};
  const requestMode = readString(request.mode) ?? readString(payload.mode) ?? "unknown";

  const costAccounting = await recordTrendCostEvents({
    ctx: input.ctx,
    runCtx: input.runCtx,
    runId,
    result,
  });
  await storeEntity({
    ctx: input.ctx,
    runCtx: input.runCtx,
    entityType: ENTITY_TYPES.trendTopicReport,
    externalId: runId,
    title: `Semantic Core trend report ${runId}`,
    status: "completed",
    data: {
      runId,
      semanticImportAllowed: false,
      directTopicCreationAllowed: false,
      requestMode,
      result,
      costAccounting,
    },
  });

  const persistedResult = {
    ...result,
    paperclip_persistence: {
      entity_type: ENTITY_TYPES.trendTopicReport,
      semantic_import_allowed: false,
      direct_topic_creation_allowed: false,
      ...costAccounting,
    },
  };
  return {
    content: JSON.stringify(persistedResult, null, 2),
    data: persistedResult,
  };
}

const keywordArrayKeys = [
  "keywords",
  "items",
  "accepted_keywords",
  "review_candidates",
  "parked_outside_layer",
  "rejected_noise",
  "serp_competitor_candidates",
  "recall_ledger",
  "review_keywords",
  "parked_keywords",
  "rejected_keywords",
  "accepted",
  "review",
  "parked",
  "rejected",
] as const;

function collectKeywordLikeRows(value: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 5) return [];
  if (typeof value === "string") {
    try {
      return collectKeywordLikeRows(JSON.parse(value) as unknown, depth + 1);
    } catch {
      return [];
    }
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectKeywordLikeRows(entry, depth + 1));
  }
  if (!isRecord(value)) return [];

  const rows: Record<string, unknown>[] = [];
  const looksLikeKeyword = readString(value.keyword_text)
    ?? readString(value.normalized_keyword)
    ?? readString(value.keyword)
    ?? readString(value.query);
  if (looksLikeKeyword) rows.push(value);

  for (const key of keywordArrayKeys) {
    const candidate = readArray(value[key]);
    if (candidate) rows.push(...candidate.filter(isRecord));
  }

  const artifacts = isRecord(value.artifacts) ? value.artifacts : null;
  if (artifacts) rows.push(...collectKeywordLikeRows(artifacts, depth + 1));
  return rows;
}

function summarizeCompetitorExpansion(importPayload: Record<string, unknown>) {
  const artifacts = isRecord(importPayload.artifacts) ? importPayload.artifacts : {};
  const debug = isRecord(artifacts.competitor_expansion_debug)
    ? artifacts.competitor_expansion_debug
    : null;
  const rows = collectKeywordLikeRows(artifacts);
  const endpointValues = Array.from(new Set(
    rows
      .map((row) => readString(row.competitor_expansion_endpoint))
      .filter((value): value is string => Boolean(value)),
  )).sort();

  return {
    keyword_rows_with_serp_result_classification_reason: rows.filter((row) =>
      readString(row.serp_result_classification_reason),
    ).length,
    keyword_rows_with_competitor_expansion_endpoint: rows.filter((row) =>
      readString(row.competitor_expansion_endpoint),
    ).length,
    keyword_rows_with_decision_trace: rows.filter((row) => row.decision_trace != null).length,
    competitor_expansion_endpoint_values: endpointValues,
    recall_ledger_present: Object.prototype.hasOwnProperty.call(artifacts, "recall_ledger"),
    recall_ledger_count: Array.isArray(artifacts.recall_ledger)
      ? artifacts.recall_ledger.length
      : null,
    serp_competitor_candidates_present: Object.prototype.hasOwnProperty.call(
      artifacts,
      "serp_competitor_candidates",
    ),
    serp_competitor_candidate_count: Array.isArray(artifacts.serp_competitor_candidates)
      ? artifacts.serp_competitor_candidates.length
      : null,
    competitor_expansion_debug_present: debug != null,
    source_counts: isRecord(debug?.source_counts) ? debug.source_counts : null,
    endpoint_counts: isRecord(debug?.endpoint_counts) ? debug.endpoint_counts : null,
    result_type_counts: isRecord(debug?.result_type_counts) ? debug.result_type_counts : null,
  };
}

async function handlePrepareImport(input: {
  ctx: PluginSetupContext;
  args: unknown;
  runCtx: ToolRunContext;
}) {
  const config = await getConfig(input.ctx);
  const result = await callSemanticCoreMcpTool({
    toolName: "prepare_paperclip_import",
    args: input.args,
    config,
    resolveSecret: (secretRef) => input.ctx.secrets.resolve(secretRef),
    fetchFn: input.ctx.http.fetch as typeof fetch,
  });
  const importPayload = extractResultObject(result);
  const validation = validatePaperclipImportPayload(importPayload);
  const competitorExpansion = summarizeCompetitorExpansion(importPayload);
  const runId = readString(importPayload.run_id)
    ?? (isRecord(input.args) ? readString(input.args.run_id) : null)
    ?? `unknown-${Date.now()}`;

  await storeEntity({
    ctx: input.ctx,
    runCtx: input.runCtx,
    entityType: ENTITY_TYPES.importCandidate,
    externalId: runId,
    title: `Semantic Core import ${runId}`,
    status: "validated",
    data: {
      runId,
      validation,
      competitorExpansion,
      importPayload,
    },
  });
  await maybeRecordImportCost({
    ctx: input.ctx,
    runCtx: input.runCtx,
    runId,
    importPayload,
  });

  return {
    content: JSON.stringify(
      {
        status: "validated",
        run_id: runId,
        schema_version: validation.schemaVersion,
        import_readiness: validation.importReadiness,
        accepted_import_allowed: validation.acceptedImportAllowed,
        unsafe_reasons: validation.unsafeReasons,
        policy_version: validation.policyVersion,
        accepted_keyword_count: validation.acceptedKeywordCount,
        review_candidate_count: validation.reviewCandidateCount,
        parked_outside_layer_count: validation.parkedOutsideLayerCount,
        rejected_noise_count: validation.rejectedNoiseCount,
        not_search_query_count: validation.notSearchQueryCount,
        client_visible_review_candidate_count: validation.clientVisibleReviewCandidateCount,
        client_visible_parked_outside_layer_count: validation.clientVisibleParkedOutsideLayerCount,
        cluster_count: validation.clusterCount,
        serp_segment_count: validation.serpSegmentCount,
        cost_event_count: validation.costEventCount,
        competitor_expansion: competitorExpansion,
      },
      null,
      2,
    ),
    data: {
      ...result.data,
      validation,
      competitorExpansion,
      importPayload,
    },
  };
}

async function handleGetLocalInventory(input: {
  ctx: PluginSetupContext;
  args: unknown;
  runCtx: ToolRunContext;
}): Promise<ToolResult> {
  const args = isRecord(input.args) ? input.args : {};
  const limit = boundedInteger(args.limit, 20, 1, 50);
  const offset = boundedInteger(args.offset, 0, 0, 100_000);
  const minimumGeoSearchVolume = Math.max(0, readFiniteNumber(args.minimumGeoSearchVolume) ?? 0);
  const search = readString(args.search)?.toLocaleLowerCase("uk-UA") ?? "";
  const candidates = await input.ctx.entities.list({
    entityType: ENTITY_TYPES.importCandidate,
    scopeKind: "project",
    scopeId: input.runCtx.projectId,
    limit: 100,
    offset: 0,
  });
  const latest = candidates
    .filter((candidate) => candidate.data.companyId === input.runCtx.companyId)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0];

  if (!latest) {
    return {
      content: JSON.stringify({ status: "unavailable", reason: "local_import_candidate_missing" }),
      data: { status: "unavailable", reason: "local_import_candidate_missing" },
      error: "local_import_candidate_missing",
    };
  }

  const importPayload = isRecord(latest.data.importPayload) ? latest.data.importPayload : {};
  const artifacts = isRecord(importPayload.artifacts) ? importPayload.artifacts : {};
  const acceptedKeywords = (readArray(artifacts.accepted_keywords) ?? [])
    .filter(isRecord)
    .filter((keyword) => {
      const status = readString(keyword.status) ?? readString(keyword.action);
      const text = readString(keyword.display_keyword) ?? readString(keyword.keyword);
      const geoVolume = readFiniteNumber(keyword.geo_search_volume) ?? 0;
      return status === "accepted"
        && !!text
        && geoVolume >= minimumGeoSearchVolume
        && (!search || text.toLocaleLowerCase("uk-UA").includes(search));
    })
    .sort((left, right) =>
      (readFiniteNumber(right.geo_search_volume) ?? 0)
      - (readFiniteNumber(left.geo_search_volume) ?? 0),
    )
    .map((keyword) => ({
      id: readString(keyword.id),
      keyword: readString(keyword.display_keyword) ?? readString(keyword.keyword),
      normalizedKeyword: readString(keyword.normalized_keyword),
      layer: readString(keyword.layer),
      geoSearchVolume: readFiniteNumber(keyword.geo_search_volume),
      globalSearchVolume: readFiniteNumber(keyword.global_search_volume),
      domainTopicMatch: readString(keyword.domain_topic_match),
      productBindingStatus: readString(keyword.product_binding_status),
      evidenceSummary: readString(keyword.evidence_summary),
      updatedAt: readString(keyword.updated_at),
    }));
  const clusters = (readArray(artifacts.clusters) ?? [])
    .filter(isRecord)
    .slice(0, 50)
    .map((cluster) => ({
      id: readString(cluster.id) ?? readString(cluster.cluster_id),
      name: readString(cluster.name) ?? readString(cluster.cluster_name),
      primaryKeyword: readString(cluster.primary_keyword) ?? readString(cluster.keyword),
      geoSearchVolume: readFiniteNumber(cluster.geo_search_volume),
      status: readString(cluster.status),
    }));
  const page = acceptedKeywords.slice(offset, offset + limit);
  const result = {
    status: "ok",
    snapshot: {
      entityId: latest.id,
      externalId: latest.externalId,
      importedAt: latest.updatedAt,
      policyVersion: readString(importPayload.policy_version),
      importReadiness: readString(importPayload.import_readiness),
    },
    totals: {
      acceptedKeywords: acceptedKeywords.length,
      clusters: clusters.length,
    },
    page: { limit, offset, returned: page.length },
    acceptedKeywords: page,
    clusters,
  };
  return { content: JSON.stringify(result, null, 2), data: result };
}

function compactTrendEvidence(value: unknown, limit: number) {
  return (readArray(value) ?? [])
    .filter(isRecord)
    .slice(0, limit)
    .map((entry) => ({
      sourceId: readString(entry.source_id),
      sourceType: readString(entry.source_type),
      title: readString(entry.title),
      url: readString(entry.url),
      publishedAt: readString(entry.published_at),
      retrievedAt: readString(entry.retrieved_at),
      claimSupported: readString(entry.claim_supported),
      cacheStatus: readString(entry.cache_status),
    }));
}

function compactTrendClusters(value: unknown, limits: {
  clusters: number;
  ideas: number;
  evidence: number;
}) {
  return (readArray(value) ?? [])
    .filter(isRecord)
    .slice(0, limits.clusters)
    .map((cluster) => {
      const searchLanguage = isRecord(cluster.search_language) ? cluster.search_language : {};
      const existingContentAction = isRecord(cluster.existing_content_action)
        ? cluster.existing_content_action
        : {};
      return {
        id: readString(cluster.id),
        title: readString(cluster.title),
        summary: readString(cluster.summary),
        rationale: readString(cluster.rationale),
        confidence: readString(cluster.confidence),
        recommendation: readString(cluster.recommendation),
        opportunityType: readString(cluster.opportunity_type),
        scores: isRecord(cluster.scores) ? cluster.scores : null,
        searchLanguage: {
          canonicalTerm: readString(searchLanguage.canonical_term),
          primaryIntent: readString(searchLanguage.primary_intent),
          alternativeTerms: (readArray(searchLanguage.alternative_terms) ?? [])
            .map(readString)
            .filter((entry): entry is string => Boolean(entry))
            .slice(0, 10),
          keywordResearchNeeded: readString(searchLanguage.keyword_research_needed),
        },
        existingContentAction: {
          action: readString(existingContentAction.action),
          relatedUrl: readString(existingContentAction.related_url),
          rationale: readString(existingContentAction.rationale),
        },
        topicIdeas: (readArray(cluster.topic_ideas) ?? [])
          .filter(isRecord)
          .slice(0, limits.ideas)
          .map((idea) => ({
            title: readString(idea.title),
            angle: readString(idea.angle),
            segmentIds: (readArray(idea.segment_ids) ?? [])
              .map(readString)
              .filter((entry): entry is string => Boolean(entry))
              .slice(0, 10),
          })),
        evidence: compactTrendEvidence(cluster.evidence, limits.evidence),
      };
    });
}

async function handleGetTrendTopicReport(input: {
  ctx: PluginSetupContext;
  args: unknown;
  runCtx: ToolRunContext;
}): Promise<ToolResult> {
  const args = isRecord(input.args) ? input.args : {};
  const requestedRunId = readString(args.runId);
  const requestedMode = readString(args.mode) ?? "live";
  const entities = await input.ctx.entities.list({
    entityType: ENTITY_TYPES.trendTopicReport,
    scopeKind: "project",
    scopeId: input.runCtx.projectId,
    limit: 100,
    offset: 0,
  });
  const reports = entities
    .filter((entity) => entity.data.companyId === input.runCtx.companyId)
    .filter((entity) => !requestedRunId || entity.externalId === requestedRunId)
    .filter((entity) => requestedRunId || requestedMode === "any" || entity.data.requestMode === requestedMode)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  const latest = reports[0];
  if (!latest) {
    const reason = requestedRunId ? "trend_report_not_found" : "trend_report_inventory_empty";
    return {
      content: JSON.stringify({ status: "unavailable", reason, runId: requestedRunId }),
      data: { status: "unavailable", reason, runId: requestedRunId },
      error: reason,
    };
  }

  const rawResult = isRecord(latest.data.result) ? latest.data.result : {};
  const clusters = compactTrendClusters(rawResult.clusters, {
    clusters: boundedInteger(args.maxClusters, 8, 1, 8),
    ideas: boundedInteger(args.maxIdeasPerCluster, 3, 1, 3),
    evidence: boundedInteger(args.maxEvidencePerCluster, 3, 0, 5),
  });
  const result = {
    status: readString(rawResult.status) ?? latest.status,
    schemaVersion: readString(rawResult.schema_version),
    runId: readString(rawResult.run_id) ?? latest.externalId,
    projectId: readString(rawResult.project_id),
    requestMode: readString(latest.data.requestMode),
    generatedAt: readString(rawResult.generated_at),
    policyVersion: readString(rawResult.policy_version),
    semanticImportAllowed: false,
    directTopicCreationAllowed: false,
    source: {
      entityId: latest.id,
      storedAt: latest.updatedAt,
    },
    counts: {
      totalClusters: (readArray(rawResult.clusters) ?? []).length,
      returnedClusters: clusters.length,
      watchlist: (readArray(rawResult.watchlist) ?? []).length,
      rejectedSignals: (readArray(rawResult.rejected_signals) ?? []).length,
      warnings: (readArray(rawResult.warnings) ?? []).length,
    },
    researchSummary: isRecord(rawResult.research_summary) ? rawResult.research_summary : null,
    cacheSummary: isRecord(rawResult.cache_summary) ? rawResult.cache_summary : null,
    clusters,
  };
  return { content: JSON.stringify(result, null, 2), data: result };
}

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info(`${PLUGIN_ID} plugin setup complete`);

    ctx.tools.register(
      TOOL_NAMES.listTools,
      {
        displayName: "Semantic Core MCP List Tools",
        description: "List allowlisted tools exposed by the private Semantic Core MCP server.",
        parametersSchema: looseObjectSchema,
      },
      async (): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        const result = await listSemanticCoreMcpTools({
          config,
          resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
          fetchFn: ctx.http.fetch as typeof fetch,
        });
        return resultAsToolResult(result);
      },
    );

    ctx.tools.register(
      TOOL_NAMES.getLocalInventory,
      {
        displayName: "Semantic Core Get Local Inventory",
        description:
          "Read a bounded, project-scoped view of the latest semantic-core import stored in Paperclip.",
        parametersSchema: looseObjectSchema,
      },
      async (params, runCtx): Promise<ToolResult> =>
        await handleGetLocalInventory({ ctx, args: params, runCtx }),
    );

    ctx.tools.register(
      TOOL_NAMES.getTrendTopicReport,
      {
        displayName: "Semantic Core Get Trend Topic Report",
        description:
          "Read a bounded, project-scoped portfolio DTO from a trend report already stored in Paperclip.",
        parametersSchema: looseObjectSchema,
      },
      async (params, runCtx): Promise<ToolResult> =>
        await handleGetTrendTopicReport({ ctx, args: params, runCtx }),
    );

    for (const tool of wrapperToolMap) {
      ctx.tools.register(
        tool.paperclipToolName,
        {
          displayName: tool.displayName,
          description: tool.description,
          parametersSchema: looseObjectSchema,
        },
        async (params, runCtx): Promise<ToolResult> => {
          if (tool.mcpToolName === "prepare_paperclip_import") {
            return await handlePrepareImport({ ctx, args: params, runCtx });
          }
          if (tool.mcpToolName === "generate_trend_topic_report") {
            return await handleTrendTopicReport({ ctx, args: params, runCtx });
          }

          const result = await callMcpTool({
            ctx,
            toolName: tool.mcpToolName,
            args: params,
          });

          if (tool.mcpToolName === "register_project" && isRecord(params)) {
            const payload = isRecord(params.payload) ? params.payload : {};
            const projectId = readString(params.project_id)
              ?? readString(payload.project_id)
              ?? "unknown-project";
            await storeEntity({
              ctx,
              runCtx,
              entityType: ENTITY_TYPES.projectRegistration,
              externalId: projectId,
              title: `Semantic Core project ${projectId}`,
              status: "registered",
              data: { projectId, request: params },
            });
          }

          if (tool.mcpToolName === "submit_review_decisions" && isRecord(params)) {
            const runId = readString(params.run_id) ?? "unknown-run";
            await storeEntity({
              ctx,
              runCtx,
              entityType: ENTITY_TYPES.reviewDecisionBatch,
              externalId: `${runId}:${Date.now()}`,
              title: `Semantic Core review decisions ${runId}`,
              status: "submitted",
              data: { runId, request: params },
            });
          }

          if (tool.mcpToolName === "get_run_costs" && isRecord(params)) {
            const runId = readString(params.run_id) ?? "unknown-run";
            await storeEntity({
              ctx,
              runCtx,
              entityType: ENTITY_TYPES.runCost,
              externalId: `${runId}:${Date.now()}`,
              title: `Semantic Core run costs ${runId}`,
              status: "fetched",
              data: { runId, request: params, result: result.data },
            });
          }

          return result;
        },
      );
    }

    ctx.tools.register(
      TOOL_NAMES.runLayerAndWait,
      {
        displayName: "Semantic Core Run Layer And Wait",
        description: "Run one semantic-core layer as an async MCP job, poll until completed, and return run_id.",
        parametersSchema: looseObjectSchema,
      },
      async (params, runCtx): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        const result = await runLayerAndWait({
          args: params,
          config,
          resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
          fetchFn: ctx.http.fetch as typeof fetch,
        });
        const data: Record<string, unknown> = isRecord(result.data) ? result.data : {};
        const runId = readString(data.run_id) ?? "unknown-run";
        const jobId = readString(data.job_id) ?? "unknown-job";
        const costAccounting = await recordCompletedRunCost({
          ctx,
          runCtx,
          runId,
          costPayload: data.cost,
        });
        await storeEntity({
          ctx,
          runCtx,
          entityType: ENTITY_TYPES.layerRun,
          externalId: jobId,
          title: `Semantic Core layer job ${jobId}`,
          status: "completed",
          data: { jobId, runId, result: data, costAccounting },
        });
        return resultAsToolResult(result);
      },
    );

    ctx.tools.register(
      TOOL_NAMES.smokeTest,
      {
        displayName: "Semantic Core Smoke Test",
        description:
          "Run initialize/tools/schema/register_project/mock run/import validation against Semantic Core MCP.",
        parametersSchema: looseObjectSchema,
      },
      async (params, runCtx): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        const result = await runSemanticCoreSmoke({
          args: params,
          config,
          resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
          fetchFn: ctx.http.fetch as typeof fetch,
        });
        const data: Record<string, unknown> = isRecord(result.data) ? result.data : {};
        const validation: Record<string, unknown> = isRecord(data.validation)
          ? data.validation
          : {};
        const keywordVolumeContract: Record<string, unknown> = isRecord(data.keywordVolumeContract)
          ? data.keywordVolumeContract
          : {};
        const run: Record<string, unknown> =
          isRecord(data.run) && isRecord(data.run.data) ? data.run.data : {};
        await storeEntity({
          ctx,
          runCtx,
          entityType: ENTITY_TYPES.smokeTest,
          externalId: `${runCtx.runId}:${Date.now()}`,
          title: "Semantic Core smoke test",
          status: "passed",
          data: {
            projectId: readString(data.project_id),
            runId: readString(run.run_id),
            validation,
            keywordVolumeContract,
          },
        });
        return resultAsToolResult(result);
      },
    );
  },

  async onHealth() {
    return { status: "ok", message: `${PLUGIN_ID} ready` };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
