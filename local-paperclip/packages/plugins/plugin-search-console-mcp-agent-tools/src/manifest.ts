import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import {
  DEFAULT_ALLOWED_SITE_URL,
  DEFAULT_SEARCH_CONSOLE_MCP_URL,
  EXPORT_NAMES,
  MCP_TOOL_NAMES,
  PLUGIN_ID,
  PLUGIN_VERSION,
  SLOT_IDS,
  TOOL_NAMES,
} from "./constants.js";

const looseObjectSchema = {
  type: "object",
  additionalProperties: true,
} as const;

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "Search Console MCP Agent Tools",
  description:
    "Thin server-side adapter for a private Google Search Console MCP endpoint. Agents call allowlisted tools; endpoint and bearer token stay in backend plugin config.",
  author: "Paperclip",
  categories: ["connector", "automation"],
  capabilities: [
    "http.outbound",
    "secrets.read-ref",
    "agent.tools.register",
    "instance.settings.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      searchConsoleMcpTokenSecretRef: {
        type: "string",
        format: "secret-ref",
        title: "Search Console MCP Token Secret Ref",
        description:
          "Paperclip secret UUID that stores the Astrogen tenant token. Agents never receive the plaintext token.",
        default: "",
      },
      searchConsoleMcpUrl: {
        type: "string",
        title: "Search Console MCP URL",
        description:
          "Private Tailscale-only Search Console MCP Streamable HTTP endpoint.",
        default: DEFAULT_SEARCH_CONSOLE_MCP_URL,
      },
      allowedSiteUrl: {
        type: "string",
        title: "Allowed Search Console Site URL",
        description:
          "Plugin-side site allowlist. Calls with another siteUrl/site_url/site are rejected before reaching MCP.",
        default: DEFAULT_ALLOWED_SITE_URL,
      },
      requestTimeoutMs: {
        type: "number",
        title: "Request Timeout Ms",
        description: "Timeout for one MCP connection/call.",
        default: 60000,
      },
    },
  },
  ui: {
    slots: [
      {
        type: "settingsPage",
        id: SLOT_IDS.settingsPage,
        displayName: "Search Console MCP Settings",
        exportName: EXPORT_NAMES.settingsPage,
      },
    ],
  },
  tools: [
    {
      name: TOOL_NAMES.listTools,
      displayName: "Search Console MCP List Tools",
      description: "List allowlisted tools exposed by the private Search Console MCP server.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.callTool,
      displayName: "Search Console MCP Call Tool",
      description:
        "Call one allowlisted Search Console MCP tool. Endpoint and bearer token are injected only by the plugin backend.",
      parametersSchema: {
        type: "object",
        properties: {
          toolName: { type: "string", enum: [...MCP_TOOL_NAMES] },
          arguments: looseObjectSchema,
        },
        required: ["toolName"],
      },
    },
    {
      name: TOOL_NAMES.sitesList,
      displayName: "GSC Sites List",
      description: "Call Search Console MCP `sites_list`.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.analyticsTopQueries,
      displayName: "GSC Analytics Top Queries",
      description: "Call Search Console MCP `analytics_top_queries` for the configured allowed site.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.analyticsQuery,
      displayName: "GSC Analytics Query",
      description: "Call Search Console MCP `analytics_query` for the configured allowed site.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.seoLowCtrOpportunities,
      displayName: "GSC Low CTR Opportunities",
      description: "Call Search Console MCP `seo_low_ctr_opportunities` for the configured allowed site.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.inspectionInspect,
      displayName: "GSC URL Inspection",
      description: "Call Search Console MCP `inspection_inspect` for the configured allowed site.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.sitemapsList,
      displayName: "GSC Sitemaps List",
      description: "Call Search Console MCP `sitemaps_list` for the configured allowed site.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.pagespeedAnalyze,
      displayName: "PageSpeed Analyze",
      description: "Call Search Console MCP `pagespeed_analyze`.",
      parametersSchema: looseObjectSchema,
    },
  ],
};

export default manifest;
