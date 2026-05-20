import {
  definePlugin,
  runWorker,
  type ToolResult,
  type ToolRunContext,
} from "@paperclipai/plugin-sdk";
import {
  callBrightDataTool,
  downloadBrightDataSnapshot,
  getBrightDataSnapshotProgress,
  listBrightDataTools,
  normalizeInstagramHandle,
  resolveInstagramAccountPostSet,
  runBrightDataDatasetRequest,
  triggerBrightDataDatasetRequest,
  type BrightDataPluginConfig,
} from "./bright-data-mcp-client.js";
import {
  BRIGHT_DATA_COST_BILLING_TYPE,
  BRIGHT_DATA_COST_PROVIDER,
  PLUGIN_ID,
  TOOL_NAMES,
} from "./constants.js";

async function getConfig(ctx: Parameters<NonNullable<Parameters<typeof definePlugin>[0]["setup"]>>[0]) {
  return await ctx.config.get() as BrightDataPluginConfig;
}

function usdToCents(amountUsd: unknown) {
  if (typeof amountUsd !== "number" || !Number.isFinite(amountUsd) || amountUsd <= 0) {
    return 0;
  }
  return Math.max(0, Math.round(amountUsd * 100));
}

function resolveEstimatedCostCents(config: BrightDataPluginConfig, toolName: string) {
  if (config.costAccountingMode !== "estimated_per_request") return 0;
  switch (toolName) {
    case TOOL_NAMES.callTool:
      return usdToCents(config.estimatedMcpToolCostUsd);
    case TOOL_NAMES.triggerDatasetRequest:
      return usdToCents(config.estimatedDatasetTriggerCostUsd);
    case TOOL_NAMES.getSnapshotProgress:
      return usdToCents(config.estimatedSnapshotProgressCostUsd);
    case TOOL_NAMES.downloadSnapshot:
      return usdToCents(config.estimatedSnapshotDownloadCostUsd);
    case TOOL_NAMES.runDatasetRequest:
      return usdToCents(config.estimatedRunDatasetCostUsd);
    case TOOL_NAMES.resolveInstagramAccountPostSet:
      return usdToCents(config.estimatedInstagramPostSetCostUsd);
    default:
      return 0;
  }
}

async function emitBrightDataCost(input: {
  ctx: Parameters<Parameters<typeof definePlugin>[0]["setup"]>[0];
  runCtx: ToolRunContext;
  config: BrightDataPluginConfig;
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
    billingCode: `bright-data:${input.toolName}`,
    provider: BRIGHT_DATA_COST_PROVIDER,
    biller: BRIGHT_DATA_COST_PROVIDER,
    billingType: BRIGHT_DATA_COST_BILLING_TYPE,
    model: input.toolName,
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    costCents,
    occurredAt: new Date().toISOString(),
  });
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
}

function readNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readBoolean(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "boolean" ? value : undefined;
}

function readCacheTtlHours(record: Record<string, unknown>) {
  const value = readNumber(record, "cacheTtlHours");
  if (value === undefined) return 24;
  return Math.max(0, value);
}

function buildInstagramCacheKey(input: {
  handle: string;
  expectedPostCount?: number;
  maxPosts?: number;
  allowLargeAccount?: boolean;
}) {
  return [
    "instagram-account-post-set",
    input.handle,
    `expected=${input.expectedPostCount ?? "any"}`,
    `max=${input.maxPosts ?? 180}`,
    `large=${input.allowLargeAccount === true ? "1" : "0"}`,
  ].join(":");
}

type CachedInstagramPostSet = {
  storedAt: string;
  expiresAt: string;
  result: {
    content: string;
    data: Record<string, unknown>;
  };
};

