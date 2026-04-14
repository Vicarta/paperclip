import { definePlugin, runWorker, type ToolResult } from "@paperclipai/plugin-sdk";
import {
  DATAFORSEO_COST_BILLING_TYPE,
  DATAFORSEO_COST_MODEL,
  DATAFORSEO_COST_PROVIDER,
  PLUGIN_ID,
  TOOL_NAMES,
} from "./constants.js";
import {
  fetchGoogleAdsSearchVolume,
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

        const costCents = usdToCents(result.actualCostUsd);
        if (costCents > 0) {
          await ctx.costs.createEvent({
            companyId: runCtx.companyId,
            agentId: runCtx.agentId,
            projectId: runCtx.projectId,
            issueId: null,
            goalId: null,
            heartbeatRunId: runCtx.runId,
            billingCode: TOOL_NAMES.googleAdsSearchVolume,
            provider: DATAFORSEO_COST_PROVIDER,
            biller: DATAFORSEO_COST_PROVIDER,
            billingType: DATAFORSEO_COST_BILLING_TYPE,
            model: DATAFORSEO_COST_MODEL,
            inputTokens: 0,
            cachedInputTokens: 0,
            outputTokens: 0,
            costCents,
            occurredAt: new Date().toISOString(),
          });
        }

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
