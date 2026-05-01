import { definePlugin, runWorker, type ToolResult } from "@paperclipai/plugin-sdk";
import {
  PLUGIN_ID,
  TOOL_NAMES,
  type VerifiedMcpToolName,
} from "./constants.js";
import {
  callGscBingGa4McpTool,
  listGscBingGa4McpTools,
  type GscBingGa4McpPluginConfig,
} from "./gsc-bing-ga4-mcp-client.js";

type PluginSetupContext = Parameters<
  NonNullable<Parameters<typeof definePlugin>[0]["setup"]>
>[0];

type GenericCallParams = {
  toolName?: string;
  arguments?: unknown;
};

const wrapperToolMap: Array<{
  paperclipToolName: (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];
  mcpToolName: VerifiedMcpToolName;
  displayName: string;
  description: string;
}> = [
  {
    paperclipToolName: TOOL_NAMES.sitesList,
    mcpToolName: "sites_list",
    displayName: "GSC Sites List",
    description: "List sites visible to the configured MCP tenant.",
  },
  {
    paperclipToolName: TOOL_NAMES.analyticsTopQueries,
    mcpToolName: "analytics_top_queries",
    displayName: "GSC Analytics Top Queries",
    description: "Get top queries for the configured allowed GSC site.",
  },
  {
    paperclipToolName: TOOL_NAMES.analyticsQuery,
    mcpToolName: "analytics_query",
    displayName: "GSC Analytics Query",
    description: "Run a GSC analytics query for the configured allowed site.",
  },
  {
    paperclipToolName: TOOL_NAMES.seoLowCtrOpportunities,
    mcpToolName: "seo_low_ctr_opportunities",
    displayName: "GSC Low CTR Opportunities",
    description: "Find low CTR GSC opportunities for the configured allowed site.",
  },
  {
    paperclipToolName: TOOL_NAMES.inspectionInspect,
    mcpToolName: "inspection_inspect",
    displayName: "GSC URL Inspection",
    description: "Inspect an indexed URL through GSC for the configured allowed site.",
  },
  {
    paperclipToolName: TOOL_NAMES.sitemapsList,
    mcpToolName: "sitemaps_list",
    displayName: "GSC Sitemaps List",
    description: "List sitemaps for the configured allowed GSC site.",
  },
  {
    paperclipToolName: TOOL_NAMES.pagespeedAnalyze,
    mcpToolName: "pagespeed_analyze",
    displayName: "PageSpeed Analyze",
    description: "Run PageSpeed analysis through the configured MCP server.",
  },
];

async function getConfig(ctx: PluginSetupContext) {
  return (await ctx.config.get()) as GscBingGa4McpPluginConfig;
}

function readObjectParams(params: unknown) {
  return params && typeof params === "object" && !Array.isArray(params)
    ? params as Record<string, unknown>
    : {};
}

async function callMcpTool(input: {
  ctx: PluginSetupContext;
  toolName: string;
  args?: unknown;
}): Promise<ToolResult> {
  const config = await getConfig(input.ctx);
  const result = await callGscBingGa4McpTool({
    toolName: input.toolName,
    args: input.args,
    config,
    resolveSecret: (secretRef) => input.ctx.secrets.resolve(secretRef),
    fetchFn: input.ctx.http.fetch as typeof fetch,
  });

  return {
    content: result.content,
    data: result.data,
  };
}

const looseObjectSchema = {
  type: "object",
  additionalProperties: true,
} as const;

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info(`${PLUGIN_ID} plugin setup complete`);

    ctx.tools.register(
      TOOL_NAMES.listTools,
      {
        displayName: "GSC Bing GA4 MCP List Tools",
        description: "List backend-allowlisted tools exposed by the private GSC/Bing/GA4 MCP server.",
        parametersSchema: looseObjectSchema,
      },
      async (): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        const result = await listGscBingGa4McpTools({
          config,
          resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
          fetchFn: ctx.http.fetch as typeof fetch,
        });
        return {
          content: result.content,
          data: result.data,
        };
      },
    );

    ctx.tools.register(
      TOOL_NAMES.callTool,
      {
        displayName: "GSC Bing GA4 MCP Call Tool",
        description:
          "Call one backend-allowlisted GSC/Bing/GA4 MCP tool. Endpoint and bearer token are injected by the plugin backend.",
        parametersSchema: {
          type: "object",
          properties: {
            toolName: { type: "string" },
            arguments: looseObjectSchema,
          },
          required: ["toolName"],
        },
      },
      async (params): Promise<ToolResult> => {
        const typed = readObjectParams(params) as GenericCallParams;
        if (typeof typed.toolName !== "string" || typed.toolName.trim().length === 0) {
          throw new Error("GSC/Bing/GA4 MCP toolName is required");
        }
        return await callMcpTool({
          ctx,
          toolName: typed.toolName,
          args: typed.arguments,
        });
      },
    );

    for (const tool of wrapperToolMap) {
      ctx.tools.register(
        tool.paperclipToolName,
        {
          displayName: tool.displayName,
          description: tool.description,
          parametersSchema: looseObjectSchema,
        },
        async (params): Promise<ToolResult> =>
          await callMcpTool({
            ctx,
            toolName: tool.mcpToolName,
            args: params,
          }),
      );
    }
  },

  async onHealth() {
    return { status: "ok", message: `${PLUGIN_ID} ready` };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
