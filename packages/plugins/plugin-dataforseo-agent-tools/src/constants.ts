export const PLUGIN_ID = "paperclip.dataforseo-agent-tools";
export const PLUGIN_VERSION = "0.1.0";

export const SLOT_IDS = {
  settingsPage: "dataforseo-agent-tools-settings-page",
} as const;

export const EXPORT_NAMES = {
  settingsPage: "DataForSeoSettingsPage",
} as const;

export const TOOL_NAMES = {
  googleAdsSearchVolume: "google-ads-search-volume",
} as const;

export const DEFAULT_DATAFORSEO_API_BASE_URL = "https://api.dataforseo.com";

export const DATAFORSEO_COST_PROVIDER = "dataforseo.com";
export const DATAFORSEO_COST_BILLING_TYPE = "metered_api";
export const DATAFORSEO_COST_MODEL = "google_ads_search_volume";
