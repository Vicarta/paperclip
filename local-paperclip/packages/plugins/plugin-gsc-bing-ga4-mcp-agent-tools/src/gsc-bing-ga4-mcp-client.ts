import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  DEFAULT_ALLOWED_SITE_URL,
  DEFAULT_GSC_BING_GA4_MCP_URL,
  SITE_SCOPED_MCP_TOOLS,
  VERIFIED_MCP_TOOL_NAMES,
  type VerifiedMcpToolName,
} from "./constants.js";

export type GscBingGa4McpPluginConfig = {
  gscBingGa4McpTokenSecretRef?: string;
  gscBingGa4McpUrl?: string;
  allowedSiteUrl?: string;
  allowedMcpToolNamesCsv?: string;
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

type McpListToolsResult = {
  tools?: Array<{
    name?: string;
    description?: string;
    inputSchema?: unknown;
  }>;
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

function parseCsv(value: unknown) {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeConfig(config: GscBingGa4McpPluginConfig) {
  const configuredTools = parseCsv(config.allowedMcpToolNamesCsv);
  const allowedToolNames = configuredTools.length > 0
    ? configuredTools
    : [...VERIFIED_MCP_TOOL_NAMES];

  return {
    mcpUrl: readNonEmptyString(config.gscBingGa4McpUrl) ?? DEFAULT_GSC_BING_GA4_MCP_URL,
    allowedSiteUrl: readNonEmptyString(config.allowedSiteUrl) ?? DEFAULT_ALLOWED_SITE_URL,
    allowedToolNames,
    requestTimeoutMs: readPositiveNumber(config.requestTimeoutMs) ?? 60_000,
  };
}

function assertAllowedTool(toolName: string, allowedToolNames: readonly string[]) {
  if (!allowedToolNames.includes(toolName)) {
    throw new Error(`GSC/Bing/GA4 MCP tool is not allowed: ${toolName}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeArguments(args: unknown): Record<string, unknown> {
  if (args == null) return {};
  if (!isRecord(args)) {
    throw new Error("GSC/Bing/GA4 MCP tool arguments must be an object");
  }
  return { ...args };
}

function isSiteScopedTool(toolName: string) {
  return (SITE_SCOPED_MCP_TOOLS as readonly string[]).includes(toolName);
}

function normalizeSiteArgValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function assertAndInjectAllowedSite(input: {
  toolName: string;
  args: Record<string, unknown>;
  allowedSiteUrl: string;
}) {
  const next = { ...input.args };

  for (const key of ["siteUrl", "site_url", "site"]) {
    const value = normalizeSiteArgValue(next[key]);
    if (value && value !== input.allowedSiteUrl) {
      throw new Error(
        `GSC/Bing/GA4 MCP site is not allowed: ${value}. Allowed site: ${input.allowedSiteUrl}`,
      );
    }
  }

  if (isSiteScopedTool(input.toolName) && !normalizeSiteArgValue(next.siteUrl)) {
    next.siteUrl = input.allowedSiteUrl;
  }

  return next;
}

export function prepareGscBingGa4McpArguments(input: {
  toolName: string;
  args?: unknown;
  allowedSiteUrl?: string;
  allowedToolNames?: readonly string[];
}) {
  assertAllowedTool(input.toolName, input.allowedToolNames ?? VERIFIED_MCP_TOOL_NAMES);
  return assertAndInjectAllowedSite({
    toolName: input.toolName,
    args: normalizeArguments(input.args),
    allowedSiteUrl:
      readNonEmptyString(input.allowedSiteUrl) ?? DEFAULT_ALLOWED_SITE_URL,
  });
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

export function normalizeGscBingGa4ToolResult(result: McpCallToolResult) {
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

async function resolveToken(input: {
  config: GscBingGa4McpPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
}) {
  const secretRef = readNonEmptyString(input.config.gscBingGa4McpTokenSecretRef);
  if (!secretRef) {
    throw new Error("GSC/Bing/GA4 MCP token secret is not configured");
  }

  const token = await input.resolveSecret(secretRef);
  if (!readNonEmptyString(token)) {
    throw new Error("GSC/Bing/GA4 MCP token secret resolved to an empty value");
  }
  return token.trim();
}

async function withClient<T>(input: {
  config: GscBingGa4McpPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
  fetchFn?: FetchLike;
  run: (
    client: Client,
    allowedSiteUrl: string,
    allowedToolNames: readonly string[],
  ) => Promise<T>;
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
    { name: "paperclip-gsc-bing-ga4-mcp-agent-tools", version: "0.1.0" },
    { capabilities: {} },
  );

  try {
    await client.connect(transport);
    return await input.run(client, normalized.allowedSiteUrl, normalized.allowedToolNames);
  } finally {
    clearTimeout(timeout);
    await client.close().catch(() => undefined);
  }
}

export async function listGscBingGa4McpTools(input: {
  config: GscBingGa4McpPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
  fetchFn?: FetchLike;
}) {
  return await withClient({
    ...input,
    async run(client, _allowedSiteUrl, allowedToolNames) {
      const result = await client.listTools() as McpListToolsResult;
      const tools = Array.isArray(result.tools) ? result.tools : [];
      const allowed = new Set<string>(allowedToolNames);
      return {
        content: JSON.stringify(
          tools
            .filter((tool) => typeof tool.name === "string" && allowed.has(tool.name))
            .map((tool) => ({
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

export async function callGscBingGa4McpTool(input: {
  toolName: string;
  args?: unknown;
  config: GscBingGa4McpPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
  fetchFn?: FetchLike;
}) {
  return await withClient({
    config: input.config,
    resolveSecret: input.resolveSecret,
    fetchFn: input.fetchFn,
    async run(client, allowedSiteUrl, allowedToolNames) {
      assertAllowedTool(input.toolName, allowedToolNames);
      const args = prepareGscBingGa4McpArguments({
        toolName: input.toolName,
        args: input.args,
        allowedSiteUrl,
        allowedToolNames,
      });

      const result = await client.callTool({
        name: input.toolName,
        arguments: args,
      });
      return normalizeGscBingGa4ToolResult(result as McpCallToolResult);
    },
  });
}
