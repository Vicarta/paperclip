export const PLUGIN_ID = "paperclip.serper-agent-tools";
export const PLUGIN_VERSION = "0.1.0";

export const SLOT_IDS = {
  settingsPage: "serper-agent-tools-settings-page",
} as const;

export const EXPORT_NAMES = {
  settingsPage: "SerperSettingsPage",
} as const;

export const TOOL_NAMES = {
  googleSearch: "google-search",
} as const;

export const DEFAULT_SERPER_API_BASE_URL = "https://google.serper.dev";

export const SERPER_COST_PROVIDER = "serper.dev";
export const SERPER_COST_BILLING_TYPE = "metered_api";
