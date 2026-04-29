export const PLUGIN_ID = "paperclip.winning-structure-mcp-agent-tools";
export const PLUGIN_VERSION = "0.1.0";

export const DEFAULT_WINNING_STRUCTURE_MCP_URL = "";

export const SLOT_IDS = {
  settingsPage: "winning-structure-mcp-agent-tools-settings-page",
} as const;

export const EXPORT_NAMES = {
  settingsPage: "WinningStructureMcpSettingsPage",
} as const;

export const MCP_TOOL_NAMES = [
  "validate_task_input",
  "start_winning_structure_run",
  "get_run_status",
  "get_run_result",
] as const;

export type WinningStructureMcpToolName = (typeof MCP_TOOL_NAMES)[number];

export const TOOL_NAMES = {
  validateTaskInput: "validate-task-input",
  startRun: "start-winning-structure-run",
  getRunStatus: "get-run-status",
  getRunResult: "get-run-result",
} as const;
