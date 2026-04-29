export const PLUGIN_ID = "paperclip.search-console-mcp-agent-tools";
export const PLUGIN_VERSION = "0.1.0";

export const DEFAULT_SEARCH_CONSOLE_MCP_URL = "http://100.98.5.50:3002/mcp";
export const DEFAULT_ALLOWED_SITE_URL = "sc-domain:astrogen.com.ua";

export const SLOT_IDS = {
  settingsPage: "search-console-mcp-agent-tools-settings-page",
} as const;

export const EXPORT_NAMES = {
  settingsPage: "SearchConsoleMcpSettingsPage",
} as const;

export const MCP_TOOL_NAMES = [
  "sites_list",
  "analytics_top_queries",
  "analytics_query",
  "seo_low_ctr_opportunities",
  "inspection_inspect",
  "sitemaps_list",
  "pagespeed_analyze",
] as const;

export type SearchConsoleMcpToolName = (typeof MCP_TOOL_NAMES)[number];

export const SITE_SCOPED_MCP_TOOLS = [
  "analytics_top_queries",
  "analytics_query",
  "seo_low_ctr_opportunities",
  "inspection_inspect",
  "sitemaps_list",
] as const satisfies readonly SearchConsoleMcpToolName[];

export const TOOL_NAMES = {
  listTools: "list-tools",
  callTool: "call-tool",
  sitesList: "sites-list",
  analyticsTopQueries: "analytics-top-queries",
  analyticsQuery: "analytics-query",
  seoLowCtrOpportunities: "seo-low-ctr-opportunities",
  inspectionInspect: "inspection-inspect",
  sitemapsList: "sitemaps-list",
  pagespeedAnalyze: "pagespeed-analyze",
} as const;
