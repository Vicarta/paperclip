export const PLUGIN_ID = "paperclip.google-drive-docs-agent-tools";
export const PLUGIN_VERSION = "0.1.0";

export const DEFAULT_GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token";
export const DEFAULT_GOOGLE_DRIVE_API_BASE_URL = "https://www.googleapis.com/drive/v3";
export const DEFAULT_GOOGLE_DRIVE_UPLOAD_BASE_URL =
  "https://www.googleapis.com/upload/drive/v3";
export const DEFAULT_GOOGLE_DOCS_API_BASE_URL = "https://docs.googleapis.com/v1";

export const TOOL_NAMES = {
  healthCheck: "google_drive_docs_health_check",
  createDocFromHtml: "google_doc_create_from_html",
  getDoc: "google_doc_get",
  shareDoc: "google_doc_share",
  replaceAllText: "google_doc_replace_all_text",
  batchUpdate: "google_doc_batch_update",
  exportDoc: "google_doc_export",
} as const;

export const SLOT_IDS = {
  settingsPage: "google-drive-docs-settings",
} as const;

export const EXPORT_NAMES = {
  settingsPage: "GoogleDriveDocsSettingsPage",
} as const;
