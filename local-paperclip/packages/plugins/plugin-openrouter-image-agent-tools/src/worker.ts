import {
  definePlugin,
  runWorker,
  type ToolResult,
  type ToolRunContext,
} from "@paperclipai/plugin-sdk";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  OPENROUTER_COST_BILLING_TYPE,
  OPENROUTER_COST_PROVIDER,
  PLUGIN_ID,
  TOOL_NAMES,
} from "./constants.js";
import {
  generateOpenRouterImage,
  type OpenRouterGenerateImageParams,
  type OpenRouterImagePluginConfig,
} from "./openrouter-image-client.js";

async function getConfig(
  ctx: Parameters<NonNullable<Parameters<typeof definePlugin>[0]["setup"]>>[0],
) {
  return (await ctx.config.get()) as OpenRouterImagePluginConfig;
}

function readPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function usdToCost(amountUsd: number) {
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    return { costCents: 0, amountMicros: 0 };
  }
  return {
    costCents: Math.max(0, Math.round(amountUsd * 100)),
    amountMicros: Math.max(0, Math.round(amountUsd * 1_000_000)),
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function readRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function slugPart(value: unknown, fallback: string) {
  return (readNonEmptyString(value) ?? fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || fallback;
}

function parseDataUrl(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return null;
  return {
    mimeType: match[1].toLowerCase(),
    bytes: Buffer.from(match[2].replace(/\s+/g, ""), "base64"),
  };
}

function extensionForMimeType(mimeType: string, fallback?: string) {
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  return fallback === "jpg" || fallback === "jpeg" || fallback === "webp" || fallback === "png"
    ? fallback.replace("jpeg", "jpg")
    : "png";
}

function resolveOutputDir(input: {
  config: OpenRouterImagePluginConfig;
  params: Record<string, unknown>;
  runCtx: ToolRunContext;
}) {
  const explicitOutputDir = readNonEmptyString(input.params.outputDir);
  if (explicitOutputDir && path.isAbsolute(explicitOutputDir)) return explicitOutputDir;

  const workspaceCwd = readNonEmptyString(input.runCtx.executionWorkspaceCwd);
  if (workspaceCwd) {
    const relative = explicitOutputDir ?? "work/generated-images";
    const base = path.resolve(workspaceCwd);
    const resolved = path.resolve(base, relative);
    if (resolved !== base && !resolved.startsWith(`${base}${path.sep}`)) {
      throw new Error("OpenRouter image outputDir must stay within the execution workspace");
    }
    return resolved;
  }

  const configuredOutputDir = readNonEmptyString(input.config.defaultOutputDir);
  if (configuredOutputDir) return configuredOutputDir;
  return null;
}

async function writeGeneratedImageFiles(input: {
  config: OpenRouterImagePluginConfig;
  params: Record<string, unknown>;
  runCtx: ToolRunContext;
  data: Record<string, unknown>;
}) {
  const outputDir = resolveOutputDir(input);
  if (!outputDir) return [];

  const images = Array.isArray(input.data.images) ? input.data.images : [];
  const metadata = readRecord(input.params.metadata);
  const issueSlug = slugPart(metadata.issueIdentifier ?? input.runCtx.issueId, "image");
  const format = readNonEmptyString(input.params.outputFormat) ?? undefined;
  await fs.mkdir(outputDir, { recursive: true });

  const workspaceFiles: Array<{
    index: number;
    path: string;
    mimeType: string;
    extension: string;
    bytes: number;
  }> = [];
  for (const image of images) {
    if (!image || typeof image !== "object") continue;
    const record = image as Record<string, unknown>;
    const parsed = parseDataUrl(record.dataUrl);
    if (!parsed) continue;
    const index = typeof record.index === "number" ? record.index : workspaceFiles.length;
    const extension = extensionForMimeType(parsed.mimeType, format);
    const filename = `openrouter-${issueSlug}-${String(index + 1).padStart(2, "0")}.${extension}`;
    const filePath = path.join(outputDir, filename);
    await fs.writeFile(filePath, parsed.bytes);
    workspaceFiles.push({
      index,
      path: filePath,
      mimeType: parsed.mimeType,
      extension,
      bytes: parsed.bytes.length,
    });
  }
  return workspaceFiles;
}

function stripImageDataUrls(result: ToolResult) {
  if (!result.data || typeof result.data !== "object") return result;
  const data = result.data as Record<string, unknown>;
  const images = Array.isArray(data.images)
    ? data.images.map((image) => {
      if (!image || typeof image !== "object") return image;
      const { dataUrl: _dataUrl, ...rest } = image as Record<string, unknown>;
      return rest;
    })
    : data.images;
  return {
    ...result,
    data: {
      ...data,
      images,
    },
  };
}

async function emitOpenRouterImageCost(input: {
  ctx: Parameters<Parameters<typeof definePlugin>[0]["setup"]>[0];
  runCtx: ToolRunContext;
  config: OpenRouterImagePluginConfig;
  model: string;
  providerCostUsd: number | null;
}) {
  if (input.config.costAccountingMode === "disabled") return;

  const exactProviderCost = input.config.costAccountingMode !== "estimated_per_image"
    ? input.providerCostUsd
    : null;
  const amountUsd = exactProviderCost ?? readPositiveNumber(input.config.estimatedImageCostUsd);
  const { costCents, amountMicros } = usdToCost(amountUsd);
  if (amountMicros <= 0) return;

  await input.ctx.costs.createEvent({
    companyId: input.runCtx.companyId,
    agentId: input.runCtx.agentId,
    projectId: input.runCtx.projectId,
    issueId: null,
    goalId: null,
    heartbeatRunId: input.runCtx.runId,
    billingCode: `openrouter:${TOOL_NAMES.generateImage}`,
    provider: OPENROUTER_COST_PROVIDER,
    biller: OPENROUTER_COST_PROVIDER,
    billingType: OPENROUTER_COST_BILLING_TYPE,
    model: input.model,
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    costCents,
    amountMicros,
    occurredAt: new Date().toISOString(),
  });
}

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info(`${PLUGIN_ID} plugin setup complete`);

    ctx.tools.register(
      TOOL_NAMES.generateImage,
      {
        displayName: "OpenRouter Generate Image",
        description:
          "Generate an image through OpenRouter and write image-provider spend to Paperclip cost_events.",
        parametersSchema: {
          type: "object",
          properties: {
            prompt: { type: "string" },
            model: { type: "string" },
            aspectRatio: { type: "string" },
            imageSize: { type: "string" },
            size: { type: "string" },
            resolution: { type: "string" },
            candidateCount: { type: "number" },
            n: { type: "number" },
            outputDir: { type: "string" },
            outputFormat: { type: "string", enum: ["png", "jpg", "jpeg", "webp"] },
            temperature: { type: "number" },
            topP: { type: "number" },
            seed: { type: "number" },
            metadata: { type: "object" },
            returnImageData: { type: "boolean" },
          },
          required: ["prompt"],
        },
      },
      async (params, runCtx): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        const originalParams = readRecord(params);
        const result = await generateOpenRouterImage({
          params: {
            ...(params as OpenRouterGenerateImageParams),
            returnImageData: true,
          },
          config,
          resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
          fetchFn: ctx.http.fetch,
        });
        const data = result.data as {
          model: string;
          providerCostUsd: number | null;
        } & Record<string, unknown>;

        const workspaceFiles = await writeGeneratedImageFiles({
          config,
          params: originalParams,
          runCtx,
          data,
        });
        data.workspaceFiles = workspaceFiles;

        let costAccountingWarning: string | null = null;
        try {
          await emitOpenRouterImageCost({
            ctx,
            runCtx,
            config,
            model: data.model,
            providerCostUsd: data.providerCostUsd,
          });
        } catch (error) {
          costAccountingWarning = `OpenRouter image cost accounting failed: ${errorMessage(error)}`;
          ctx.logger.warn(costAccountingWarning);
        }

        const resultWithoutImageData = originalParams.returnImageData === false
          ? stripImageDataUrls(result)
          : result;
        if (!costAccountingWarning) return resultWithoutImageData;

        return {
          ...resultWithoutImageData,
          content: `${resultWithoutImageData.content}\nCost accounting warning: ${costAccountingWarning}`,
          data: {
            ...(resultWithoutImageData.data && typeof resultWithoutImageData.data === "object" ? resultWithoutImageData.data : {}),
            costAccountingWarning,
          },
        };
      },
    );
  },

  async onHealth() {
    return { status: "ok", message: `${PLUGIN_ID} ready` };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
