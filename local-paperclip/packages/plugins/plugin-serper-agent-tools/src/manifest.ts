import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import {
  DEFAULT_SERPER_API_BASE_URL,
  EXPORT_NAMES,
  PLUGIN_ID,
  PLUGIN_VERSION,
  SLOT_IDS,
  TOOL_NAMES,
  SERPER_COST_BILLING_TYPE,
} from "./constants.js";

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "Serper Agent Tools",
  description:
    "Server-side Serper.dev connector for Google SERP retrieval with secret-backed settings.",
  author: "Paperclip",
  categories: ["connector", "automation"],
  capabilities: [
    "http.outbound",
    "secrets.read-ref",
    "agent.tools.register",
    "instance.settings.register",
    "costs.write",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      serperApiKeySecretRef: {
        type: "string",
        format: "secret-ref",
        title: "Serper API Key Secret Ref",
        description:
          "Paperclip secret UUID that stores the Serper API key. Managed by the custom settings page.",
        default: "",
      },
      serperApiBaseUrl: {
        type: "string",
        title: "Serper API Base URL",
        description: "Base URL for Serper REST API requests.",
        default: DEFAULT_SERPER_API_BASE_URL,
      },
      costAccountingMode: {
        type: "string",
        title: "Cost Accounting Mode",
        description:
          "How Paperclip writes Serper spend to the cost ledger. Use estimated_per_request when Serper is billed by request/credit and does not return per-call cost.",
        enum: ["disabled", "estimated_per_request"],
        default: "disabled",
      },
      estimatedSearchCostUsd: {
        type: "number",
        title: "Estimated Web Search Cost USD",
        description: `Estimated cost per successful web search call. Written as ${SERPER_COST_BILLING_TYPE}.`,
        default: 0,
      },
      estimatedNewsCostUsd: {
        type: "number",
        title: "Estimated News Search Cost USD",
        description: `Estimated cost per successful news search call. Written as ${SERPER_COST_BILLING_TYPE}.`,
        default: 0,
      },
    },
  },
  ui: {
    slots: [
      {
        type: "settingsPage",
        id: SLOT_IDS.settingsPage,
        displayName: "Serper Settings",
        exportName: EXPORT_NAMES.settingsPage,
      },
    ],
  },
  tools: [
    {
      name: TOOL_NAMES.googleSearch,
      displayName: "Serper Google Search",
      description:
        "Query Google SERP results through Serper.dev. Use this for web or news search result pages, not for fetching page bodies.",
      parametersSchema: {
        type: "object",
        properties: {
          q: { type: "string" },
          gl: { type: "string" },
          hl: { type: "string" },
          num: { type: "number" },
          page: { type: "number" },
          autocorrect: { type: "boolean" },
          type: { type: "string", enum: ["search", "news"] },
        },
        required: ["q"],
      },
    },
  ],
};

export default manifest;
