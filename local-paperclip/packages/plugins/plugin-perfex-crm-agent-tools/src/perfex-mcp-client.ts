import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  DEFAULT_PERFEX_HEALTH_URL,
  DEFAULT_PERFEX_MCP_URL,
  PERFEX_ACTION_TYPES,
  PLUGIN_ID,
  PLUGIN_VERSION,
  type PerfexActionType,
} from "./constants.js";

export type PerfexPluginConfig = {
  perfexMcpTokenSecretRef?: string;
  perfexMcpUrl?: string;
  perfexHealthUrl?: string;
  perfexProjectId?: string;
  projectManagerId?: string;
  assigneeByActionTypeJson?: string;
  createTaskToolName?: string;
  addCommentToolName?: string;
  getTaskToolName?: string;
  getTaskCommentsToolName?: string;
  enableTaskWrites?: boolean;
  defaultDryRun?: boolean;
  statusCheckIntervalMinutes?: number;
  requestTimeoutMs?: number;
};

type FetchLike = typeof fetch;

type McpCallToolResult = {
  content?: unknown[];
  structuredContent?: unknown;
  isError?: boolean;
};

type McpListToolsResult = {
  tools?: Array<{
    name?: string;
    description?: string;
    inputSchema?: unknown;
  }>;
};

export type PerfexImplementationTaskInput = {
  action_type?: unknown;
  title?: unknown;
  affected_urls?: unknown;
  requested_changes?: unknown;
  source_evidence?: unknown;
  qa_checklist?: unknown;
  acceptance_criteria?: unknown;
  paperclip_issue_key?: unknown;
  source_opportunity_id?: unknown;
  product_lane?: unknown;
  priority?: unknown;
  indexing_recommendation?: unknown;
  followup_windows?: unknown;
  due_date?: unknown;
  manager_note?: unknown;
};

export type PerfexImplementationTaskPayload = {
  project_id: string;
  project_manager_id: string | null;
  assignee_ids: string[];
  action_type: PerfexActionType;
  title: string;
  description: string;
  priority: string;
  due_date: string | null;
  metadata: {
    company: "DiskInternals";
    paperclip_company_id: "969d66ff-d77e-4dbf-8759-1a17c2bb17c2";
    paperclip_issue_key: string | null;
    source_opportunity_id: string | null;
    affected_urls: string[];
    product_lane: string | null;
    indexing_recommendation: string | null;
    followup_windows: string[];
  };
};

export type PerfexCreateTaskMcpArguments = {
  project_id: string;
  task_name: string;
  description: string;
  assignee_ids: string[];
  follower_ids: string[];
  status: string;
  priority: string;
  start_date: string;
  due_date: string;
  tags: string[];
  created_by: string;
  has_write_permission: true;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function readStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((entry) => readString(entry)).filter((entry): entry is string => Boolean(entry));
  }
  const direct = readString(value);
  if (!direct) return [];
  return direct
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseAssigneeMap(value: unknown): Record<string, string[]> {
  const raw = readString(value) ?? "{}";
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return {};
    const result: Record<string, string[]> = {};
    for (const [key, entry] of Object.entries(parsed)) {
      const actionType = normalizeActionType(key);
      if (!actionType) continue;
      const ids = readStringArray(entry);
      if (ids.length > 0) result[actionType] = ids;
    }
    return result;
  } catch {
    return {};
  }
}

export function normalizeConfig(config: PerfexPluginConfig) {
  return {
    mcpUrl: readString(config.perfexMcpUrl) ?? DEFAULT_PERFEX_MCP_URL,
    healthUrl: readString(config.perfexHealthUrl) ?? DEFAULT_PERFEX_HEALTH_URL,
    projectId: readString(config.perfexProjectId),
    projectManagerId: readString(config.projectManagerId),
    assigneeByActionType: parseAssigneeMap(config.assigneeByActionTypeJson),
    createTaskToolName: readString(config.createTaskToolName) ?? "create_task",
    addCommentToolName: readString(config.addCommentToolName) ?? "add_task_comment",
    getTaskToolName: readString(config.getTaskToolName) ?? "get_task",
    getTaskCommentsToolName: readString(config.getTaskCommentsToolName) ?? "get_task_comments",
    enableTaskWrites: config.enableTaskWrites === true,
    defaultDryRun: config.defaultDryRun !== false,
    statusCheckIntervalMinutes: readPositiveNumber(config.statusCheckIntervalMinutes) ?? 60,
    requestTimeoutMs: readPositiveNumber(config.requestTimeoutMs) ?? 60_000,
  };
}

