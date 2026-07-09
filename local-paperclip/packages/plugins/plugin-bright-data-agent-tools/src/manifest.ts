import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import {
  BRIGHT_DATA_COST_BILLING_TYPE,
  DEFAULT_BRIGHT_DATA_GROUPS,
  DEFAULT_BRIGHT_DATA_MCP_URL,
  EXPORT_NAMES,
  PLUGIN_ID,
  PLUGIN_VERSION,
  SLOT_IDS,
  TOOL_NAMES,
} from "./constants.js";

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "Bright Data Agent Tools",
  description: "Agent tools for Bright Data MCP social and scraping workflows via a server-side secret-backed endpoint.",
  author: "Paperclip",
  categories: ["connector", "automation"],
  capabilities: [
    "http.outbound",
    "secrets.read-ref",
    "agent.tools.register",
    "costs.write",
    "plugin.state.read",
    "plugin.state.write",
    "instance.settings.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      brightDataTokenSecretRef: {
        type: "string",
        format: "secret-ref",
        title: "Bright Data Token Secret Ref",
        description: "Paperclip secret UUID that stores the Bright Data token. Managed by the custom settings page.",
        default: "",
      },
      brightDataMcpUrl: {
        type: "string",
        title: "Bright Data MCP URL",
        description: "Remote Bright Data MCP endpoint. Defaults to the official hosted endpoint.",
        default: DEFAULT_BRIGHT_DATA_MCP_URL,
      },
      brightDataGroups: {
        type: "array",
        title: "Bright Data MCP Groups",
        description: "Allowed Bright Data MCP groups to expose through this plugin.",
        items: { type: "string" },
        default: [...DEFAULT_BRIGHT_DATA_GROUPS],
      },
      costAccountingMode: {
        type: "string",
        title: "Cost Accounting Mode",
        description: "When enabled, successful Bright Data tool calls write estimated Paperclip cost events.",
        enum: ["disabled", "estimated_per_request"],
        default: "disabled",
      },
      estimatedMcpToolCostUsd: {
        type: "number",
        title: "Estimated MCP Tool Cost USD",
        description: `Estimated cost per successful generic Bright Data MCP tool call. Written as ${BRIGHT_DATA_COST_BILLING_TYPE}.`,
        default: 0,
      },
      estimatedDatasetTriggerCostUsd: {
        type: "number",
        title: "Estimated Dataset Trigger Cost USD",
        description: `Estimated cost per successful Bright Data dataset trigger call. Written as ${BRIGHT_DATA_COST_BILLING_TYPE}.`,
        default: 0,
      },
      estimatedSnapshotProgressCostUsd: {
        type: "number",
        title: "Estimated Snapshot Progress Cost USD",
        description: `Estimated cost per successful Bright Data snapshot progress call. Written as ${BRIGHT_DATA_COST_BILLING_TYPE}.`,
        default: 0,
      },
      estimatedSnapshotDownloadCostUsd: {
        type: "number",
        title: "Estimated Snapshot Download Cost USD",
        description: `Estimated cost per successful Bright Data snapshot download call. Written as ${BRIGHT_DATA_COST_BILLING_TYPE}.`,
        default: 0,
      },
      estimatedRunDatasetCostUsd: {
        type: "number",
        title: "Estimated Run Dataset Cost USD",
        description: `Estimated cost per successful top-level Bright Data run dataset call. Written as ${BRIGHT_DATA_COST_BILLING_TYPE}.`,
        default: 0,
      },
      estimatedInstagramPostSetCostUsd: {
        type: "number",
        title: "Estimated Instagram Post Set Cost USD",
        description: `Estimated cost per successful uncached Instagram account post-set resolution. Written as ${BRIGHT_DATA_COST_BILLING_TYPE}.`,
        default: 0,
      },
    },
  },
  ui: {
    slots: [
      {
        type: "settingsPage",
        id: SLOT_IDS.settingsPage,
        displayName: "Bright Data Settings",
        exportName: EXPORT_NAMES.settingsPage,
      },
    ],
  },
  tools: [
    {
      name: TOOL_NAMES.listTools,
      displayName: "Bright Data List Tools",
      description: "List the remote Bright Data MCP tools available through the configured groups.",
      parametersSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: TOOL_NAMES.callTool,
      displayName: "Bright Data Call Tool",
      description: "Execute one Bright Data MCP tool by remote tool name with structured arguments.",
      parametersSchema: {
        type: "object",
        properties: {
          remoteToolName: { type: "string" },
          arguments: {
            type: "object",
            additionalProperties: true,
          },
        },
        required: ["remoteToolName"],
      },
    },
    {
      name: TOOL_NAMES.triggerDatasetRequest,
      displayName: "Bright Data Trigger Dataset Request",
      description: "Start a Bright Data asynchronous dataset request and return a snapshot ID.",
      parametersSchema: {
        type: "object",
        properties: {
          datasetId: { type: "string" },
          input: {
            oneOf: [
              { type: "array", items: { type: "object", additionalProperties: true } },
              { type: "object", additionalProperties: true },
            ],
          },
          includeErrors: { type: "boolean" },
          customOutputFields: { type: "string" },
          type: { type: "string" },
          discoverBy: { type: "string" },
          limitPerInput: { type: "number" },
          limitMultipleResults: { type: "number" },
          notify: { type: "boolean" },
          endpoint: { type: "string" },
          format: { type: "string" },
          authHeader: { type: "string" },
          uncompressedWebhook: { type: "boolean" },
        },
        required: ["datasetId", "input"],
      },
    },
    {
      name: TOOL_NAMES.getSnapshotProgress,
      displayName: "Bright Data Get Snapshot Progress",
      description: "Fetch Bright Data progress status for a snapshot ID.",
      parametersSchema: {
        type: "object",
        properties: {
          snapshotId: { type: "string" },
        },
        required: ["snapshotId"],
      },
    },
    {
      name: TOOL_NAMES.downloadSnapshot,
      displayName: "Bright Data Download Snapshot",
      description: "Download the completed Bright Data snapshot payload.",
      parametersSchema: {
        type: "object",
        properties: {
          snapshotId: { type: "string" },
          format: { type: "string" },
          includeErrors: { type: "boolean" },
        },
        required: ["snapshotId"],
      },
    },
    {
      name: TOOL_NAMES.runDatasetRequest,
      displayName: "Bright Data Run Dataset Request",
      description: "Trigger a Bright Data dataset job, poll until completion or timeout, and optionally download the snapshot.",
      parametersSchema: {
        type: "object",
        properties: {
          datasetId: { type: "string" },
          input: {
            oneOf: [
              { type: "array", items: { type: "object", additionalProperties: true } },
              { type: "object", additionalProperties: true },
            ],
          },
          includeErrors: { type: "boolean" },
          customOutputFields: { type: "string" },
          type: { type: "string" },
          discoverBy: { type: "string" },
          limitPerInput: { type: "number" },
          limitMultipleResults: { type: "number" },
          notify: { type: "boolean" },
          endpoint: { type: "string" },
          format: { type: "string" },
          authHeader: { type: "string" },
          uncompressedWebhook: { type: "boolean" },
          maxWaitMs: { type: "number" },
          pollIntervalMs: { type: "number" },
          autoDownload: { type: "boolean" },
          downloadFormat: { type: "string" },
        },
        required: ["datasetId", "input"],
      },
    },
    {
      name: TOOL_NAMES.resolveInstagramAccountPostSet,
      displayName: "Bright Data Resolve Instagram Account Post Set",
      description: "Resolve a full canonical Instagram account post set and detailed records through the validated Bright Data composite recipe.",
      parametersSchema: {
        type: "object",
        properties: {
          handleOrUrl: { type: "string" },
          expectedPostCount: { type: "number" },
          maxPosts: { type: "number" },
          allowLargeAccount: { type: "boolean" },
          maxWaitMs: { type: "number" },
          pollIntervalMs: { type: "number" },
          forceRefresh: { type: "boolean" },
          cacheTtlHours: { type: "number" },
        },
        required: ["handleOrUrl"],
      },
    },
  ],
};

export default manifest;
