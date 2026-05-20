import {
  definePlugin,
  runWorker,
  type ToolResult,
  type ToolRunContext,
} from "@paperclipai/plugin-sdk";
import { callExaMcpTool, type ExaPluginConfig } from "./exa-mcp-client.js";
import {
  EXA_COST_BILLING_TYPE,
  EXA_COST_PROVIDER,
  EXA_MCP_TOOLS,
  PLUGIN_ID,
  TOOL_NAMES,
} from "./constants.js";

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

function usdToCents(amountUsd: unknown) {
  if (typeof amountUsd !== "number" || !Number.isFinite(amountUsd) || amountUsd <= 0) {
    return 0;
  }
  return Math.max(0, Math.round(amountUsd * 100));
}

function resolveEstimatedCostCents(config: ExaPluginConfig, toolName: string) {
  if (config.costAccountingMode !== "estimated_per_request") return 0;
  switch (toolName) {
    case TOOL_NAMES.webSearch:
      return usdToCents(config.estimatedWebSearchCostUsd);
    case TOOL_NAMES.crawlUrl:
      return usdToCents(config.estimatedCrawlUrlCostUsd);
    case TOOL_NAMES.codeContext:
      return usdToCents(config.estimatedCodeContextCostUsd);
    default:
      return 0;
  }
}

async function emitExaCost(input: {
  ctx: Parameters<Parameters<typeof definePlugin>[0]["setup"]>[0];
  runCtx: ToolRunContext;
  config: ExaPluginConfig;
  toolName: string;
}) {
  const costCents = resolveEstimatedCostCents(input.config, input.toolName);
  if (costCents <= 0) return;

  await input.ctx.costs.createEvent({
    companyId: input.runCtx.companyId,
    agentId: input.runCtx.agentId,
    projectId: input.runCtx.projectId,
    issueId: null,
    goalId: null,
    heartbeatRunId: input.runCtx.runId,
    billingCode: `exa:${input.toolName}`,
    provider: EXA_COST_PROVIDER,
    biller: EXA_COST_PROVIDER,
    billingType: EXA_COST_BILLING_TYPE,
    model: input.toolName,
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
      async (params, runCtx): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        const result = await callExaMcpTool({
          toolName: EXA_MCP_TOOLS.webSearch,
          args: params as Record<string, unknown>,
          config,
          resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
        });
        if (result.isError) return { error: result.content || "Exa web search failed" };
        await emitExaCost({ ctx, runCtx, config, toolName: TOOL_NAMES.webSearch });
        return { content: result.content, data: result.data };
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
      async (params, runCtx): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        const result = await callExaMcpTool({
          toolName: EXA_MCP_TOOLS.crawling,
          args: normalizeCrawlArgs(params as Record<string, unknown>),
          config,
          resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
        });
        if (result.isError) return { error: result.content || "Exa crawl failed" };
        await emitExaCost({ ctx, runCtx, config, toolName: TOOL_NAMES.crawlUrl });
        return { content: result.content, data: result.data };
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
      async (params, runCtx): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        const result = await callExaMcpTool({
          toolName: EXA_MCP_TOOLS.codeContext,
          args: params as Record<string, unknown>,
          config,
          resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
        });
        if (result.isError) return { error: result.content || "Exa code context lookup failed" };
        await emitExaCost({ ctx, runCtx, config, toolName: TOOL_NAMES.codeContext });
        return { content: result.content, data: result.data };
      },
    );
  },

  async onHealth() {
    return { status: "ok", message: `${PLUGIN_ID} ready` };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
