import { definePlugin, runWorker, type ToolResult } from "@paperclipai/plugin-sdk";
import {
  DATAFORSEO_COST_BILLING_TYPE,
  DATAFORSEO_COST_MODELS,
  DATAFORSEO_COST_PROVIDER,
  PLUGIN_ID,
  TOOL_NAMES,
} from "./constants.js";
import {
  fetchGoogleAdsKeywordsForKeywords,
  fetchGoogleAdsSearchVolume,
  type DataForSeoKeywordsForKeywordsParams,
  type DataForSeoPluginConfig,
  type DataForSeoSearchVolumeParams,
} from "./dataforseo-client.js";

async function getConfig(
  ctx: Parameters<NonNullable<Parameters<typeof definePlugin>[0]["setup"]>>[0],
) {
  return (await ctx.config.get()) as DataForSeoPluginConfig;
}

function usdToCents(amountUsd: number) {
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) return 0;
  return Math.max(0, Math.round(amountUsd * 100));
}

async function emitDataForSeoCost(input: {
  ctx: Parameters<Parameters<typeof definePlugin>[0]["setup"]>[0];
  runCtx: Parameters<Parameters<Parameters<typeof definePlugin>[0]["setup"]>[0]["tools"]["register"]>[2] extends (
    params: unknown,
    runCtx: infer RunCtx,
  ) => unknown
    ? RunCtx
    : never;
  costUsd: number;
  billingCode: string;
  model: string;
}) {
  const costCents = usdToCents(input.costUsd);
  if (costCents <= 0) return;

  await input.ctx.costs.createEvent({
    companyId: input.runCtx.companyId,
    agentId: input.runCtx.agentId,
    projectId: input.runCtx.projectId,
    issueId: null,
    goalId: null,
    heartbeatRunId: input.runCtx.runId,
    billingCode: input.billingCode,
    provider: DATAFORSEO_COST_PROVIDER,
    biller: DATAFORSEO_COST_PROVIDER,
    billingType: DATAFORSEO_COST_BILLING_TYPE,
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
      TOOL_NAMES.googleAdsSearchVolume,
      {
        displayName: "DataForSEO Google Ads Search Volume",
        description:
          "Retrieve keyword demand metrics from DataForSEO Google Ads data.",
        parametersSchema: {
          type: "object",
          properties: {
            keywords: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
              maxItems: 1000,
            },
            location_name: { type: "string" },
            language_name: { type: "string" },
            location_code: { type: "number" },
            language_code: { type: "string" },
            search_partners: { type: "boolean" },
          },
          required: ["keywords"],
        },
      },
      async (params, runCtx): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        const result = await fetchGoogleAdsSearchVolume({
          params: params as DataForSeoSearchVolumeParams,
          config,
          resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
          fetchFn: ctx.http.fetch,
        });

        await emitDataForSeoCost({
          ctx,
          runCtx,
          costUsd: result.actualCostUsd,
          billingCode: TOOL_NAMES.googleAdsSearchVolume,
          model: DATAFORSEO_COST_MODELS.googleAdsSearchVolume,
        });

        return {
          content: result.content,
          data: result.data,
        };
      },
    );

    ctx.tools.register(
      TOOL_NAMES.googleAdsKeywordsForKeywords,
      {
        displayName: "DataForSEO Google Ads Keywords For Keywords",
        description:
          "Expand seed keywords into Google Ads keyword ideas with search volume, CPC, and competition.",
        parametersSchema: {
          type: "object",
          properties: {
            keywords: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
              maxItems: 20,
            },
            location_name: { type: "string" },
            language_name: { type: "string" },
            location_code: { type: "number" },
            language_code: { type: "string" },
            search_partners: { type: "boolean" },
            sort_by: {
              type: "string",
              enum: [
                "relevance",
                "search_volume",
                "competition_index",
                "low_top_of_page_bid",
                "high_top_of_page_bid",
              ],
            },
            include_adult_keywords: { type: "boolean" },
            date_from: { type: "string" },
            date_to: { type: "string" },
          },
          required: ["keywords"],
        },
      },
      async (params, runCtx): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        const result = await fetchGoogleAdsKeywordsForKeywords({
          params: params as DataForSeoKeywordsForKeywordsParams,
          config,
          resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
          fetchFn: ctx.http.fetch,
        });

        await emitDataForSeoCost({
          ctx,
          runCtx,
          costUsd: result.actualCostUsd,
          billingCode: TOOL_NAMES.googleAdsKeywordsForKeywords,
          model: DATAFORSEO_COST_MODELS.googleAdsKeywordsForKeywords,
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
