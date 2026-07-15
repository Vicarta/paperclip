import {
  DEFAULT_OPENROUTER_BASE_URL,
  DEFAULT_OPENROUTER_IMAGE_MODEL,
  DEFAULT_TARGET_DIMENSION_TOLERANCE_PERCENT,
} from "./constants.js";

export type OpenRouterImagePluginConfig = {
  openrouterApiKeySecretRef?: string;
  openrouterBaseUrl?: string;
  defaultModel?: string;
  allowModelOverride?: boolean;
  maxImagesPerRequest?: number;
  defaultImageSize?: string;
  defaultAspectRatio?: string;
  targetDimensionTolerancePercent?: number;
  defaultOutputDir?: string;
  costAccountingMode?: "provider_reported" | "estimated_per_image" | "disabled";
  estimatedImageCostUsd?: number;
  appName?: string;
  siteUrl?: string;
  structuredArtDirectionMode?: "optional" | "required_for_human_scene";
  visualHistoryLimit?: number;
  minimumDistinctVisualAxes?: number;
  legacyAvoidVisualPatterns?: string[];
  requireSubjectMode?: boolean;
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
  subjectMode?: "human_scene" | "abstract_graphic";
  artDirection?: Record<string, unknown>;
};

export type OpenRouterGeneratedImage = {
  index: number;
  mimeType: string;
  extension: string;
  dataUrl?: string;
  bytes: number | null;
  source: string;
  targetDimensions: ImageDimensions | null;
  actualDimensions: ImageDimensions | null;
  dimensionDeviationPercent: ImageDimensions | null;
  targetDimensionTolerancePercent: number;
  acceptedWithinTolerance: boolean | null;
};

export type ImageDimensions = {
  width: number;
  height: number;
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

function readPngDimensions(bytes: Buffer): ImageDimensions | null {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (
    bytes.length < 24
    || !bytes.subarray(0, signature.length).equals(signature)
    || bytes.toString("ascii", 12, 16) !== "IHDR"
  ) {
    return null;
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  return width > 0 && height > 0 ? { width, height } : null;
}

const JPEG_START_OF_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3,
  0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb,
  0xcd, 0xce, 0xcf,
]);

function readJpegDimensions(bytes: Buffer): ImageDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let offset = 2;
  while (offset < bytes.length) {
    while (offset < bytes.length && bytes[offset] !== 0xff) offset += 1;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) return null;

    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    if (offset + 2 > bytes.length) return null;

    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    if (JPEG_START_OF_FRAME_MARKERS.has(marker)) {
      if (segmentLength < 7) return null;
      const height = bytes.readUInt16BE(offset + 3);
      const width = bytes.readUInt16BE(offset + 5);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    offset += segmentLength;
  }
  return null;
}

function readUInt24LE(bytes: Buffer, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readWebpDimensions(bytes: Buffer): ImageDimensions | null {
  if (
    bytes.length < 30
    || bytes.toString("ascii", 0, 4) !== "RIFF"
    || bytes.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return null;
  }

  const chunkType = bytes.toString("ascii", 12, 16);
  if (chunkType === "VP8X") {
    return {
      width: readUInt24LE(bytes, 24) + 1,
      height: readUInt24LE(bytes, 27) + 1,
    };
  }
  if (chunkType === "VP8L" && bytes[20] === 0x2f) {
    return {
      width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
      height: 1 + ((bytes[22] & 0xc0) >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10),
    };
  }
  if (
    chunkType === "VP8 "
    && bytes[23] === 0x9d
    && bytes[24] === 0x01
    && bytes[25] === 0x2a
  ) {
    return {
      width: bytes.readUInt16LE(26) & 0x3fff,
      height: bytes.readUInt16LE(28) & 0x3fff,
    };
  }
  return null;
}

function readImageDimensions(bytes: Buffer, mimeType: string) {
  const declaredFormatDimensions = mimeType === "image/png"
    ? readPngDimensions(bytes)
    : mimeType === "image/jpeg"
      ? readJpegDimensions(bytes)
      : mimeType === "image/webp"
        ? readWebpDimensions(bytes)
        : null;
  return declaredFormatDimensions
    ?? readPngDimensions(bytes)
    ?? readJpegDimensions(bytes)
    ?? readWebpDimensions(bytes);
}

function inspectDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return { mimeType: "image/png", bytes: null, dimensions: null };
  const decoded = Buffer.from(match[2].replace(/\s+/g, ""), "base64");
  const mimeType = match[1].toLowerCase();
  return {
    mimeType,
    bytes: decoded.length,
    dimensions: readImageDimensions(decoded, mimeType),
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

function parsePixelDimensions(value: unknown): ImageDimensions | null {
  const match = readNonEmptyString(value)?.match(/^(\d{3,5})\s*x\s*(\d{3,5})$/i);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width > 0 && height > 0 ? { width, height } : null;
}

function resolveTargetDimensions(
  params: OpenRouterGenerateImageParams,
  config: OpenRouterImagePluginConfig,
) {
  const requestedSize = readNonEmptyString(params.imageSize)
    ?? readNonEmptyString(params.size)
    ?? readNonEmptyString(params.resolution)
    ?? readNonEmptyString(config.defaultImageSize);
  return parsePixelDimensions(requestedSize);
}

function resolveTargetDimensionTolerancePercent(config: OpenRouterImagePluginConfig) {
  const value = config.targetDimensionTolerancePercent;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : DEFAULT_TARGET_DIMENSION_TOLERANCE_PERCENT;
}

function assessDimensions(input: {
  targetDimensions: ImageDimensions | null;
  actualDimensions: ImageDimensions | null;
  tolerancePercent: number;
}) {
  if (!input.targetDimensions || !input.actualDimensions) {
    return {
      dimensionDeviationPercent: null,
      acceptedWithinTolerance: null,
    };
  }
  const width = Math.abs(input.actualDimensions.width - input.targetDimensions.width)
    / input.targetDimensions.width * 100;
  const height = Math.abs(input.actualDimensions.height - input.targetDimensions.height)
    / input.targetDimensions.height * 100;
  return {
    dimensionDeviationPercent: { width, height },
    acceptedWithinTolerance: width <= input.tolerancePercent && height <= input.tolerancePercent,
  };
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
  const targetDimensions = resolveTargetDimensions(input.params, input.config);
  const targetDimensionTolerancePercent = resolveTargetDimensionTolerancePercent(input.config);
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
      const { mimeType, bytes, dimensions: actualDimensions } = inspectDataUrl(dataUrl);
      const dimensionAssessment = assessDimensions({
        targetDimensions,
        actualDimensions,
        tolerancePercent: targetDimensionTolerancePercent,
      });
      images.push({
        index: globalIndex,
        mimeType,
        extension: extensionForMimeType(mimeType, input.params.outputFormat),
        ...(returnImageData ? { dataUrl } : {}),
        bytes,
        source: dataUrl.includes(";base64,")
          ? `openrouter.requests[${requestIndex}].data[${responseImageIndex}].b64_json`
          : `openrouter.requests[${requestIndex}].data[${responseImageIndex}].url`,
        targetDimensions,
        actualDimensions,
        ...dimensionAssessment,
        targetDimensionTolerancePercent,
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
      targetDimensions,
      targetDimensionTolerancePercent,
      acceptedWithinTolerance: targetDimensions
        ? images.some((image) => image.acceptedWithinTolerance === true)
        : null,
      providerCostUsd,
      response: sanitizeProviderResponse(
        responseBodies.length === 1
          ? responseBodies[0]
          : { requests: responseBodies },
      ),
    },
  };
}
