import {
  definePlugin,
  runWorker,
  type PluginContext,
  type ToolResult,
  type ToolRunContext,
} from "@paperclipai/plugin-sdk";
import {
  ENTITY_TYPES,
  PLUGIN_ID,
  TOOL_NAMES,
  type SemanticCoreMcpToolName,
} from "./constants.js";
import {
  callSemanticCoreMcpTool,
  extractResultObject,
  listSemanticCoreMcpTools,
  runLayerAndWait,
  runSemanticCoreSmoke,
  type SemanticCoreMcpPluginConfig,
  validatePaperclipImportPayload,
} from "./semantic-core-mcp-client.js";

type PluginSetupContext = Parameters<
  NonNullable<Parameters<typeof definePlugin>[0]["setup"]>
>[0];

const wrapperToolMap: Array<{
  paperclipToolName: (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];
  mcpToolName: SemanticCoreMcpToolName;
  displayName: string;
  description: string;
}> = [
  {
    paperclipToolName: TOOL_NAMES.getPaperclipImportSchema,
    mcpToolName: "get_paperclip_import_schema",
    displayName: "Semantic Core Get Paperclip Import Schema",
    description: "Call Semantic Core MCP `get_paperclip_import_schema`.",
  },
  {
    paperclipToolName: TOOL_NAMES.registerProject,
    mcpToolName: "register_project",
    displayName: "Semantic Core Register Project",
    description: "Register semantic-core project inputs with the MCP server.",
  },
  {
    paperclipToolName: TOOL_NAMES.runLayer,
    mcpToolName: "run_layer",
    displayName: "Semantic Core Run Layer",
    description: "Start one semantic-core layer run and return the MCP job id.",
  },
  {
    paperclipToolName: TOOL_NAMES.getJobStatus,
    mcpToolName: "get_job_status",
    displayName: "Semantic Core Get Job Status",
    description: "Poll a Semantic Core MCP async job.",
  },
  {
    paperclipToolName: TOOL_NAMES.preparePaperclipImport,
    mcpToolName: "prepare_paperclip_import",
    displayName: "Semantic Core Prepare Paperclip Import",
    description: "Prepare and validate a `paperclip_import.v1` payload for a completed run.",
  },
  {
    paperclipToolName: TOOL_NAMES.getReviewQueue,
    mcpToolName: "get_review_queue",
    displayName: "Semantic Core Get Review Queue",
    description: "Fetch Semantic Core review queue entries.",
  },
  {
    paperclipToolName: TOOL_NAMES.submitReviewDecisions,
    mcpToolName: "submit_review_decisions",
    displayName: "Semantic Core Submit Review Decisions",
    description: "Send Paperclip human/agent review decisions back to Semantic Core MCP.",
  },
];

const looseObjectSchema = {
  type: "object",
  additionalProperties: true,
} as const;

