export const PLUGIN_ID = "paperclip.gsc-bing-ga4-mcp-agent-tools";
export const PLUGIN_VERSION = "0.1.0";

export const DEFAULT_GSC_BING_GA4_MCP_URL = "http://100.98.5.50:3002/mcp";
export const DEFAULT_ALLOWED_SITE_URL = "sc-domain:astrogen.com.ua";
export const DEFAULT_ALLOWED_GA4_PROPERTY_ID = "484723525";

export const SLOT_IDS = {
  settingsPage: "gsc-bing-ga4-mcp-agent-tools-settings-page",
} as const;

export const EXPORT_NAMES = {
  settingsPage: "GscBingGa4McpSettingsPage",
} as const;

export const VERIFIED_MCP_TOOL_NAMES = [
  // GSC analytics and SEO intelligence.
  "sites_list",
  "analytics_query",
  "analytics_top_queries",
  "analytics_trends",
  "analytics_anomalies",
  "analytics_drop_attribution",
  "analytics_time_series",
  "analytics_compare_periods",
  "seo_brand_vs_nonbrand",
  "seo_low_hanging_fruit",
  "seo_striking_distance",
  "seo_low_ctr_opportunities",
  "seo_cannibalization",
  "seo_lost_queries",
  "seo_primitive_ranking_bucket",
  "seo_primitive_traffic_delta",
  "seo_primitive_is_brand",
  "seo_primitive_is_cannibalized",
  "sites_health_check",
  "inspection_inspect",
  "inspection_batch_inspect",
  "inspection_batch_job_start",
  "inspection_batch_job_status",
  "inspection_batch_job_results",
  "inspection_batch_job_cancel",
  "inspection_cache_stats",
  "sitemaps_list",
  "pagespeed_analyze",
  "schema_validate",
  // Bing read-only analytics and diagnostics. Mutating tools such as
  // bing_index_now and sitemap submission stay out of the default allowlist.
  "bing_sites_list",
  "bing_analytics_query",
  "bing_opportunity_finder",
  "bing_seo_recommendations",
  "bing_url_info",
  "bing_crawl_issues",
  "bing_analytics_detect_anomalies",
  "bing_analytics_time_series",
  "bing_seo_lost_queries",
  "bing_brand_analysis",
  "bing_sitemaps_list",
  // GA4 read-only reporting.
  "analytics_page_performance",
  "analytics_traffic_sources",
  "analytics_organic_landing_pages",
  "analytics_content_performance",
  "analytics_conversion_funnel",
  "analytics_user_behavior",
  "analytics_audience_segments",
  "analytics_realtime",
  "analytics_ecommerce",
  "analytics_pagespeed_correlation",
  "page_analysis",
  // Cross-platform read-only intelligence.
  "opportunity_matrix",
] as const;

export type VerifiedMcpToolName = (typeof VERIFIED_MCP_TOOL_NAMES)[number];

export const SITE_SCOPED_MCP_TOOLS = [
  "analytics_top_queries",
  "analytics_query",
  "analytics_trends",
  "analytics_anomalies",
  "analytics_drop_attribution",
  "analytics_time_series",
  "analytics_compare_periods",
  "seo_brand_vs_nonbrand",
  "seo_low_hanging_fruit",
  "seo_striking_distance",
  "seo_low_ctr_opportunities",
  "seo_cannibalization",
  "seo_lost_queries",
  "page_analysis",
  "sites_health_check",
  "inspection_inspect",
  "inspection_batch_inspect",
  "inspection_batch_job_start",
  "inspection_cache_stats",
  "sitemaps_list",
  "schema_validate",
] as const satisfies readonly VerifiedMcpToolName[];

export const GA4_PROPERTY_SCOPED_MCP_TOOLS = [
  "analytics_page_performance",
  "analytics_traffic_sources",
  "analytics_organic_landing_pages",
  "analytics_content_performance",
  "analytics_conversion_funnel",
  "analytics_user_behavior",
  "analytics_audience_segments",
  "analytics_realtime",
  "analytics_ecommerce",
  "analytics_pagespeed_correlation",
  "page_analysis",
] as const satisfies readonly VerifiedMcpToolName[];

export const TOOL_NAMES = {
  listTools: "list-tools",
  callTool: "call-tool",
  sitesList: "sites-list",
  analyticsTopQueries: "analytics-top-queries",
  analyticsQuery: "analytics-query",
  seoLowCtrOpportunities: "seo-low-ctr-opportunities",
  inspectionInspect: "inspection-inspect",
  inspectionBatchInspect: "inspection-batch-inspect",
  inspectionBatchJobStart: "inspection-batch-job-start",
  inspectionBatchJobStatus: "inspection-batch-job-status",
  inspectionBatchJobResults: "inspection-batch-job-results",
  inspectionBatchJobCancel: "inspection-batch-job-cancel",
  inspectionCacheStats: "inspection-cache-stats",
  sitemapsList: "sitemaps-list",
  pagespeedAnalyze: "pagespeed-analyze",
} as const;
