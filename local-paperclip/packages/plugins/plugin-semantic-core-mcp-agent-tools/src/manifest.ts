import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import {
  DEFAULT_SEMANTIC_CORE_MCP_URL,
  EXPORT_NAMES,
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
  displayName: "Semantic Core MCP Agent Tools",
  description:
    "Server-side adapter for the private Semantic Core MCP endpoint. Agents can register projects, run semantic layers, poll jobs, validate Paperclip imports, and submit review decisions without seeing endpoint credentials.",
  author: "Paperclip",
  categories: ["connector", "automation"],
  capabilities: [
    "http.outbound",
    "secrets.read-ref",
    "agent.tools.register",
    "instance.settings.register",
    "plugin.state.read",
    "plugin.state.write",
    "projects.read",
    "companies.read",
    "costs.write",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      semanticCoreMcpTokenSecretRef: {
        type: "string",
        format: "secret-ref",
        title: "Semantic Core MCP Token Secret Ref",
        description:
          "Paperclip secret UUID that stores SEMANTIC_CORE_MCP_TOKEN. Agents never receive the plaintext token.",
        default: "",
      },
      semanticCoreMcpUrl: {
        type: "string",
        title: "Semantic Core MCP URL",
        description: "Private Semantic Core MCP Streamable HTTP endpoint.",
        default: DEFAULT_SEMANTIC_CORE_MCP_URL,
      },
      allowedProjectIdsCsv: {
        type: "string",
        title: "Allowed Semantic Project IDs",
        description:
          "Optional comma-separated semantic project_id allowlist. Empty means no plugin-side project restriction.",
        default: "",
      },
      allowedClientKeysCsv: {
        type: "string",
        title: "Allowed Client Keys",
        description:
          "Optional comma-separated client_key allowlist when project_config/client_key is provided. Empty means no plugin-side client_key restriction.",
        default: "",
      },
      requestTimeoutMs: {
        type: "number",
        title: "Request Timeout Ms",
        description: "Timeout for one MCP connection/call.",
        default: 180000,
      },
      pollIntervalMs: {
        type: "number",
        title: "Job Poll Interval Ms",
        description: "Polling interval for run-layer-and-wait.",
        default: 2000,
      },
      runWaitTimeoutMs: {
        type: "number",
        title: "Run Wait Timeout Ms",
        description: "Maximum wait time for run-layer-and-wait.",
        default: 600000,
      },
    },
  },
  ui: {
    slots: [
      {
        type: "settingsPage",
        id: SLOT_IDS.settingsPage,
        displayName: "Semantic Core MCP Settings",
        exportName: EXPORT_NAMES.settingsPage,
      },
    ],
  },
  tools: [
    {
      name: TOOL_NAMES.listTools,
      displayName: "Semantic Core MCP List Tools",
      description: "List allowlisted tools exposed by the private Semantic Core MCP server.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.getPaperclipImportSchema,
      displayName: "Semantic Core Get Paperclip Import Schema",
      description: "Call Semantic Core MCP `get_paperclip_import_schema`.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.registerProject,
      displayName: "Semantic Core Register Project",
      description: "Call Semantic Core MCP `register_project`.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.validateProject,
      displayName: "Semantic Core Validate Project",
      description: "Call Semantic Core MCP `validate_project`.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.runLayer,
      displayName: "Semantic Core Run Layer",
      description: "Call Semantic Core MCP `run_layer`.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.runLayerAndWait,
      displayName: "Semantic Core Run Layer And Wait",
      description: "Call `run_layer`, poll `get_job_status`, and return the completed run_id.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.getJobStatus,
      displayName: "Semantic Core Get Job Status",
      description: "Call Semantic Core MCP `get_job_status`.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.listRuns,
      displayName: "Semantic Core List Runs",
      description: "Call Semantic Core MCP `list_runs`.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.getKeywords,
      displayName: "Semantic Core Get Keywords",
      description: "Call Semantic Core MCP `get_keywords`.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.getClusters,
      displayName: "Semantic Core Get Clusters",
      description: "Call Semantic Core MCP `get_clusters`.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.getSerpSegments,
      displayName: "Semantic Core Get SERP Segments",
      description: "Call Semantic Core MCP `get_serp_segments`.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.preparePaperclipImport,
      displayName: "Semantic Core Prepare Paperclip Import",
      description:
        "Call `prepare_paperclip_import`, validate `paperclip_import.v1`, and persist an operational import candidate.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.getReviewQueue,
      displayName: "Semantic Core Get Review Queue",
      description: "Call Semantic Core MCP `get_review_queue`.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.submitReviewDecisions,
      displayName: "Semantic Core Submit Review Decisions",
      description: "Call Semantic Core MCP `submit_review_decisions`.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.getRunCosts,
      displayName: "Semantic Core Get Run Costs",
      description: "Call Semantic Core MCP `get_run_costs`.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.smokeTest,
      displayName: "Semantic Core Smoke Test",
      description:
        "Run schema/register_project/validate_project/mock layer/get_keywords/import validation smoke through the configured MCP server.",
      parametersSchema: looseObjectSchema,
    },
  ],
};

export default manifest;
