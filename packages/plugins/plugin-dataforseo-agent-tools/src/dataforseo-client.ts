import { DEFAULT_DATAFORSEO_API_BASE_URL } from "./constants.js";

export type DataForSeoPluginConfig = {
  dataforseoApiLoginSecretRef?: string;
  dataforseoApiPasswordSecretRef?: string;
  dataforseoApiBaseUrl?: string;
};

export type DataForSeoSearchVolumeParams = {
  keywords: string[];
  location_name?: string;
  language_name?: string;
  location_code?: number;
  language_code?: string;
  search_partners?: boolean;
};

type DataForSeoKeywordResult = {
  keyword?: string;
  location_code?: number;
  language_code?: string;
  search_partners?: boolean;
  competition?: string | null;
  competition_index?: number | null;
  search_volume?: number | null;
  low_top_of_page_bid?: number | null;
  high_top_of_page_bid?: number | null;
  cpc?: number | null;
  monthly_searches?: Array<{
    year?: number;
    month?: number;
    search_volume?: number | null;
  }>;
};

type DataForSeoTask = {
  id?: string;
  status_code?: number;
  status_message?: string;
  cost?: number;
  result?: DataForSeoKeywordResult[];
  data?: Record<string, unknown>;
};

type DataForSeoResponse = {
  status_code?: number;
  status_message?: string;
  cost?: number;
  tasks?: DataForSeoTask[];
};

function readNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeBaseUrl(value: unknown) {
  return readNonEmptyString(value) ?? DEFAULT_DATAFORSEO_API_BASE_URL;
}

function normalizeKeywordList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}

async function resolveCredentials(input: {
  config: DataForSeoPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
}) {
  const loginSecretRef = readNonEmptyString(input.config.dataforseoApiLoginSecretRef);
  const passwordSecretRef = readNonEmptyString(
    input.config.dataforseoApiPasswordSecretRef,
  );

  if (!loginSecretRef || !passwordSecretRef) {
    throw new Error("DataForSEO API credentials are not configured for this plugin");
  }

  const [login, password] = await Promise.all([
    input.resolveSecret(loginSecretRef),
    input.resolveSecret(passwordSecretRef),
  ]);

  if (!login || login.trim().length === 0) {
    throw new Error("DataForSEO API login secret resolved to an empty value");
  }
  if (!password || password.trim().length === 0) {
    throw new Error("DataForSEO API password secret resolved to an empty value");
  }

  return {
    login: login.trim(),
    password: password.trim(),
  };
}

function buildEndpoint(baseUrl: string) {
  const url = new URL(baseUrl);
  const pathname = (url.pathname || "/").replace(/\/+$/, "");
  url.pathname = `${pathname}/v3/keywords_data/google_ads/search_volume/live`;
  return url.toString();
}

function buildTask(params: DataForSeoSearchVolumeParams) {
  const keywords = normalizeKeywordList(params.keywords).slice(0, 1000);
  if (keywords.length === 0) {
    throw new Error("At least one keyword is required");
  }

  return {
    keywords,
    ...(typeof params.location_name === "string" && params.location_name.trim().length > 0
      ? { location_name: params.location_name.trim() }
      : {}),
    ...(typeof params.language_name === "string" && params.language_name.trim().length > 0
      ? { language_name: params.language_name.trim() }
      : {}),
    ...(typeof params.location_code === "number" && Number.isFinite(params.location_code)
      ? { location_code: params.location_code }
      : {}),
    ...(typeof params.language_code === "string" && params.language_code.trim().length > 0
      ? { language_code: params.language_code.trim() }
      : {}),
    ...(typeof params.search_partners === "boolean"
      ? { search_partners: params.search_partners }
      : {}),
  };
}

function formatCurrency(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? `$${value.toFixed(3)}`
    : "n/a";
}

function summarizeResults(payload: DataForSeoResponse, params: DataForSeoSearchVolumeParams) {
  const task = payload.tasks?.[0];
  const rows = task?.result ?? [];
  const location =
    readNonEmptyString(params.location_name) ??
    (typeof params.location_code === "number" ? `code:${params.location_code}` : "unspecified");
  const language =
    readNonEmptyString(params.language_name) ??
    readNonEmptyString(params.language_code) ??
    "unspecified";

  const lines: string[] = [];
  lines.push("DataForSEO Google Ads search volume results");
  lines.push(`Keywords requested: ${normalizeKeywordList(params.keywords).length}`);
  lines.push(`Location: ${location}`);
  lines.push(`Language: ${language}`);
  lines.push(`Rows returned: ${rows.length}`);

  if (rows.length === 0) {
    lines.push("No keyword rows returned.");
    return lines.join("\n");
  }

  lines.push("Top keyword rows:");
  for (const row of rows.slice(0, 20)) {
    const keyword = readNonEmptyString(row.keyword) ?? "(unknown keyword)";
    const volume =
      typeof row.search_volume === "number" && Number.isFinite(row.search_volume)
        ? row.search_volume
        : "n/a";
    const competition = readNonEmptyString(row.competition) ?? "n/a";
    const cpc = formatCurrency(row.cpc);
    lines.push(
      `- ${keyword} | volume: ${volume} | competition: ${competition} | cpc: ${cpc}`,
    );
  }

  return lines.join("\n");
}

function readTaskCostUsd(payload: DataForSeoResponse) {
  const taskCost = (payload.tasks ?? []).reduce((sum, task) => {
    const cost = typeof task.cost === "number" && Number.isFinite(task.cost) ? task.cost : 0;
    return sum + cost;
  }, 0);
  if (taskCost > 0) return taskCost;
  return typeof payload.cost === "number" && Number.isFinite(payload.cost) ? payload.cost : 0;
}

export async function fetchGoogleAdsSearchVolume(input: {
  params: DataForSeoSearchVolumeParams;
  config: DataForSeoPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
  fetchFn?: (url: string, init?: RequestInit) => Promise<Response>;
}) {
  const credentials = await resolveCredentials(input);
  const baseUrl = normalizeBaseUrl(input.config.dataforseoApiBaseUrl);
  const fetchFn = input.fetchFn ?? fetch;
  const endpoint = buildEndpoint(baseUrl);
  const task = buildTask(input.params);

  const authToken = Buffer.from(
    `${credentials.login}:${credentials.password}`,
    "utf8",
  ).toString("base64");

  const response = await fetchFn(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${authToken}`,
    },
    body: JSON.stringify([task]),
  });

  const rawText = await response.text();
  let payload: DataForSeoResponse | null = null;
  try {
    payload = JSON.parse(rawText) as DataForSeoResponse;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(
      `DataForSEO request failed (${response.status}): ${
        payload ? JSON.stringify(payload) : rawText
      }`,
    );
  }

  if (!payload) {
    throw new Error("DataForSEO returned a non-JSON response");
  }

  const statusCode =
    typeof payload.status_code === "number" ? payload.status_code : undefined;
  if (statusCode && statusCode >= 30000) {
    throw new Error(
      `DataForSEO returned error ${statusCode}: ${
        payload.status_message ?? "Unknown error"
      }`,
    );
  }

  return {
    content: summarizeResults(payload, input.params),
    data: payload,
    actualCostUsd: readTaskCostUsd(payload),
  };
}
