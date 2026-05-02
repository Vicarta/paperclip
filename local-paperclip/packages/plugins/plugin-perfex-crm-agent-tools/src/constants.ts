export const PLUGIN_ID = "paperclip.perfex-crm-agent-tools";
export const PLUGIN_VERSION = "0.1.0";

export const DEFAULT_PERFEX_MCP_URL = "https://pxmc.aibizmate.com/mcp";
export const DEFAULT_PERFEX_HEALTH_URL = "https://pxmc.aibizmate.com/healthz";

export const SLOT_IDS = {
  settingsPage: "perfex-crm-agent-tools-settings-page",
} as const;

export const EXPORT_NAMES = {
  settingsPage: "PerfexCrmSettingsPage",
} as const;

export const PERFEX_ACTION_TYPES = [
  "seo_refresh",
  "new_page_or_article",
  "product_page_update",
  "internal_linking",
  "cro_experiment",
  "localization_experiment",
  "indexing_followup",
  "tracking_or_data_quality_issue",
] as const;

export type PerfexActionType = (typeof PERFEX_ACTION_TYPES)[number];

export const PERFEX_ACTION_TYPE_ALIASES: Record<string, PerfexActionType> = {
  content_update: "seo_refresh",
  new_page: "new_page_or_article",
  product_update: "product_page_update",
  localization: "localization_experiment",
  tracking: "tracking_or_data_quality_issue",
  data_quality: "tracking_or_data_quality_issue",
  indexing: "indexing_followup",
} as const;

export const TOOL_NAMES = {
  healthcheck: "perfex-healthcheck",
  listTools: "perfex-list-tools",
  previewImplementationTask: "perfex-preview-implementation-task",
  createImplementationTask: "perfex-create-implementation-task",
  addTaskComment: "perfex-add-task-comment",
  getTaskStatus: "perfex-get-task-status",
  getTaskComments: "perfex-get-task-comments",
  syncTaskStatus: "perfex-sync-task-status",
} as const;

export const ENTITY_TYPES = {
  implementationTask: "perfex-implementation-task",
  taskComment: "perfex-task-comment",
  taskStatus: "perfex-task-status",
} as const;
