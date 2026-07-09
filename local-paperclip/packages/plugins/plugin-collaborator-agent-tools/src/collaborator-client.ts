import { DEFAULT_COLLABORATOR_API_BASE_URL } from "./constants.js";

export type CollaboratorPluginConfig = {
  collaboratorApiKeySecretRef?: string;
  collaboratorApiBaseUrl?: string;
};

export type CollaboratorCreatorListParams = {
  keywords?: string[];
  countries?: number[];
  regions?: number[];
  cities?: number[];
  languages?: number[];
  url?: string;
  priceMin?: number;
  priceMax?: number;
  priceWithWriting?: boolean;
  spelling?: 1 | 2;
  withInsurance?: boolean;
  trafficMin?: number;
  isTrafficGrown?: boolean;
  formatId?: 1;
  speedMaxDays?: number;
  uniqueSitesOnly?: boolean;
  cfMin?: number;
  tfMin?: number;
  trMin?: number;
  mozDaMin?: number;
  ahrefsDrMin?: number;
  ahrefsRefdomainsMin?: number;
  ahrefsTrafficMin?: number;
  serpSdrMin?: number;
  serpKeywordsMin?: number;
  indexGoogleMin?: number;
  googleNews?: 0 | 1 | 2;
  domainAgeMin?: number;
  maxAnchors?: Array<1 | 2 | 3>;
  nofollow?: 0 | 1 | 2;
  advertisingMark?: boolean;
  siteTypes?: number[];
  sort?: string;
  limit?: number;
};

export type CollaboratorDictionaryParams = {
  countryId?: number;
  regionId?: number;
};

type CollaboratorPrice = {
  name?: string;
  pricePublication?: number | string | null;
  priceSpelling?: number | string | null;
  priceAnnouncement?: number | string | null;
  linkType?: string | number | null;
  numberOfLinks?: number | string | null;
  priceContrCategories?: number | string | null;
  contrCategories?: unknown;
};

type CollaboratorCreator = {
  id?: number | string;
  name?: string;
  url?: string;
  categories?: unknown;
  contrCategories?: unknown;
  traffic?: number | string | null;
  country?: unknown;
  regions?: unknown;
  cities?: unknown;
  placementSpeed?: number | string | null;
  tf?: number | string | null;
  cf?: number | string | null;
  tr?: number | string | null;
  daMoz?: number | string | null;
  indexGoogle?: number | string | null;
  siteAge?: number | string | null;
  linkExchange?: unknown;
  domainZone?: string | null;
  siteType?: unknown;
  addedToSystem?: string | null;
  googleAiOverview?: number | string | null;
  prices?: CollaboratorPrice[];
  [key: string]: unknown;
};

type CollaboratorCreatorListResponse =
  | CollaboratorCreator[]
  | {
      data?: CollaboratorCreator[];
      items?: CollaboratorCreator[];
      result?: CollaboratorCreator[];
      [key: string]: unknown;
    };

function readNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeBaseUrl(value: unknown) {
  return readNonEmptyString(value) ?? DEFAULT_COLLABORATOR_API_BASE_URL;
}

async function resolveApiKey(input: {
  config: CollaboratorPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
}) {
  const secretRef = readNonEmptyString(input.config.collaboratorApiKeySecretRef);
  if (!secretRef) {
    throw new Error("Collaborator API key secret ref is not configured for this plugin");
  }
  const apiKey = await input.resolveSecret(secretRef);
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error("Collaborator API key secret resolved to an empty value");
  }
  return apiKey.trim();
}

function buildEndpoint(baseUrl: string, path: string, query?: URLSearchParams) {
  const url = new URL(baseUrl);
  const basePath = (url.pathname || "/").replace(/\/+$/, "");
  url.pathname = `${basePath}${path}`;
  if (query) url.search = query.toString();
  return url.toString();
}

function appendStringArray(query: URLSearchParams, name: string, value: unknown) {
  if (!Array.isArray(value)) return;
  for (const item of value) {
    const normalized = readNonEmptyString(item);
    if (normalized) query.append(name, normalized);
  }
}

function appendNumberArray(query: URLSearchParams, name: string, value: unknown) {
  if (!Array.isArray(value)) return;
  for (const item of value) {
    if (typeof item === "number" && Number.isFinite(item)) {
      query.append(name, String(item));
    }
  }
}

function appendNumber(query: URLSearchParams, name: string, value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) query.set(name, String(value));
}

function appendBoolean(query: URLSearchParams, name: string, value: unknown) {
  if (typeof value === "boolean") query.set(name, value ? "1" : "0");
}

