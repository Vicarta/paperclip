import { asString, parseObject } from "@paperclipai/adapter-utils/server-utils";

export const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export interface OpenRouterSettings {
  apiKey: string;
  baseUrl: string;
  siteUrl: string;
  appName: string;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function normalizeOpenRouterBaseUrl(value: unknown): string {
  const raw = asString(value, "").trim();
  const fallback = DEFAULT_OPENROUTER_BASE_URL;
  if (!raw) return fallback;

  try {
    const url = new URL(raw);
    const pathname = url.pathname.replace(/\/+$/, "");
    if (!pathname || pathname === "/") {
      url.pathname = "/api/v1";
      return trimTrailingSlash(url.toString());
    }
    return trimTrailingSlash(url.toString());
  } catch {
    return fallback;
  }
}

export function normalizeOpenRouterModelId(value: unknown): string {
  const model = asString(value, "").trim();
  return model.startsWith("openrouter/") ? model.slice("openrouter/".length) : model;
}

export function resolveOpenRouterSettings(config: Record<string, unknown>): OpenRouterSettings {
  const env = parseObject(config.env);
  const apiKey =
    asString(env.OPENROUTER_API_KEY, "").trim() ||
    asString(config.apiKey, "").trim();
  const baseUrl = normalizeOpenRouterBaseUrl(
    config.baseUrl ?? env.OPENROUTER_BASE_URL ?? DEFAULT_OPENROUTER_BASE_URL,
  );
  const siteUrl = asString(config.siteUrl ?? env.OPENROUTER_SITE_URL, "").trim();
  const appName =
    asString(config.appName ?? env.OPENROUTER_APP_NAME, "").trim() || "Paperclip";
  return { apiKey, baseUrl, siteUrl, appName };
}

export function buildOpenRouterHeaders(settings: OpenRouterSettings): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${settings.apiKey}`,
    "Content-Type": "application/json",
    "X-OpenRouter-Title": settings.appName,
  };
  if (settings.siteUrl) {
    headers["HTTP-Referer"] = settings.siteUrl;
  }
  return headers;
}

export function summarizeErrorPayload(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  const nestedError =
    typeof record.error === "object" && record.error !== null
      ? (record.error as Record<string, unknown>)
      : null;
  const message =
    asString(nestedError?.message, "").trim() ||
    asString(record.message, "").trim() ||
    asString(record.error, "").trim();
  return message;
}

export function extractAssistantText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  const choices = Array.isArray(record.choices) ? record.choices : [];
  const message =
    choices.length > 0 &&
    typeof choices[0] === "object" &&
    choices[0] !== null &&
    typeof (choices[0] as Record<string, unknown>).message === "object" &&
    (choices[0] as Record<string, unknown>).message !== null
      ? ((choices[0] as Record<string, unknown>).message as Record<string, unknown>)
      : null;
  const content = message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .flatMap((entry) => {
        if (typeof entry === "string") return [entry];
        if (!entry || typeof entry !== "object") return [];
        const record = entry as Record<string, unknown>;
        const text = asString(record.text, "").trim();
        return text ? [text] : [];
      })
      .join("\n")
      .trim();
  }
  return "";
}

export function extractCostUsd(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const usage =
    typeof record.usage === "object" && record.usage !== null
      ? (record.usage as Record<string, unknown>)
      : null;
  const candidates = [
    usage?.cost,
    usage?.total_cost,
    record.cost,
    record.total_cost,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}
