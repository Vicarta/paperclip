import { DEFAULT_SERPER_API_BASE_URL } from "./constants.js";

export type SerperPluginConfig = {
  serperApiKeySecretRef?: string;
  serperApiBaseUrl?: string;
};

export type SerperSearchParams = {
  q: string;
  gl?: string;
  hl?: string;
  num?: number;
  page?: number;
  autocorrect?: boolean;
  type?: "search" | "news";
};

type SerperOrganicResult = {
  position?: number;
  title?: string;
  link?: string;
  snippet?: string;
};

type SerperSearchResponse = {
  searchParameters?: Record<string, unknown>;
  organic?: SerperOrganicResult[];
  news?: SerperOrganicResult[];
  answerBox?: Record<string, unknown> | null;
  knowledgeGraph?: Record<string, unknown> | null;
  peopleAlsoAsk?: Array<Record<string, unknown>>;
};

function readNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeBaseUrl(value: unknown) {
  return readNonEmptyString(value) ?? DEFAULT_SERPER_API_BASE_URL;
}

async function resolveApiKey(input: {
  config: SerperPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
}) {
  const secretRef = readNonEmptyString(input.config.serperApiKeySecretRef);
  if (!secretRef) throw new Error("Serper API key is not configured for this plugin");
  const apiKey = await input.resolveSecret(secretRef);
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error("Serper API key secret resolved to an empty value");
  }
  return apiKey.trim();
}

function buildEndpoint(baseUrl: string, type: SerperSearchParams["type"]) {
  const url = new URL(baseUrl);
  const pathname = (url.pathname || "/").replace(/\/+$/, "");
  url.pathname = `${pathname}${type === "news" ? "/news" : "/search"}`;
  return url.toString();
}

function formatInlineObject(value: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!value) return null;
  const parts = keys
    .map((key) => {
      const next = value[key];
      if (typeof next !== "string" || next.trim().length === 0) return null;
      return `${key}: ${next.trim()}`;
    })
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" | ") : null;
}

function summarizeResults(payload: SerperSearchResponse, type: SerperSearchParams["type"]) {
  const lines: string[] = [];
  const searchParams = payload.searchParameters ? JSON.stringify(payload.searchParameters) : null;
  lines.push(`Serper ${type === "news" ? "news" : "web"} search results`);
  if (searchParams) lines.push(`Parameters: ${searchParams}`);

  const answerBox = formatInlineObject(payload.answerBox ?? null, ["title", "answer", "snippet", "source"]);
  if (answerBox) lines.push(`Answer box: ${answerBox}`);

  const knowledgeGraph = formatInlineObject(payload.knowledgeGraph ?? null, ["title", "type", "description", "website"]);
  if (knowledgeGraph) lines.push(`Knowledge graph: ${knowledgeGraph}`);

  const records = (type === "news" ? payload.news : payload.organic) ?? [];
  if (records.length === 0) {
    lines.push("No results returned.");
    return lines.join("\n");
  }

  lines.push("Top results:");
  for (const row of records.slice(0, 10)) {
    const parts = [
      row.position ? `${row.position}.` : "-",
      row.title?.trim() || "Untitled",
      row.link?.trim() || "",
    ].filter((part) => part.length > 0);
    const snippet = row.snippet?.trim();
    lines.push(parts.join(" "));
    if (snippet) lines.push(`   ${snippet}`);
  }

  const peopleAlsoAsk = Array.isArray(payload.peopleAlsoAsk) ? payload.peopleAlsoAsk : [];
  if (peopleAlsoAsk.length > 0) {
    lines.push("People also ask:");
    for (const item of peopleAlsoAsk.slice(0, 5)) {
      const question = typeof item.question === "string" ? item.question.trim() : "";
      const snippet = typeof item.snippet === "string" ? item.snippet.trim() : "";
      if (question) lines.push(`- ${question}`);
      if (snippet) lines.push(`  ${snippet}`);
    }
  }

  return lines.join("\n");
}

export async function searchSerper(input: {
  params: SerperSearchParams;
  config: SerperPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
  fetchFn?: (url: string, init?: RequestInit) => Promise<Response>;
}) {
  const apiKey = await resolveApiKey(input);
  const baseUrl = normalizeBaseUrl(input.config.serperApiBaseUrl);
  const fetchFn = input.fetchFn ?? fetch;
  const type = input.params.type === "news" ? "news" : "search";
  const endpoint = buildEndpoint(baseUrl, type);

  const response = await fetchFn(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({
      q: input.params.q,
      ...(typeof input.params.gl === "string" ? { gl: input.params.gl } : {}),
      ...(typeof input.params.hl === "string" ? { hl: input.params.hl } : {}),
      ...(typeof input.params.num === "number" ? { num: input.params.num } : {}),
      ...(typeof input.params.page === "number" ? { page: input.params.page } : {}),
      ...(typeof input.params.autocorrect === "boolean" ? { autocorrect: input.params.autocorrect } : {}),
    }),
  });

  const rawText = await response.text();
  let payload: SerperSearchResponse | null = null;
  try {
    payload = JSON.parse(rawText) as SerperSearchResponse;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(`Serper request failed (${response.status}): ${payload ? JSON.stringify(payload) : rawText}`);
  }

  if (!payload) {
    throw new Error("Serper returned a non-JSON response");
  }

  return {
    content: summarizeResults(payload, type),
    data: payload,
  };
}
