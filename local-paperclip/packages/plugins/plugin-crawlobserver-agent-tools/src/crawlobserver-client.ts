import {
  DEFAULT_CRAWLOBSERVER_BASE_URL,
  DEFAULT_MAX_PAGE_LIMIT,
  DEFAULT_REQUEST_TIMEOUT_MS,
  READ_ENDPOINT_ALLOWLIST,
} from "./constants.js";

export type CrawlObserverPluginConfig = {
  crawlObserverApiKeySecretRef?: string;
  crawlObserverBaseUrl?: string;
  allowedProjectId?: string;
  allowMutatingTools?: boolean;
  requestTimeoutMs?: number;
  maxPageLimit?: number;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type QueryValue = string | number | boolean | null | undefined;
type QueryParams = Record<string, QueryValue>;

export type CrawlObserverRequest = {
  method?: "GET" | "POST" | "DELETE";
  path: string;
  query?: QueryParams;
  body?: unknown;
};

export type CrawlObserverToolResponse = {
  content: string;
  data: unknown;
};

const START_CRAWL_FIELDS = new Set([
  "seeds",
  "max_pages",
  "max_depth",
  "workers",
  "delay",
  "store_html",
  "crawl_scope",
  "project_id",
  "check_external_links",
  "external_link_workers",
  "retry_status_code",
  "user_agent",
  "crawl_sitemap_only",
  "fetch_sitemaps",
  "check_page_resources",
  "resource_workers",
  "tls_profile",
  "js_render_mode",
  "js_render_max_pages",
  "js_render_timeout",
  "follow_js_links",
  "source_ip",
  "force_ipv4",
  "extractor_set_id",
  "ignore_robots",
  "exclude_patterns",
  "measure_cwv",
]);

const PAGE_FILTER_FIELDS = new Set([
  "limit",
  "offset",
  "sort",
  "order",
  "url",
  "status_code",
  "title",
  "content_type",
  "depth",
  "word_count",
  "is_indexable",
  "canonical",
  "meta_description",
  "h1",
  "h2",
  "pagerank",
]);

const LINK_FILTER_FIELDS = new Set([
  "limit",
  "offset",
  "sort",
  "order",
  "source_url",
  "target_url",
  "anchor_text",
  "rel",
  "tag",
]);

const RESOURCE_FILTER_FIELDS = new Set([
  "limit",
  "offset",
  "sort",
  "order",
  "resource_type",
  "status_code",
  "url",
  "is_internal",
  "error",
]);

const SESSION_FILTER_FIELDS = new Set([
  "limit",
  "offset",
  "project_id",
  "search",
]);

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

function readRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeBaseUrl(value: unknown) {
  const candidate = readNonEmptyString(value) ?? DEFAULT_CRAWLOBSERVER_BASE_URL;
  const parsed = new URL(candidate);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("CrawlObserver base URL must use http or https");
  }
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

function normalizeConfig(config: CrawlObserverPluginConfig) {
  return {
    baseUrl: normalizeBaseUrl(config.crawlObserverBaseUrl),
    allowedProjectId: readNonEmptyString(config.allowedProjectId),
    allowMutatingTools: config.allowMutatingTools === true,
    requestTimeoutMs:
      readPositiveNumber(config.requestTimeoutMs) ?? DEFAULT_REQUEST_TIMEOUT_MS,
    maxPageLimit: readPositiveNumber(config.maxPageLimit) ?? DEFAULT_MAX_PAGE_LIMIT,
  };
}

async function resolveApiKey(input: {
  config: CrawlObserverPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
}) {
  const secretRef = readNonEmptyString(input.config.crawlObserverApiKeySecretRef);
  if (!secretRef) {
    throw new Error("CrawlObserver API key secret is not configured");
  }
  const apiKey = await input.resolveSecret(secretRef);
  if (!readNonEmptyString(apiKey)) {
    throw new Error("CrawlObserver API key secret resolved to an empty value");
  }
  return apiKey.trim();
}

function assertMutationAllowed(config: CrawlObserverPluginConfig) {
  if (config.allowMutatingTools !== true) {
    throw new Error(
      "CrawlObserver mutating tools are disabled for this plugin instance",
    );
  }
}

function assertAllowedProject(input: {
  config: CrawlObserverPluginConfig;
  projectId?: unknown;
}) {
  const allowedProjectId = readNonEmptyString(input.config.allowedProjectId);
  const requestedProjectId = readNonEmptyString(input.projectId);
  if (allowedProjectId && requestedProjectId && requestedProjectId !== allowedProjectId) {
    throw new Error(
      `CrawlObserver project_id is not allowed: ${requestedProjectId}. Allowed project_id: ${allowedProjectId}`,
    );
  }
}

function requireSessionId(params: unknown) {
  const value = readNonEmptyString(readRecord(params).sessionId);
  if (!value) throw new Error("CrawlObserver sessionId is required");
  return encodeURIComponent(value);
}

function cleanQuery(
  params: Record<string, unknown>,
  allowedFields: Set<string>,
  maxPageLimit: number,
) {
  const query: QueryParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (!allowedFields.has(key) || value == null) continue;
    if (key === "limit") {
      const limit = readPositiveNumber(value);
      query.limit = limit ? Math.min(Math.floor(limit), maxPageLimit) : undefined;
      continue;
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      query[key] = value;
    }
  }
  return query;
}

