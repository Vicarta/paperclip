import { definePlugin, runWorker, type ToolResult } from "@paperclipai/plugin-sdk";
import { PLUGIN_ID, TOOL_NAMES } from "./constants.js";
import {
  readConfiguredFlatCostUsd,
  searchSerper,
  type SerperPluginConfig,
  type SerperSearchParams,
} from "./serper-client.js";

async function getConfig(
  ctx: Parameters<NonNullable<Parameters<typeof definePlugin>[0]["setup"]>>[0],
) {
  return (await ctx.config.get()) as SerperPluginConfig;
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
        const result = await searchSerper({
          params: params as SerperSearchParams,
          config,
          resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
          fetchFn: ctx.http.fetch,
        });

        const flatCostUsd = readConfiguredFlatCostUsd(config);
        if (flatCostUsd > 0) {
          await ctx.costs.report({
            companyId: runCtx.companyId,
            agentId: runCtx.agentId,
            projectId: runCtx.projectId,
            provider: "serper.dev",
            model:
              (params as SerperSearchParams).type === "news"
                ? "google/news"
                : "google/search",
            costUsd: flatCostUsd,
            inputTokens: 0,
            outputTokens: 0,
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
