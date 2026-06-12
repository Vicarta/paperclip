export const PLUGIN_ID = "paperclip.crawlobserver-agent-tools";
export const PLUGIN_VERSION = "0.1.0";

export const DEFAULT_CRAWLOBSERVER_BASE_URL =
  "http://ubuntu-aibizmate-n8n.tailbd4e1c.ts.net:8899";
export const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;
export const DEFAULT_MAX_PAGE_LIMIT = 500;

export const SLOT_IDS = {
  settingsPage: "crawlobserver-agent-tools-settings-page",
} as const;

export const EXPORT_NAMES = {
  settingsPage: "CrawlObserverSettingsPage",
} as const;

export const TOOL_NAMES = {
  healthCheck: "health-check",
  serverInfo: "server-info",
  systemStats: "system-stats",
  storageStats: "storage-stats",
  globalStats: "global-stats",
  listProjects: "list-projects",
  listSessions: "list-sessions",
  startCrawl: "start-crawl",
  stopSession: "stop-session",
  resumeSession: "resume-session",
  retryFailed: "retry-failed",
  getSessionProgress: "get-session-progress",
  getSessionStats: "get-session-stats",
  getSessionAudit: "get-session-audit",
  listPages: "list-pages",
  listLinks: "list-links",
  listInternalLinks: "list-internal-links",
  getPageDetail: "get-page-detail",
  getSitemaps: "get-sitemaps",
  getSitemapUrls: "get-sitemap-urls",
  getResourceSummary: "get-resource-summary",
  getResourceChecks: "get-resource-checks",
  getRedirectPages: "get-redirect-pages",
  getNearDuplicates: "get-near-duplicates",
  getStructuredData: "get-structured-data",
  callReadEndpoint: "call-read-endpoint",
} as const;

export const READ_ENDPOINT_ALLOWLIST = [
  "/api/health",
  "/api/server-info",
  "/api/system-stats",
  "/api/storage-stats",
  "/api/global-stats",
  "/api/projects",
  "/api/sessions",
  "/api/sessions/{id}/progress",
  "/api/sessions/{id}/events",
  "/api/sessions/{id}/stats",
  "/api/sessions/{id}/audit",
  "/api/sessions/{id}/pages",
  "/api/sessions/{id}/links",
  "/api/sessions/{id}/internal-links",
  "/api/sessions/{id}/page-detail",
  "/api/sessions/{id}/status-timeline",
  "/api/sessions/{id}/status-timeline-recent",
  "/api/sessions/{id}/pagerank-top",
  "/api/sessions/{id}/pagerank-weighted-top",
  "/api/sessions/{id}/pagerank-distribution",
  "/api/sessions/{id}/pagerank-treemap",
  "/api/sessions/{id}/robots",
  "/api/sessions/{id}/robots-content",
  "/api/sessions/{id}/sitemaps",
  "/api/sessions/{id}/sitemap-urls",
  "/api/sessions/{id}/sitemap-coverage-urls",
  "/api/sessions/{id}/external-checks",
  "/api/sessions/{id}/external-checks/domains",
  "/api/sessions/{id}/external-checks/expired-domains",
  "/api/sessions/{id}/resource-checks",
  "/api/sessions/{id}/resource-checks/summary",
  "/api/sessions/{id}/near-duplicates",
  "/api/sessions/{id}/redirect-pages",
  "/api/sessions/{id}/structured-data",
  "/api/sessions/{id}/url-patterns",
  "/api/sessions/{id}/url-params",
  "/api/sessions/{id}/url-directories",
  "/api/sessions/{id}/url-hosts",
  "/api/sessions/{id}/authority",
] as const;
