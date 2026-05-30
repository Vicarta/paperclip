import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  DEFAULT_ALLOWED_SITE_URL,
  DEFAULT_SEARCH_CONSOLE_MCP_URL,
  MCP_TOOL_NAMES,
  SITE_SCOPED_MCP_TOOLS,
  type SearchConsoleMcpToolName,
} from "./constants.js";

export type SearchConsoleMcpPluginConfig = {
  searchConsoleMcpTokenSecretRef?: string;
  searchConsoleMcpUrl?: string;
  allowedSiteUrl?: string;
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

function normalizeConfig(config: SearchConsoleMcpPluginConfig) {
  return {
    mcpUrl: readNonEmptyString(config.searchConsoleMcpUrl) ?? DEFAULT_SEARCH_CONSOLE_MCP_URL,
    allowedSiteUrl: readNonEmptyString(config.allowedSiteUrl) ?? DEFAULT_ALLOWED_SITE_URL,
    requestTimeoutMs: readPositiveNumber(config.requestTimeoutMs) ?? 60_000,
  };
}

function assertAllowedTool(toolName: string): asserts toolName is SearchConsoleMcpToolName {
  if (!(MCP_TOOL_NAMES as readonly string[]).includes(toolName)) {
    throw new Error(`Search Console MCP tool is not allowed: ${toolName}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeArguments(args: unknown): Record<string, unknown> {
  if (args == null) return {};
  if (!isRecord(args)) {
    throw new Error("Search Console MCP tool arguments must be an object");
  }
  return { ...args };
}

function isSiteScopedTool(toolName: SearchConsoleMcpToolName) {
  return (SITE_SCOPED_MCP_TOOLS as readonly string[]).includes(toolName);
}

function normalizeSiteArgValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function assertAndInjectAllowedSite(input: {
  toolName: SearchConsoleMcpToolName;
  args: Record<string, unknown>;
  allowedSiteUrl: string;
}) {
  const next = { ...input.args };

  for (const key of ["siteUrl", "site_url", "site"]) {
    const value = normalizeSiteArgValue(next[key]);
    if (value && value !== input.allowedSiteUrl) {
      throw new Error(
        `Search Console MCP site is not allowed: ${value}. Allowed site: ${input.allowedSiteUrl}`,
      );
    }
  }

  if (isSiteScopedTool(input.toolName) && !normalizeSiteArgValue(next.siteUrl)) {
    next.siteUrl = input.allowedSiteUrl;
  }

  return next;
}

export function prepareSearchConsoleMcpArguments(input: {
  toolName: string;
  args?: unknown;
  allowedSiteUrl?: string;
}) {
  assertAllowedTool(input.toolName);
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

export function normalizeSearchConsoleToolResult(result: McpCallToolResult) {
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
  config: SearchConsoleMcpPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
}) {
  const secretRef = readNonEmptyString(input.config.searchConsoleMcpTokenSecretRef);
  if (!secretRef) {
    throw new Error("Search Console MCP token secret is not configured");
  }

  const token = await input.resolveSecret(secretRef);
  if (!readNonEmptyString(token)) {
    throw new Error("Search Console MCP token secret resolved to an empty value");
  }
  return token.trim();
}

async function withClient<T>(input: {
  config: SearchConsoleMcpPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
  fetchFn?: FetchLike;
  run: (client: Client, allowedSiteUrl: string) => Promise<T>;
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
    { name: "paperclip-search-console-mcp-agent-tools", version: "0.1.0" },
    { capabilities: {} },
  );

  try {
    await client.connect(transport);
    return await input.run(client, normalized.allowedSiteUrl);
  } finally {
    clearTimeout(timeout);
    await transport.terminateSession().catch(() => undefined);
    await client.close().catch(() => undefined);
  }
}

export async function listSearchConsoleMcpTools(input: {
  config: SearchConsoleMcpPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
  fetchFn?: FetchLike;
}) {
  return await withClient({
    ...input,
    async run(client) {
      const result = await client.listTools() as McpListToolsResult;
      const tools = Array.isArray(result.tools) ? result.tools : [];
      const allowed = new Set<string>(MCP_TOOL_NAMES);
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

export async function callSearchConsoleMcpTool(input: {
  toolName: string;
  args?: unknown;
  config: SearchConsoleMcpPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
  fetchFn?: FetchLike;
}) {
  assertAllowedTool(input.toolName);
  return await withClient({
    config: input.config,
    resolveSecret: input.resolveSecret,
    fetchFn: input.fetchFn,
    async run(client, allowedSiteUrl) {
      const args = prepareSearchConsoleMcpArguments({
        toolName: input.toolName,
        args: input.args,
        allowedSiteUrl,
      });

      const result = await client.callTool({
        name: input.toolName,
        arguments: args,
      });
      return normalizeSearchConsoleToolResult(result as McpCallToolResult);
    },
  });
}