function nowIso() {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

async function getConfig(ctx: PluginSetupContext) {
  return (await ctx.config.get()) as SemanticCoreMcpPluginConfig;
}

function resultAsToolResult(result: { content: string; data: unknown }): ToolResult {
  return {
    content: result.content,
    data: result.data,
  };
}

async function callMcpTool(input: {
  ctx: PluginSetupContext;
  toolName: SemanticCoreMcpToolName;
  args?: unknown;
}): Promise<ToolResult> {
  const config = await getConfig(input.ctx);
  const result = await callSemanticCoreMcpTool({
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

async function storeEntity(input: {
  ctx: PluginContext;
  runCtx: ToolRunContext;
  entityType: string;
  externalId: string;
  title: string;
  status: string;
  data: Record<string, unknown>;
}) {
  await input.ctx.entities.upsert({
    entityType: input.entityType,
    scopeKind: "project",
    scopeId: input.runCtx.projectId,
    externalId: input.externalId,
    title: input.title,
    status: input.status,
    data: {
      ...input.data,
      companyId: input.runCtx.companyId,
      projectId: input.runCtx.projectId,
      agentId: input.runCtx.agentId,
      heartbeatRunId: input.runCtx.runId,
      storedAt: nowIso(),
    },
  });
}

async function maybeRecordImportCost(input: {
  ctx: PluginContext;
  runCtx: ToolRunContext;
  runId: string;
  importPayload: Record<string, unknown>;
}) {
  const stateKey = `cost-event:${input.runId}`;
  const previous = await input.ctx.state.get({
    scopeKind: "project",
    scopeId: input.runCtx.projectId,
    namespace: "semantic-core",
    stateKey,
  });
  if (previous) return;

  const cost = isRecord(input.importPayload.cost) ? input.importPayload.cost : {};
  const total = typeof cost.total === "number"
    ? cost.total
    : typeof cost.total_estimated === "number"
      ? cost.total_estimated
      : 0;
  const costCents = Math.max(0, Math.round(total * 100));
  if (costCents === 0) return;

  await input.ctx.costs.createEvent({
    companyId: input.runCtx.companyId,
    agentId: input.runCtx.agentId,
    projectId: input.runCtx.projectId,
    heartbeatRunId: input.runCtx.runId,
    issueId: null,
    goalId: null,
    billingCode: "semantic-core-mcp",
    provider: "semantic-core-builder",
    biller: "semantic-core-builder",
    billingType: "metered_api",
    model: "semantic-core-mcp",
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    costCents,
    occurredAt: nowIso(),
  });
  await input.ctx.state.set(
    {
      scopeKind: "project",
      scopeId: input.runCtx.projectId,
      namespace: "semantic-core",
      stateKey,
    },
    { recordedAt: nowIso(), costCents },
  );
}

async function handlePrepareImport(input: {
  ctx: PluginSetupContext;
  args: unknown;
  runCtx: ToolRunContext;
}) {
  const config = await getConfig(input.ctx);
  const result = await callSemanticCoreMcpTool({
    toolName: "prepare_paperclip_import",
    args: input.args,
    config,
    resolveSecret: (secretRef) => input.ctx.secrets.resolve(secretRef),
    fetchFn: input.ctx.http.fetch as typeof fetch,
  });
  const importPayload = extractResultObject(result);
  const validation = validatePaperclipImportPayload(importPayload);
  const runId = readString(importPayload.run_id)
    ?? (isRecord(input.args) ? readString(input.args.run_id) : null)
    ?? `unknown-${Date.now()}`;

  await storeEntity({
    ctx: input.ctx,
    runCtx: input.runCtx,
    entityType: ENTITY_TYPES.importCandidate,
    externalId: runId,
    title: `Semantic Core import ${runId}`,
    status: "validated",
    data: {
      runId,
      validation,
      importPayload,
    },
  });
  await maybeRecordImportCost({
    ctx: input.ctx,
    runCtx: input.runCtx,
    runId,
    importPayload,
  });

  return {
    content: JSON.stringify(
      {
        status: "validated",
        run_id: runId,
        schema_version: validation.schemaVersion,
        accepted_keyword_count: validation.acceptedKeywordCount,
        cluster_count: validation.clusterCount,
        serp_segment_count: validation.serpSegmentCount,
        cost_event_count: validation.costEventCount,
      },
      null,
      2,
    ),
    data: {
      ...result.data,
      validation,
      importPayload,
    },
  };
}

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info(`${PLUGIN_ID} plugin setup complete`);

    ctx.tools.register(
      TOOL_NAMES.listTools,
      {
        displayName: "Semantic Core MCP List Tools",
        description: "List allowlisted tools exposed by the private Semantic Core MCP server.",
        parametersSchema: looseObjectSchema,
      },
      async (): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        const result = await listSemanticCoreMcpTools({
          config,
          resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
          fetchFn: ctx.http.fetch as typeof fetch,
        });
        return resultAsToolResult(result);
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
        async (params, runCtx): Promise<ToolResult> => {
          if (tool.mcpToolName === "prepare_paperclip_import") {
            return await handlePrepareImport({ ctx, args: params, runCtx });
          }

          const result = await callMcpTool({
            ctx,
            toolName: tool.mcpToolName,
            args: params,
          });

          if (tool.mcpToolName === "register_project" && isRecord(params)) {
            const projectId = readString(params.project_id) ?? "unknown-project";
            await storeEntity({
              ctx,
              runCtx,
              entityType: ENTITY_TYPES.projectRegistration,
              externalId: projectId,
              title: `Semantic Core project ${projectId}`,
              status: "registered",
              data: { projectId, request: params },
            });
          }

          if (tool.mcpToolName === "submit_review_decisions" && isRecord(params)) {
            const runId = readString(params.run_id) ?? "unknown-run";
            await storeEntity({
              ctx,
              runCtx,
              entityType: ENTITY_TYPES.reviewDecisionBatch,
              externalId: `${runId}:${Date.now()}`,
              title: `Semantic Core review decisions ${runId}`,
              status: "submitted",
              data: { runId, request: params },
            });
          }

          return result;
        },
      );
    }

    ctx.tools.register(
      TOOL_NAMES.runLayerAndWait,
      {
        displayName: "Semantic Core Run Layer And Wait",
        description: "Run one semantic-core layer as an async MCP job, poll until completed, and return run_id.",
        parametersSchema: looseObjectSchema,
      },
      async (params, runCtx): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        const result = await runLayerAndWait({
          args: params,
          config,
          resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
          fetchFn: ctx.http.fetch as typeof fetch,
        });
        const data: Record<string, unknown> = isRecord(result.data) ? result.data : {};
        const runId = readString(data.run_id) ?? "unknown-run";
        const jobId = readString(data.job_id) ?? "unknown-job";
        await storeEntity({
          ctx,
          runCtx,
          entityType: ENTITY_TYPES.layerRun,
          externalId: jobId,
          title: `Semantic Core layer job ${jobId}`,
          status: "completed",
          data: { jobId, runId, result: data },
        });
        return resultAsToolResult(result);
      },
    );

    ctx.tools.register(
      TOOL_NAMES.smokeTest,
      {
        displayName: "Semantic Core Smoke Test",
        description:
          "Run initialize/tools/schema/register_project/mock run/import validation against Semantic Core MCP.",
        parametersSchema: looseObjectSchema,
      },
      async (params, runCtx): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        const result = await runSemanticCoreSmoke({
          args: params,
          config,
          resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
          fetchFn: ctx.http.fetch as typeof fetch,
        });
        const data: Record<string, unknown> = isRecord(result.data) ? result.data : {};
        const validation: Record<string, unknown> = isRecord(data.validation)
          ? data.validation
          : {};
        const run: Record<string, unknown> =
          isRecord(data.run) && isRecord(data.run.data) ? data.run.data : {};
        await storeEntity({
          ctx,
          runCtx,
          entityType: ENTITY_TYPES.smokeTest,
          externalId: `${runCtx.runId}:${Date.now()}`,
          title: "Semantic Core smoke test",
          status: "passed",
          data: {
            projectId: readString(data.project_id),
            runId: readString(run.run_id),
            validation,
          },
        });
        return resultAsToolResult(result);
      },
    );
  },

  async onHealth() {
    return { status: "ok", message: `${PLUGIN_ID} ready` };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
