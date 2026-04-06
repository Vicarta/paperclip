import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import {
  DEFAULT_DATAFORSEO_API_BASE_URL,
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
  displayName: "DataForSEO Agent Tools",
  description:
    "Server-side DataForSEO connector for keyword demand retrieval with secret-backed credentials and provider-cost attribution.",
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
      dataforseoApiLoginSecretRef: {
        type: "string",
        format: "secret-ref",
        title: "DataForSEO API Login Secret Ref",
        description:
          "Paperclip secret UUID that stores the DataForSEO API login. Managed by the custom settings page.",
        default: "",
      },
      dataforseoApiPasswordSecretRef: {
        type: "string",
        format: "secret-ref",
        title: "DataForSEO API Password Secret Ref",
        description:
          "Paperclip secret UUID that stores the DataForSEO API password. Managed by the custom settings page.",
        default: "",
      },
      dataforseoApiBaseUrl: {
        type: "string",
        title: "DataForSEO API Base URL",
        description: "Base URL for DataForSEO REST API requests.",
        default: DEFAULT_DATAFORSEO_API_BASE_URL,
      },
    },
  },
  ui: {
    slots: [
      {
        type: "settingsPage",
        id: SLOT_IDS.settingsPage,
        displayName: "DataForSEO Settings",
        exportName: EXPORT_NAMES.settingsPage,
      },
    ],
  },
  tools: [
    {
      name: TOOL_NAMES.googleAdsSearchVolume,
      displayName: "DataForSEO Google Ads Search Volume",
      description:
        "Retrieve keyword demand metrics from DataForSEO Google Ads data, including search volume, CPC, and competition.",
      parametersSchema: {
        type: "object",
        properties: {
          keywords: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 1000,
          },
          location_name: { type: "string" },
          language_name: { type: "string" },
          location_code: { type: "number" },
          language_code: { type: "string" },
          search_partners: { type: "boolean" },
        },
        required: ["keywords"],
      },
    },
  ],
};

export default manifest;
