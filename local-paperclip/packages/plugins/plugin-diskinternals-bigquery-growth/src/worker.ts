import { definePlugin, runWorker, type ToolResult } from "@paperclipai/plugin-sdk";
import { normalizeConfig, type BigQueryGrowthPluginConfig } from "./config.js";
import { PLUGIN_ID, TOOL_NAMES, type ToolName } from "./constants.js";
import { executeBigQueryGrowthTool } from "./tools.js";

type PluginSetupContext = Parameters<
  NonNullable<Parameters<typeof definePlugin>[0]["setup"]>
>[0];

const looseObjectSchema = {
  type: "object",
  additionalProperties: true,
} as const;

async function getConfig(ctx: PluginSetupContext) {
  return normalizeConfig((await ctx.config.get()) as BigQueryGrowthPluginConfig);
}

const toolDescriptions: Record<ToolName, string> = {
  [TOOL_NAMES.getSchemaStatus]: "Check configured BigQuery growth schema/views.",
  [TOOL_NAMES.syncSitemapSnapshot]: "Parse a sitemap snapshot for DiskInternals URL inventory ingestion.",
  [TOOL_NAMES.getSiteUrlInventory]: "Get canonical URL inventory rows.",
  [TOOL_NAMES.normalizeUrlInventory]: "Normalize one URL using DiskInternals URL identity rules.",
  [TOOL_NAMES.scheduleCrawlBatch]: "Prepare a bounded rate-limited crawl batch.",
  [TOOL_NAMES.getCrawlJobStatus]: "Get crawl job status summary.",
  [TOOL_NAMES.getProductFunnelMetrics]: "Get product-level GA4 funnel metrics from BigQuery.",
  [TOOL_NAMES.getGscUrlQueryOpportunities]: "Get GSC URL/query opportunities from BigQuery.",
  [TOOL_NAMES.getUrlGrowthOpportunityQueue]: "Get scored URL growth opportunities.",
  [TOOL_NAMES.getProductPriorityScores]: "Get product priority scores.",
  [TOOL_NAMES.getCroExperimentCandidates]: "Get CRO experiment candidates.",
  [TOOL_NAMES.getLocalizationCandidates]: "Get localization experiment candidates.",
  [TOOL_NAMES.getInternalLinkCandidates]: "Get internal-link candidates.",
  [TOOL_NAMES.getIndexingCandidates]: "Get manual indexing candidates.",
  [TOOL_NAMES.recordOpportunityDecision]: "Record a Growth Opportunity Strategist decision.",
  [TOOL_NAMES.recordExperimentDecision]: "Record an experiment decision.",
  [TOOL_NAMES.getPostChangeFollowup]: "Get 7/14/28 day post-change follow-up metrics.",
  [TOOL_NAMES.getQueryCostSummary]: "Dry-run a representative report query and return cost metadata.",
};

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info(`${PLUGIN_ID} plugin setup complete`);

    for (const toolName of Object.values(TOOL_NAMES)) {
      ctx.tools.register(
        toolName,
        {
          displayName: toolName.split("-").map((part) =>
            part ? part[0]!.toUpperCase() + part.slice(1) : part,
          ).join(" "),
          description: toolDescriptions[toolName],
          parametersSchema: looseObjectSchema,
        },
        async (params): Promise<ToolResult> =>
          await executeBigQueryGrowthTool({
            deps: {
              config: await getConfig(ctx),
              resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
              fetchFn: ctx.http.fetch as typeof fetch,
            },
            toolName,
            params,
          }),
      );
    }

    ctx.jobs.register("crawl-due-items", async () => {
      ctx.logger.info("crawl-due-items job tick; crawl execution is controlled by scheduled crawl batch tools");
    });
  },

  async onHealth() {
    return { status: "ok", message: `${PLUGIN_ID} ready` };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
