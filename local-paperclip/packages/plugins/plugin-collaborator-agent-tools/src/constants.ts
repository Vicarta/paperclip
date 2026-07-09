export const PLUGIN_ID = "paperclip.collaborator-agent-tools";
export const PLUGIN_VERSION = "0.1.0";

export const SLOT_IDS = {
  settingsPage: "collaborator-agent-tools-settings-page",
} as const;

export const EXPORT_NAMES = {
  settingsPage: "CollaboratorSettingsPage",
} as const;

export const TOOL_NAMES = {
  creatorList: "creator-list",
  dictionaryCountries: "dictionary-countries",
  dictionaryRegions: "dictionary-regions",
  dictionaryCities: "dictionary-cities",
  dictionaryLanguages: "dictionary-languages",
  testConnection: "test-connection",
} as const;

export const DEFAULT_COLLABORATOR_API_BASE_URL = "https://collaborator.pro";
