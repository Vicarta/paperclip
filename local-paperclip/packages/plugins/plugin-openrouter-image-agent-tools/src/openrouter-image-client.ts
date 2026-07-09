import {
  DEFAULT_OPENROUTER_BASE_URL,
  DEFAULT_OPENROUTER_IMAGE_MODEL,
} from "./constants.js";

export type OpenRouterImagePluginConfig = {
  openrouterApiKeySecretRef?: string;
  openrouterBaseUrl?: string;
  defaultModel?: string;
  allowModelOverride?: boolean;
  maxImagesPerRequest?: number;
  defaultImageSize?: string;
  defaultAspectRatio?: string;
  defaultOutputDir?: string;
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
  size?: string;
  resolution?: string;
  candidateCount?: number;
  n?: number;
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
  const configuredModel = readNonEmptyString(config.defaultModel) ?? DEFAULT_OPENROUTER_IMAGE_MODEL;
  if (config.allowModelOverride === false) return configuredModel;
  return readNonEmptyString(params.model) ?? configuredModel;
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
  return `${normalizeBaseUrl(baseUrl)}/images`;
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

function normalizeOutputFormat(value: unknown) {
  const format = readNonEmptyString(value)?.toLowerCase();
  if (format === "jpg") return "jpeg";
  if (format === "jpeg" || format === "png" || format === "webp") return format;
  return null;
}

function readPositiveInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function resolveRequestedImageCount(
  params: OpenRouterGenerateImageParams,
  config: OpenRouterImagePluginConfig,
) {
  const configuredMax = readPositiveInteger(config.maxImagesPerRequest);
  const maxImages = Math.min(configuredMax ?? 10, 10);
  return Math.min(
    readPositiveInteger(params.n) ?? readPositiveInteger(params.candidateCount) ?? 1,
    maxImages,
  );
}

function normalizeImageShape(
  params: OpenRouterGenerateImageParams,
  config: OpenRouterImagePluginConfig,
) {
  const explicitAspectRatio = readNonEmptyString(params.aspectRatio)
    ?? readNonEmptyString(config.defaultAspectRatio);
  const requestedSize = readNonEmptyString(params.imageSize)
    ?? readNonEmptyString(params.size)
    ?? readNonEmptyString(params.resolution)
    ?? readNonEmptyString(config.defaultImageSize);
  if (!requestedSize) {
    return {
      aspectRatio: explicitAspectRatio,
      size: null,
    };
  }

  if (/^(0\.5K|1K|2K|4K)$/i.test(requestedSize)) {
    return {
      aspectRatio: explicitAspectRatio,
      size: requestedSize.toUpperCase().replace("0.5K", "0.5K"),
    };
  }

  const dimensions = requestedSize.match(/^(\d{3,5})\s*x\s*(\d{3,5})$/i);
  if (!dimensions) {
    return {
      aspectRatio: explicitAspectRatio,
      size: requestedSize,
    };
  }

  const width = Number(dimensions[1]);
  const height = Number(dimensions[2]);
  const ratio = width / height;
  const commonRatios = [
    ["1:1", 1],
    ["4:3", 4 / 3],
    ["3:2", 3 / 2],
    ["16:9", 16 / 9],
    ["21:9", 21 / 9],
    ["3:4", 3 / 4],
    ["2:3", 2 / 3],
    ["9:16", 9 / 16],
  ] as const;
  const nearest = commonRatios.reduce((best, current) => {
    return Math.abs(current[1] - ratio) < Math.abs(best[1] - ratio) ? current : best;
  }, commonRatios[0]);
  const aspectRatio = explicitAspectRatio ?? nearest[0];
  const longestSide = Math.max(width, height);
  const size = longestSide <= 512
    ? "0.5K"
    : longestSide <= 1024
      ? "1K"
      : longestSide <= 2048
        ? "2K"
        : "4K";
  return { aspectRatio, size };
}

function dataUrlFromB64(input: { b64Json: string; mediaType?: string | null; outputFormat?: string }) {
  const mimeType = readNonEmptyString(input.mediaType)
    ?? (input.outputFormat === "jpeg" ? "image/jpeg" : input.outputFormat === "webp" ? "image/webp" : "image/png");
  return `data:${mimeType};base64,${input.b64Json}`;
}

function collectImageDataUrls(payload: OpenRouterResponse, outputFormat?: string) {
  const data = Array.isArray(payload.data) ? payload.data : [];
  const dataUrls: string[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const b64Json = readNonEmptyString(record.b64_json);
    if (b64Json) {
      dataUrls.push(dataUrlFromB64({
        b64Json,
        mediaType: readNonEmptyString(record.media_type),
        outputFormat,
      }));
      continue;
    }
    const url = readNonEmptyString(record.url);
    if (url?.startsWith("data:image/")) dataUrls.push(url);
  }
  if (dataUrls.length > 0) return dataUrls;

  const choices = Array.isArray(payload.choices) ? payload.choices : [];
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
      if (typeof url === "string" && url.startsWith("data:image/")) dataUrls.push(url);
    }
  }
  return dataUrls;
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
    if (key === "b64_json" && typeof value === "string") {
      return `<base64 omitted: ${value.length} chars>`;
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
  const outputFormat = normalizeOutputFormat(input.params.outputFormat);
  const imageShape = normalizeImageShape(input.params, input.config);
  const shapeSize = model.startsWith("google/gemini-2.5-flash-image")
    ? null
    : imageShape.size;
  return {
    model,
    prompt,
    ...(imageShape.aspectRatio
      ? { aspect_ratio: imageShape.aspectRatio }
      : {}),
    ...(shapeSize
      ? { size: shapeSize }
      : {}),
    ...(outputFormat ? { output_format: outputFormat } : {}),
    n: 1,
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
  const requestedImageCount = resolveRequestedImageCount(input.params, input.config);
  const basePayload = buildPayload(input);
  const endpoint = buildEndpoint(input.config.openrouterBaseUrl ?? DEFAULT_OPENROUTER_BASE_URL);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "X-OpenRouter-Title": readNonEmptyString(input.config.appName) ?? "Paperclip",
  };
  const siteUrl = readNonEmptyString(input.config.siteUrl);
  if (siteUrl) headers["HTTP-Referer"] = siteUrl;

  const returnImageData = input.params.returnImageData !== false;
  const outputFormat = normalizeOutputFormat(input.params.outputFormat) ?? undefined;
  const images: OpenRouterGeneratedImage[] = [];
  const responseBodies: OpenRouterResponse[] = [];
  let providerCostUsd: number | null = null;

  for (let requestIndex = 0; requestIndex < requestedImageCount; requestIndex += 1) {
    const payload = {
      ...basePayload,
      ...(readPositiveNumber(input.params.seed) !== null
        ? { seed: Number(input.params.seed) + requestIndex }
        : {}),
    };
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

    const imageDataUrls = collectImageDataUrls(responseBody, outputFormat);
    if (imageDataUrls.length === 0) {
      throw new Error(`OpenRouter image request returned no image data: ${JSON.stringify(sanitizeProviderResponse(responseBody))}`);
    }

    responseBodies.push(responseBody);
    const responseCost = extractOpenRouterCostUsd(responseBody);
    if (responseCost !== null) {
      providerCostUsd = (providerCostUsd ?? 0) + responseCost;
    }

    for (const [responseImageIndex, dataUrl] of imageDataUrls.entries()) {
      const globalIndex = images.length;
      const { mimeType, bytes } = bytesFromDataUrl(dataUrl);
      images.push({
        index: globalIndex,
        mimeType,
        extension: extensionForMimeType(mimeType, input.params.outputFormat),
        ...(returnImageData ? { dataUrl } : {}),
        bytes,
        source: dataUrl.includes(";base64,")
          ? `openrouter.requests[${requestIndex}].data[${responseImageIndex}].b64_json`
          : `openrouter.requests[${requestIndex}].data[${responseImageIndex}].url`,
      });
    }
  }

  if (images.length === 0) {
    throw new Error("OpenRouter image request returned no image data");
  }

  return {
    content: [
      "OpenRouter image generation completed",
      `Model: ${basePayload.model}`,
      `Images: ${images.length}`,
      `Provider cost: ${providerCostUsd ?? "not reported"}`,
    ].join("\n"),
    data: {
      model: basePayload.model,
      endpoint,
      imageCount: images.length,
      images,
      providerCostUsd,
      response: sanitizeProviderResponse(
        responseBodies.length === 1
          ? responseBodies[0]
          : { requests: responseBodies },
      ),
    },
  };
}
