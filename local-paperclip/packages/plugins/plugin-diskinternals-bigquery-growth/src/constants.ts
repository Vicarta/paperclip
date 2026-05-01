export const PLUGIN_ID = "paperclip.diskinternals-bigquery-growth";
export const PLUGIN_VERSION = "0.1.0";

export const DEFAULT_DATASET_ID = "diskinternals_growth";
export const DEFAULT_LOCATION = "US";
export const DEFAULT_MAXIMUM_BYTES_BILLED = "1000000000";
export const DEFAULT_ROW_LIMIT = 100;
export const MAX_ROW_LIMIT = 1000;
export const DEFAULT_DATE_WINDOW_DAYS = 28;

export const SLOT_IDS = {
  settingsPage: "diskinternals-bigquery-growth-settings-page",
} as const;

export const EXPORT_NAMES = {
  settingsPage: "DiskInternalsBigQueryGrowthSettingsPage",
} as const;

export const TOOL_NAMES = {
  getSchemaStatus: "get-schema-status",
  syncSitemapSnapshot: "sync-sitemap-snapshot",
  getSiteUrlInventory: "get-site-url-inventory",
  normalizeUrlInventory: "normalize-url-inventory",
  scheduleCrawlBatch: "schedule-crawl-batch",
  getCrawlJobStatus: "get-crawl-job-status",
  getProductFunnelMetrics: "get-product-funnel-metrics",
  getGscUrlQueryOpportunities: "get-gsc-url-query-opportunities",
  getUrlGrowthOpportunityQueue: "get-url-growth-opportunity-queue",
  getProductPriorityScores: "get-product-priority-scores",
  getCroExperimentCandidates: "get-cro-experiment-candidates",
  getLocalizationCandidates: "get-localization-candidates",
  getInternalLinkCandidates: "get-internal-link-candidates",
  getIndexingCandidates: "get-indexing-candidates",
  recordOpportunityDecision: "record-opportunity-decision",
  recordExperimentDecision: "record-experiment-decision",
  getPostChangeFollowup: "get-post-change-followup",
  getQueryCostSummary: "get-query-cost-summary",
} as const;

export type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];

export const ACTION_TYPES = [
  "seo_refresh",
  "new_page_or_article",
  "internal_linking",
  "cro_experiment",
  "localization_experiment",
  "product_page_update",
  "indexing_followup",
  "tracking_or_data_quality_issue",
  "park_no_action",
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];
