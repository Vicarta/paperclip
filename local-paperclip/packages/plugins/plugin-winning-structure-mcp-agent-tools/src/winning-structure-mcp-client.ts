import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  DEFAULT_WINNING_STRUCTURE_MCP_URL,
  MCP_TOOL_NAMES,
  PLUGIN_ID,
  PLUGIN_VERSION,
  type WinningStructureMcpToolName,
} from "./constants.js";

export type WinningStructureMcpPluginConfig = {
  winningStructureMcpTokenSecretRef?: string;
  winningStructureMcpUrl?: string;
  allowedClientKeysCsv?: string;
  requestTimeoutMs?: number;
  costAccountingMode?: "provider_reported" | "disabled";
};

type FetchLike = typeof fetch;

type McpTextContent = {
  type?: string;
  text?: string;
};

type McpCallToolResult = {
  content?: unknown[];
  structuredContent?: unknown;
  isError?: boolean;
};

type McpListToolsResult = {
  tools?: Array<{ name?: unknown }>;
};

export type WinningStructureResultClassification = {
  state:
    | "active"
    | "paused"
    | "completed"
    | "stale_decision"
    | "decision_conflict"
    | "expired"
    | "validation_error"
    | "terminal_error"
    | "remote_tool_error"
    | "unknown";
  status: string | null;
  errors: string[];
  retryable: false;
};

export type WinningStructureProviderCost = {
  amountUsd: number;
  currency: string;
  runId: string | null;
};

const ACTIVE_STATUSES = new Set([
  "queued",
  "validating_input",
  "discovering_site_ownership",
  "evaluating_reader_added_value",
  "fetching_serp",
  "applying_run_decision",
]);

const PAUSED_STATUSES = new Set([
  "awaiting_ownership_decision",
  "awaiting_added_value_input",
]);

const TERMINAL_ERROR_STATUSES = new Set([
  "failed",
  "cancelled",
  "unresolved_ownership_conflict",
  "unresolved_added_value_requirement",
]);

const STALE_DECISION_ERRORS = new Set([
  "decision_not_pending_or_stale",
  "stale_decision_version",
  "run_is_not_awaiting_a_decision",
]);

function readNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readPositiveNumber(value: unknown) {
  const numeric = typeof value === "string" && value.trim().length > 0
    ? Number(value)
    : value;
  return typeof numeric === "number" && Number.isFinite(numeric) && numeric > 0
    ? numeric
    : null;
}

function readNonNegativeNumber(value: unknown) {
  const numeric = typeof value === "string" && value.trim().length > 0
    ? Number(value)
    : value;
  return typeof numeric === "number" && Number.isFinite(numeric) && numeric >= 0
    ? numeric
    : null;
}

function normalizeConfig(config: WinningStructureMcpPluginConfig) {
  const mcpUrl = readNonEmptyString(config.winningStructureMcpUrl)
    ?? DEFAULT_WINNING_STRUCTURE_MCP_URL;
  if (!mcpUrl) {
    throw new Error("Winning Structure MCP URL is not configured");
  }

  return {
    mcpUrl,
    allowedClientKeys: parseAllowedClientKeys(config.allowedClientKeysCsv),
    requestTimeoutMs: readPositiveNumber(config.requestTimeoutMs) ?? 180_000,
  };
}

