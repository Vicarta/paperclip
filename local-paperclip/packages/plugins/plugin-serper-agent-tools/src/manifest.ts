import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import {
  DEFAULT_SERPER_API_BASE_URL,
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
