export const PLUGIN_ID = "paperclip.email-notifications";
export const PLUGIN_VERSION = "0.3.1";

export const TOOL_NAMES = {
  sendEmailNotification: "email-notification-send",
  sendChangeReport: "email-change-report-send",
  sendIncidentReport: "email-incident-report-send",
  sendDeveloperHandoff: "email-developer-handoff-send",
  sendWeeklySeoReport: "email-seo-weekly-report-send",
} as const;

export const DEFAULT_RESEND_API_BASE_URL = "https://api.resend.com";
export const EMAIL_COST_PROVIDER = "resend";
export const EMAIL_COST_BILLING_TYPE = "metered_api";

export const DEFAULT_CONFIG = {
  resendApiKeySecretRef: "",
  resendApiBaseUrl: DEFAULT_RESEND_API_BASE_URL,
  fromEmail: "",
  defaultRecipientEmails: "",
  allowlistedRecipientEmails: "",
  developerHandoffAllowedHosts: "",
  defaultLanguage: "uk",
  costAccountingMode: "estimated_per_email",
  estimatedEmailCostUsd: 0.001,
};
