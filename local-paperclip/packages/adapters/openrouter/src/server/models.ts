import type { AdapterModel } from "@paperclipai/adapter-utils";
import { asString } from "@paperclipai/adapter-utils/server-utils";
import {
  buildOpenRouterHeaders,
  normalizeOpenRouterModelId,
  resolveOpenRouterSettings,
  summarizeErrorPayload,
} from "./shared.js";

type ModelResponse = {
  data?: Array<{
    id?: unknown;
    name?: unknown;
  }>;
};

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const message = summarizeErrorPayload(payload) || text || `HTTP ${response.status}`;
    throw new Error(`OpenRouter request failed (${response.status}): ${message}`);
  }
  return (payload ?? {}) as T;
}

export async function listOpenRouterDirectModels(
  input: Record<string, unknown> = {},
): Promise<AdapterModel[]> {
  const settings = resolveOpenRouterSettings(input);
  if (!settings.apiKey) {
    throw new Error("OpenRouter requires OPENROUTER_API_KEY in adapter settings or env bindings.");
  }

  const payload = await fetchJson<ModelResponse>(`${settings.baseUrl}/models`, {
    method: "GET",
    headers: buildOpenRouterHeaders(settings),
  });

  return (payload.data ?? [])
    .map((entry) => {
      const id = normalizeOpenRouterModelId(entry.id);
      if (!id) return null;
      const label = asString(entry.name, "").trim() || id;
      return { id, label };
    })
    .filter((entry): entry is AdapterModel => Boolean(entry));
}

export async function ensureOpenRouterDirectModelConfiguredAndAvailable(input: {
  model?: unknown;
  baseUrl?: unknown;
  apiKey?: unknown;
  env?: unknown;
} & Record<string, unknown>): Promise<AdapterModel[]> {
  const model = normalizeOpenRouterModelId(input.model);
  if (!model) {
    throw new Error("OpenRouter requires `adapterConfig.model` in provider/model format.");
  }

  const discovered = await listOpenRouterDirectModels(input);
  if (discovered.length === 0) {
    throw new Error("OpenRouter returned no models. Verify OPENROUTER_API_KEY and provider access.");
  }
  if (!discovered.some((entry) => entry.id === model)) {
    const sample = discovered.slice(0, 12).map((entry) => entry.id).join(", ");
    throw new Error(
      `Configured OpenRouter model is unavailable: ${model}. Available models: ${sample}${discovered.length > 12 ? ", ..." : ""}`,
    );
  }
  return discovered;
}
