import { definePlugin, runWorker, type ToolResult } from "@paperclipai/plugin-sdk";
import {
  callBrightDataTool,
  downloadBrightDataSnapshot,
  getBrightDataSnapshotProgress,
  listBrightDataTools,
  runBrightDataDatasetRequest,
  triggerBrightDataDatasetRequest,
  type BrightDataPluginConfig,
} from "./bright-data-mcp-client.js";
import { PLUGIN_ID, TOOL_NAMES } from "./constants.js";

async function getConfig(ctx: Parameters<NonNullable<Parameters<typeof definePlugin>[0]["setup"]>>[0]) {
  return await ctx.config.get() as BrightDataPluginConfig;
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
}

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info(`${PLUGIN_ID} plugin setup complete`);

    ctx.tools.register(
      TOOL_NAMES.listTools,
      {
        displayName: "Bright Data List Tools",
        description: "List the remote Bright Data MCP tools available through the configured groups.",
        parametersSchema: {
          type: "object",
          properties: {},
        },
      },
      async (): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        const result = await listBrightDataTools({
          config,
          resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
        });
        return { content: result.content, data: result.data };
      },
    );

    ctx.tools.register(
      TOOL_NAMES.callTool,
      {
        displayName: "Bright Data Call Tool",
        description: "Execute one Bright Data MCP tool by remote tool name with structured arguments.",
        parametersSchema: {
          type: "object",
          properties: {
            remoteToolName: { type: "string" },
            arguments: {
              type: "object",
              additionalProperties: true,
            },
          },
          required: ["remoteToolName"],
        },
      },
      async (params): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        const record = params as Record<string, unknown>;
        const remoteToolName =
          typeof record.remoteToolName === "string" && record.remoteToolName.trim().length > 0
            ? record.remoteToolName.trim()
            : "";
        if (!remoteToolName) {
          return { error: "remoteToolName is required" };
        }

        const args =
          record.arguments && typeof record.arguments === "object" && !Array.isArray(record.arguments)
            ? record.arguments as Record<string, unknown>
            : {};

        const result = await callBrightDataTool({
          remoteToolName,
          args,
          config,
          resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
        });

        return result.isError
          ? { error: result.content || "Bright Data tool call failed" }
          : { content: result.content, data: result.data };
      },
    );

    ctx.tools.register(
      TOOL_NAMES.triggerDatasetRequest,
      {
        displayName: "Bright Data Trigger Dataset Request",
        description: "Start a Bright Data asynchronous dataset request and return a snapshot ID.",
        parametersSchema: {
          type: "object",
          properties: {
            datasetId: { type: "string" },
            input: {
              oneOf: [
                { type: "array", items: { type: "object", additionalProperties: true } },
                { type: "object", additionalProperties: true },
              ],
            },
          },
          required: ["datasetId", "input"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const config = await getConfig(ctx);
          const record = params as Record<string, unknown>;
          const result = await triggerBrightDataDatasetRequest({
            params: {
              datasetId: readString(record, "datasetId"),
              input: record.input as Record<string, unknown> | Array<Record<string, unknown>>,
              includeErrors: record.includeErrors as boolean | undefined,
              customOutputFields: record.customOutputFields as string | undefined,
              type: record.type as string | undefined,
              discoverBy: record.discoverBy as string | undefined,
              limitPerInput: record.limitPerInput as number | undefined,
              limitMultipleResults: record.limitMultipleResults as number | undefined,
              notify: record.notify as boolean | undefined,
              endpoint: record.endpoint as string | undefined,
              format: record.format as string | undefined,
              authHeader: record.authHeader as string | undefined,
              uncompressedWebhook: record.uncompressedWebhook as boolean | undefined,
            },
            config,
            resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
          });
          return { content: result.content, data: result.data };
        } catch (error) {
          return { error: error instanceof Error ? error.message : String(error) };
        }
      },
    );

    ctx.tools.register(
      TOOL_NAMES.getSnapshotProgress,
      {
        displayName: "Bright Data Get Snapshot Progress",
        description: "Fetch Bright Data progress status for a snapshot ID.",
        parametersSchema: {
          type: "object",
          properties: {
            snapshotId: { type: "string" },
          },
          required: ["snapshotId"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const config = await getConfig(ctx);
          const record = params as Record<string, unknown>;
          const result = await getBrightDataSnapshotProgress({
            snapshotId: readString(record, "snapshotId"),
            config,
            resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
          });
          return { content: result.content, data: result.data };
        } catch (error) {
          return { error: error instanceof Error ? error.message : String(error) };
        }
      },
    );

    ctx.tools.register(
      TOOL_NAMES.downloadSnapshot,
      {
        displayName: "Bright Data Download Snapshot",
        description: "Download the completed Bright Data snapshot payload.",
        parametersSchema: {
          type: "object",
          properties: {
            snapshotId: { type: "string" },
            format: { type: "string" },
          },
          required: ["snapshotId"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const config = await getConfig(ctx);
          const record = params as Record<string, unknown>;
          const result = await downloadBrightDataSnapshot({
            snapshotId: readString(record, "snapshotId"),
            format: record.format as string | undefined,
            config,
            resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
          });
          return { content: result.content, data: result.data };
        } catch (error) {
          return { error: error instanceof Error ? error.message : String(error) };
        }
      },
    );

    ctx.tools.register(
      TOOL_NAMES.runDatasetRequest,
      {
        displayName: "Bright Data Run Dataset Request",
        description: "Trigger a Bright Data dataset job, poll until completion or timeout, and optionally download the snapshot.",
        parametersSchema: {
          type: "object",
          properties: {
            datasetId: { type: "string" },
            input: {
              oneOf: [
                { type: "array", items: { type: "object", additionalProperties: true } },
                { type: "object", additionalProperties: true },
              ],
            },
            maxWaitMs: { type: "number" },
            pollIntervalMs: { type: "number" },
            autoDownload: { type: "boolean" },
            downloadFormat: { type: "string" },
          },
          required: ["datasetId", "input"],
        },
      },
      async (params): Promise<ToolResult> => {
        try {
          const config = await getConfig(ctx);
          const record = params as Record<string, unknown>;
          const result = await runBrightDataDatasetRequest({
            params: {
              datasetId: readString(record, "datasetId"),
              input: record.input as Record<string, unknown> | Array<Record<string, unknown>>,
              includeErrors: record.includeErrors as boolean | undefined,
              customOutputFields: record.customOutputFields as string | undefined,
              type: record.type as string | undefined,
              discoverBy: record.discoverBy as string | undefined,
              limitPerInput: record.limitPerInput as number | undefined,
              limitMultipleResults: record.limitMultipleResults as number | undefined,
              notify: record.notify as boolean | undefined,
              endpoint: record.endpoint as string | undefined,
              format: record.format as string | undefined,
              authHeader: record.authHeader as string | undefined,
              uncompressedWebhook: record.uncompressedWebhook as boolean | undefined,
              maxWaitMs: record.maxWaitMs as number | undefined,
              pollIntervalMs: record.pollIntervalMs as number | undefined,
              autoDownload: record.autoDownload as boolean | undefined,
              downloadFormat: record.downloadFormat as string | undefined,
            },
            config,
            resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
          });
          return { content: result.content, data: result.data };
        } catch (error) {
          return { error: error instanceof Error ? error.message : String(error) };
        }
      },
    );
  },

  async onHealth() {
    return { status: "ok", message: `${PLUGIN_ID} ready` };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