function normalizeActionType(value: unknown): PerfexActionType | null {
  const candidate = readString(value);
  if (!candidate) return null;
  return (PERFEX_ACTION_TYPES as readonly string[]).includes(candidate)
    ? candidate as PerfexActionType
    : null;
}

function requireConfiguredProjectId(projectId: string | null) {
  if (!projectId) {
    throw new Error("Perfex project ID is not configured. Do not create implementation tasks until the approved project is set.");
  }
  return projectId;
}

function section(title: string, body: string | string[]) {
  const lines = Array.isArray(body) ? body : [body];
  const nonEmpty = lines.map((line) => line.trim()).filter(Boolean);
  if (nonEmpty.length === 0) return "";
  return `## ${title}\n${nonEmpty.join("\n")}`;
}

export function buildImplementationTaskPayload(input: {
  args?: unknown;
  config: PerfexPluginConfig;
}): PerfexImplementationTaskPayload {
  if (!isRecord(input.args)) {
    throw new Error("Perfex implementation task input must be an object");
  }
  const config = normalizeConfig(input.config);
  const actionType = normalizeActionType(input.args.action_type);
  if (!actionType) {
    throw new Error(`action_type must be one of: ${PERFEX_ACTION_TYPES.join(", ")}`);
  }
  const projectId = requireConfiguredProjectId(config.projectId);
  const title = readString(input.args.title);
  if (!title) throw new Error("title is required");
  const requestedChanges = readString(input.args.requested_changes);
  if (!requestedChanges) throw new Error("requested_changes is required");
  const affectedUrls = readStringArray(input.args.affected_urls);
  if (affectedUrls.length === 0) throw new Error("affected_urls must contain at least one URL");
  const qaChecklist = readStringArray(input.args.qa_checklist);
  if (qaChecklist.length === 0) throw new Error("qa_checklist must contain at least one item");
  const acceptanceCriteria = readStringArray(input.args.acceptance_criteria);
  if (acceptanceCriteria.length === 0) {
    throw new Error("acceptance_criteria must contain at least one item");
  }

  const sourceEvidence = readString(input.args.source_evidence) ?? "Source evidence was not provided.";
  const followupWindows = readStringArray(input.args.followup_windows);
  const priority = readString(input.args.priority) ?? "medium";
  const productLane = readString(input.args.product_lane);
  const indexingRecommendation = readString(input.args.indexing_recommendation);
  const paperclipIssueKey = readString(input.args.paperclip_issue_key);
  const sourceOpportunityId = readString(input.args.source_opportunity_id);
  const dueDate = readString(input.args.due_date);
  const managerNote = readString(input.args.manager_note);
  const assigneeIds = config.assigneeByActionType[actionType] ?? [];

  const description = [
    section("Affected URLs", affectedUrls.map((url) => `- ${url}`)),
    section("Requested Changes", requestedChanges),
    section("Source Evidence", sourceEvidence),
    section("QA Checklist", qaChecklist.map((item) => `- ${item}`)),
    section("Acceptance Criteria", acceptanceCriteria.map((item) => `- ${item}`)),
    section("Indexing Recommendation", indexingRecommendation ?? "Not specified"),
    section("Follow-Up", followupWindows.length > 0 ? followupWindows.map((item) => `- ${item}`) : "Not specified"),
    section("Paperclip Reference", [
      paperclipIssueKey ? `- Issue: ${paperclipIssueKey}` : "",
      sourceOpportunityId ? `- Opportunity: ${sourceOpportunityId}` : "",
      productLane ? `- Product lane: ${productLane}` : "",
    ]),
    section("Manager Note", managerNote ?? ""),
  ].filter(Boolean).join("\n\n");

  return {
    project_id: projectId,
    project_manager_id: config.projectManagerId,
    assignee_ids: assigneeIds,
    action_type: actionType,
    title,
    description,
    priority,
    due_date: dueDate,
    metadata: {
      company: "DiskInternals",
      paperclip_company_id: "969d66ff-d77e-4dbf-8759-1a17c2bb17c2",
      paperclip_issue_key: paperclipIssueKey,
      source_opportunity_id: sourceOpportunityId,
      affected_urls: affectedUrls,
      product_lane: productLane,
      indexing_recommendation: indexingRecommendation,
      followup_windows: followupWindows,
    },
  };
}

function shouldDryRun(args: unknown, config: ReturnType<typeof normalizeConfig>) {
  if (isRecord(args) && typeof args.dry_run === "boolean") return args.dry_run;
  return config.defaultDryRun;
}

