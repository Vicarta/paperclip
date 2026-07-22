import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import {
  DEFAULT_CRAWLOBSERVER_BASE_URL,
  DEFAULT_MAX_PAGE_LIMIT,
  DEFAULT_REQUEST_TIMEOUT_MS,
  EXPORT_NAMES,
  PLUGIN_ID,
  PLUGIN_VERSION,
  READ_ENDPOINT_ALLOWLIST,
  SLOT_IDS,
  TOOL_NAMES,
} from "./constants.js";

export const looseObjectSchema = {
  type: "object",
  additionalProperties: true,
} as const;

export const sessionSchema = {
  type: "object",
  properties: {
    sessionId: { type: "string" },
  },
  required: ["sessionId"],
} as const;

export const sessionsQuerySchema = {
  type: "object",
  properties: {
    project_id: {
      type: "string",
      description:
        "Optional CrawlObserver project ID. Omit it when the plugin has a company-scoped allowedProjectId; the plugin injects that value.",
    },
    limit: { type: "number" },
    offset: { type: "number" },
    search: { type: "string" },
  },
  additionalProperties: false,
} as const;

export const sessionPagedSchema = {
  type: "object",
  properties: {
    sessionId: {
      type: "string",
      description: "Crawl session ID returned by list-sessions. Use this exact camelCase key.",
    },
    limit: { type: "number" },
    offset: { type: "number" },
    sort: { type: "string" },
    order: { type: "string", enum: ["asc", "desc"] },
    url: { type: "string" },
    status_code: { oneOf: [{ type: "string" }, { type: "number" }] },
    title: { type: "string" },
    content_type: { type: "string" },
    page_type: { type: "string" },
    depth: { type: "number" },
    word_count: { type: "number" },
    is_indexable: { type: "boolean" },
    canonical: { type: "string" },
    meta_description: { type: "string" },
    h1: { type: "string" },
    h2: { type: "string" },
    pagerank: { type: "number" },
    source_url: { type: "string" },
    target_url: { type: "string" },
    anchor_text: { type: "string" },
    rel: { type: "string" },
    tag: { type: "string" },
    resource_type: { type: "string" },
    is_internal: { type: "boolean" },
    error: { type: "string" },
    severity: { type: "string" },
    issue_type: { type: "string" },
  },
  required: ["sessionId"],
  additionalProperties: true,
} as const;

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "CrawlObserver Agent Tools",
  description:
    "Server-side adapter for the private Tailnet-only CrawlObserver SEO crawler API. Agents can acquire crawl evidence without seeing API keys.",
  author: "Paperclip",
  categories: ["connector", "automation"],
  capabilities: [
    "http.outbound",
    "secrets.read-ref",
    "agent.tools.register",
    "instance.settings.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      crawlObserverApiKeySecretRef: {
        type: "string",
        format: "secret-ref",
        title: "CrawlObserver API Key Secret Ref",
        description:
          "Paperclip secret UUID storing the CrawlObserver API key. Agents never receive the plaintext key.",
        default: "",
      },
      crawlObserverBaseUrl: {
        type: "string",
        title: "CrawlObserver Base URL",
        description: "Private Tailnet-only CrawlObserver API base URL.",
        default: DEFAULT_CRAWLOBSERVER_BASE_URL,
      },
      allowedProjectId: {
        type: "string",
        title: "Allowed CrawlObserver Project ID",
      description:
          "Company-scoped project guardrail. When set, session inventory calls inject it when omitted and reject another project_id before reaching CrawlObserver.",
        default: "",
      },
      allowMutatingTools: {
        type: "boolean",
        title: "Allow Mutating Tools",
        description:
          "Enable only for trusted agents with a general CrawlObserver API key. Required for start/stop/resume/retry crawl operations.",
        default: false,
      },
      requestTimeoutMs: {
        type: "number",
        title: "Request Timeout Ms",
        description:
          "Timeout for one CrawlObserver API call. Large page exports should be paged instead of increasing this excessively.",
        default: DEFAULT_REQUEST_TIMEOUT_MS,
      },
      maxPageLimit: {
        type: "number",
        title: "Max Page Limit",
        description:
          "Maximum limit value forwarded to paged CrawlObserver endpoints.",
        default: DEFAULT_MAX_PAGE_LIMIT,
      },
    },
  },
  ui: {
    slots: [
      {
        type: "settingsPage",
        id: SLOT_IDS.settingsPage,
        displayName: "CrawlObserver Settings",
        exportName: EXPORT_NAMES.settingsPage,
      },
    ],
  },
  tools: [
    {
      name: TOOL_NAMES.healthCheck,
      displayName: "CrawlObserver Health Check",
      description: "Call `GET /api/health` on the configured CrawlObserver server.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.serverInfo,
      displayName: "CrawlObserver Server Info",
      description: "Call `GET /api/server-info`.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.systemStats,
      displayName: "CrawlObserver System Stats",
      description: "Call `GET /api/system-stats`.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.storageStats,
      displayName: "CrawlObserver Storage Stats",
      description: "Call `GET /api/storage-stats`.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.globalStats,
      displayName: "CrawlObserver Global Stats",
      description: "Call `GET /api/global-stats`.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.listProjects,
      displayName: "CrawlObserver List Projects",
      description: "Call `GET /api/projects`.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.listSessions,
      displayName: "CrawlObserver List Sessions",
      description:
        "Call `GET /api/sessions` with optional limit, offset, project_id, and search filters.",
      parametersSchema: sessionsQuerySchema,
    },
    {
      name: TOOL_NAMES.startCrawl,
      displayName: "CrawlObserver Start Crawl",
      description:
        "Start a CrawlObserver crawl. Requires plugin config `allowMutatingTools=true` and a general CrawlObserver API key.",
      parametersSchema: {
        type: "object",
        properties: {
          seeds: { type: "array", items: { type: "string" } },
          project_id: { type: "string" },
        },
        required: ["seeds"],
        additionalProperties: true,
      },
    },
    {
      name: TOOL_NAMES.stopSession,
      displayName: "CrawlObserver Stop Session",
      description: "Stop a crawl session. Requires mutating tools.",
      parametersSchema: sessionSchema,
    },
    {
      name: TOOL_NAMES.resumeSession,
      displayName: "CrawlObserver Resume Session",
      description: "Resume a crawl session. Requires mutating tools.",
      parametersSchema: sessionSchema,
    },
    {
      name: TOOL_NAMES.retryFailed,
      displayName: "CrawlObserver Retry Failed",
      description: "Retry failed URLs for a crawl session. Requires mutating tools.",
      parametersSchema: sessionSchema,
    },
    {
      name: TOOL_NAMES.getSessionProgress,
      displayName: "CrawlObserver Session Progress",
      description: "Call `GET /api/sessions/{id}/progress`.",
      parametersSchema: sessionSchema,
    },
    {
      name: TOOL_NAMES.getSessionStats,
      displayName: "CrawlObserver Session Stats",
      description: "Call `GET /api/sessions/{id}/stats`.",
      parametersSchema: sessionSchema,
    },
    {
      name: TOOL_NAMES.getSessionAudit,
      displayName: "CrawlObserver Session Audit",
      description: "Call `GET /api/sessions/{id}/audit`.",
      parametersSchema: sessionSchema,
    },
    {
      name: TOOL_NAMES.getSessionQuality,
      displayName: "CrawlObserver Session Quality",
      description:
        "Call `GET /api/sessions/{id}/quality`. Use this as the trust gate before using crawl data for SEO recommendations.",
      parametersSchema: sessionSchema,
    },
    {
      name: TOOL_NAMES.listPages,
      displayName: "CrawlObserver List Pages",
      description:
        "Call `GET /api/sessions/{id}/pages` with allowlisted pagination, sorting, and page filters. Use `page_type=html` for SEO page inventory; rows include `internal_links_in` and `internal_links_out` when the CrawlObserver API provides them.",
      parametersSchema: sessionPagedSchema,
    },
    {
      name: TOOL_NAMES.listLinks,
      displayName: "CrawlObserver List Links",
      description:
        "Call `GET /api/sessions/{id}/links` with allowlisted pagination, sorting, and link filters.",
      parametersSchema: sessionPagedSchema,
    },
    {
      name: TOOL_NAMES.listInternalLinks,
      displayName: "CrawlObserver List Internal Links",
      description: "Call `GET /api/sessions/{id}/internal-links`.",
      parametersSchema: sessionPagedSchema,
    },
    {
      name: TOOL_NAMES.getPageDetail,
      displayName: "CrawlObserver Page Detail",
      description: "Call `GET /api/sessions/{id}/page-detail?url=<url>`.",
      parametersSchema: {
        type: "object",
        properties: {
          sessionId: { type: "string" },
          url: { type: "string" },
        },
        required: ["sessionId", "url"],
      },
    },
    {
      name: TOOL_NAMES.getSitemaps,
      displayName: "CrawlObserver Sitemaps",
      description: "Call `GET /api/sessions/{id}/sitemaps`.",
      parametersSchema: sessionSchema,
    },
    {
      name: TOOL_NAMES.getSitemapUrls,
      displayName: "CrawlObserver Sitemap URLs",
      description: "Call `GET /api/sessions/{id}/sitemap-urls`.",
      parametersSchema: sessionPagedSchema,
    },
    {
      name: TOOL_NAMES.getResourceSummary,
      displayName: "CrawlObserver Resource Summary",
      description: "Call `GET /api/sessions/{id}/resource-checks/summary`.",
      parametersSchema: sessionSchema,
    },
    {
      name: TOOL_NAMES.getResourceChecks,
      displayName: "CrawlObserver Resource Checks",
      description:
        "Call `GET /api/sessions/{id}/resource-checks` with allowlisted filters such as resource_type=image, status_code, url, is_internal, and error.",
      parametersSchema: sessionPagedSchema,
    },
    {
      name: TOOL_NAMES.getPageIssues,
      displayName: "CrawlObserver Page Issues",
      description:
        "Call `GET /api/sessions/{id}/page-issues` with allowlisted filters such as severity, issue_type, and url. Use for soft_404 and generic rendered/static metadata findings.",
      parametersSchema: sessionPagedSchema,
    },
    {
      name: TOOL_NAMES.getRedirectPages,
      displayName: "CrawlObserver Redirect Pages",
      description: "Call `GET /api/sessions/{id}/redirect-pages`.",
      parametersSchema: sessionPagedSchema,
    },
    {
      name: TOOL_NAMES.getNearDuplicates,
      displayName: "CrawlObserver Near Duplicates",
      description: "Call `GET /api/sessions/{id}/near-duplicates`.",
      parametersSchema: sessionPagedSchema,
    },
    {
      name: TOOL_NAMES.getStructuredData,
      displayName: "CrawlObserver Structured Data",
      description: "Call `GET /api/sessions/{id}/structured-data`.",
      parametersSchema: sessionPagedSchema,
    },
    {
      name: TOOL_NAMES.callReadEndpoint,
      displayName: "CrawlObserver Call Read Endpoint",
      description:
        "Call one backend-allowlisted read-only CrawlObserver endpoint. This is not an arbitrary HTTP proxy.",
      parametersSchema: {
        type: "object",
        properties: {
          endpoint: {
            type: "string",
            enum: [...READ_ENDPOINT_ALLOWLIST],
          },
          sessionId: { type: "string" },
          query: looseObjectSchema,
        },
        required: ["endpoint"],
      },
    },
  ],
};

export default manifest;
