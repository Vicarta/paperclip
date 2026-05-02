import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import {
  DEFAULT_PERFEX_HEALTH_URL,
  DEFAULT_PERFEX_MCP_URL,
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
  displayName: "Perfex CRM Agent Tools",
  description:
    "Server-side adapter for the Perfex CRM MCP endpoint. Agents can preview human implementation tasks, perform read-only status checks, and only create/update Perfex tasks when writes are explicitly enabled.",
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
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      perfexMcpTokenSecretRef: {
        type: "string",
        format: "secret-ref",
        title: "Perfex MCP Token Secret Ref",
        description:
          "Paperclip secret UUID that stores the Perfex MCP bearer token. Agents never receive the plaintext token.",
        default: "",
      },
      perfexMcpUrl: {
        type: "string",
        title: "Perfex MCP URL",
        description: "Perfex CRM MCP Streamable HTTP endpoint.",
        default: DEFAULT_PERFEX_MCP_URL,
      },
      perfexHealthUrl: {
        type: "string",
        title: "Perfex Health URL",
        description: "Bearer-protected healthcheck endpoint for the Perfex MCP service.",
        default: DEFAULT_PERFEX_HEALTH_URL,
      },
      perfexProjectId: {
        type: "string",
        title: "Perfex Project ID",
        description: "Approved Perfex project ID for DiskInternals implementation tasks.",
        default: "",
      },
      projectManagerId: {
        type: "string",
        title: "Project Manager ID",
        description: "Perfex staff/user ID for the project manager who should be referenced on handoff tasks.",
        default: "",
      },
      assigneeByActionTypeJson: {
        type: "string",
        title: "Assignee By Action Type JSON",
        description:
          "JSON object mapping canonical Growth OS action types to Perfex staff/user IDs. Example: {\"seo_refresh\":[\"12\"],\"product_page_update\":[\"15\"]}.",
        default: "{}",
      },
      createTaskToolName: {
        type: "string",
        title: "MCP Create Task Tool Name",
        description: "Raw Perfex MCP tool used by the adapter when task writes are enabled.",
        default: "create_task",
      },
      addCommentToolName: {
        type: "string",
        title: "MCP Add Comment Tool Name",
        description: "Raw Perfex MCP tool used by the adapter when comment writes are enabled.",
        default: "add_task_comment",
      },
      getTaskToolName: {
        type: "string",
        title: "MCP Get Task Tool Name",
        description: "Raw Perfex MCP tool used by the adapter for status reads.",
        default: "get_task",
      },
      getTaskCommentsToolName: {
        type: "string",
        title: "MCP Get Task Comments Tool Name",
        description: "Raw Perfex MCP tool used by the adapter to read task comments.",
        default: "get_task_comments",
      },
      enableTaskWrites: {
        type: "boolean",
        title: "Enable Task Writes",
        description:
          "Safety gate. Keep false until the final implementer assignment mapping is approved.",
        default: false,
      },
      defaultDryRun: {
        type: "boolean",
        title: "Default Dry Run",
        description: "When true, create/comment tools return payload previews unless dry_run is explicitly false and writes are enabled.",
        default: true,
      },
      statusCheckIntervalMinutes: {
        type: "number",
        title: "Status Check Interval Minutes",
        description:
          "Recommended polling interval for future scheduled status sync. Phase 11 MVP does not auto-schedule sync jobs.",
        default: 60,
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
        displayName: "Perfex CRM Settings",
        exportName: EXPORT_NAMES.settingsPage,
      },
    ],
  },
  tools: [
    {
      name: TOOL_NAMES.healthcheck,
      displayName: "Perfex Healthcheck",
      description: "Run the bearer-protected Perfex MCP healthcheck. Read-only.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.listTools,
      displayName: "Perfex List MCP Tools",
      description: "List tools exposed by the Perfex MCP server. Read-only.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.previewImplementationTask,
      displayName: "Perfex Preview Implementation Task",
      description: "Build and validate a human implementation task payload without writing to Perfex.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.createImplementationTask,
      displayName: "Perfex Create Implementation Task",
      description:
        "Create a Perfex implementation task only when plugin writes are enabled and dry_run is false. Otherwise returns a safe preview.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.addTaskComment,
      displayName: "Perfex Add Task Comment",
      description:
        "Add a Perfex task comment only when plugin writes are enabled and dry_run is false. Otherwise returns a safe preview.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.getTaskStatus,
      displayName: "Perfex Get Task Status",
      description: "Fetch a Perfex task status through the configured MCP read tool.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.getTaskComments,
      displayName: "Perfex Get Task Comments",
      description: "Fetch Perfex task comments through the configured MCP read tool.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.syncTaskStatus,
      displayName: "Perfex Sync Task Status",
      description: "Fetch and store a Perfex task status in plugin entities/state. Read-only against Perfex.",
      parametersSchema: looseObjectSchema,
    },
  ],
};

export default manifest;