function appendString(query: URLSearchParams, name: string, value: unknown) {
  const normalized = readNonEmptyString(value);
  if (normalized) query.set(name, normalized);
}

export function buildCreatorListQuery(params: CollaboratorCreatorListParams) {
  const query = new URLSearchParams();
  appendStringArray(query, "keywords", params.keywords);
  appendNumberArray(query, "countries", params.countries);
  appendNumberArray(query, "_regions", params.regions);
  appendNumberArray(query, "_city", params.cities);
  appendNumberArray(query, "_language", params.languages);
  appendString(query, "_url", params.url);
  appendNumber(query, "_price_min", params.priceMin);
  appendNumber(query, "_price_max", params.priceMax);
  appendBoolean(query, "_price_with_writing", params.priceWithWriting);
  appendNumber(query, "spelling", params.spelling);
  appendBoolean(query, "with_insurance", params.withInsurance);
  appendNumber(query, "_traffic", params.trafficMin);
  appendBoolean(query, "is_traffic_grown", params.isTrafficGrown);
  appendNumber(query, "format_id", params.formatId);
  appendNumber(query, "_speed", params.speedMaxDays);
  appendBoolean(query, "exchange", params.uniqueSitesOnly);
  appendNumber(query, "_cf_min", params.cfMin);
  appendNumber(query, "_tf_min", params.tfMin);
  appendNumber(query, "_tr_min", params.trMin);
  appendNumber(query, "_moz_da_min", params.mozDaMin);
  appendNumber(query, "ahrefs_dr_min", params.ahrefsDrMin);
  appendNumber(query, "ahrefs_refdomains_min", params.ahrefsRefdomainsMin);
  appendNumber(query, "ahrefs_traffic_min", params.ahrefsTrafficMin);
  appendNumber(query, "serp_sdr_min", params.serpSdrMin);
  appendNumber(query, "serp_keywords_min", params.serpKeywordsMin);
  appendNumber(query, "_index_google_min", params.indexGoogleMin);
  appendNumber(query, "googleNews", params.googleNews);
  appendNumber(query, "_domain_age", params.domainAgeMin);
  appendNumberArray(query, "max_anchors[]", params.maxAnchors);
  appendNumber(query, "nofollow", params.nofollow);
  appendBoolean(query, "advertising_mark", params.advertisingMark);
  appendNumberArray(query, "_cre_type_id", params.siteTypes);
  appendString(query, "sort", params.sort);
  return query;
}

function extractCreatorRows(payload: CollaboratorCreatorListResponse) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.result)) return payload.result;
  return [];
}

function queryToRecord(query: URLSearchParams) {
  const record: Record<string, string | string[]> = {};
  query.forEach((value, key) => {
    const previous = record[key];
    if (Array.isArray(previous)) {
      previous.push(value);
      return;
    }
    if (typeof previous === "string") {
      record[key] = [previous, value];
      return;
    }
    record[key] = value;
  });
  return record;
}

function compactJson(value: unknown) {
  if (value == null) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function summarizePrice(price: CollaboratorPrice | undefined) {
  if (!price) return "price: n/a";
  const parts = [
    price.name ? `format: ${price.name}` : null,
    price.pricePublication != null ? `publication: ${price.pricePublication}` : null,
    price.priceSpelling != null ? `writing: ${price.priceSpelling}` : null,
    price.priceAnnouncement != null ? `announcement: ${price.priceAnnouncement}` : null,
    price.linkType != null ? `link: ${price.linkType}` : null,
    price.numberOfLinks != null ? `links: ${price.numberOfLinks}` : null,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" | ") : "price: n/a";
}

function normalizeCreator(row: CollaboratorCreator) {
  const firstPrice = Array.isArray(row.prices) ? row.prices[0] : undefined;
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    categories: row.categories,
    contrCategories: row.contrCategories,
    traffic: row.traffic,
    country: row.country,
    regions: row.regions,
    cities: row.cities,
    placementSpeed: row.placementSpeed,
    tf: row.tf,
    cf: row.cf,
    tr: row.tr,
    daMoz: row.daMoz,
    indexGoogle: row.indexGoogle,
    siteAge: row.siteAge,
    linkExchange: row.linkExchange,
    domainZone: row.domainZone,
    siteType: row.siteType,
    addedToSystem: row.addedToSystem,
    googleAiOverview: row.googleAiOverview,
    prices: row.prices,
    firstPrice,
  };
}

