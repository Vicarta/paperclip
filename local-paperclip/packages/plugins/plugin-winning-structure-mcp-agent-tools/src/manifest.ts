import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import {
  DEFAULT_WINNING_STRUCTURE_MCP_URL,
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
  displayName: "Winning Structure MCP Agent Tools",
  description:
    "Thin server-side adapter for a Winning Structure MCP endpoint. Agents can validate SEO page structure tasks, start async runs, poll status, and retrieve recommendation artifacts without receiving endpoint credentials.",
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
      winningStructureMcpTokenSecretRef: {
        type: "string",
        format: "secret-ref",
        title: "Winning Structure MCP Token Secret Ref",
        description:
          "Optional Paperclip secret UUID that stores the MCP bearer token. Agents never receive the plaintext token.",
        default: "",
      },
      winningStructureMcpUrl: {
        type: "string",
        title: "Winning Structure MCP URL",
        description: "Winning Structure MCP Streamable HTTP endpoint.",
        default: DEFAULT_WINNING_STRUCTURE_MCP_URL,
      },
      allowedClientKeysCsv: {
        type: "string",
        title: "Allowed Client Keys",
        description:
          "Optional comma-separated client_key allowlist. Empty means no plugin-side client_key restriction.",
        default: "",
      },
      requestTimeoutMs: {
        type: "number",
        title: "Request Timeout Ms",
        description: "Timeout for one MCP connection/call.",
        default: 180000,
      },
    },
  },
  ui: {
    slots: [
      {
        type: "settingsPage",
        id: SLOT_IDS.settingsPage,
        displayName: "Winning Structure MCP Settings",
        exportName: EXPORT_NAMES.settingsPage,
      },
    ],
  },
  tools: [
    {
      name: TOOL_NAMES.validateTaskInput,
      displayName: "Winning Structure Validate Task Input",
      description: "Call Winning Structure MCP `validate_task_input`.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.startRun,
      displayName: "Winning Structure Start Run",
      description: "Call Winning Structure MCP `start_winning_structure_run`.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.getRunStatus,
      displayName: "Winning Structure Get Run Status",
      description: "Call Winning Structure MCP `get_run_status`.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.getRunResult,
      displayName: "Winning Structure Get Run Result",
      description: "Call Winning Structure MCP `get_run_result`.",
      parametersSchema: looseObjectSchema,
    },
  ],
};

export default manifest;
