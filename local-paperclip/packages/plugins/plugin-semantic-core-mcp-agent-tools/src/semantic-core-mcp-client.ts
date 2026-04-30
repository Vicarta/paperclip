import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  DEFAULT_SEMANTIC_CORE_MCP_URL,
  MCP_TOOL_NAMES,
  PAPERCLIP_IMPORT_SCHEMA_VERSION,
  PLUGIN_ID,
  PLUGIN_VERSION,
  SEMANTIC_LAYERS,
  type SemanticCoreMcpToolName,
  type SemanticLayer,
} from "./constants.js";

export type SemanticCoreMcpPluginConfig = {
  semanticCoreMcpTokenSecretRef?: string;
  semanticCoreMcpUrl?: string;
  allowedProjectIdsCsv?: string;
  allowedClientKeysCsv?: string;
  requestTimeoutMs?: number;
  pollIntervalMs?: number;
  runWaitTimeoutMs?: number;
};

type FetchLike = typeof fetch;

type McpTextContent = {
  type?: string;
  text?: string;
};

type McpCallToolResult = {
  content?: unknown[];
  structuredContent?: unknown;
  isError?: boolean;
};

type McpListToolsResult = {
  tools?: Array<{
    name?: string;
    description?: string;
    inputSchema?: unknown;
  }>;
};

export type NormalizedMcpToolResult = {
  isError: boolean;
  content: string;
  data: {
    structuredContent: unknown;
    content: unknown[];
  };
};

export type PaperclipImportValidation = {
  schemaVersion: string;
  acceptedKeywordCount: number;
  clusterCount: number;
  serpSegmentCount: number;
  costEventCount: number;
};

export type KeywordVolumeContractValidation = {
  keywordCount: number;
  requiredFields: string[];
};

function readNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function parseCsv(value: unknown) {
  const raw = readNonEmptyString(value);
  if (!raw) return new Set<string>();
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

export function normalizeConfig(config: SemanticCoreMcpPluginConfig) {
  return {
    mcpUrl: readNonEmptyString(config.semanticCoreMcpUrl) ?? DEFAULT_SEMANTIC_CORE_MCP_URL,
    allowedProjectIds: parseCsv(config.allowedProjectIdsCsv),
    allowedClientKeys: parseCsv(config.allowedClientKeysCsv),
    requestTimeoutMs: readPositiveNumber(config.requestTimeoutMs) ?? 180_000,
    pollIntervalMs: readPositiveNumber(config.pollIntervalMs) ?? 2_000,
    runWaitTimeoutMs: readPositiveNumber(config.runWaitTimeoutMs) ?? 600_000,
  };
}

function assertAllowedTool(toolName: string): asserts toolName is SemanticCoreMcpToolName {
  if (!(MCP_TOOL_NAMES as readonly string[]).includes(toolName)) {
    throw new Error(`Semantic Core MCP tool is not allowed: ${toolName}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeArguments(args: unknown): Record<string, unknown> {
  if (args == null) return {};
  if (!isRecord(args)) {
    throw new Error("Semantic Core MCP tool arguments must be an object");
  }
  return { ...args };
}

function normalizeLayer(layer: unknown): SemanticLayer {
  const value = readNonEmptyString(layer);
  if (!value || !(SEMANTIC_LAYERS as readonly string[]).includes(value)) {
    throw new Error(
      `Semantic Core layer must be one of: ${SEMANTIC_LAYERS.join(", ")}`,
    );
  }
  return value as SemanticLayer;
}

function readClientKey(args: Record<string, unknown>) {
  const payload = isRecord(args.payload) ? args.payload : null;
  const payloadConfig = payload && isRecord(payload.project_config)
    ? payload.project_config
    : null;
  const payloadInputs = payload && isRecord(payload.inputs)
    ? payload.inputs
    : null;
  const payloadInputsConfig = payloadInputs && isRecord(payloadInputs.project_config)
    ? payloadInputs.project_config
    : null;
  const nested = isRecord(args.project_config)
    ? readNonEmptyString(args.project_config.client_key)
    : null;
  return readNonEmptyString(args.client_key)
    ?? nested
    ?? readNonEmptyString(payload?.client_key)
    ?? readNonEmptyString(payloadConfig?.client_key)
    ?? readNonEmptyString(payloadInputs?.client_key)
    ?? readNonEmptyString(payloadInputsConfig?.client_key);
}

function assertAllowlists(input: {
  args: Record<string, unknown>;
  allowedProjectIds: ReadonlySet<string>;
  allowedClientKeys: ReadonlySet<string>;
}) {
  const payload = isRecord(input.args.payload) ? input.args.payload : null;
  const projectId = readNonEmptyString(input.args.project_id)
    ?? readNonEmptyString(payload?.project_id);
  if (input.allowedProjectIds.size > 0) {
    if (!projectId) {
      throw new Error("Semantic Core MCP project_id is required by plugin allowlist");
    }
    if (!input.allowedProjectIds.has(projectId)) {
      throw new Error(`Semantic Core MCP project_id is not allowed: ${projectId}`);
    }
  }

  const clientKey = readClientKey(input.args);
  if (input.allowedClientKeys.size > 0) {
    if (!clientKey) {
      throw new Error("Semantic Core MCP client_key is required by plugin allowlist");
    }
    if (!input.allowedClientKeys.has(clientKey)) {
      throw new Error(`Semantic Core MCP client_key is not allowed: ${clientKey}`);
    }
  }
}

function toolRequiresPayload(toolName: SemanticCoreMcpToolName) {
  return toolName === "register_project"
    || toolName === "run_layer"
    || toolName === "submit_review_decisions";
}

export function prepareSemanticCoreMcpFallbackArguments(input: {
  toolName: SemanticCoreMcpToolName;
  preparedArgs: Record<string, unknown>;
}) {
  if (!isRecord(input.preparedArgs.payload)) return null;

  if (input.toolName === "run_layer") {
    return {
      ...input.preparedArgs.payload,
      async_job: typeof input.preparedArgs.async_job === "boolean"
        ? input.preparedArgs.async_job
        : true,
    };
  }

  if (input.toolName === "register_project" || input.toolName === "submit_review_decisions") {
    return { ...input.preparedArgs.payload };
  }

  return null;
}

const LEGACY_PROJECT_CONFIG_KEYS = new Set([
  "brand",
  "business_rules",
  "geo_targets",
  "language_code",
  "language_name",
  "language_targets",
  "location_code",
  "location_name",
  "market_matrix",
  "product_scope",
  "route_scope",
  "site_mode",
  "target_domain",
]);

function readFirstString(values: unknown[]): string | null {
  for (const value of values) {
    const direct = readNonEmptyString(value);
    if (direct) return direct;
    if (Array.isArray(value)) {
      const nested: string | null = readFirstString(value);
      if (nested) return nested;
    }
  }
  return null;
}

function readFirstNumber(values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) return parsed;
    }
    if (Array.isArray(value)) {
      const nested: number | null = readFirstNumber(value);
      if (nested != null) return nested;
    }
  }
  return null;
}

function countryCodeFromLocationName(locationName: string | null) {
  if (!locationName) return undefined;
  const normalized = locationName.toLowerCase();
  if (normalized === "united states" || normalized === "usa" || normalized === "us") return "US";
  if (normalized === "ukraine") return "UA";
  if (normalized === "united kingdom" || normalized === "uk") return "GB";
  if (normalized === "germany") return "DE";
  if (normalized === "france") return "FR";
  if (normalized === "mexico") return "MX";
  if (normalized === "china") return "CN";
  return undefined;
}

function normalizeLocaleMatrix(config: Record<string, unknown>) {
  if (Array.isArray(config.locale_matrix) && config.locale_matrix.length > 0) {
    return config.locale_matrix;
  }

  const marketMatrix = Array.isArray(config.market_matrix) ? config.market_matrix : [];
  const localeRows = marketMatrix
    .filter(isRecord)
    .map((row) => {
      const languageCode = readFirstString([row.language_code, row.language, config.language_code])
        ?? "en";
      const locationName = readFirstString([row.location_name, row.geo, row.country, config.location_name])
        ?? "United States";
      const countryCode = readNonEmptyString(row.country_code)
        ?? countryCodeFromLocationName(locationName);
      return {
        language_code: languageCode,
        ...(readNonEmptyString(row.language_name) ? { language_name: readNonEmptyString(row.language_name) } : {}),
        location_code: readFirstNumber([row.location_code, config.location_code]) ?? 2840,
        location_name: locationName,
        ...(countryCode ? { country_code: countryCode } : {}),
        device_context: readNonEmptyString(row.device_context) ?? "desktop",
        device_priority: readNonEmptyString(row.device_priority) ?? "desktop",
      };
    });
  if (localeRows.length > 0) return localeRows;

  const languageCode = readFirstString([config.language_code, config.language_targets]) ?? "en";
  const locationName = readFirstString([config.location_name, config.geo_targets]) ?? "United States";
  const countryCode = countryCodeFromLocationName(locationName);
  return [
    {
      language_code: languageCode,
      location_code: readFirstNumber([config.location_code]) ?? 2840,
      location_name: locationName,
      ...(countryCode ? { country_code: countryCode } : {}),
      device_context: "desktop",
      device_priority: "desktop",
    },
  ];
}

function normalizeSections(config: Record<string, unknown>) {
  if (Array.isArray(config.sections) && config.sections.length > 0) return config.sections;
  const siteMode = readNonEmptyString(config.site_mode);
  return [
    {
      section_id: siteMode === "blog" ? "blog" : "commercial",
      allowed_owner_types: siteMode === "blog" ? ["blog"] : ["commercial", "blog"],
      allowed_page_types: siteMode === "blog"
        ? ["blog_article"]
        : ["landing_page", "product_page", "guide"],
      forbidden_topics: [],
    },
  ];
}

function normalizeOwnerRules(config: Record<string, unknown>) {
  if (isRecord(config.owner_rules)) return config.owner_rules;
  const businessRules = isRecord(config.business_rules) ? config.business_rules : {};
  return {
    informational: readNonEmptyString(businessRules.informational) ?? "blog",
    commercial: readNonEmptyString(businessRules.commercial) ?? "commercial",
    transactional: readNonEmptyString(businessRules.transactional) ?? "commercial",
    navigational: readNonEmptyString(businessRules.navigational) ?? "brand",
  };
}

function fallbackSiteId(projectId: unknown, domain: string) {
  const explicit = readNonEmptyString(projectId);
  if (explicit) return explicit;
  const normalized = domain
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return normalized || "paperclip-semantic-core";
}

function normalizeProjectConfig(value: unknown, projectId: unknown) {
  if (!isRecord(value)) return value;

  const base = Object.fromEntries(
    Object.entries(value).filter(([key]) => !LEGACY_PROJECT_CONFIG_KEYS.has(key)),
  );
  const domain = readNonEmptyString(value.domain)
    ?? readNonEmptyString(value.target_domain)
    ?? readNonEmptyString(value.site_domain)
    ?? "example.com";

  return {
    ...base,
    site_id: readNonEmptyString(value.site_id) ?? fallbackSiteId(projectId, domain),
    domain,
    locale_matrix: normalizeLocaleMatrix(value),
    sections: normalizeSections(value),
    owner_rules: normalizeOwnerRules(value),
    thresholds: isRecord(value.thresholds)
      ? value.thresholds
      : {
          intent_probability_min: 0.5,
          serp_official_vendor_dominance: 0.8,
        },
    intent_rules: isRecord(value.intent_rules)
      ? value.intent_rules
      : {
          ambiguous_secondary_delta: 0.15,
        },
    title_meta_policy: isRecord(value.title_meta_policy)
      ? value.title_meta_policy
      : {
          title_length_range: [45, 70],
          description_length_range: [120, 160],
          examples_are_editorial_only: true,
        },
  };
}

function normalizeRegisterProjectPayload(payload: Record<string, unknown>) {
  const existingInputs = isRecord(payload.inputs) ? payload.inputs : null;
  if (existingInputs) {
    return {
      ...payload,
      inputs: {
        ...existingInputs,
        project_config: normalizeProjectConfig(existingInputs.project_config, payload.project_id),
        seed_catalog: normalizeSeedCatalog(existingInputs.seed_catalog),
      },
    };
  }

  const hasFlatInputs = Object.prototype.hasOwnProperty.call(payload, "project_config")
    || Object.prototype.hasOwnProperty.call(payload, "seed_catalog")
    || Object.prototype.hasOwnProperty.call(payload, "existing_pages");
  if (!hasFlatInputs) return payload;

  return {
    project_id: payload.project_id,
    inputs: {
      project_config: normalizeProjectConfig(payload.project_config, payload.project_id),
      seed_catalog: normalizeSeedCatalog(payload.seed_catalog),
      existing_pages: payload.existing_pages,
      audience_summary: payload.audience_summary ?? null,
      gsc_refinement_input: payload.gsc_refinement_input ?? null,
    },
  };
}

function normalizeSeedCatalog(value: unknown) {
  if (isRecord(value) && Array.isArray(value.products)) return value;

  const seedItems = Array.isArray(value)
    ? value
    : isRecord(value)
      ? Array.isArray(value.seeds)
        ? value.seeds
        : Array.isArray(value.keywords)
          ? value.keywords
          : Array.isArray(value.items)
            ? value.items
            : null
      : null;

  if (!seedItems) return value;

  return {
    products: seedItems
      .map((item, index) => normalizeSeedProduct(item, index))
      .filter((item): item is NonNullable<ReturnType<typeof normalizeSeedProduct>> => Boolean(item)),
  };
}

function normalizeSeedProduct(value: unknown, index: number) {
  const rawName = readSeedText(value);
  if (!rawName) return null;
  const variants = readSeedVariants(value, rawName);
  return {
    product_id: seedProductId(rawName, index),
    name: rawName,
    variants,
  };
}

function readSeedText(value: unknown) {
  if (typeof value === "string") return readNonEmptyString(value);
  if (!isRecord(value)) return null;
  return readNonEmptyString(value.name)
    ?? readNonEmptyString(value.seed)
    ?? readNonEmptyString(value.keyword)
    ?? readNonEmptyString(value.query)
    ?? readNonEmptyString(value.text);
}

function readSeedVariants(value: unknown, fallback: string) {
  if (!isRecord(value) || !Array.isArray(value.variants)) return [fallback];
  const variants = value.variants
    .map((entry) => readNonEmptyString(entry))
    .filter((entry): entry is string => Boolean(entry));
  return variants.length > 0 ? variants : [fallback];
}

function seedProductId(value: string, index: number) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || `seed-${index + 1}`;
}

export function prepareSemanticCoreMcpArguments(input: {
  toolName: string;
  args?: unknown;
  allowedProjectIds?: ReadonlySet<string>;
  allowedClientKeys?: ReadonlySet<string>;
}) {
  assertAllowedTool(input.toolName);
  const args = normalizeArguments(input.args);
  const payload = isRecord(args.payload) ? { ...args.payload } : { ...args };
  if (input.toolName === "run_layer") {
    const layer = normalizeLayer(payload.layer);
    const asyncJob = typeof args.async_job === "boolean" ? args.async_job : true;
    return {
      payload: {
        ...payload,
        layer,
      },
      async_job: asyncJob,
    };
  }

  if (input.toolName === "register_project") {
    const registerPayload = normalizeRegisterProjectPayload(payload);
    const mcpArgs = isRecord(args.payload)
      ? { ...args, payload: registerPayload }
      : { payload: registerPayload };
    assertAllowlists({
      args: mcpArgs,
      allowedProjectIds: input.allowedProjectIds ?? new Set<string>(),
      allowedClientKeys: input.allowedClientKeys ?? new Set<string>(),
    });
    return mcpArgs;
  }

  const mcpArgs = toolRequiresPayload(input.toolName) && !isRecord(args.payload)
    ? { payload }
    : args;

  assertAllowlists({
    args: mcpArgs,
    allowedProjectIds: input.allowedProjectIds ?? new Set<string>(),
    allowedClientKeys: input.allowedClientKeys ?? new Set<string>(),
  });
  return mcpArgs;
}

function flattenToolContent(content: unknown[] | undefined) {
  if (!Array.isArray(content) || content.length === 0) return null;
  const textParts = content
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const candidate = entry as McpTextContent;
      return candidate.type === "text" && typeof candidate.text === "string"
        ? candidate.text.trim()
        : null;
    })
    .filter((value): value is string => Boolean(value));

  if (textParts.length > 0) return textParts.join("\n\n");
  return JSON.stringify(content);
}

export function normalizeSemanticCoreToolResult(result: McpCallToolResult): NormalizedMcpToolResult {
  const content = flattenToolContent(result.content) ?? (
    result.structuredContent == null
      ? null
      : JSON.stringify(result.structuredContent, null, 2)
  );

  return {
    isError: result.isError === true,
    content: content ?? "",
    data: {
      structuredContent: result.structuredContent ?? null,
      content: result.content ?? [],
    },
  };
}

function parseJsonText(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  if (!candidate.startsWith("{") && !candidate.startsWith("[")) return null;
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    return null;
  }
}

export function extractResultObject(result: NormalizedMcpToolResult): Record<string, unknown> {
  if (isRecord(result.data.structuredContent)) {
    return findPaperclipImportPayload(result.data.structuredContent) ?? result.data.structuredContent;
  }
  const parsed = parseJsonText(result.content);
  const importPayload = findPaperclipImportPayload(parsed);
  if (importPayload) return importPayload;
  if (isRecord(parsed)) return parsed;
  return {};
}

function readNestedRecord(value: Record<string, unknown>, key: string) {
  const candidate = value[key];
  return isRecord(candidate) ? candidate : null;
}

function readArray(value: unknown) {
  return Array.isArray(value) ? value : null;
}

const KEYWORD_VOLUME_CONTRACT_FIELDS = [
  "geo_search_volume",
  "global_search_volume",
  "global_search_volume_status",
  "global_search_volume_source",
  "global_search_volume_country_distribution",
] as const;

const IMPORT_PAYLOAD_WRAPPER_KEYS = [
  "payload",
  "result",
  "data",
  "structuredContent",
  "import_payload",
  "importPayload",
  "paperclip_import",
  "paperclipImport",
  "paperclip_import_json",
  "paperclipImportJson",
  "import_payload_json",
  "importPayloadJson",
  "json",
] as const;

function normalizeImportPayloadShape(payload: Record<string, unknown>) {
  if (
    payload.schema_version === undefined
    && typeof payload.schemaVersion === "string"
  ) {
    return {
      ...payload,
      schema_version: payload.schemaVersion,
    };
  }
  return payload;
}

function findPaperclipImportPayload(value: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 4) return null;

  if (typeof value === "string") {
    return findPaperclipImportPayload(parseJsonText(value), depth + 1);
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = findPaperclipImportPayload(entry, depth + 1);
      if (nested) return nested;
    }
    return null;
  }

  if (!isRecord(value)) return null;

  const normalized = normalizeImportPayloadShape(value);
  if (
    normalized.schema_version === PAPERCLIP_IMPORT_SCHEMA_VERSION
    || isRecord(normalized.artifacts)
  ) {
    return normalized;
  }

  for (const key of IMPORT_PAYLOAD_WRAPPER_KEYS) {
    const nested = findPaperclipImportPayload(normalized[key], depth + 1);
    if (nested) return nested;
  }

  return null;
}

export function validatePaperclipImportPayload(payload: unknown): PaperclipImportValidation {
  const importPayload = findPaperclipImportPayload(payload);
  if (!importPayload) {
    throw new Error("Semantic Core import payload must be an object");
  }
  if (importPayload.schema_version !== PAPERCLIP_IMPORT_SCHEMA_VERSION) {
    throw new Error(
      `Semantic Core import payload schema_version must be ${PAPERCLIP_IMPORT_SCHEMA_VERSION}`,
    );
  }

  const artifacts = readNestedRecord(importPayload, "artifacts");
  if (!artifacts) {
    throw new Error("Semantic Core import payload artifacts object is required");
  }

  const acceptedKeywords = readArray(artifacts.accepted_keywords);
  const clusters = readArray(artifacts.clusters);
  const serpSegments = readArray(artifacts.serp_segments);
  const cost = readNestedRecord(importPayload, "cost");
  const costEvents = cost ? readArray(cost.events) : null;

  if (!acceptedKeywords) {
    throw new Error("Semantic Core import payload artifacts.accepted_keywords must be an array");
  }
  if (!clusters) {
    throw new Error("Semantic Core import payload artifacts.clusters must be an array");
  }
  if (!serpSegments) {
    throw new Error("Semantic Core import payload artifacts.serp_segments must be an array");
  }
  if (!costEvents) {
    throw new Error("Semantic Core import payload cost.events must be an array");
  }

  return {
    schemaVersion: PAPERCLIP_IMPORT_SCHEMA_VERSION,
    acceptedKeywordCount: acceptedKeywords.length,
    clusterCount: clusters.length,
    serpSegmentCount: serpSegments.length,
    costEventCount: costEvents.length,
  };
}

const KEYWORD_ARRAY_KEYS = [
  "keywords",
  "items",
  "accepted_keywords",
  "review_keywords",
  "parked_keywords",
  "rejected_keywords",
  "accepted",
  "review",
  "parked",
  "rejected",
] as const;

function collectKeywordItems(value: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 5) return [];
  if (typeof value === "string") {
    return collectKeywordItems(parseJsonText(value), depth + 1);
  }
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }
  if (!isRecord(value)) return [];

  const collected: Record<string, unknown>[] = [];
  for (const key of KEYWORD_ARRAY_KEYS) {
    const candidate = value[key];
    if (Array.isArray(candidate)) {
      collected.push(...candidate.filter(isRecord));
    }
  }
  const artifacts = isRecord(value.artifacts) ? value.artifacts : null;
  if (artifacts) {
    collected.push(...collectKeywordItems(artifacts, depth + 1));
  }
  for (const key of IMPORT_PAYLOAD_WRAPPER_KEYS) {
    collected.push(...collectKeywordItems(value[key], depth + 1));
  }
  return collected;
}

export function extractKeywordItems(result: NormalizedMcpToolResult | unknown) {
  if (
    isRecord(result)
    && isRecord(result.data)
    && Object.prototype.hasOwnProperty.call(result.data, "structuredContent")
  ) {
    const fromStructured = collectKeywordItems(result.data.structuredContent);
    if (fromStructured.length > 0) return fromStructured;
    const fromContent = collectKeywordItems(result.content);
    if (fromContent.length > 0) return fromContent;
    return collectKeywordItems(result.data.content);
  }

  return collectKeywordItems(result);
}

export function validateKeywordVolumeContract(keywords: unknown): KeywordVolumeContractValidation {
  const items = Array.isArray(keywords) ? keywords.filter(isRecord) : extractKeywordItems(keywords);
  if (items.length === 0) {
    throw new Error("Semantic Core get_keywords returned no keyword items");
  }

  for (const [index, keyword] of items.entries()) {
    for (const field of KEYWORD_VOLUME_CONTRACT_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(keyword, field)) {
        throw new Error(`Semantic Core keyword ${index} is missing ${field}`);
      }
    }
    const distribution = keyword.global_search_volume_country_distribution;
    if (distribution != null && !Array.isArray(distribution)) {
      throw new Error(
        `Semantic Core keyword ${index} global_search_volume_country_distribution must be an array when present`,
      );
    }
  }

  return {
    keywordCount: items.length,
    requiredFields: [...KEYWORD_VOLUME_CONTRACT_FIELDS],
  };
}

async function resolveToken(input: {
  config: SemanticCoreMcpPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
}) {
  const secretRef = readNonEmptyString(input.config.semanticCoreMcpTokenSecretRef);
  if (!secretRef) {
    throw new Error("Semantic Core MCP token secret is not configured");
  }

  const token = await input.resolveSecret(secretRef);
  const normalized = readNonEmptyString(token);
  if (!normalized) {
    throw new Error("Semantic Core MCP token secret resolved to an empty value");
  }
  return normalized;
}

async function withClient<T>(input: {
  config: SemanticCoreMcpPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
  fetchFn?: FetchLike;
  run: (
    client: Client,
    normalized: ReturnType<typeof normalizeConfig>,
  ) => Promise<T>;
}) {
  const normalized = normalizeConfig(input.config);
  const token = await resolveToken(input);
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), normalized.requestTimeoutMs);

  const transport = new StreamableHTTPClientTransport(new URL(normalized.mcpUrl), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      signal: abortController.signal,
    },
    fetch: input.fetchFn,
  });
  const client = new Client(
    { name: PLUGIN_ID, version: PLUGIN_VERSION },
    { capabilities: {} },
  );

  try {
    await client.connect(transport);
    return await input.run(client, normalized);
  } finally {
    clearTimeout(timeout);
    await client.close().catch(() => undefined);
  }
}

export async function listSemanticCoreMcpTools(input: {
  config: SemanticCoreMcpPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
  fetchFn?: FetchLike;
}) {
  return await withClient({
    ...input,
    async run(client) {
      const result = await client.listTools() as McpListToolsResult;
      const tools = Array.isArray(result.tools) ? result.tools : [];
      const allowed = new Set<string>(MCP_TOOL_NAMES);
      return {
        content: JSON.stringify(
          tools
            .filter((tool) => typeof tool.name === "string" && allowed.has(tool.name))
            .map((tool) => ({
              name: tool.name,
              description: tool.description ?? "",
              inputSchema: tool.inputSchema ?? null,
            })),
          null,
          2,
        ),
        data: { tools },
      };
    },
  });
}

export async function callSemanticCoreMcpTool(input: {
  toolName: string;
  args?: unknown;
  config: SemanticCoreMcpPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
  fetchFn?: FetchLike;
}) {
  assertAllowedTool(input.toolName);
  const toolName = input.toolName;
  return await withClient({
    config: input.config,
    resolveSecret: input.resolveSecret,
    fetchFn: input.fetchFn,
    async run(client, normalized) {
      const args = prepareSemanticCoreMcpArguments({
        toolName: input.toolName,
        args: input.args,
        allowedProjectIds: normalized.allowedProjectIds,
        allowedClientKeys: normalized.allowedClientKeys,
      }) as Record<string, unknown>;

      let result: unknown;
      try {
        result = await client.callTool({
          name: toolName,
          arguments: args,
        });
      } catch (err) {
        const fallbackArgs = prepareSemanticCoreMcpFallbackArguments({
          toolName,
          preparedArgs: args,
        });
        if (!fallbackArgs) throw err;
        result = await client.callTool({
          name: toolName,
          arguments: fallbackArgs,
        });
      }
      return normalizeSemanticCoreToolResult(result as McpCallToolResult);
    },
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readResultString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = readNonEmptyString(record[key]);
    if (value) return value;
  }
  return null;
}

export async function runLayerAndWait(input: {
  args?: unknown;
  config: SemanticCoreMcpPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
  fetchFn?: FetchLike;
}) {
  const normalized = normalizeConfig(input.config);
  const started = await callSemanticCoreMcpTool({
    toolName: "run_layer",
    args: {
      ...normalizeArguments(input.args),
      async_job: true,
    },
    config: input.config,
    resolveSecret: input.resolveSecret,
    fetchFn: input.fetchFn,
  });
  const startedObject = extractResultObject(started);
  const jobId = readResultString(startedObject, ["job_id", "jobId"]);
  if (!jobId) {
    throw new Error("Semantic Core MCP run_layer did not return job_id");
  }

  const deadline = Date.now() + normalized.runWaitTimeoutMs;
  let lastStatus: Record<string, unknown> = {};
  while (Date.now() <= deadline) {
    const statusResult = await callSemanticCoreMcpTool({
      toolName: "get_job_status",
      args: { job_id: jobId },
      config: input.config,
      resolveSecret: input.resolveSecret,
      fetchFn: input.fetchFn,
    });
    lastStatus = extractResultObject(statusResult);
    const status = readResultString(lastStatus, ["status"]);
    if (status === "completed") {
      return {
        content: JSON.stringify(
          {
            job_id: jobId,
            status,
            run_id: readResultString(lastStatus, ["run_id", "runId"]),
            started: startedObject,
            final_status: lastStatus,
          },
          null,
          2,
        ),
        data: {
          job_id: jobId,
          status,
          run_id: readResultString(lastStatus, ["run_id", "runId"]),
          started: startedObject,
          final_status: lastStatus,
        },
      };
    }
    if (status === "failed" || status === "cancelled") {
      throw new Error(`Semantic Core MCP job ${jobId} ended with status ${status}`);
    }
    await sleep(normalized.pollIntervalMs);
  }

  throw new Error(
    `Semantic Core MCP job ${jobId} did not complete before timeout; last status: ${
      JSON.stringify(lastStatus)
    }`,
  );
}

export async function runSemanticCoreSmoke(input: {
  args?: unknown;
  config: SemanticCoreMcpPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
  fetchFn?: FetchLike;
}) {
  const args = normalizeArguments(input.args);
  const projectId = readNonEmptyString(args.project_id)
    ?? `paperclip-semantic-smoke-${Date.now()}`;
  const projectConfig = isRecord(args.project_config)
    ? args.project_config
    : {
        site_id: projectId,
        domain: "example.com",
        locale_matrix: [
          {
            language_code: "uk",
            location_code: 2804,
            location_name: "Ukraine",
            country_code: "UA",
            device_context: "desktop",
            device_priority: "desktop",
          },
        ],
        sections: [
          {
            section_id: "blog",
            allowed_owner_types: ["blog"],
            allowed_page_types: ["blog_article"],
            forbidden_topics: ["checkout"],
          },
        ],
        owner_rules: {
          informational: "blog",
          commercial: "blog",
          transactional: "blog",
          navigational: "brand",
        },
        thresholds: {
          intent_probability_min: 0.5,
          serp_official_vendor_dominance: 0.8,
        },
        intent_rules: {
          ambiguous_secondary_delta: 0.15,
        },
        title_meta_policy: {
          title_length_range: [45, 70],
          description_length_range: [120, 160],
          examples_are_editorial_only: true,
        },
        gsc_policy: {
          enabled: false,
          pagination_start_row: 0,
        },
        provider_credentials: {},
      };
  const seedCatalog = isRecord(args.seed_catalog)
    ? args.seed_catalog
    : {
        products: [
          {
            product_id: "natal_chart",
            name: "Натальна карта",
            variants: ["персональна натальна карта"],
          },
        ],
        features: ["розшифровка натальної карти"],
        use_cases: ["зрозуміти себе через натальну карту"],
        categories: ["астрологія"],
        support_themes: ["час народження"],
        faq_themes: ["що таке натальна карта"],
        competitor_domains: [],
        competitor_pages: [],
      };
  const existingPages = Array.isArray(args.existing_pages) ? args.existing_pages : [];

  const schemaResult = await callSemanticCoreMcpTool({
    toolName: "get_paperclip_import_schema",
    args: {},
    config: input.config,
    resolveSecret: input.resolveSecret,
    fetchFn: input.fetchFn,
  });
  const schemaObject = extractResultObject(schemaResult);
  const schemaVersion = readResultString(schemaObject, ["schema_version", "schemaVersion"]);
  if (schemaVersion && schemaVersion !== PAPERCLIP_IMPORT_SCHEMA_VERSION) {
    throw new Error(
      `Semantic Core MCP schema version is ${schemaVersion}, expected ${PAPERCLIP_IMPORT_SCHEMA_VERSION}`,
    );
  }

  await callSemanticCoreMcpTool({
    toolName: "register_project",
    args: {
      project_id: projectId,
      inputs: {
        project_config: projectConfig,
        seed_catalog: seedCatalog,
        existing_pages: existingPages,
        audience_summary: args.audience_summary ?? null,
        gsc_refinement_input: args.gsc_refinement_input ?? null,
      },
    },
    config: input.config,
    resolveSecret: input.resolveSecret,
    fetchFn: input.fetchFn,
  });

  await callSemanticCoreMcpTool({
    toolName: "validate_project",
    args: { project_id: projectId },
    config: input.config,
    resolveSecret: input.resolveSecret,
    fetchFn: input.fetchFn,
  });

  const run = await runLayerAndWait({
    args: {
      project_id: projectId,
      layer: args.layer ?? "core_product_intent",
      mode: args.mode ?? "mock",
    },
    config: input.config,
    resolveSecret: input.resolveSecret,
    fetchFn: input.fetchFn,
  });
  const runData: Record<string, unknown> = isRecord(run.data) ? run.data : {};
  const runId = readNonEmptyString(runData.run_id);
  if (!runId) {
    throw new Error("Semantic Core smoke did not receive run_id from completed job");
  }

  const keywordsResult = await callSemanticCoreMcpTool({
    toolName: "get_keywords",
    args: { project_id: projectId, run_id: runId },
    config: input.config,
    resolveSecret: input.resolveSecret,
    fetchFn: input.fetchFn,
  });
  const keywordVolumeContract = validateKeywordVolumeContract(keywordsResult);

  const importResult = await callSemanticCoreMcpTool({
    toolName: "prepare_paperclip_import",
    args: { run_id: runId },
    config: input.config,
    resolveSecret: input.resolveSecret,
    fetchFn: input.fetchFn,
  });
  const importPayload = extractResultObject(importResult);
  const validation = validatePaperclipImportPayload(importPayload);

  return {
    content: JSON.stringify(
      {
        status: "ok",
        project_id: projectId,
        job_id: readNonEmptyString(runData.job_id),
        run_id: runId,
        schema_version: validation.schemaVersion,
        accepted_keyword_count: validation.acceptedKeywordCount,
        get_keywords_count: keywordVolumeContract.keywordCount,
        keyword_volume_contract: "ok",
        cluster_count: validation.clusterCount,
        serp_segment_count: validation.serpSegmentCount,
        cost_event_count: validation.costEventCount,
      },
      null,
      2,
    ),
    data: {
      project_id: projectId,
      run,
      keywords_result: keywordsResult,
      keywordVolumeContract,
      import_payload: importPayload,
      validation,
    },
  };
}
