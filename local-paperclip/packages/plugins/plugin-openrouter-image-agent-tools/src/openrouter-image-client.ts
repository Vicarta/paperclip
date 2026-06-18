import {
  DEFAULT_OPENROUTER_BASE_URL,
  DEFAULT_OPENROUTER_IMAGE_MODEL,
} from "./constants.js";

export type OpenRouterImagePluginConfig = {
  openrouterApiKeySecretRef?: string;
  openrouterBaseUrl?: string;
  defaultModel?: string;
  costAccountingMode?: "provider_reported" | "estimated_per_image" | "disabled";
  estimatedImageCostUsd?: number;
  appName?: string;
  siteUrl?: string;
};

export type OpenRouterGenerateImageParams = {
  prompt: string;
  model?: string;
  aspectRatio?: string;
  imageSize?: string;
  outputFormat?: "png" | "jpg" | "jpeg" | "webp";
  temperature?: number;
  topP?: number;
  seed?: number;
  metadata?: Record<string, unknown>;
  returnImageData?: boolean;
};

export type OpenRouterGeneratedImage = {
  index: number;
  mimeType: string;
  extension: string;
  dataUrl?: string;
  bytes: number | null;
  source: string;
};

type OpenRouterResponse = Record<string, unknown>;

function readNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function normalizeBaseUrl(value: unknown) {
  return (readNonEmptyString(value) ?? DEFAULT_OPENROUTER_BASE_URL).replace(/\/+$/, "");
}

function resolveModel(config: OpenRouterImagePluginConfig, params: OpenRouterGenerateImageParams) {
  return readNonEmptyString(params.model)
    ?? readNonEmptyString(config.defaultModel)
    ?? DEFAULT_OPENROUTER_IMAGE_MODEL;
}

async function resolveApiKey(input: {
  config: OpenRouterImagePluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
}) {
  const secretRef = readNonEmptyString(input.config.openrouterApiKeySecretRef);
  if (!secretRef) {
    throw new Error("OpenRouter API key secret ref is not configured for this plugin");
  }
  const apiKey = await input.resolveSecret(secretRef);
  const normalized = readNonEmptyString(apiKey);
  if (!normalized) {
    throw new Error("OpenRouter API key secret resolved to an empty value");
  }
  return normalized.replace(/^Bearer\s+/i, "");
}

function buildEndpoint(baseUrl: string) {
  return `${normalizeBaseUrl(baseUrl)}/chat/completions`;
}

function extensionForMimeType(mimeType: string, outputFormat?: string) {
  if (outputFormat === "jpg") return "jpg";
  if (outputFormat === "jpeg") return "jpg";
  if (outputFormat === "webp") return "webp";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

function bytesFromDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return { mimeType: "image/png", bytes: null };
  return {
    mimeType: match[1].toLowerCase(),
    bytes: Buffer.from(match[2].replace(/\s+/g, ""), "base64").length,
  };
}

function collectImageDataUrls(payload: OpenRouterResponse) {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const urls: string[] = [];
  for (const choice of choices) {
    if (!choice || typeof choice !== "object") continue;
    const message = (choice as Record<string, unknown>).message;
    if (!message || typeof message !== "object") continue;
    const images = (message as Record<string, unknown>).images;
    if (!Array.isArray(images)) continue;
    for (const image of images) {
      if (!image || typeof image !== "object") continue;
      const imageUrl = (image as Record<string, unknown>).image_url;
      if (!imageUrl || typeof imageUrl !== "object") continue;
      const url = (imageUrl as Record<string, unknown>).url;
      if (typeof url === "string" && url.startsWith("data:image/")) urls.push(url);
    }
  }
  return urls;
}

export function extractOpenRouterCostUsd(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const usage = record.usage && typeof record.usage === "object"
    ? record.usage as Record<string, unknown>
    : {};
  const candidates = [
    usage.cost,
    usage.total_cost,
    record.cost,
    record.total_cost,
  ];
  for (const candidate of candidates) {
    const numeric = typeof candidate === "string" ? Number(candidate) : candidate;
    if (typeof numeric === "number" && Number.isFinite(numeric) && numeric > 0) return numeric;
  }
  return null;
}

