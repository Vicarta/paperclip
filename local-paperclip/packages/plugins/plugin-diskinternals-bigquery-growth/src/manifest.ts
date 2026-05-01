import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import {
  DEFAULT_DATASET_ID,
  DEFAULT_LOCATION,
  DEFAULT_MAXIMUM_BYTES_BILLED,
  DEFAULT_ROW_LIMIT,
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
  displayName: "DiskInternals BigQuery Growth",
  description:
    "BigQuery-backed growth data tools for DiskInternals agents. Agents receive allowlisted reports; credentials and SQL stay server-side.",
  author: "Paperclip",
  categories: ["connector", "automation"],
  capabilities: [
    "http.outbound",
    "secrets.read-ref",
    "agent.tools.register",
    "instance.settings.register",
    "jobs.schedule",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      bigQueryProjectId: {
        type: "string",
        title: "BigQuery Project ID",
        description: "GCP project that owns the DiskInternals growth dataset.",
        default: "",
      },
      bigQueryDatasetId: {
        type: "string",
        title: "BigQuery Dataset ID",
        default: DEFAULT_DATASET_ID,
      },
      bigQueryLocation: {
        type: "string",
        title: "BigQuery Location",
        default: DEFAULT_LOCATION,
      },
      bigQueryAccessTokenSecretRef: {
        type: "string",
        format: "secret-ref",
        title: "BigQuery Access Token Secret Ref",
        description:
          "Optional short-lived OAuth access token secret. Prefer service account JSON for long-lived runtime.",
        default: "",
      },
      bigQueryServiceAccountJsonSecretRef: {
        type: "string",
        format: "secret-ref",
        title: "BigQuery Service Account JSON Secret Ref",
        description:
          "Paperclip secret containing service account JSON. Agents never receive this value.",
        default: "",
      },
      defaultDateWindowDays: {
        type: "number",
        title: "Default Date Window Days",
        default: 28,
      },
      defaultRowLimit: {
        type: "number",
        title: "Default Row Limit",
        default: DEFAULT_ROW_LIMIT,
      },
      maxRowLimit: {
        type: "number",
        title: "Maximum Row Limit",
        default: 1000,
      },
      maximumBytesBilled: {
        type: "string",
        title: "Maximum Bytes Billed",
        default: DEFAULT_MAXIMUM_BYTES_BILLED,
      },
      crawlUserAgent: {
        type: "string",
        title: "Crawler User Agent",
        default: "PaperclipDiskInternalsGrowthBot/0.1 (+https://diskinternals.com/)",
      },
      crawlMaxConcurrentRequestsPerHost: {
        type: "number",
        title: "Crawl Max Concurrent Requests Per Host",
        default: 2,
      },
      crawlMinDelayMsPerHost: {
        type: "number",
        title: "Crawl Minimum Delay Ms Per Host",
        default: 2000,
      },
      crawlMaxPagesPerJob: {
        type: "number",
        title: "Crawl Max Pages Per Job",
        default: 500,
      },
    },
  },
  jobs: [
    {
      jobKey: "crawl-due-items",
      displayName: "DiskInternals Crawl Due Items",
      description: "Processes a small batch of due crawl items with rate limits.",
      schedule: "*/15 * * * *",
    },
  ],
  ui: {
    slots: [
      {
        type: "settingsPage",
        id: SLOT_IDS.settingsPage,
        displayName: "DiskInternals BigQuery Growth Settings",
        exportName: EXPORT_NAMES.settingsPage,
      },
    ],
  },
  tools: Object.values(TOOL_NAMES).map((name) => ({
    name,
    displayName: name.split("-").map((part) =>
      part.length > 0 ? part[0]!.toUpperCase() + part.slice(1) : part,
    ).join(" "),
    description: "DiskInternals BigQuery Growth allowlisted tool.",
    parametersSchema: looseObjectSchema,
  })),
};

export default manifest;
