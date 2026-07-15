import {
  definePlugin,
  runWorker,
  type PluginHealthDiagnostics,
  type ToolResult,
  type ToolRunContext,
} from "@paperclipai/plugin-sdk";
import {
  MCP_TOOL_NAMES,
  PLUGIN_ID,
  TOOL_NAMES,
  WINNING_STRUCTURE_COST_BILLING_TYPE,
  WINNING_STRUCTURE_COST_MODEL,
  WINNING_STRUCTURE_COST_PROVIDER,
  type WinningStructureMcpToolName,
} from "./constants.js";
import {
  callWinningStructureMcpTool,
  verifyWinningStructureMcpContract,
  type WinningStructureMcpPluginConfig,
} from "./winning-structure-mcp-client.js";
import { TOOL_PARAMETER_SCHEMAS } from "./tool-schemas.js";

type PluginSetupContext = Parameters<
  NonNullable<Parameters<typeof definePlugin>[0]["setup"]>
>[0];

const wrapperToolMap: Array<{
  paperclipToolName: (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];
  mcpToolName: WinningStructureMcpToolName;
  displayName: string;
  description: string;
  parametersSchema: (typeof TOOL_PARAMETER_SCHEMAS)[keyof typeof TOOL_PARAMETER_SCHEMAS];
}> = [
  {
    paperclipToolName: TOOL_NAMES.validateTaskInput,
    mcpToolName: "validate_task_input",
    displayName: "Winning Structure Validate Task Input",
    description: "Validate a Winning Structure MCP v1 SEO page structure task.",
    parametersSchema: TOOL_PARAMETER_SCHEMAS.validateTaskInput,
  },
  {
    paperclipToolName: TOOL_NAMES.startRun,
    mcpToolName: "start_winning_structure_run",
    displayName: "Winning Structure Start Run",
    description: "Start an async Winning Structure run for an SEO page structure task.",
    parametersSchema: TOOL_PARAMETER_SCHEMAS.startRun,
  },
  {
    paperclipToolName: TOOL_NAMES.getRunStatus,
    mcpToolName: "get_run_status",
    displayName: "Winning Structure Get Run Status",
    description: "Poll the status of a Winning Structure MCP run.",
    parametersSchema: TOOL_PARAMETER_SCHEMAS.getRunStatus,
  },
  {
    paperclipToolName: TOOL_NAMES.submitRunDecisions,
    mcpToolName: "submit_run_decisions",
    displayName: "Winning Structure Submit Run Decisions",
    description: "Submit exactly one versioned decision for a paused Winning Structure run.",
    parametersSchema: TOOL_PARAMETER_SCHEMAS.submitRunDecisions,
  },
  {
    paperclipToolName: TOOL_NAMES.getRunResult,
    mcpToolName: "get_run_result",
    displayName: "Winning Structure Get Run Result",
    description: "Fetch the complete Winning Structure result payload for durable import, including recommendations, requirements, artifact references, provenance, retention, and quality flags.",
    parametersSchema: TOOL_PARAMETER_SCHEMAS.getRunResult,
  },
];

let health: PluginHealthDiagnostics = {
  status: "degraded",
  message: `${PLUGIN_ID} has not verified the remote MCP contract`,
  details: {
    contractVerified: false,
    requiredTools: [...MCP_TOOL_NAMES],
  },
};

async function getConfig(ctx: PluginSetupContext) {
  return (await ctx.config.get()) as WinningStructureMcpPluginConfig;
}

async function callMcpTool(input: {
  ctx: PluginSetupContext;
  toolName: WinningStructureMcpToolName;
  args?: unknown;
  runCtx: ToolRunContext;
}): Promise<ToolResult> {
  const config = await getConfig(input.ctx);
  const result = await callWinningStructureMcpTool({
    toolName: input.toolName,
    args: input.args,
    config,
    resolveSecret: (secretRef) => input.ctx.secrets.resolve(secretRef),
    fetchFn: input.ctx.http.fetch as typeof fetch,
  });

  if (result.providerCost && config.costAccountingMode !== "disabled") {
    const remoteRunId = result.providerCost.runId ?? input.runCtx.runId;
    const stateKey = `cost-event:${remoteRunId}`;
    const stateRef = {
      scopeKind: "project" as const,
      scopeId: input.runCtx.projectId,
      namespace: "winning-structure-mcp",
      stateKey,
    };
    const previous = await input.ctx.state.get(stateRef);
    if (!previous) {
      const amountMicros = Math.max(
        0,
        Math.round(result.providerCost.amountUsd * 1_000_000),
      );
      await input.ctx.costs.createEvent({
        companyId: input.runCtx.companyId,
        agentId: input.runCtx.agentId,
        projectId: input.runCtx.projectId,
        issueId: input.runCtx.issueId ?? null,
        goalId: null,
        heartbeatRunId: input.runCtx.runId,
        billingCode: "winning-structure-mcp",
        provider: WINNING_STRUCTURE_COST_PROVIDER,
        biller: WINNING_STRUCTURE_COST_PROVIDER,
        billingType: WINNING_STRUCTURE_COST_BILLING_TYPE,
        model: WINNING_STRUCTURE_COST_MODEL,
        service: "winning-structure",
        operation: input.toolName,
        toolName: input.toolName,
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
        costCents: Math.max(0, Math.round(result.providerCost.amountUsd * 100)),
        amountMicros,
        currency: result.providerCost.currency,
        occurredAt: new Date().toISOString(),
      });
      await input.ctx.state.set(stateRef, {
        recordedAt: new Date().toISOString(),
        amountMicros,
        currency: result.providerCost.currency,
      });
    }
  }

  return {
    content: result.content,
    data: result.data,
  };
}

const plugin = definePlugin({
  async setup(ctx) {
    health = {
      status: "degraded",
      message: `${PLUGIN_ID} is verifying the remote MCP contract`,
      details: {
        contractVerified: false,
        requiredTools: [...MCP_TOOL_NAMES],
      },
    };

    for (const tool of wrapperToolMap) {
      ctx.tools.register(
        tool.paperclipToolName,
        {
          displayName: tool.displayName,
          description: tool.description,
          parametersSchema: tool.parametersSchema,
        },
        async (params, runCtx): Promise<ToolResult> =>
          await callMcpTool({
            ctx,
            toolName: tool.mcpToolName,
            args: params,
            runCtx,
          }),
      );
    }

    try {
      const config = await getConfig(ctx);
      const verifiedTools = await verifyWinningStructureMcpContract({
        config,
        resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
        fetchFn: ctx.http.fetch as typeof fetch,
      });
      health = {
        status: "ok",
        message: `${PLUGIN_ID} remote contract verified`,
        details: {
          contractVerified: true,
          requiredTools: [...MCP_TOOL_NAMES],
          verifiedTools,
        },
      };
      ctx.logger.info(`${PLUGIN_ID} plugin setup complete; remote contract verified`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Remote contract verification failed";
      health = {
        status: message.includes("missing required tools") ? "error" : "degraded",
        message,
        details: {
          contractVerified: false,
          requiredTools: [...MCP_TOOL_NAMES],
        },
      };
      ctx.logger.warn(`${PLUGIN_ID} remote contract verification failed`, { message });
    }
  },

  async onHealth() {
    return health;
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
