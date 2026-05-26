import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import {
  DEFAULT_ALLOWED_GA4_PROPERTY_ID,
  DEFAULT_ALLOWED_SITE_URL,
  DEFAULT_GSC_BING_GA4_MCP_URL,
  EXPORT_NAMES,
  PLUGIN_ID,
  PLUGIN_VERSION,
  SLOT_IDS,
  TOOL_NAMES,
  VERIFIED_MCP_TOOL_NAMES,
} from "./constants.js";

const looseObjectSchema = {
  type: "object",
  additionalProperties: true,
} as const;

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "GSC Bing GA4 MCP Agent Tools",
  description:
    "Thin server-side adapter for a private GSC, Bing, and GA4 MCP endpoint. Agents call backend-allowlisted tools; endpoint and bearer token stay in backend plugin config.",
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
      gscBingGa4McpTokenSecretRef: {
        type: "string",
        format: "secret-ref",
        title: "GSC Bing GA4 MCP Token Secret Ref",
        description:
          "Paperclip secret UUID that stores the Astrogen tenant token. Agents never receive the plaintext token.",
        default: "",
      },
      gscBingGa4McpUrl: {
        type: "string",
        title: "GSC Bing GA4 MCP URL",
        description:
          "Private Tailscale-only GSC/Bing/GA4 MCP Streamable HTTP endpoint.",
        default: DEFAULT_GSC_BING_GA4_MCP_URL,
      },
      allowedSiteUrl: {
        type: "string",
        title: "Allowed GSC Site URL",
        description:
          "Plugin-side site allowlist. Calls with another siteUrl/site_url/site are rejected before reaching MCP.",
        default: DEFAULT_ALLOWED_SITE_URL,
      },
      allowedGa4PropertyId: {
        type: "string",
        title: "Allowed GA4 Property ID",
        description:
          "Plugin-side GA4 property allowlist. Calls with another propertyId/property_id/ga4PropertyId/property are rejected before reaching MCP.",
        default: DEFAULT_ALLOWED_GA4_PROPERTY_ID,
      },
      allowedMcpToolNamesCsv: {
        type: "string",
        title: "Allowed MCP Tool Names",
        description:
          "Comma-separated backend allowlist. Leave empty to allow only the verified default tools. Use this to add Bing/GA4 tools after MCP-side verification.",
        default: "",
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
        displayName: "GSC Bing GA4 MCP Settings",
        exportName: EXPORT_NAMES.settingsPage,
      },
    ],
  },
  tools: [
    {
      name: TOOL_NAMES.listTools,
      displayName: "GSC Bing GA4 MCP List Tools",
      description: "List backend-allowlisted tools exposed by the private GSC/Bing/GA4 MCP server.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.callTool,
      displayName: "GSC Bing GA4 MCP Call Tool",
      description:
        "Call one backend-allowlisted GSC/Bing/GA4 MCP tool. Endpoint and bearer token are injected only by the plugin backend.",
      parametersSchema: {
        type: "object",
        properties: {
          toolName: {
            type: "string",
            description:
              "MCP tool name. Default verified tools are listed in plugin docs; additional Bing/GA4 tools require backend allowlist config.",
            examples: [...VERIFIED_MCP_TOOL_NAMES],
          },
          arguments: looseObjectSchema,
        },
        required: ["toolName"],
      },
    },
    {
      name: TOOL_NAMES.sitesList,
      displayName: "GSC Sites List",
      description: "Call MCP `sites_list`.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.analyticsTopQueries,
      displayName: "GSC Analytics Top Queries",
      description: "Call MCP `analytics_top_queries` for the configured allowed GSC site.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.analyticsQuery,
      displayName: "GSC Analytics Query",
      description: "Call MCP `analytics_query` for the configured allowed GSC site.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.seoLowCtrOpportunities,
      displayName: "GSC Low CTR Opportunities",
      description: "Call MCP `seo_low_ctr_opportunities` for the configured allowed GSC site.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.inspectionInspect,
      displayName: "GSC URL Inspection",
      description: "Call MCP `inspection_inspect` for the configured allowed GSC site.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.inspectionBatchInspect,
      displayName: "GSC URL Inspection Batch",
      description:
        "Call MCP `inspection_batch_inspect` for multiple URLs on the configured allowed GSC site. Use this for indexing audits; MCP remains acquisition/cache only.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.inspectionBatchJobStart,
      displayName: "GSC URL Inspection Batch Job Start",
      description:
        "Call MCP `inspection_batch_job_start` for large URL Inspection audits. MCP job/result files are transient provider acquisition state; Paperclip stores historical snapshots.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.inspectionBatchJobStatus,
      displayName: "GSC URL Inspection Batch Job Status",
      description: "Call MCP `inspection_batch_job_status`.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.inspectionBatchJobResults,
      displayName: "GSC URL Inspection Batch Job Results",
      description: "Call MCP `inspection_batch_job_results` with paging.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.inspectionBatchJobCancel,
      displayName: "GSC URL Inspection Batch Job Cancel",
      description: "Call MCP `inspection_batch_job_cancel`.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.inspectionCacheStats,
      displayName: "GSC URL Inspection Cache Stats",
      description:
        "Call MCP `inspection_cache_stats` for the configured allowed GSC site.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.sitemapsList,
      displayName: "GSC Sitemaps List",
      description: "Call MCP `sitemaps_list` for the configured allowed GSC site.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.pagespeedAnalyze,
      displayName: "PageSpeed Analyze",
      description: "Call MCP `pagespeed_analyze`.",
      parametersSchema: looseObjectSchema,
    },
  ],
};

export default manifest;
