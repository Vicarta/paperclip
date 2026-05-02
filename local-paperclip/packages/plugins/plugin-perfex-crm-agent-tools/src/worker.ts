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
} from "./constants.js";
import {
  assertWriteAllowed,
  buildImplementationTaskPayload,
  classifyPerfexFollowup,
  callPerfexMcpTool,
  listPerfexMcpTools,
  normalizeConfig,
  perfexHealthcheck,
  toCreateTaskMcpArguments,
  type PerfexPluginConfig,
} from "./perfex-mcp-client.js";

type PluginSetupContext = Parameters<
  NonNullable<Parameters<typeof definePlugin>[0]["setup"]>
>[0];

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
  return (await ctx.config.get()) as PerfexPluginConfig;
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

function previewResult(payload: unknown, reason = "preview"): ToolResult {
  return {
    content: JSON.stringify(
      {
        status: reason,
        wrote_to_perfex: false,
        payload,
      },
      null,
      2,
    ),
    data: {
      status: reason,
      wrote_to_perfex: false,
      payload,
    },
  };
}

function resultAsToolResult(result: { content: string; data: unknown }): ToolResult {
  return {
    content: result.content,
    data: result.data,
  };
}

function taskIdFromResult(data: unknown) {
  const structured = isRecord(data)
    && isRecord(data.structuredContent)
    ? data.structuredContent
    : null;
  const direct = isRecord(data) ? data : {};
  return readString(structured?.task_id)
    ?? readString(structured?.id)
    ?? readString(direct.task_id)
    ?? readString(direct.id)
    ?? `unknown-${Date.now()}`;
}

function buildCommentPayload(args: unknown, config: PerfexPluginConfig) {
  if (!isRecord(args)) throw new Error("Perfex comment input must be an object");
  const taskId = readString(args.task_id);
  if (!taskId) throw new Error("task_id is required");
  const body = readString(args.body) ?? readString(args.comment);
  if (!body) throw new Error("body or comment is required");
  const normalized = normalizeConfig(config);
  const author = readString(args.author) ?? normalized.projectManagerId;
  if (!author) throw new Error("author or configured projectManagerId is required");
  return {
    task_id: taskId,
    author,
    body,
    has_write_permission: true,
  };
}

