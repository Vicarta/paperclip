import http from "node:http";
import https from "node:https";
import {
  DEFAULT_ALLOWED_GA4_PROPERTY_ID,
  DEFAULT_ALLOWED_SITE_URL,
  DEFAULT_GSC_BING_GA4_MCP_URL,
  GA4_PROPERTY_SCOPED_MCP_TOOLS,
  SITE_SCOPED_MCP_TOOLS,
  VERIFIED_MCP_TOOL_NAMES,
} from "./constants.js";

export type GscBingGa4McpPluginConfig = {
  gscBingGa4McpTokenSecretRef?: string;
  gscBingGa4McpUrl?: string;
  allowedSiteUrl?: string;
  allowedGa4PropertyId?: string;
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

type JsonRpcResponse = {
  jsonrpc?: string;
  id?: unknown;
  result?: unknown;
  error?: {
    code?: number;
    message?: string;
    data?: unknown;
  };
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
    allowedGa4PropertyId:
      readNonEmptyString(config.allowedGa4PropertyId) ?? DEFAULT_ALLOWED_GA4_PROPERTY_ID,
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

function isGa4PropertyScopedTool(toolName: string) {
  return (GA4_PROPERTY_SCOPED_MCP_TOOLS as readonly string[]).includes(toolName);
}

function normalizeSiteArgValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function urlBelongsToAllowedSite(urlValue: string, allowedSiteUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(urlValue);
  } catch {
    return false;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) return false;

  if (allowedSiteUrl.startsWith("sc-domain:")) {
    const allowedDomain = allowedSiteUrl.slice("sc-domain:".length).toLowerCase();
    const hostname = parsed.hostname.toLowerCase();
    return hostname === allowedDomain || hostname.endsWith(`.${allowedDomain}`);
  }

  try {
    const allowed = new URL(allowedSiteUrl);
    return parsed.origin === allowed.origin;
  } catch {
    return false;
  }
}

function normalizePropertyArgValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
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

  const inspectionUrl = normalizeSiteArgValue(next.inspectionUrl);
  if (inspectionUrl && !urlBelongsToAllowedSite(inspectionUrl, input.allowedSiteUrl)) {
    throw new Error(
      `GSC/Bing/GA4 MCP inspection URL is not allowed: ${inspectionUrl}. Allowed site: ${input.allowedSiteUrl}`,
    );
  }

  if (Array.isArray(next.urls)) {
    for (const value of next.urls) {
      const url = normalizeSiteArgValue(value);
      if (!url || !urlBelongsToAllowedSite(url, input.allowedSiteUrl)) {
        throw new Error(
          `GSC/Bing/GA4 MCP inspection URL is not allowed: ${String(value)}. Allowed site: ${input.allowedSiteUrl}`,
        );
      }
    }
  }

  return next;
}

function assertAndInjectAllowedGa4Property(input: {
  toolName: string;
  args: Record<string, unknown>;
  allowedGa4PropertyId: string;
}) {
  const next = { ...input.args };

  for (const key of ["propertyId", "property_id", "ga4PropertyId", "property"]) {
    const value = normalizePropertyArgValue(next[key]);
    if (value && value !== input.allowedGa4PropertyId) {
      throw new Error(
        `GSC/Bing/GA4 MCP GA4 property is not allowed: ${value}. Allowed property: ${input.allowedGa4PropertyId}`,
      );
    }
  }

  if (isGa4PropertyScopedTool(input.toolName) && !normalizePropertyArgValue(next.propertyId)) {
    next.propertyId = input.allowedGa4PropertyId;
  }

  return next;
}

