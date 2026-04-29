import { definePlugin, runWorker, type ToolResult } from "@paperclipai/plugin-sdk";
import {
  PLUGIN_ID,
  TOOL_NAMES,
  type SearchConsoleMcpToolName,
} from "./constants.js";
import {
  callSearchConsoleMcpTool,
  listSearchConsoleMcpTools,
  type SearchConsoleMcpPluginConfig,
} from "./search-console-mcp-client.js";

type PluginSetupContext = Parameters<
  NonNullable<Parameters<typeof definePlugin>[0]["setup"]>
>[0];

type GenericCallParams = {
  toolName?: string;
  arguments?: unknown;
};

const wrapperToolMap: Array<{
  paperclipToolName: (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];
  mcpToolName: SearchConsoleMcpToolName;
  displayName: string;
  description: string;
}> = [
  {
    paperclipToolName: TOOL_NAMES.sitesList,
    mcpToolName: "sites_list",
    displayName: "GSC Sites List",
    description: "List sites visible to the configured Search Console MCP tenant.",
  },
  {
    paperclipToolName: TOOL_NAMES.analyticsTopQueries,
    mcpToolName: "analytics_top_queries",
    displayName: "GSC Analytics Top Queries",
    description: "Get top queries for the configured allowed Search Console site.",
  },
  {
    paperclipToolName: TOOL_NAMES.analyticsQuery,
    mcpToolName: "analytics_query",
    displayName: "GSC Analytics Query",
    description: "Run a Search Console analytics query for the configured allowed site.",
  },
  {
    paperclipToolName: TOOL_NAMES.seoLowCtrOpportunities,
    mcpToolName: "seo_low_ctr_opportunities",
    displayName: "GSC Low CTR Opportunities",
    description: "Find low CTR Search Console opportunities for the configured allowed site.",
  },
  {
    paperclipToolName: TOOL_NAMES.inspectionInspect,
    mcpToolName: "inspection_inspect",
    displayName: "GSC URL Inspection",
    description: "Inspect an indexed URL through Search Console for the configured allowed site.",
  },
  {
    paperclipToolName: TOOL_NAMES.sitemapsList,
    mcpToolName: "sitemaps_list",
    displayName: "GSC Sitemaps List",
    description: "List sitemaps for the configured allowed Search Console site.",
  },
  {
    paperclipToolName: TOOL_NAMES.pagespeedAnalyze,
    mcpToolName: "pagespeed_analyze",
    displayName: "PageSpeed Analyze",
    description: "Run PageSpeed analysis through the configured MCP server.",
  },
];

async function getConfig(ctx: PluginSetupContext) {
  return (await ctx.config.get()) as SearchConsoleMcpPluginConfig;
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
  const result = await callSearchConsoleMcpTool({
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
        displayName: "Search Console MCP List Tools",
        description: "List allowlisted tools exposed by the private Search Console MCP server.",
        parametersSchema: looseObjectSchema,
      },
      async (): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        const result = await listSearchConsoleMcpTools({
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
        displayName: "Search Console MCP Call Tool",
        description:
          "Call one allowlisted Search Console MCP tool. Endpoint and bearer token are injected by the plugin backend.",
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
          throw new Error("Search Console MCP toolName is required");
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