function parseAllowedClientKeys(value: unknown) {
  const raw = readNonEmptyString(value);
  if (!raw) return new Set<string>();
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

function assertAllowedTool(toolName: string): asserts toolName is WinningStructureMcpToolName {
  if (!(MCP_TOOL_NAMES as readonly string[]).includes(toolName)) {
    throw new Error(`Winning Structure MCP tool is not allowed: ${toolName}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeArguments(args: unknown): Record<string, unknown> {
  if (args == null) return {};
  if (!isRecord(args)) {
    throw new Error("Winning Structure MCP tool arguments must be an object");
  }
  return { ...args };
}

function payloadFromArguments(args: Record<string, unknown>) {
  return isRecord(args.payload) ? args.payload : args;
}

function assertRequiredString(payload: Record<string, unknown>, key: string) {
  if (!readNonEmptyString(payload[key])) {
    throw new Error(`Winning Structure MCP ${key} is required`);
  }
}

function assertOperationArguments(
  toolName: WinningStructureMcpToolName,
  args: Record<string, unknown>,
) {
  const payload = payloadFromArguments(args);
  for (const key of ["company_id", "project_id", "client_key"]) {
    assertRequiredString(payload, key);
  }

  if (toolName === "validate_task_input" || toolName === "start_winning_structure_run") {
    assertRequiredString(payload, "idempotency_key");
    for (const forbiddenKey of ["task_input", "namespace", "run_id", "decisions"]) {
      if (payload[forbiddenKey] !== undefined) {
        throw new Error(
          `Winning Structure MCP ${forbiddenKey} is not allowed in task payload`,
        );
      }
    }
    if (!isRecord(payload.task)) {
      throw new Error("Winning Structure MCP task is required");
    }
    if (!isRecord(payload.market)) {
      throw new Error("Winning Structure MCP market is required");
    }
  } else {
    assertRequiredString(payload, "run_id");
  }

  if (toolName === "submit_run_decisions") {
    if (!Array.isArray(payload.decisions) || payload.decisions.length !== 1) {
      throw new Error("Winning Structure MCP requires exactly one pending decision");
    }
  }
}

function assertAllowedClientKey(input: {
  args: Record<string, unknown>;
  allowedClientKeys: ReadonlySet<string>;
}) {
  if (input.allowedClientKeys.size === 0) return;

  const payload = payloadFromArguments(input.args);
  const clientKey = readNonEmptyString(payload.client_key);
  if (!clientKey) {
    throw new Error("Winning Structure MCP client_key is required by plugin allowlist");
  }
  if (!input.allowedClientKeys.has(clientKey)) {
    throw new Error(`Winning Structure MCP client_key is not allowed: ${clientKey}`);
  }
}

export function prepareWinningStructureMcpArguments(input: {
  toolName: string;
  args?: unknown;
  allowedClientKeys?: ReadonlySet<string>;
}) {
  assertAllowedTool(input.toolName);
  const args = normalizeArguments(input.args);
  const mcpArgs = isRecord(args.payload) ? args : { payload: args };
  assertOperationArguments(input.toolName, mcpArgs);
  assertAllowedClientKey({
    args: mcpArgs,
    allowedClientKeys: input.allowedClientKeys ?? new Set<string>(),
  });
  return mcpArgs;
}

function textToolContent(content: unknown[] | undefined) {
  if (!Array.isArray(content) || content.length === 0) return [];
  return content
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const candidate = entry as McpTextContent;
      return candidate.type === "text" && typeof candidate.text === "string"
        ? candidate.text.trim()
        : null;
    })
    .filter((value): value is string => Boolean(value));
}

function parseJsonRecord(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function primaryPayload(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  return isRecord(value.result) ? value.result : value;
}

function resultPayload(result: McpCallToolResult) {
  const structured = primaryPayload(result.structuredContent);
  if (structured) return structured;
  for (const text of textToolContent(result.content)) {
    const parsed = primaryPayload(parseJsonRecord(text));
    if (parsed) return parsed;
  }
  return null;
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => readNonEmptyString(entry))
    .filter((entry): entry is string => entry !== null);
}

export function classifyWinningStructureResult(
  payload: Record<string, unknown> | null,
  isError = false,
): WinningStructureResultClassification {
  const status = readNonEmptyString(payload?.status);
  const errors = readStringArray(payload?.errors);
  const singleError = readNonEmptyString(payload?.error);
  const valid = payload?.valid;
  if (singleError) errors.push(singleError);

  let state: WinningStructureResultClassification["state"] = "unknown";
  if (valid === false) {
    state = "validation_error";
  } else if (errors.some((error) => STALE_DECISION_ERRORS.has(error))) {
    state = "stale_decision";
  } else if (errors.includes("decision_version_already_resolved_with_different_response")) {
    state = "decision_conflict";
  } else if (status === "completed_expired_artifacts") {
    state = "expired";
  } else if (status === "validation_failed") {
    state = "validation_error";
  } else if (status && PAUSED_STATUSES.has(status)) {
    state = "paused";
  } else if (status === "completed") {
    state = "completed";
  } else if (status && ACTIVE_STATUSES.has(status)) {
    state = "active";
  } else if (status && TERMINAL_ERROR_STATUSES.has(status)) {
    state = "terminal_error";
  } else if (isError || errors.length > 0) {
    state = "remote_tool_error";
  }

  return { state, status, errors, retryable: false };
}

function compactSummary(
  payload: Record<string, unknown> | null,
  classification: WinningStructureResultClassification,
) {
  if (!payload) return { classification };

  const summary: Record<string, unknown> = { classification };
  const scalarKeys = [
    "run_id",
    "status",
    "stage",
    "valid",
    "accepted",
    "reused_submission",
    "reused_existing_run",
    "input_hash",
    "effective_input_hash",
    "decision_set_version",
    "human_review_required",
    "expires_at",
  ];
  for (const key of scalarKeys) {
    if (payload[key] !== undefined) summary[key] = payload[key];
  }

  const arrayKeys = [
    "errors",
    "warnings",
    "validation_issues",
    "human_review_reasons",
    "quality_flags",
    "decision_requests",
  ];
  for (const key of arrayKeys) {
    if (Array.isArray(payload[key]) && payload[key].length > 0) {
      summary[key] = payload[key];
    }
  }
  if (readNonEmptyString(payload.error)) summary.error = payload.error;
  if (isRecord(payload.cost)) summary.cost = payload.cost;
  if (isRecord(payload.retention)) summary.retention = payload.retention;
  if (Array.isArray(payload.winning_structure)) {
    summary.winning_structure_count = payload.winning_structure.length;
  }
  if (Array.isArray(payload.added_value_plans)) {
    summary.added_value_plan_count = payload.added_value_plans.length;
  }
  if (isRecord(payload.artifacts)) {
    summary.artifact_keys = Object.keys(payload.artifacts).sort();
  }
  return summary;
}

function redactSensitiveText(value: string) {
  return value
    .replace(/authorization\s*[:=]\s*bearer\s+[^\s,;}]+/gi, "Authorization: Bearer [REDACTED]")
    .replace(/bearer\s+[^\s,;}]+/gi, "Bearer [REDACTED]");
}

export function extractWinningStructureProviderCost(
  payload: Record<string, unknown> | null,
): WinningStructureProviderCost | null {
  if (!payload || readNonEmptyString(payload.status) !== "completed") return null;

  const candidates = [
    payload.cost,
    isRecord(payload.metadata) ? payload.metadata.cost : null,
    isRecord(payload.status_metadata) ? payload.status_metadata.cost : null,
  ];
  const cost = candidates.find(isRecord);
  if (!cost) return null;

  const amountUsd = readNonNegativeNumber(cost.total_estimated)
    ?? readNonNegativeNumber(cost.total);
  if (amountUsd === null) return null;

  return {
    amountUsd,
    currency: readNonEmptyString(cost.currency)?.toUpperCase() ?? "USD",
    runId: readNonEmptyString(payload.run_id),
  };
}

export function normalizeWinningStructureToolResult(
  result: McpCallToolResult,
  options: { exposeFullPayload?: boolean } = {},
) {
  const payload = resultPayload(result);
  const classification = classifyWinningStructureResult(payload, result.isError === true);
  const summary = compactSummary(payload, classification);
  const textFallback = textToolContent(result.content)[0];
  const content = payload
    ? redactSensitiveText(JSON.stringify(options.exposeFullPayload ? payload : summary))
    : redactSensitiveText(textFallback ?? JSON.stringify(summary));

  return {
    isError: result.isError === true,
    content,
    data: {
      structuredContent: result.structuredContent ?? null,
      content: result.content ?? [],
      classification,
    },
    providerCost: extractWinningStructureProviderCost(payload),
  };
}

export function assertWinningStructureMcpToolContract(tools: unknown) {
  const listedNames = new Set(
    (Array.isArray(tools) ? tools : [])
      .map((tool) => isRecord(tool) ? readNonEmptyString(tool.name) : null)
      .filter((name): name is string => name !== null),
  );
  const missingTools = MCP_TOOL_NAMES.filter((name) => !listedNames.has(name));
  if (missingTools.length > 0) {
    throw new Error(
      `Winning Structure MCP is missing required tools: ${missingTools.join(", ")}`,
    );
  }
  return [...MCP_TOOL_NAMES];
}

async function resolveOptionalToken(input: {
  config: WinningStructureMcpPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
}) {
  const secretRef = readNonEmptyString(input.config.winningStructureMcpTokenSecretRef);
  if (!secretRef) return null;

  const token = await input.resolveSecret(secretRef);
  const normalized = readNonEmptyString(token);
  if (!normalized) {
    throw new Error("Winning Structure MCP token secret resolved to an empty value");
  }
  return normalized;
}

function safeMcpError(error: unknown, token: string | null) {
  const raw = error instanceof Error ? error.message : String(error);
  const withoutToken = token ? raw.split(token).join("[REDACTED]") : raw;
  return new Error(`Winning Structure MCP request failed: ${redactSensitiveText(withoutToken)}`);
}

async function withClient<T>(input: {
  config: WinningStructureMcpPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
  fetchFn?: FetchLike;
  run: (client: Client, allowedClientKeys: ReadonlySet<string>) => Promise<T>;
}) {
  const normalized = normalizeConfig(input.config);
  const token = await resolveOptionalToken(input);
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), normalized.requestTimeoutMs);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const transport = new StreamableHTTPClientTransport(new URL(normalized.mcpUrl), {
    requestInit: {
      headers,
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
    return await input.run(client, normalized.allowedClientKeys);
  } catch (error) {
    throw safeMcpError(error, token);
  } finally {
    clearTimeout(timeout);
    await transport.terminateSession().catch(() => undefined);
    await client.close().catch(() => undefined);
  }
}

async function verifyClientTools(client: Client) {
  const result = await client.listTools() as McpListToolsResult;
  return assertWinningStructureMcpToolContract(result.tools);
}

export async function verifyWinningStructureMcpContract(input: {
  config: WinningStructureMcpPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
  fetchFn?: FetchLike;
}) {
  return await withClient({
    ...input,
    async run(client) {
      return await verifyClientTools(client);
    },
  });
}

export async function callWinningStructureMcpTool(input: {
  toolName: string;
  args?: unknown;
  config: WinningStructureMcpPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
  fetchFn?: FetchLike;
}) {
  assertAllowedTool(input.toolName);
  return await withClient({
    config: input.config,
    resolveSecret: input.resolveSecret,
    fetchFn: input.fetchFn,
    async run(client, allowedClientKeys) {
      await verifyClientTools(client);
      const args = prepareWinningStructureMcpArguments({
        toolName: input.toolName,
        args: input.args,
        allowedClientKeys,
      });

      const result = await client.callTool({
        name: input.toolName,
        arguments: args,
      });
      return normalizeWinningStructureToolResult(
        result as McpCallToolResult,
        { exposeFullPayload: input.toolName === "get_run_result" },
      );
    },
  });
}
