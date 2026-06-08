export const PLUGIN_ID = "paperclip.seo-performance-loop";
export const PLUGIN_VERSION = "0.1.1";

export const SLOT_IDS = {
  settingsPage: "seo-performance-loop-settings-page",
  dashboardWidget: "seo-performance-loop-dashboard-widget",
} as const;

export const EXPORT_NAMES = {
  settingsPage: "SeoPerformanceSettingsPage",
  dashboardWidget: "SeoPerformanceDashboardWidget",
} as const;

export const JOB_KEYS = {
  collectWeeklySearchTelemetry: "collect-weekly-search-telemetry",
  evaluateWeeklySeoDecisions: "evaluate-weekly-seo-decisions",
} as const;

export const TOOL_NAMES = {
  publishedArticleUpsert: "seo-published-article-upsert",
  publishedArticleGet: "seo-published-article-get",
  telemetryIngestionRecord: "seo-telemetry-ingestion-record",
  telemetryIngestionGet: "seo-telemetry-ingestion-get",
  telemetrySnapshotRecord: "seo-telemetry-snapshot-record",
  searchTelemetryGet: "seo-search-telemetry-get",
  performanceDecisionGet: "seo-performance-decision-get",
  followupIssueOpen: "seo-followup-issue-open",
  weeklyReportPlanGet: "seo-weekly-report-plan-get",
  detailedReportEmailSend: "seo-detailed-report-email-send",
  crawlFindingRoutePlan: "seo-crawl-finding-route-plan",
} as const;

export const DEFAULT_POLICY = {
  stableWindowWeeks: 2,
  noisyWindowWeeks: 2,
  declineWindowWeeks: 2,
  stablePositionDeltaThreshold: 1,
  declinePositionDeltaThreshold: 3,
  stableClickDeltaPct: 5,
  declineClickDeltaPct: -15,
  stableImpressionDeltaPct: 5,
  declineImpressionDeltaPct: -15,
} as const;

export const DEFAULT_CONFIG = {
  googleSearchConsoleCredentialSecretRef: "",
  googleSearchConsolePropertyUrl: "",
  defaultRankProvider: "paperclip-connected-provider",
  defaultRankGeo: "ua",
  defaultRankLanguage: "uk",
  weeklyCollectionEnabled: true,
  weeklyCollectionDay: "WE",
  weeklyCollectionHourUtc: 6,
  weeklyReportTimezone: "Europe/Kiev",
  weeklyReportDataDelayDays: 2,
  weeklyReportComparisonWeeks: 1,
  telegramReportMode: "summary_only",
  telegramSummaryHardCapChars: 1800,
  detailedReportChannel: "email",
  detailedReportRecipientEmails: "",
  detailedReportFromEmail: "paperclip@aibizmate.com",
  resendApiKeySecretRef: "",
  detailedReportFallback: "paperclip_issue_document",
  automaticFindingTaskCreationEnabled: true,
  automaticFindingTaskAgent: "SEO CMS Technical Fixer",
  automaticFindingTaskMaxPerRun: 25,
  findingCooldownDays: 14,
  ignoreCloudflareEmailProtection404: true,
  ignoreCrawlObserverNearDuplicates: true,
  ignoreJsZeroWordArtifacts: true,
  ...DEFAULT_POLICY,
} as const;
