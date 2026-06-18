import {
  definePlugin,
  runWorker,
  type ToolResult,
  type ToolRunContext,
} from "@paperclipai/plugin-sdk";
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

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

async function allocateCostCents(input: {
  ctx: Parameters<Parameters<typeof definePlugin>[0]["setup"]>[0];
  stateKey: string;
  amountUsd: number;
}) {
  const exactCents = input.amountUsd * 100;
  if (!Number.isFinite(exactCents) || exactCents <= 0) return 0;

  const stateKey = `fractional-cents:${input.stateKey}`;
  const previous = readRecord(await input.ctx.state.get({
    scopeKind: "instance",
    namespace: "cost-accounting",
    stateKey,
  }));
  const previousFractionalCents = readPositiveNumber(previous.fractionalCents);
  const totalCents = previousFractionalCents + exactCents;
  const wholeCents = Math.floor(totalCents + Number.EPSILON);
  const fractionalCents = Math.max(0, totalCents - wholeCents);

  await input.ctx.state.set(
    {
      scopeKind: "instance",
      namespace: "cost-accounting",
      stateKey,
    },
    {
      fractionalCents,
      updatedAt: new Date().toISOString(),
    },
  );

  return wholeCents;
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
  const costCents = await allocateCostCents({
    ctx: input.ctx,
    stateKey: `${TOOL_NAMES.generateImage}:${input.model}`,
    amountUsd,
  });
  if (costCents <= 0) return;

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
        const result = await generateOpenRouterImage({
          params: params as OpenRouterGenerateImageParams,
          config,
          resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
          fetchFn: ctx.http.fetch,
        });
        const data = result.data as {
          model: string;
          providerCostUsd: number | null;
        };

        await emitOpenRouterImageCost({
          ctx,
          runCtx,
          config,
          model: data.model,
          providerCostUsd: data.providerCostUsd,
        });

        return result;
      },
    );
  },

  async onHealth() {
    return { status: "ok", message: `${PLUGIN_ID} ready` };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
