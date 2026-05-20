export const PLUGIN_ID = "paperclip.bright-data-agent-tools";
export const PLUGIN_VERSION = "0.3.1";

export const SLOT_IDS = {
  settingsPage: "bright-data-agent-tools-settings-page",
} as const;

export const EXPORT_NAMES = {
  settingsPage: "BrightDataSettingsPage",
} as const;

export const TOOL_NAMES = {
  listTools: "list-tools",
  callTool: "call-tool",
  triggerDatasetRequest: "trigger-dataset-request",
  getSnapshotProgress: "get-snapshot-progress",
  downloadSnapshot: "download-snapshot",
  runDatasetRequest: "run-dataset-request",
  resolveInstagramAccountPostSet: "resolve-instagram-account-post-set",
} as const;

export const DEFAULT_BRIGHT_DATA_MCP_URL = "https://mcp.brightdata.com/mcp";

export const DEFAULT_BRIGHT_DATA_GROUPS = [
  "social",
  "advanced_scraping",
  "app_stores",
] as const;

export const BRIGHT_DATA_COST_PROVIDER = "brightdata.com";
export const BRIGHT_DATA_COST_BILLING_TYPE = "metered_api";
