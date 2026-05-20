import {
  definePlugin,
  runWorker,
  type ToolResult,
  type ToolRunContext,
} from "@paperclipai/plugin-sdk";
import {
  PLUGIN_ID,
  SERPER_COST_BILLING_TYPE,
  SERPER_COST_PROVIDER,
  TOOL_NAMES,
} from "./constants.js";
import {
  searchSerper,
  type SerperPluginConfig,
  type SerperSearchParams,
} from "./serper-client.js";

async function getConfig(
  ctx: Parameters<NonNullable<Parameters<typeof definePlugin>[0]["setup"]>>[0],
) {
  return (await ctx.config.get()) as SerperPluginConfig;
}

function usdToCents(amountUsd: unknown) {
  if (typeof amountUsd !== "number" || !Number.isFinite(amountUsd) || amountUsd <= 0) {
    return 0;
  }
  return Math.max(0, Math.round(amountUsd * 100));
}

function resolveEstimatedCostCents(config: SerperPluginConfig, params: SerperSearchParams) {
  if (config.costAccountingMode !== "estimated_per_request") return 0;
  const type = params.type === "news" ? "news" : "search";
  return usdToCents(
    type === "news"
      ? config.estimatedNewsCostUsd
      : config.estimatedSearchCostUsd,
  );
}

async function emitSerperCost(input: {
  ctx: Parameters<Parameters<typeof definePlugin>[0]["setup"]>[0];
  runCtx: ToolRunContext;
  config: SerperPluginConfig;
  params: SerperSearchParams;
}) {
  const costCents = resolveEstimatedCostCents(input.config, input.params);
  if (costCents <= 0) return;

  const type = input.params.type === "news" ? "news" : "search";
  await input.ctx.costs.createEvent({
    companyId: input.runCtx.companyId,
    agentId: input.runCtx.agentId,
    projectId: input.runCtx.projectId,
    issueId: null,
    goalId: null,
    heartbeatRunId: input.runCtx.runId,
    billingCode: `serper:${TOOL_NAMES.googleSearch}:${type}`,
    provider: SERPER_COST_PROVIDER,
    biller: SERPER_COST_PROVIDER,
    billingType: SERPER_COST_BILLING_TYPE,
    model: `google_${type}`,
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
      TOOL_NAMES.googleSearch,
      {
        displayName: "Serper Google Search",
        description: "Query Google SERP results through Serper.dev.",
        parametersSchema: {
          type: "object",
          properties: {
            q: { type: "string" },
            gl: { type: "string" },
            hl: { type: "string" },
            num: { type: "number" },
            page: { type: "number" },
            autocorrect: { type: "boolean" },
            type: { type: "string", enum: ["search", "news"] },
          },
          required: ["q"],
        },
      },
      async (params, runCtx): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        const searchParams = params as SerperSearchParams;
        const result = await searchSerper({
          params: searchParams,
          config,
          resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
          fetchFn: ctx.http.fetch,
        });

        await emitSerperCost({
          ctx,
          runCtx,
          config,
          params: searchParams,
        });

        return {
          content: result.content,
          data: result.data,
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