function appendQuery(url: URL, query: QueryParams | undefined) {
  if (!query) return;
  for (const [key, value] of Object.entries(query)) {
    if (value == null) continue;
    url.searchParams.set(key, String(value));
  }
}

function normalizeErrorBody(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return "";
  try {
    const parsed = JSON.parse(trimmed) as { error?: unknown };
    if (typeof parsed.error === "string") return parsed.error;
  } catch {
    // Fall through to safe truncation.
  }
  return trimmed.slice(0, 400);
}

export async function callCrawlObserverApi(input: {
  config: CrawlObserverPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
  fetchFn: FetchLike;
  request: CrawlObserverRequest;
}): Promise<CrawlObserverToolResponse> {
  const normalized = normalizeConfig(input.config);
  const apiKey = await resolveApiKey(input);
  const url = new URL(`${normalized.baseUrl}${input.request.path}`);
  appendQuery(url, input.request.query);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), normalized.requestTimeoutMs);
  try {
    const response = await input.fetchFn(url.toString(), {
      method: input.request.method ?? "GET",
      headers: {
        "X-API-Key": apiKey,
        Accept: "application/json",
        ...(input.request.body == null
          ? {}
          : { "Content-Type": "application/json" }),
      },
      body:
        input.request.body == null ? undefined : JSON.stringify(input.request.body),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      const detail = normalizeErrorBody(text);
      throw new Error(
        `CrawlObserver HTTP ${response.status}${detail ? `: ${detail}` : ""}`,
      );
    }
    const data = text.trim().length > 0 ? JSON.parse(text) : null;
    return {
      content: JSON.stringify(data, null, 2),
      data,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("CrawlObserver request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function prepareStartCrawlBody(input: {
  params: unknown;
  config: CrawlObserverPluginConfig;
}) {
  assertMutationAllowed(input.config);
  const params = readRecord(input.params);
  const seeds = Array.isArray(params.seeds)
    ? params.seeds.filter((seed): seed is string => typeof seed === "string" && seed.trim().length > 0)
    : [];
  if (seeds.length === 0) throw new Error("CrawlObserver crawl seeds are required");
  assertAllowedProject({ config: input.config, projectId: params.project_id });

  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (START_CRAWL_FIELDS.has(key) && value != null) body[key] = value;
  }
  body.seeds = seeds;
  return body;
}

export function prepareReadEndpointRequest(input: {
  params: unknown;
  config: CrawlObserverPluginConfig;
}) {
  const params = readRecord(input.params);
  const endpointTemplate = readNonEmptyString(params.endpoint);
  if (!endpointTemplate) throw new Error("CrawlObserver read endpoint is required");
  if (!(READ_ENDPOINT_ALLOWLIST as readonly string[]).includes(endpointTemplate)) {
    throw new Error(`CrawlObserver read endpoint is not allowed: ${endpointTemplate}`);
  }
  const query = readRecord(params.query);
  assertAllowedProject({ config: input.config, projectId: query.project_id });
  const sessionId = endpointTemplate.includes("{id}")
    ? requireSessionId(params)
    : null;
  const path = sessionId
    ? endpointTemplate.replace("{id}", sessionId)
    : endpointTemplate;
  return {
    method: "GET" as const,
    path,
    query: cleanQuery(query, new Set(Object.keys(query)), normalizeConfig(input.config).maxPageLimit),
  };
}

export function prepareSessionsQuery(input: {
  params: unknown;
  config: CrawlObserverPluginConfig;
}) {
  const params = readRecord(input.params);
  assertAllowedProject({ config: input.config, projectId: params.project_id });
  return cleanQuery(
    params,
    SESSION_FILTER_FIELDS,
    normalizeConfig(input.config).maxPageLimit,
  );
}

export function preparePagesQuery(input: {
  params: unknown;
  config: CrawlObserverPluginConfig;
}) {
  return cleanQuery(
    readRecord(input.params),
    PAGE_FILTER_FIELDS,
    normalizeConfig(input.config).maxPageLimit,
  );
}

export function prepareLinksQuery(input: {
  params: unknown;
  config: CrawlObserverPluginConfig;
}) {
  return cleanQuery(
    readRecord(input.params),
    LINK_FILTER_FIELDS,
    normalizeConfig(input.config).maxPageLimit,
  );
}

export function prepareResourceChecksQuery(input: {
  params: unknown;
  config: CrawlObserverPluginConfig;
}) {
  return cleanQuery(
    readRecord(input.params),
    RESOURCE_FILTER_FIELDS,
    normalizeConfig(input.config).maxPageLimit,
  );
}

export function buildSessionPath(input: {
  params: unknown;
  suffix: string;
}) {
  return `/api/sessions/${requireSessionId(input.params)}${input.suffix}`;
}

export function preparePageDetailQuery(params: unknown) {
  const url = readNonEmptyString(readRecord(params).url);
  if (!url) throw new Error("CrawlObserver page URL is required");
  return { url };
}

export function prepareMutatingSessionRequest(input: {
  params: unknown;
  config: CrawlObserverPluginConfig;
  suffix: string;
}) {
  assertMutationAllowed(input.config);
  return {
    method: "POST" as const,
    path: buildSessionPath({ params: input.params, suffix: input.suffix }),
  };
}
