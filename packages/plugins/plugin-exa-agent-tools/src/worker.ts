import { definePlugin, runWorker, type ToolResult } from "@paperclipai/plugin-sdk";
import { callExaMcpTool, type ExaPluginConfig } from "./exa-mcp-client.js";
import { EXA_MCP_TOOLS, PLUGIN_ID, TOOL_NAMES } from "./constants.js";

async function getConfig(ctx: Parameters<NonNullable<Parameters<typeof definePlugin>[0]["setup"]>>[0]) {
  return await ctx.config.get() as ExaPluginConfig;
}

function normalizeCrawlArgs(params: Record<string, unknown>) {
  const next = { ...params };
  const url =
    typeof next.url === "string" && next.url.trim().length > 0
      ? next.url.trim()
      : null;
  const urls = Array.isArray(next.urls)
    ? next.urls.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];

  if (urls.length === 0 && url) {
    next.urls = [url];
  } else if (urls.length > 0) {
    next.urls = urls;
  }

  delete next.url;
  return next;
}

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info(`${PLUGIN_ID} plugin setup complete`);

    ctx.tools.register(
      TOOL_NAMES.webSearch,
      {
        displayName: "Exa Web Search",
        description: "Search the web with Exa and return compact, LLM-ready context.",
        parametersSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            numResults: { type: "number" },
            livecrawl: { type: "string", enum: ["fallback", "preferred"] },
            type: { type: "string", enum: ["auto", "fast"] },
            category: { type: "string" },
            contextMaxCharacters: { type: "number" },
          },
          required: ["query"],
        },
      },
      async (params): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        const result = await callExaMcpTool({
          toolName: EXA_MCP_TOOLS.webSearch,
          args: params as Record<string, unknown>,
          config,
          resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
        });
        return result.isError ? { error: result.content || "Exa web search failed" } : { content: result.content, data: result.data };
      },
    );

    ctx.tools.register(
      TOOL_NAMES.crawlUrl,
      {
        displayName: "Exa Crawl URL",
        description: "Fetch and extract the content of a known webpage URL with Exa.",
        parametersSchema: {
          type: "object",
          properties: {
            url: { type: "string" },
            urls: {
              type: "array",
              items: { type: "string" },
            },
            subpages: { type: "number" },
            text: { type: "boolean" },
            livecrawl: { type: "string", enum: ["fallback", "preferred"] },
          },
          anyOf: [
            { required: ["url"] },
            { required: ["urls"] },
          ],
        },
      },
      async (params): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        const result = await callExaMcpTool({
          toolName: EXA_MCP_TOOLS.crawling,
          args: normalizeCrawlArgs(params as Record<string, unknown>),
          config,
          resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
        });
        return result.isError ? { error: result.content || "Exa crawl failed" } : { content: result.content, data: result.data };
      },
    );

    ctx.tools.register(
      TOOL_NAMES.codeContext,
      {
        displayName: "Exa Code Context",
        description: "Find code examples, official docs, and implementation references with Exa.",
        parametersSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            tokensNum: { type: "number" },
          },
          required: ["query"],
        },
      },
      async (params): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        const result = await callExaMcpTool({
          toolName: EXA_MCP_TOOLS.codeContext,
          args: params as Record<string, unknown>,
          config,
          resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
        });
        return result.isError ? { error: result.content || "Exa code context lookup failed" } : { content: result.content, data: result.data };
      },
    );
  },

  async onHealth() {
    return { status: "ok", message: `${PLUGIN_ID} ready` };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