export function sanitizeProviderResponse(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  return JSON.parse(JSON.stringify(payload, (key, value) => {
    if (key === "url" && typeof value === "string" && value.startsWith("data:image/")) {
      const commaIndex = value.indexOf(",");
      const prefix = commaIndex >= 0 ? value.slice(0, commaIndex + 1) : "data:image/*;base64,";
      return `${prefix}<base64 omitted>`;
    }
    if (
      typeof value === "string"
      && value.length > 4096
      && (value.includes("data:image/") || value.includes(";base64,"))
    ) {
      return `<base64-like data omitted: ${value.length} chars>`;
    }
    return value;
  }));
}

function buildPayload(input: {
  params: OpenRouterGenerateImageParams;
  config: OpenRouterImagePluginConfig;
}) {
  const prompt = readNonEmptyString(input.params.prompt);
  if (!prompt) throw new Error("prompt is required");
  const model = resolveModel(input.config, input.params);
  const metadata = input.params.metadata && typeof input.params.metadata === "object"
    ? input.params.metadata
    : {};
  return {
    model,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    modalities: ["image", "text"],
    image_config: {
      ...(readNonEmptyString(input.params.aspectRatio)
        ? { aspect_ratio: input.params.aspectRatio?.trim() }
        : {}),
      ...(readNonEmptyString(input.params.imageSize)
        ? { image_size: input.params.imageSize?.trim() }
        : {}),
    },
    stream: false,
    metadata: {
      ...metadata,
      paperclip_provider: "openrouter",
      paperclip_model: model,
      paperclip_request_type: "image_generation",
    },
    ...(readPositiveNumber(input.params.temperature) !== null
      ? { temperature: input.params.temperature }
      : {}),
    ...(readPositiveNumber(input.params.topP) !== null ? { top_p: input.params.topP } : {}),
    ...(readPositiveNumber(input.params.seed) !== null ? { seed: input.params.seed } : {}),
  };
}

export async function generateOpenRouterImage(input: {
  params: OpenRouterGenerateImageParams;
  config: OpenRouterImagePluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
  fetchFn?: (url: string, init?: RequestInit) => Promise<Response>;
}) {
  const apiKey = await resolveApiKey(input);
  const payload = buildPayload(input);
  const endpoint = buildEndpoint(input.config.openrouterBaseUrl ?? DEFAULT_OPENROUTER_BASE_URL);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "X-OpenRouter-Title": readNonEmptyString(input.config.appName) ?? "Paperclip",
  };
  const siteUrl = readNonEmptyString(input.config.siteUrl);
  if (siteUrl) headers["HTTP-Referer"] = siteUrl;

  const response = await (input.fetchFn ?? fetch)(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const rawText = await response.text();
  let responseBody: OpenRouterResponse | null = null;
  try {
    const parsed = JSON.parse(rawText);
    responseBody = parsed && typeof parsed === "object" ? parsed as OpenRouterResponse : null;
  } catch {
    responseBody = null;
  }

  if (!response.ok) {
    throw new Error(`OpenRouter image request failed (${response.status}): ${responseBody ? JSON.stringify(sanitizeProviderResponse(responseBody)) : rawText}`);
  }
  if (!responseBody) throw new Error("OpenRouter returned a non-JSON response");

  const returnImageData = input.params.returnImageData !== false;
  const images = collectImageDataUrls(responseBody).map((dataUrl, index) => {
    const { mimeType, bytes } = bytesFromDataUrl(dataUrl);
    return {
      index,
      mimeType,
      extension: extensionForMimeType(mimeType, input.params.outputFormat),
      ...(returnImageData ? { dataUrl } : {}),
      bytes,
      source: `openrouter.choices.message.images[${index}].image_url.url`,
    } satisfies OpenRouterGeneratedImage;
  });

  return {
    content: [
      "OpenRouter image generation completed",
      `Model: ${payload.model}`,
      `Images: ${images.length}`,
      `Provider cost: ${extractOpenRouterCostUsd(responseBody) ?? "not reported"}`,
    ].join("\n"),
    data: {
      model: payload.model,
      endpoint,
      imageCount: images.length,
      images,
      providerCostUsd: extractOpenRouterCostUsd(responseBody),
      response: sanitizeProviderResponse(responseBody),
    },
  };
}
