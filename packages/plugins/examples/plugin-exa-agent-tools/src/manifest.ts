import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import { DEFAULT_EXA_MCP_URL, PLUGIN_ID, PLUGIN_VERSION, TOOL_NAMES } from "./constants.js";

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "Exa Agent Tools",
  description: "Agent tools for web search, crawling, and code-context lookup via the official Exa MCP endpoint.",
  author: "Paperclip",
  categories: ["connector", "automation"],
  capabilities: [
    "http.outbound",
    "secrets.read-ref",
    "agent.tools.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      exaApiKeySecretRef: {
        type: "string",
        title: "Exa API Key Secret Ref",
        description: "Paperclip secret UUID that stores the Exa API key. Leave empty to use Exa's hosted free plan limits.",
        default: "",
      },
      exaMcpUrl: {
        type: "string",
        title: "Exa MCP URL",
        description: "Remote Exa MCP endpoint. Defaults to the official hosted endpoint.",
        default: DEFAULT_EXA_MCP_URL,
      },
    },
  },
  tools: [
    {
      name: TOOL_NAMES.webSearch,
      displayName: "Exa Web Search",
      description: "Search the web with Exa and return compact, LLM-ready context.",
      parametersSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          numResults: { type: "number" },
          livecrawl: { type: "string", enum: ["fallback", "preferred"] },
          type: { type: "string", enum: ["auto", "fast"] },
          category: { type: "string" },
          contextMaxCharacters: { type: "number" },
        },
        required: ["query"],
      },
    },
    {
      name: TOOL_NAMES.crawlUrl,
      displayName: "Exa Crawl URL",
      description: "Fetch and extract the content of a known webpage URL with Exa.",
      parametersSchema: {
        type: "object",
        properties: {
          url: { type: "string" },
          subpages: { type: "number" },
          text: { type: "boolean" },
          livecrawl: { type: "string", enum: ["fallback", "preferred"] },
        },
        required: ["url"],
      },
    },
    {
      name: TOOL_NAMES.codeContext,
      displayName: "Exa Code Context",
      description: "Find code examples, official docs, and implementation references with Exa.",
      parametersSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          tokensNum: { type: "number" },
        },
        required: ["query"],
      },
    },
  ],
};

export default manifest;