function summarizeCreatorRows(rows: CollaboratorCreator[], limit: number) {
  const lines: string[] = [];
  lines.push("Collaborator creator catalog results");
  lines.push(`Rows returned: ${rows.length}`);
  lines.push(`Source timestamp: ${new Date().toISOString()}`);
  if (rows.length === 0) {
    lines.push("No creators returned.");
    return lines.join("\n");
  }

  lines.push("Top creators:");
  for (const row of rows.slice(0, limit)) {
    const normalized = normalizeCreator(row);
    const identity = [
      normalized.id != null ? `#${normalized.id}` : null,
      normalized.name,
      normalized.url,
    ].filter((part): part is string => typeof part === "string" && part.length > 0);
    const metrics = [
      normalized.traffic != null ? `traffic: ${normalized.traffic}` : null,
      normalized.daMoz != null ? `DA: ${normalized.daMoz}` : null,
      normalized.tf != null ? `TF: ${normalized.tf}` : null,
      normalized.cf != null ? `CF: ${normalized.cf}` : null,
      normalized.indexGoogle != null ? `index: ${normalized.indexGoogle}` : null,
      normalized.siteAge != null ? `age: ${normalized.siteAge}` : null,
    ].filter((part): part is string => Boolean(part));
    const context = [
      compactJson(normalized.country) ? `country: ${compactJson(normalized.country)}` : null,
      compactJson(normalized.siteType) ? `type: ${compactJson(normalized.siteType)}` : null,
    ].filter((part): part is string => Boolean(part));
    lines.push(`- ${identity.join(" | ") || "(unknown creator)"}`);
    if (context.length > 0) lines.push(`  ${context.join(" | ")}`);
    if (metrics.length > 0) lines.push(`  ${metrics.join(" | ")}`);
    lines.push(`  ${summarizePrice(normalized.firstPrice)}`);
  }
  return lines.join("\n");
}

async function requestCollaborator(input: {
  config: CollaboratorPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
  fetchFn?: (url: string, init?: RequestInit) => Promise<Response>;
  path: string;
  query?: URLSearchParams;
}) {
  const apiKey = await resolveApiKey(input);
  const baseUrl = normalizeBaseUrl(input.config.collaboratorApiBaseUrl);
  const fetchFn = input.fetchFn ?? fetch;
  const endpoint = buildEndpoint(baseUrl, input.path, input.query);

  const response = await fetchFn(endpoint, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Api-Key": apiKey,
    },
  });
  const rawText = await response.text();
  let payload: unknown = null;
  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    throw new Error(
      `Collaborator request failed (${response.status}): ${
        payload ? JSON.stringify(payload) : rawText
      }`,
    );
  }
  if (payload == null) throw new Error("Collaborator returned an empty response");
  return payload;
}

export async function fetchCreatorList(input: {
  params: CollaboratorCreatorListParams;
  config: CollaboratorPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
  fetchFn?: (url: string, init?: RequestInit) => Promise<Response>;
}) {
  const payload = await requestCollaborator({
    config: input.config,
    resolveSecret: input.resolveSecret,
    fetchFn: input.fetchFn,
    path: "/api/public/creator/list",
    query: buildCreatorListQuery(input.params),
  }) as CollaboratorCreatorListResponse;
  const rows = extractCreatorRows(payload);
  const limit =
    typeof input.params.limit === "number" && Number.isFinite(input.params.limit)
      ? Math.max(1, Math.min(50, Math.floor(input.params.limit)))
      : 20;
  return {
    content: summarizeCreatorRows(rows, limit),
    data: {
      source: "collaborator.pro",
      sourceTimestamp: new Date().toISOString(),
      query: queryToRecord(buildCreatorListQuery(input.params)),
      rows: rows.slice(0, limit).map(normalizeCreator),
      raw: payload,
    },
  };
}

export async function fetchDictionary(input: {
  type: "countries" | "regions" | "cities" | "languages";
  params?: CollaboratorDictionaryParams;
  config: CollaboratorPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
  fetchFn?: (url: string, init?: RequestInit) => Promise<Response>;
}) {
  const query = new URLSearchParams();
  if (input.type === "regions") appendNumber(query, "countryId", input.params?.countryId);
  if (input.type === "cities") appendNumber(query, "regionId", input.params?.regionId);
  const payload = await requestCollaborator({
    config: input.config,
    resolveSecret: input.resolveSecret,
    fetchFn: input.fetchFn,
    path: `/api/public/dictionary/${input.type}`,
    query,
  });
  const rows = Array.isArray(payload)
    ? payload
    : typeof payload === "object" && payload && Array.isArray((payload as { data?: unknown }).data)
      ? (payload as { data: unknown[] }).data
      : payload;
  return {
    content: `Collaborator ${input.type} dictionary fetched.`,
    data: {
      source: "collaborator.pro",
      sourceTimestamp: new Date().toISOString(),
      rows,
      raw: payload,
    },
  };
}