function isCachedInstagramPostSet(value: unknown): value is CachedInstagramPostSet {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const result = record.result;
  return (
    typeof record.storedAt === "string" &&
    typeof record.expiresAt === "string" &&
    !!result &&
    typeof result === "object" &&
    !Array.isArray(result) &&
    typeof (result as Record<string, unknown>).content === "string" &&
    !!(result as Record<string, unknown>).data &&
    typeof (result as Record<string, unknown>).data === "object"
  );
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
      async (_params): Promise<ToolResult> => {
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
      async (params, runCtx): Promise<ToolResult> => {
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

        if (result.isError) return { error: result.content || "Bright Data tool call failed" };
        await emitBrightDataCost({ ctx, runCtx, config, toolName: TOOL_NAMES.callTool });
        return { content: result.content, data: result.data };
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
      async (params, runCtx): Promise<ToolResult> => {
        try {
          const config = await getConfig(ctx);
          const record = params as Record<string, unknown>;
          const datasetId = readString(record, "datasetId");
          const result = await triggerBrightDataDatasetRequest({
            params: {
              datasetId,
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
          await emitBrightDataCost({ ctx, runCtx, config, toolName: TOOL_NAMES.triggerDatasetRequest });
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
      async (params, runCtx): Promise<ToolResult> => {
        try {
          const config = await getConfig(ctx);
          const record = params as Record<string, unknown>;
          const snapshotId = readString(record, "snapshotId");
          const result = await getBrightDataSnapshotProgress({
            snapshotId,
            config,
            resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
          });
          await emitBrightDataCost({ ctx, runCtx, config, toolName: TOOL_NAMES.getSnapshotProgress });
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
      async (params, runCtx): Promise<ToolResult> => {
        try {
          const config = await getConfig(ctx);
          const record = params as Record<string, unknown>;
          const snapshotId = readString(record, "snapshotId");
          const result = await downloadBrightDataSnapshot({
            snapshotId,
            format: record.format as string | undefined,
            config,
            resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
          });
          await emitBrightDataCost({ ctx, runCtx, config, toolName: TOOL_NAMES.downloadSnapshot });
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
      async (params, runCtx): Promise<ToolResult> => {
        try {
          const config = await getConfig(ctx);
          const record = params as Record<string, unknown>;
          const datasetId = readString(record, "datasetId");
          const result = await runBrightDataDatasetRequest({
            params: {
              datasetId,
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
          await emitBrightDataCost({ ctx, runCtx, config, toolName: TOOL_NAMES.runDatasetRequest });
          return { content: result.content, data: result.data };
        } catch (error) {
          return { error: error instanceof Error ? error.message : String(error) };
        }
      },
    );

    ctx.tools.register(
      TOOL_NAMES.resolveInstagramAccountPostSet,
      {
        displayName: "Bright Data Resolve Instagram Account Post Set",
        description: "Resolve a full canonical Instagram account post set and detailed records through the validated Bright Data composite recipe.",
        parametersSchema: {
          type: "object",
          properties: {
            handleOrUrl: { type: "string" },
            expectedPostCount: { type: "number" },
            maxPosts: { type: "number" },
            allowLargeAccount: { type: "boolean" },
            maxWaitMs: { type: "number" },
            pollIntervalMs: { type: "number" },
            forceRefresh: { type: "boolean" },
            cacheTtlHours: { type: "number" },
          },
          required: ["handleOrUrl"],
        },
      },
      async (params, runCtx): Promise<ToolResult> => {
        try {
          const config = await getConfig(ctx);
          const record = params as Record<string, unknown>;
          const handleOrUrl = readString(record, "handleOrUrl");
          const handle = normalizeInstagramHandle(handleOrUrl);
          if (!handle) return { error: "handleOrUrl is required" };

          const expectedPostCount = readNumber(record, "expectedPostCount");
          const maxPosts = readNumber(record, "maxPosts");
          const allowLargeAccount = readBoolean(record, "allowLargeAccount") === true;
          const forceRefresh = readBoolean(record, "forceRefresh") === true;
          const cacheTtlHours = readCacheTtlHours(record);
          const cacheKey = buildInstagramCacheKey({
            handle,
            expectedPostCount,
            maxPosts,
            allowLargeAccount,
          });

          if (!forceRefresh && cacheTtlHours > 0) {
            const cached = await ctx.state.get({
              scopeKind: "instance",
              namespace: "instagram-account-post-set",
              stateKey: cacheKey,
            });
            if (isCachedInstagramPostSet(cached) && Date.parse(cached.expiresAt) > Date.now()) {
              return {
                content: [
                  `Reused cached Bright Data Instagram account post set for @${handle}.`,
                  `Cache key: ${cacheKey}.`,
                  `Cached at: ${cached.storedAt}.`,
                  `Expires at: ${cached.expiresAt}.`,
                  "",
                  cached.result.content,
                ].join("\n"),
                data: {
                  ...cached.result.data,
                  cache: {
                    hit: true,
                    key: cacheKey,
                    storedAt: cached.storedAt,
                    expiresAt: cached.expiresAt,
                    ttlHours: cacheTtlHours,
                  },
                },
              };
            }
          }

          const result = await resolveInstagramAccountPostSet({
            params: {
              handleOrUrl,
              expectedPostCount,
              maxPosts,
              allowLargeAccount,
              maxWaitMs: readNumber(record, "maxWaitMs"),
              pollIntervalMs: readNumber(record, "pollIntervalMs"),
            },
            config,
            resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
          });
          const now = new Date();
          const expiresAt = new Date(now.getTime() + cacheTtlHours * 60 * 60 * 1000);
          if (cacheTtlHours > 0) {
            await ctx.state.set(
              {
                scopeKind: "instance",
                namespace: "instagram-account-post-set",
                stateKey: cacheKey,
              },
              {
                storedAt: now.toISOString(),
                expiresAt: expiresAt.toISOString(),
                result,
              } satisfies CachedInstagramPostSet,
            );
          }
          await emitBrightDataCost({ ctx, runCtx, config, toolName: TOOL_NAMES.resolveInstagramAccountPostSet });
          return {
            content: result.content,
            data: {
              ...result.data,
              cache: {
                hit: false,
                key: cacheKey,
                storedAt: cacheTtlHours > 0 ? now.toISOString() : null,
                expiresAt: cacheTtlHours > 0 ? expiresAt.toISOString() : null,
                ttlHours: cacheTtlHours,
              },
            },
          };
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