export function assertWriteAllowed(input: {
  args?: unknown;
  config: PerfexPluginConfig;
}) {
  const config = normalizeConfig(input.config);
  const dryRun = shouldDryRun(input.args, config);
  if (dryRun) return { allowed: false, reason: "dry_run", dryRun };
  if (!config.enableTaskWrites) {
    return { allowed: false, reason: "writes_disabled", dryRun };
  }
  return { allowed: true, reason: "enabled", dryRun };
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function toCreateTaskMcpArguments(payload: PerfexImplementationTaskPayload): PerfexCreateTaskMcpArguments {
  if (payload.assignee_ids.length === 0) {
    throw new Error("Perfex assignee_ids are required before task writes can be enabled");
  }
  if (!payload.project_manager_id) {
    throw new Error("Perfex project_manager_id is required before task writes can be enabled");
  }
  if (!payload.due_date) {
    throw new Error("due_date is required before writing a Perfex task");
  }

  return {
    project_id: payload.project_id,
    task_name: payload.title,
    description: payload.description,
    assignee_ids: payload.assignee_ids,
    follower_ids: [payload.project_manager_id],
    status: "1",
    priority: payload.priority,
    start_date: todayIsoDate(),
    due_date: payload.due_date,
    tags: [
      "Paperclip",
      "DiskInternals",
      payload.action_type,
      payload.metadata.paperclip_issue_key ?? "",
    ].filter(Boolean),
    created_by: payload.project_manager_id,
    has_write_permission: true,
  };
}

async function resolveToken(input: {
  config: PerfexPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
}) {
  const secretRef = readString(input.config.perfexMcpTokenSecretRef);
  if (!secretRef) throw new Error("Perfex MCP token secret is not configured");
  const token = await input.resolveSecret(secretRef);
  const normalized = readString(token);
  if (!normalized) throw new Error("Perfex MCP token secret resolved to an empty value");
  return normalized;
}

async function withClient<T>(input: {
  config: PerfexPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
  fetchFn?: FetchLike;
  run: (client: Client, normalized: ReturnType<typeof normalizeConfig>) => Promise<T>;
}) {
  const normalized = normalizeConfig(input.config);
  const token = await resolveToken(input);
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), normalized.requestTimeoutMs);
  const transport = new StreamableHTTPClientTransport(new URL(normalized.mcpUrl), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      signal: abortController.signal,
    },
    fetch: input.fetchFn,
  });
  const client = new Client(
    { name: PLUGIN_ID, version: PLUGIN_VERSION },
    { capabilities: {} },
  );

  try {
    await client.connect(transport);
    return await input.run(client, normalized);
  } finally {
    clearTimeout(timeout);
    await client.close().catch(() => undefined);
  }
}

function normalizeMcpResult(result: McpCallToolResult) {
  const text = Array.isArray(result.content)
    ? result.content
        .map((item) => isRecord(item) && typeof item.text === "string" ? item.text : "")
        .filter(Boolean)
        .join("\n")
    : "";
  return {
    isError: result.isError === true,
    content: text || JSON.stringify(result.structuredContent ?? result.content ?? {}, null, 2),
    data: {
      structuredContent: result.structuredContent ?? null,
      content: result.content ?? [],
    },
  };
}

export async function perfexHealthcheck(input: {
  config: PerfexPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
  fetchFn?: FetchLike;
}) {
  const normalized = normalizeConfig(input.config);
  const token = await resolveToken(input);
  const fetchImpl = input.fetchFn ?? fetch;
  const response = await fetchImpl(normalized.healthUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  return {
    content: JSON.stringify(
      {
        ok: response.ok,
        status: response.status,
        url: normalized.healthUrl,
      },
      null,
      2,
    ),
    data: {
      ok: response.ok,
      status: response.status,
      url: normalized.healthUrl,
    },
  };
}

export async function listPerfexMcpTools(input: {
  config: PerfexPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
  fetchFn?: FetchLike;
}) {
  return await withClient({
    ...input,
    async run(client) {
      const result = await client.listTools() as McpListToolsResult;
      const tools = Array.isArray(result.tools) ? result.tools : [];
      return {
        content: JSON.stringify(
          tools.map((tool) => ({
            name: tool.name,
            description: tool.description ?? "",
            inputSchema: tool.inputSchema ?? null,
          })),
          null,
          2,
        ),
        data: { tools },
      };
    },
  });
}

export async function callPerfexMcpTool(input: {
  toolName: string;
  args?: unknown;
  config: PerfexPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
  fetchFn?: FetchLike;
}) {
  return await withClient({
    config: input.config,
    resolveSecret: input.resolveSecret,
    fetchFn: input.fetchFn,
    async run(client) {
      const result = await client.callTool({
        name: input.toolName,
        arguments: isRecord(input.args) ? input.args : {},
      });
      return normalizeMcpResult(result as McpCallToolResult);
    },
  });
}
