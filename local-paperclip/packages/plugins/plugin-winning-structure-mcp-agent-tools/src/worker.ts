import { definePlugin, runWorker, type ToolResult } from "@paperclipai/plugin-sdk";
import {
  PLUGIN_ID,
  TOOL_NAMES,
  type WinningStructureMcpToolName,
} from "./constants.js";
import {
  callWinningStructureMcpTool,
  type WinningStructureMcpPluginConfig,
} from "./winning-structure-mcp-client.js";

type PluginSetupContext = Parameters<
  NonNullable<Parameters<typeof definePlugin>[0]["setup"]>
>[0];

const wrapperToolMap: Array<{
  paperclipToolName: (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];
  mcpToolName: WinningStructureMcpToolName;
  displayName: string;
  description: string;
}> = [
  {
    paperclipToolName: TOOL_NAMES.validateTaskInput,
    mcpToolName: "validate_task_input",
    displayName: "Winning Structure Validate Task Input",
    description: "Validate a Winning Structure MCP v1 SEO page structure task.",
  },
  {
    paperclipToolName: TOOL_NAMES.startRun,
    mcpToolName: "start_winning_structure_run",
    displayName: "Winning Structure Start Run",
    description: "Start an async Winning Structure run for an SEO page structure task.",
  },
  {
    paperclipToolName: TOOL_NAMES.getRunStatus,
    mcpToolName: "get_run_status",
    displayName: "Winning Structure Get Run Status",
    description: "Poll the status of a Winning Structure MCP run.",
  },
  {
    paperclipToolName: TOOL_NAMES.getRunResult,
    mcpToolName: "get_run_result",
    displayName: "Winning Structure Get Run Result",
    description: "Fetch Winning Structure JSON/Markdown artifact references and quality flags.",
  },
];

const looseObjectSchema = {
  type: "object",
  additionalProperties: true,
} as const;

async function getConfig(ctx: PluginSetupContext) {
  return (await ctx.config.get()) as WinningStructureMcpPluginConfig;
}

async function callMcpTool(input: {
  ctx: PluginSetupContext;
  toolName: WinningStructureMcpToolName;
  args?: unknown;
}): Promise<ToolResult> {
  const config = await getConfig(input.ctx);
  const result = await callWinningStructureMcpTool({
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

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info(`${PLUGIN_ID} plugin setup complete`);

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
