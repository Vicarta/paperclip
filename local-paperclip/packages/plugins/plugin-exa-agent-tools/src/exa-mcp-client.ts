import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { DEFAULT_EXA_MCP_URL } from "./constants.js";

export type ExaPluginConfig = {
  exaApiKeySecretRef?: string;
  exaMcpUrl?: string;
  costAccountingMode?: "disabled" | "estimated_per_request";
  estimatedWebSearchCostUsd?: number;
  estimatedCrawlUrlCostUsd?: number;
  estimatedCodeContextCostUsd?: number;
};

export type ExaToolName = "web_search_exa" | "crawling_exa" | "get_code_context_exa";

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
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function buildToolUrl(baseUrl: string | undefined, toolName: ExaToolName, apiKey: string | null) {
  const url = new URL(readNonEmptyString(baseUrl) ?? DEFAULT_EXA_MCP_URL);
  if (!url.searchParams.has("tools")) {
    url.searchParams.set("tools", toolName);
  }
  if (apiKey && !url.searchParams.has("exaApiKey")) {
    url.searchParams.set("exaApiKey", apiKey);
  }
  return url;
}

function flattenToolContent(content: unknown[] | undefined) {
  if (!Array.isArray(content) || content.length === 0) return null;
  const textParts = content
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const candidate = entry as McpTextContent;
      return candidate.type === "text" && typeof candidate.text === "string"
        ? candidate.text.trim()
        : null;
    })
    .filter((value): value is string => Boolean(value));

  if (textParts.length > 0) return textParts.join("\n\n");
  return JSON.stringify(content);
}

export function normalizeExaToolResult(result: McpCallToolResult) {
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

export async function callExaMcpTool(input: {
  toolName: ExaToolName;
  args: Record<string, unknown>;
  config: ExaPluginConfig;
  resolveSecret: (secretRef: string) => Promise<string>;
}) {
  const secretRef = readNonEmptyString(input.config.exaApiKeySecretRef);
  const apiKey = secretRef ? await input.resolveSecret(secretRef) : null;
  const endpoint = buildToolUrl(input.config.exaMcpUrl, input.toolName, apiKey);

  const transport = new StreamableHTTPClientTransport(endpoint);
  const client = new Client(
    { name: "paperclip-exa-agent-tools", version: "0.1.0" },
    { capabilities: {} },
  );

  try {
    await client.connect(transport);
    const result = await client.callTool({
      name: input.toolName,
      arguments: input.args,
    });
    return normalizeExaToolResult(result as McpCallToolResult);
  } finally {
    await transport.terminateSession().catch(() => undefined);
    await client.close().catch(() => undefined);
  }
}
