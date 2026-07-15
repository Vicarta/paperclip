export const PLUGIN_ID = "paperclip.winning-structure-mcp-agent-tools";
export const PLUGIN_VERSION = "0.2.0";

export const DEFAULT_WINNING_STRUCTURE_MCP_URL = "";

export const WINNING_STRUCTURE_COST_PROVIDER = "winning-structure-mcp";
export const WINNING_STRUCTURE_COST_BILLING_TYPE = "metered_api";
export const WINNING_STRUCTURE_COST_MODEL = "winning-structure-mcp-v1";

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
  "submit_run_decisions",
  "get_run_result",
] as const;

export type WinningStructureMcpToolName = (typeof MCP_TOOL_NAMES)[number];

export const TOOL_NAMES = {
  validateTaskInput: "validate-task-input",
  startRun: "start-winning-structure-run",
  getRunStatus: "get-run-status",
  submitRunDecisions: "submit-run-decisions",
  getRunResult: "get-run-result",
} as const;
