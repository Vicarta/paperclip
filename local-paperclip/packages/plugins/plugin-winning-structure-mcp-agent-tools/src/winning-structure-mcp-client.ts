import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
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

function readNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function normalizeConfig(config: WinningStructureMcpPluginConfig) {
  const mcpUrl = readNonEmptyString(config.winningStructureMcpUrl);
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

function assertAllowedClientKey(input: {
  args: Record<string, unknown>;
  allowedClientKeys: ReadonlySet<string>;
  requireClientKey: boolean;
}) {
  if (input.allowedClientKeys.size === 0) return;

  const payload = isRecord(input.args.payload) ? input.args.payload : null;
  const clientKey = readNonEmptyString(input.args.client_key)
    ?? readNonEmptyString(payload?.client_key);
  if (!input.requireClientKey && !clientKey) return;
  if (!clientKey) {
    throw new Error("Winning Structure MCP client_key is required by plugin allowlist");
  }
  if (!input.allowedClientKeys.has(clientKey)) {
    throw new Error(`Winning Structure MCP client_key is not allowed: ${clientKey}`);
  }
}

function shouldWrapPayload(toolName: WinningStructureMcpToolName) {
  return (MCP_TOOL_NAMES as readonly string[]).includes(toolName);
}

function requiresClientKey(toolName: WinningStructureMcpToolName) {
  return toolName === "validate_task_input" || toolName === "start_winning_structure_run";
}

export function prepareWinningStructureMcpArguments(input: {
  toolName: string;
  args?: unknown;
  allowedClientKeys?: ReadonlySet<string>;
}) {
  assertAllowedTool(input.toolName);
  const args = normalizeArguments(input.args);
  const mcpArgs = shouldWrapPayload(input.toolName) && !isRecord(args.payload)
    ? { payload: args }
    : args;
  assertAllowedClientKey({
    args: mcpArgs,
    allowedClientKeys: input.allowedClientKeys ?? new Set<string>(),
    requireClientKey: requiresClientKey(input.toolName),
  });
  return mcpArgs;
}

function flattenToolContent(content: unknown[] | undefined) {
  if (!Array.isArray(content) || content.length === 0) return null;
  const textParts = content
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const candidate = entry as McpTextContent;
      return candidate.type === "text" && typeof candidate.text === "string"
        ? candidate.text.trim()
        : null;
    })
    .filter((value): value is string => Boolean(value));

  if (textParts.length > 0) return textParts.join("\n\n");
  return JSON.stringify(content);
}

export function normalizeWinningStructureToolResult(result: McpCallToolResult) {
  const content = flattenToolContent(result.content) ?? (
    result.structuredContent == null
      ? null
      : JSON.stringify(result.structuredContent, null, 2)
  );

  return {
    isError: result.isError === true,
    content: content ?? "",
    data: {
      structuredContent: result.structuredContent ?? null,
      content: result.content ?? [],
    },
  };
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
  } finally {
    clearTimeout(timeout);
    await transport.terminateSession().catch(() => undefined);
    await client.close().catch(() => undefined);
  }
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
      const args = prepareWinningStructureMcpArguments({
        toolName: input.toolName,
        args: input.args,
        allowedClientKeys,
      });

      const result = await client.callTool({
        name: input.toolName,
        arguments: args,
      });
      return normalizeWinningStructureToolResult(result as McpCallToolResult);
    },
  });
}
