export type SemanticCoreExecutionPolicyConfig = {
  providerExecutionPolicy?: "disabled" | "read_only" | "approved_candidate_batch";
  trendLiveExecutionEnabled?: boolean;
};

type ExecutionPolicyInput = {
  toolName: string;
  args?: unknown;
  config: SemanticCoreExecutionPolicyConfig;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function readInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function mergedPayload(args: unknown) {
  const input = isRecord(args) ? args : {};
  const nested = isRecord(input.payload) ? input.payload : {};
  const topLevel = Object.fromEntries(Object.entries(input).filter(([key]) => key !== "payload"));
  return { ...nested, ...topLevel };
}

function withPayload(args: unknown, payload: Record<string, unknown>) {
  return isRecord(args) && isRecord(args.payload)
    ? { ...args, payload }
    : payload;
}

function enforceRunLayer(input: ExecutionPolicyInput) {
  const payload = mergedPayload(input.args);
  const mode = readString(payload.mode) ?? "mock";
  if (mode === "mock") {
    return withPayload(input.args, { ...payload, mode: "mock" });
  }
  if (mode !== "provider" && mode !== "live") {
    throw new Error(`SEMANTIC_CORE_MODE_UNSUPPORTED: ${mode}`);
  }

  const policy = input.config.providerExecutionPolicy ?? "disabled";
  if (policy === "disabled") {
    throw new Error(
      "SEMANTIC_CORE_PROVIDER_EXECUTION_DISABLED: provider-backed runs require an operator-approved Paperclip execution policy.",
    );
  }

  const providerCacheMode = readString(payload.provider_cache_mode) ?? "read_only";
  if (policy === "read_only" && providerCacheMode !== "read_only") {
    throw new Error(
      "SEMANTIC_CORE_PROVIDER_CACHE_WRITE_DISABLED: read_only is the only no-spend cache mode allowed by the current Paperclip policy.",
    );
  }
  if (
    policy === "approved_candidate_batch"
    && !["read_only", "read_write"].includes(providerCacheMode)
  ) {
    throw new Error(
      "SEMANTIC_CORE_PROVIDER_CACHE_MODE_FORBIDDEN: refresh and bypass require a separate operator runbook.",
    );
  }

  const candidateKeywords = Array.isArray(payload.candidate_keywords)
    ? payload.candidate_keywords.filter((entry) => typeof entry === "string" && entry.trim().length > 0)
    : [];
  if (policy === "approved_candidate_batch" && (candidateKeywords.length < 1 || candidateKeywords.length > 10)) {
    throw new Error(
      "SEMANTIC_CORE_CANDIDATE_BATCH_REQUIRED: paid agent runs are limited to 1-10 exact candidate_keywords.",
    );
  }
  if (readString(payload.provider_queue) && readString(payload.provider_queue) !== "standard") {
    throw new Error("SEMANTIC_CORE_PRIORITY_QUEUE_DISABLED: agent runs must use provider_queue=standard.");
  }
  if (readBoolean(payload.include_search_intent) === true) {
    throw new Error(
      "SEMANTIC_CORE_SEARCH_INTENT_DISABLED: Labs Search Intent is a separate paid enrichment and is not allowed in autonomous runs.",
    );
  }
  if (readBoolean(payload.include_content_parsing) === true) {
    throw new Error(
      "SEMANTIC_CORE_CONTENT_PARSING_DISABLED: content parsing requires a separate bounded evidence request.",
    );
  }

  return withPayload(input.args, {
    ...payload,
    mode: mode === "live" ? "provider" : mode,
    provider_cache_mode: providerCacheMode,
    provider_queue: "standard",
    include_search_intent: false,
    include_content_parsing: false,
  });
}

function enforceTrend(input: ExecutionPolicyInput) {
  const payload = mergedPayload(input.args);
  const mode = readString(payload.mode) ?? "fixture";
  if (mode === "fixture") {
    return withPayload(input.args, { ...payload, mode: "fixture" });
  }
  if (mode !== "live") {
    throw new Error(`SEMANTIC_CORE_TREND_MODE_UNSUPPORTED: ${mode}`);
  }
  if (input.config.trendLiveExecutionEnabled !== true) {
    throw new Error(
      "SEMANTIC_CORE_TREND_LIVE_DISABLED: live trend discovery is locked until an operator explicitly enables it.",
    );
  }

  const constraints = isRecord(payload.constraints) ? payload.constraints : {};
  const maxResearchQueries = readInteger(constraints.max_research_queries) ?? 6;
  const maxSources = readInteger(constraints.max_sources) ?? 20;
  if (maxResearchQueries < 1 || maxResearchQueries > 12) {
    throw new Error("SEMANTIC_CORE_TREND_QUERY_BUDGET_EXCEEDED: max_research_queries must be 1-12.");
  }
  if (maxSources < 1 || maxSources > 30) {
    throw new Error("SEMANTIC_CORE_TREND_SOURCE_BUDGET_EXCEEDED: max_sources must be 1-30.");
  }

  const cachePolicy = isRecord(payload.cache_policy) ? payload.cache_policy : {};
  const cacheStrategy = readString(cachePolicy.strategy) ?? "use_cache";
  if (cacheStrategy !== "use_cache") {
    throw new Error(
      "SEMANTIC_CORE_TREND_CACHE_REFRESH_DISABLED: autonomous trend runs must use the private-project cache.",
    );
  }

  return withPayload(input.args, {
    ...payload,
    mode: "live",
    constraints: {
      ...constraints,
      max_research_queries: maxResearchQueries,
      max_sources: maxSources,
    },
    cache_policy: {
      ...cachePolicy,
      scope: "private_project",
      strategy: "use_cache",
    },
  });
}

export function enforceSemanticCoreExecutionPolicy(input: ExecutionPolicyInput) {
  if (input.toolName === "run_layer") return enforceRunLayer(input);
  if (input.toolName === "generate_trend_topic_report") return enforceTrend(input);
  return input.args;
}
