import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import {
  DEFAULT_GOOGLE_DOCS_API_BASE_URL,
  DEFAULT_GOOGLE_DRIVE_API_BASE_URL,
  DEFAULT_GOOGLE_DRIVE_UPLOAD_BASE_URL,
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
  displayName: "Google Drive Docs Agent Tools",
  description:
    "Server-side Google Drive and Docs adapter for controlled agent-created documents. Agents receive document IDs and URLs, not OAuth credentials.",
  author: "Paperclip",
  categories: ["connector", "automation"],
  capabilities: [
    "http.outbound",
    "secrets.read-ref",
    "agent.tools.register",
    "instance.settings.register",
    "ui.page.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      googleServiceAccountJsonSecretRef: {
        type: "string",
        format: "secret-ref",
        title: "Google Service Account JSON Secret Ref",
        description:
          "Paperclip secret containing the service account JSON. The plaintext key is never shown to agents.",
        default: "",
      },
      defaultFolderId: {
        type: "string",
        title: "Default Google Drive Folder ID",
        description:
          "Optional default folder for created documents. Use a shared-drive folder when possible.",
        default: "",
      },
      allowedFolderIds: {
        type: "array",
        title: "Allowed Folder IDs",
        description:
          "Optional folder allowlist. If present, agents can create documents only in these folders.",
        items: { type: "string" },
        default: [],
      },
      driveApiBaseUrl: {
        type: "string",
        title: "Google Drive API Base URL",
        default: DEFAULT_GOOGLE_DRIVE_API_BASE_URL,
      },
      driveUploadBaseUrl: {
        type: "string",
        title: "Google Drive Upload API Base URL",
        default: DEFAULT_GOOGLE_DRIVE_UPLOAD_BASE_URL,
      },
      docsApiBaseUrl: {
        type: "string",
        title: "Google Docs API Base URL",
        default: DEFAULT_GOOGLE_DOCS_API_BASE_URL,
      },
      defaultShareType: {
        type: "string",
        enum: ["user", "group", "domain", "anyone"],
        title: "Default Share Type",
        default: "user",
      },
      defaultShareRole: {
        type: "string",
        enum: ["reader", "commenter", "writer"],
        title: "Default Share Role",
        default: "reader",
      },
      defaultShareEmailAddress: {
        type: "string",
        title: "Default Share Email Address",
        default: "",
      },
      defaultShareDomain: {
        type: "string",
        title: "Default Share Domain",
        default: "",
      },
    },
  },
  ui: {
    slots: [
      {
        type: "settingsPage",
        id: SLOT_IDS.settingsPage,
        displayName: "Google Drive Docs Settings",
        exportName: EXPORT_NAMES.settingsPage,
      },
    ],
  },
  tools: [
    {
      name: TOOL_NAMES.healthCheck,
      displayName: "Google Drive Docs Health Check",
      description: "Verify configured Google Drive/Docs service-account access.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.createDocFromHtml,
      displayName: "Create Google Doc From HTML",
      description:
        "Create a Google Docs document by importing safe HTML into an allowed Drive folder.",
      parametersSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          html: { type: "string" },
          folderId: { type: "string" },
        },
        required: ["title", "html"],
        additionalProperties: false,
      },
    },
    {
      name: TOOL_NAMES.getDoc,
      displayName: "Get Google Doc Metadata",
      description: "Read Drive metadata for a Google Docs document.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.shareDoc,
      displayName: "Share Google Doc",
      description: "Create a controlled Drive permission for a Google Docs document.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.replaceAllText,
      displayName: "Replace Text In Google Doc",
      description: "Run a replaceAllText request against a Google Docs document.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.batchUpdate,
      displayName: "Google Docs Batch Update",
      description: "Run a bounded Google Docs batchUpdate operation.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.exportDoc,
      displayName: "Export Google Doc",
      description: "Export a Google Doc as html, txt, pdf, or docx.",
      parametersSchema: looseObjectSchema,
    },
  ],
};

export default manifest;
