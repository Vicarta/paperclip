export const PLUGIN_ID = "paperclip.exa-agent-tools";
export const PLUGIN_VERSION = "0.1.0";
export const SLOT_IDS = {
  settingsPage: "exa-agent-tools-settings-page",
} as const;

export const EXPORT_NAMES = {
  settingsPage: "ExaSettingsPage",
} as const;

export const TOOL_NAMES = {
  webSearch: "web-search",
  crawlUrl: "crawl-url",
  codeContext: "code-context",
} as const;

export const EXA_MCP_TOOLS = {
  webSearch: "web_search_exa",
  crawling: "crawling_exa",
  codeContext: "get_code_context_exa",
} as const;

export const DEFAULT_EXA_MCP_URL = "https://mcp.exa.ai/mcp";