function buildGetTaskPayload(args: unknown) {
  if (!isRecord(args)) throw new Error("Perfex task status input must be an object");
  const taskId = readString(args.task_id);
  if (!taskId) throw new Error("task_id is required");
  return { task_id: taskId };
}

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info(`${PLUGIN_ID} plugin setup complete`);

    ctx.tools.register(
      TOOL_NAMES.healthcheck,
      {
        displayName: "Perfex Healthcheck",
        description: "Run the bearer-protected Perfex MCP healthcheck. Read-only.",
        parametersSchema: looseObjectSchema,
      },
      async (): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        return resultAsToolResult(
          await perfexHealthcheck({
            config,
            resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
            fetchFn: ctx.http.fetch as typeof fetch,
          }),
        );
      },
    );

    ctx.tools.register(
      TOOL_NAMES.listTools,
      {
        displayName: "Perfex List MCP Tools",
        description: "List tools exposed by the Perfex MCP server. Read-only.",
        parametersSchema: looseObjectSchema,
      },
      async (): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        return resultAsToolResult(
          await listPerfexMcpTools({
            config,
            resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
            fetchFn: ctx.http.fetch as typeof fetch,
          }),
        );
      },
    );

    ctx.tools.register(
      TOOL_NAMES.previewImplementationTask,
      {
        displayName: "Perfex Preview Implementation Task",
        description: "Build and validate a human implementation task payload without writing to Perfex.",
        parametersSchema: looseObjectSchema,
      },
      async (params): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        return previewResult(buildImplementationTaskPayload({ args: params, config }));
      },
    );

    ctx.tools.register(
      TOOL_NAMES.createImplementationTask,
      {
        displayName: "Perfex Create Implementation Task",
        description:
          "Create a Perfex implementation task only when writes are enabled and dry_run is false.",
        parametersSchema: looseObjectSchema,
      },
      async (params, runCtx): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        const payload = buildImplementationTaskPayload({ args: params, config });
        const writeGate = assertWriteAllowed({ args: params, config });
        if (!writeGate.allowed) {
          return previewResult(payload, writeGate.reason);
        }

        const normalized = normalizeConfig(config);
        const result = await callPerfexMcpTool({
          toolName: normalized.createTaskToolName,
          args: toCreateTaskMcpArguments(payload),
          config,
          resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
          fetchFn: ctx.http.fetch as typeof fetch,
        });
        const taskId = taskIdFromResult(result.data);
        await storeEntity({
          ctx,
          runCtx,
          entityType: ENTITY_TYPES.implementationTask,
          externalId: taskId,
          title: payload.title,
          status: "sent_to_perfex",
          data: { taskId, payload, result: result.data },
        });
        return resultAsToolResult({
          content: JSON.stringify(
            {
              status: "sent_to_perfex",
              wrote_to_perfex: true,
              task_id: taskId,
            },
            null,
            2,
          ),
          data: {
            status: "sent_to_perfex",
            wrote_to_perfex: true,
            task_id: taskId,
            payload,
            result: result.data,
          },
        });
      },
    );

    ctx.tools.register(
      TOOL_NAMES.addTaskComment,
      {
        displayName: "Perfex Add Task Comment",
        description:
          "Add a Perfex task comment only when writes are enabled and dry_run is false.",
        parametersSchema: looseObjectSchema,
      },
      async (params, runCtx): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        const payload = buildCommentPayload(params, config);
        const writeGate = assertWriteAllowed({ args: params, config });
        if (!writeGate.allowed) {
          return previewResult(payload, writeGate.reason);
        }

        const normalized = normalizeConfig(config);
        const result = await callPerfexMcpTool({
          toolName: normalized.addCommentToolName,
          args: payload,
          config,
          resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
          fetchFn: ctx.http.fetch as typeof fetch,
        });
        await storeEntity({
          ctx,
          runCtx,
          entityType: ENTITY_TYPES.taskComment,
          externalId: `${payload.task_id}:${Date.now()}`,
          title: `Perfex comment ${payload.task_id}`,
          status: "sent_to_perfex",
          data: { taskId: payload.task_id, payload, result: result.data },
        });
        return resultAsToolResult(result);
      },
    );

    ctx.tools.register(
      TOOL_NAMES.getTaskStatus,
      {
        displayName: "Perfex Get Task Status",
        description: "Fetch a Perfex task status through the configured MCP read tool.",
        parametersSchema: looseObjectSchema,
      },
      async (params): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        const normalized = normalizeConfig(config);
        return resultAsToolResult(
          await callPerfexMcpTool({
            toolName: normalized.getTaskToolName,
            args: buildGetTaskPayload(params),
            config,
            resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
            fetchFn: ctx.http.fetch as typeof fetch,
          }),
        );
      },
    );

    ctx.tools.register(
      TOOL_NAMES.getTaskComments,
      {
        displayName: "Perfex Get Task Comments",
        description: "Fetch Perfex task comments through the configured MCP read tool.",
        parametersSchema: looseObjectSchema,
      },
      async (params): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        const normalized = normalizeConfig(config);
        return resultAsToolResult(
          await callPerfexMcpTool({
            toolName: normalized.getTaskCommentsToolName,
            args: buildGetTaskPayload(params),
            config,
            resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
            fetchFn: ctx.http.fetch as typeof fetch,
          }),
        );
      },
    );

    ctx.tools.register(
      TOOL_NAMES.syncTaskStatus,
      {
        displayName: "Perfex Sync Task Status",
        description: "Fetch and store a Perfex task status in plugin entities/state. Read-only against Perfex.",
        parametersSchema: looseObjectSchema,
      },
      async (params, runCtx): Promise<ToolResult> => {
        const config = await getConfig(ctx);
        const normalized = normalizeConfig(config);
        const payload = buildGetTaskPayload(params);
        const statusResult = await callPerfexMcpTool({
          toolName: normalized.getTaskToolName,
          args: payload,
          config,
          resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
          fetchFn: ctx.http.fetch as typeof fetch,
        });
        const commentsResult = await callPerfexMcpTool({
          toolName: normalized.getTaskCommentsToolName,
          args: payload,
          config,
          resolveSecret: (secretRef) => ctx.secrets.resolve(secretRef),
          fetchFn: ctx.http.fetch as typeof fetch,
        });
        const followupDecision = classifyPerfexFollowup({
          taskId: payload.task_id,
          statusResult: statusResult.data,
          commentsResult: commentsResult.data,
          followupWindows: isRecord(params) ? params.followup_windows : undefined,
        });
        await storeEntity({
          ctx,
          runCtx,
          entityType: ENTITY_TYPES.taskStatus,
          externalId: payload.task_id,
          title: `Perfex status ${payload.task_id}`,
          status: followupDecision.workflow_state,
          data: {
            taskId: payload.task_id,
            statusResult: statusResult.data,
            commentsResult: commentsResult.data,
            followupDecision,
          },
        });
        return resultAsToolResult({
          content: JSON.stringify(
            {
              task_id: payload.task_id,
              status: "synced",
              workflow_state: followupDecision.workflow_state,
              indexing_eligible: followupDecision.indexing_eligible,
              followup_eligible: followupDecision.followup_eligible,
              followup_decision: followupDecision,
              status_result: statusResult.data,
              comments_result: commentsResult.data,
            },
            null,
            2,
          ),
          data: {
            taskId: payload.task_id,
            statusResult: statusResult.data,
            commentsResult: commentsResult.data,
            followupDecision,
          },
        });
      },
    );
  },

  async onHealth() {
    return { status: "ok", message: `${PLUGIN_ID} ready` };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