export function prepareGscBingGa4McpArguments(input: {
  toolName: string;
  args?: unknown;
  allowedSiteUrl?: string;
  allowedGa4PropertyId?: string;
  allowedToolNames?: readonly string[];
}) {
  assertAllowedTool(input.toolName, input.allowedToolNames ?? VERIFIED_MCP_TOOL_NAMES);
  const siteScopedArgs = assertAndInjectAllowedSite({
    toolName: input.toolName,
    args: normalizeArguments(input.args),
    allowedSiteUrl:
      readNonEmptyString(input.allowedSiteUrl) ?? DEFAULT_ALLOWED_SITE_URL,
  });
  return assertAndInjectAllowedGa4Property({
    toolName: input.toolName,
    args: siteScopedArgs,
    allowedGa4PropertyId:
      readNonEmptyString(input.allowedGa4PropertyId) ?? DEFAULT_ALLOWED_GA4_PROPERTY_ID,
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

function parseJsonRpcPayload(text: string): JsonRpcResponse {
  const trimmed = text.trim();
  if (!trimmed) return {};
  const parsed = JSON.parse(trimmed) as JsonRpcResponse;
  if (parsed.error) {
    throw new Error(parsed.error.message || `MCP JSON-RPC error ${parsed.error.code ?? ""}`.trim());
  }
  return parsed;
}

async function postJsonRpc(input: {
  mcpUrl: string;
  token: string;
  requestTimeoutMs: number;
  body: unknown;
  sessionId?: string | null;
}) {
  const url = new URL(input.mcpUrl);
  const transport = url.protocol === "https:" ? https : http;
  const body = JSON.stringify(input.body);

  return await new Promise<{ payload: JsonRpcResponse; sessionId: string | null }>((resolve, reject) => {
    const req = transport.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.token}`,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "Content-Length": Buffer.byteLength(body),
          ...(input.sessionId ? { "mcp-session-id": input.sessionId } : {}),
        },
        timeout: input.requestTimeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          const nextSession = Array.isArray(res.headers["mcp-session-id"])
            ? res.headers["mcp-session-id"][0] ?? null
            : res.headers["mcp-session-id"] ?? null;

          if ((res.statusCode ?? 500) >= 400) {
            try {
              const payload = parseJsonRpcPayload(text);
              reject(new Error(payload.error?.message || `MCP HTTP ${res.statusCode}`));
            } catch (error) {
              reject(error instanceof Error ? error : new Error(`MCP HTTP ${res.statusCode}`));
            }
            return;
          }

          try {
            resolve({ payload: parseJsonRpcPayload(text), sessionId: nextSession });
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("GSC/Bing/GA4 MCP request timed out")));
    req.on("error", reject);
    req.end(body);
  });
}

async function withMcpSession<T>(input: {
  config: GscBingGa4McpPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
  run: (
    session: {
      call(method: string, params?: Record<string, unknown>): Promise<unknown>;
    },
    allowedSiteUrl: string,
    allowedGa4PropertyId: string,
    allowedToolNames: readonly string[],
  ) => Promise<T>;
}) {
  const normalized = normalizeConfig(input.config);
  const token = await resolveToken(input);
  let nextId = 1;

  const init = await postJsonRpc({
    mcpUrl: normalized.mcpUrl,
    token,
    requestTimeoutMs: normalized.requestTimeoutMs,
    body: {
      jsonrpc: "2.0",
      id: nextId++,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: {
          name: "paperclip-gsc-bing-ga4-mcp-agent-tools",
          version: "0.1.0",
        },
      },
    },
  });
  const sessionId = init.sessionId;
  if (!sessionId) throw new Error("GSC/Bing/GA4 MCP initialize did not return a session id");

  await postJsonRpc({
    mcpUrl: normalized.mcpUrl,
    token,
    requestTimeoutMs: normalized.requestTimeoutMs,
    sessionId,
    body: {
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    },
  });

  const session = {
    async call(method: string, params?: Record<string, unknown>) {
      const response = await postJsonRpc({
        mcpUrl: normalized.mcpUrl,
        token,
        requestTimeoutMs: normalized.requestTimeoutMs,
        sessionId,
        body: {
          jsonrpc: "2.0",
          id: nextId++,
          method,
          params: params ?? {},
        },
      });
      return response.payload.result;
    },
  };

  return await input.run(
    session,
    normalized.allowedSiteUrl,
    normalized.allowedGa4PropertyId,
    normalized.allowedToolNames,
  );
}

export async function listGscBingGa4McpTools(input: {
  config: GscBingGa4McpPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
  fetchFn?: FetchLike;
}) {
  return await withMcpSession({
    ...input,
    async run(session, _allowedSiteUrl, _allowedGa4PropertyId, allowedToolNames) {
      const result = await session.call("tools/list") as McpListToolsResult;
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
  return await withMcpSession({
    config: input.config,
    resolveSecret: input.resolveSecret,
    async run(session, allowedSiteUrl, allowedGa4PropertyId, allowedToolNames) {
      assertAllowedTool(input.toolName, allowedToolNames);
      const args = prepareGscBingGa4McpArguments({
        toolName: input.toolName,
        args: input.args,
        allowedSiteUrl,
        allowedGa4PropertyId,
        allowedToolNames,
      });

      const result = await session.call("tools/call", {
        name: input.toolName,
        arguments: args,
      });
      return normalizeGscBingGa4ToolResult(result as McpCallToolResult);
    },
  });
}
