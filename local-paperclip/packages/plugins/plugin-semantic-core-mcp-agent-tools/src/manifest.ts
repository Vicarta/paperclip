import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import {
  DEFAULT_SEMANTIC_CORE_MCP_URL,
  EXPORT_NAMES,
  PLUGIN_ID,
  PLUGIN_VERSION,
  SLOT_IDS,
  TOOL_NAMES,
} from "./constants.js";

const looseObjectSchema = {
  type: "object",
  additionalProperties: true,
} as const;

const trendTopicReportParametersSchema = {
  type: "object",
  required: ["project_id", "project", "audience_segments", "analysis_date"],
  properties: {
    project_id: { type: "string", minLength: 1 },
    project: {
      type: "object",
      required: ["name", "description", "market", "geographies", "output_language"],
      properties: {
        name: { type: "string", minLength: 1 },
        description: { type: "string", minLength: 1 },
        market: { type: "string", minLength: 1 },
        geographies: { type: "array", items: { type: "string", minLength: 1 } },
        output_language: { type: "string", minLength: 2 },
        business_context: { type: "string", maxLength: 5_000 },
      },
      additionalProperties: false,
    },
    audience_segments: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["id", "name", "description"],
        properties: {
          id: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1 },
          description: { type: "string", minLength: 1 },
        },
        additionalProperties: false,
      },
    },
    analysis_date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    horizon_months: { type: "integer", minimum: 1, maximum: 12 },
    constraints: {
      type: "object",
      properties: {
        max_clusters: { type: "integer", minimum: 0, maximum: 12 },
        topics_per_cluster: { type: "integer", minimum: 2, maximum: 5 },
        content_lead_time_days: { type: "integer", minimum: 0, maximum: 365 },
        excluded_topics: { type: "array", items: { type: "string" } },
        max_research_queries: { type: "integer", minimum: 1, maximum: 12 },
        max_sources: { type: "integer", minimum: 1, maximum: 30 },
        max_watchlist_items: { type: "integer", minimum: 0, maximum: 25 },
        max_source_chars: { type: "integer", minimum: 500, maximum: 100_000 },
        request_timeout_ms: { type: "integer", minimum: 5_000, maximum: 300_000 },
      },
      additionalProperties: false,
    },
    cache_policy: {
      type: "object",
      properties: {
        scope: { type: "string", enum: ["private_project"] },
        strategy: { type: "string", enum: ["use_cache", "refresh", "bypass"] },
        search_ttl_seconds: { type: "integer", minimum: 0 },
        source_ttl_seconds: { type: "integer", minimum: 0 },
        llm_ttl_seconds: { type: "integer", minimum: 0 },
        stale_retention_seconds: { type: "integer", minimum: 0 },
        max_entry_bytes: { type: "integer", minimum: 1_024, maximum: 10_000_000 },
        stale_if_provider_unavailable: { type: "boolean" },
        cache_llm_outputs: { type: "boolean" },
      },
      additionalProperties: false,
    },
    mode: { type: "string", enum: ["fixture", "live"] },
    company_goal: { type: "string", maxLength: 3_000 },
    products: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "name"],
        properties: {
          id: { type: "string", minLength: 1, maxLength: 100 },
          name: { type: "string", minLength: 1, maxLength: 200 },
          description: { type: "string", maxLength: 3_000 },
          url: { type: "string", minLength: 1 },
        },
        additionalProperties: false,
      },
    },
    existing_content: {
      type: "array",
      items: {
        type: "object",
        required: ["title"],
        properties: {
          title: { type: "string", minLength: 1 },
          url: { type: "string", minLength: 1 },
          published_at: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          status: { type: "string", enum: ["published", "planned"] },
        },
        additionalProperties: false,
      },
    },
    previous_clusters: {
      type: "array",
      items: {
        type: "object",
        required: ["title"],
        properties: {
          id: { type: "string", maxLength: 100 },
          title: { type: "string", minLength: 1, maxLength: 500 },
          summary: { type: "string", maxLength: 3_000 },
        },
        additionalProperties: false,
      },
    },
    internal_signals: {
      type: "array",
      items: {
        type: "object",
        required: ["title", "description"],
        properties: {
          title: { type: "string", minLength: 1, maxLength: 500 },
          description: { type: "string", minLength: 1, maxLength: 5_000 },
          observed_at: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          source: { type: "string", maxLength: 500 },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
} as const;

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "Semantic Core MCP Agent Tools",
  description:
    "Server-side adapter for the private Semantic Core MCP endpoint. Agents can register projects, run semantic layers, generate isolated trend reports, validate Paperclip imports, and submit review decisions without seeing endpoint credentials.",
  author: "Paperclip",
  categories: ["connector", "automation"],
  capabilities: [
    "http.outbound",
    "secrets.read-ref",
    "agent.tools.register",
    "instance.settings.register",
    "plugin.state.read",
    "plugin.state.write",
    "projects.read",
    "companies.read",
    "costs.write",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      semanticCoreMcpTokenSecretRef: {
        type: "string",
        format: "secret-ref",
        title: "Semantic Core MCP Token Secret Ref",
        description:
          "Paperclip secret UUID that stores SEMANTIC_CORE_MCP_TOKEN. Agents never receive the plaintext token.",
        default: "",
      },
      semanticCoreMcpUrl: {
        type: "string",
        title: "Semantic Core MCP URL",
        description: "Private Semantic Core MCP Streamable HTTP endpoint.",
        default: DEFAULT_SEMANTIC_CORE_MCP_URL,
      },
      defaultProjectId: {
        type: "string",
        title: "Default Semantic Project ID",
        description:
          "Company-scoped semantic project_id injected when an agent omits it. A conflicting agent-supplied value is rejected before any MCP request.",
        default: "",
      },
      allowedProjectIdsCsv: {
        type: "string",
        title: "Allowed Semantic Project IDs",
        description:
          "Optional comma-separated semantic project_id allowlist. Empty means no plugin-side project restriction.",
        default: "",
      },
      allowedClientKeysCsv: {
        type: "string",
        title: "Allowed Client Keys",
        description:
          "Optional comma-separated client_key allowlist when project_config/client_key is provided. Empty means no plugin-side client_key restriction.",
        default: "",
      },
      requestTimeoutMs: {
        type: "number",
        title: "Request Timeout Ms",
        description: "Timeout for one MCP connection/call.",
        default: 300000,
      },
      pollIntervalMs: {
        type: "number",
        title: "Job Poll Interval Ms",
        description: "Polling interval for run-layer-and-wait.",
        default: 2000,
      },
      runWaitTimeoutMs: {
        type: "number",
        title: "Run Wait Timeout Ms",
        description: "Maximum wait time for run-layer-and-wait.",
        default: 600000,
      },
      providerExecutionPolicy: {
        type: "string",
        title: "Provider Execution Policy",
        description:
          "Fail-closed policy for semantic provider calls. read_only cannot spend; approved_candidate_batch allows only 1-10 exact candidates and still forbids priority, Search Intent, content parsing, refresh, and bypass.",
        enum: ["disabled", "read_only", "approved_candidate_batch"],
        default: "disabled",
      },
      trendLiveExecutionEnabled: {
        type: "boolean",
        title: "Enable Live Trend Execution",
        description:
          "Operator gate for bounded live trend research. Disabled by default even when the remote MCP server is enabled.",
        default: false,
      },
      contentParsingExecutionPolicy: {
        type: "string",
        title: "Content Parsing Execution Policy",
        description:
          "Fail-closed policy for standalone competitor-page evidence. approved_bounded_evidence permits only 1-3 explicit public URLs, Standard queue, no Markdown/browser rendering, and at most 50 terms per URL.",
        enum: ["disabled", "approved_bounded_evidence"],
        default: "disabled",
      },
    },
  },
  ui: {
    slots: [
      {
        type: "settingsPage",
        id: SLOT_IDS.settingsPage,
        displayName: "Semantic Core MCP Settings",
        exportName: EXPORT_NAMES.settingsPage,
      },
    ],
  },
  tools: [
    {
      name: TOOL_NAMES.listTools,
      displayName: "Semantic Core MCP List Tools",
      description: "List allowlisted tools exposed by the private Semantic Core MCP server.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.getPaperclipImportSchema,
      displayName: "Semantic Core Get Paperclip Import Schema",
      description: "Call Semantic Core MCP `get_paperclip_import_schema`.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.registerProject,
      displayName: "Semantic Core Register Project",
      description: "Call Semantic Core MCP `register_project`.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.validateProject,
      displayName: "Semantic Core Validate Project",
      description: "Call Semantic Core MCP `validate_project`.",
      parametersSchema: looseObjectSchema,
      executionTimeoutMs: 60_000,
    },
    {
      name: TOOL_NAMES.runLayer,
      displayName: "Semantic Core Run Layer",
      description:
        "Call Semantic Core MCP `run_layer`. Omitted mode defaults to mock. Provider calls are fail-closed and require an operator-approved plugin policy; autonomous paid runs are limited to exact candidate batches with economical enrichments.",
      parametersSchema: looseObjectSchema,
      executionTimeoutMs: 120_000,
    },
    {
      name: TOOL_NAMES.runLayerAndWait,
      displayName: "Semantic Core Run Layer And Wait",
      description:
        "Call `run_layer`, poll `get_job_status`, and return the completed run_id with candidate_keyword_count. Omitted mode defaults to mock; paid provider execution requires 1-10 exact candidate_keywords and follows the fail-closed candidate-batch policy.",
      parametersSchema: looseObjectSchema,
      executionTimeoutMs: 360_000,
    },
    {
      name: TOOL_NAMES.getJobStatus,
      displayName: "Semantic Core Get Job Status",
      description: "Call Semantic Core MCP `get_job_status`.",
      parametersSchema: looseObjectSchema,
      executionTimeoutMs: 60_000,
    },
    {
      name: TOOL_NAMES.requestContentParsing,
      displayName: "Semantic Core Request Content Parsing",
      description:
        "Queue a bounded, evidence-only competitor-page parsing job. It never changes semantic membership or creates Paperclip topics/articles.",
      parametersSchema: looseObjectSchema,
      executionTimeoutMs: 60_000,
    },
    {
      name: TOOL_NAMES.listRuns,
      displayName: "Semantic Core List Runs",
      description: "Call Semantic Core MCP `list_runs`.",
      parametersSchema: looseObjectSchema,
      executionTimeoutMs: 60_000,
    },
    {
      name: TOOL_NAMES.getKeywords,
      displayName: "Semantic Core Get Keywords",
      description: "Call Semantic Core MCP `get_keywords`.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.getClusters,
      displayName: "Semantic Core Get Clusters",
      description: "Call Semantic Core MCP `get_clusters`.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.getLocalInventory,
      displayName: "Semantic Core Get Local Inventory",
      description:
        "Read a bounded, project-scoped view of the latest semantic-core import already stored in Paperclip.",
      parametersSchema: {
        type: "object",
        properties: {
          limit: { type: "number", minimum: 1, maximum: 50, default: 20 },
          offset: { type: "number", minimum: 0, default: 0 },
          minimumGeoSearchVolume: { type: "number", minimum: 0, default: 0 },
          search: { type: "string", maxLength: 200 },
        },
        additionalProperties: false,
      },
    },
    {
      name: TOOL_NAMES.getTrendTopicReport,
      displayName: "Semantic Core Get Trend Topic Report",
      description:
        "Read a bounded, project-scoped portfolio DTO from a trend report already stored in Paperclip. This never calls a provider or creates semantic imports, topics, or articles.",
      parametersSchema: {
        type: "object",
        properties: {
          runId: { type: "string", minLength: 1, maxLength: 160 },
          mode: { type: "string", enum: ["live", "fixture", "any"], default: "live" },
          maxClusters: { type: "number", minimum: 1, maximum: 8, default: 8 },
          maxIdeasPerCluster: { type: "number", minimum: 1, maximum: 3, default: 3 },
          maxEvidencePerCluster: { type: "number", minimum: 0, maximum: 5, default: 3 },
        },
        additionalProperties: false,
      },
    },
    {
      name: TOOL_NAMES.getSerpSegments,
      displayName: "Semantic Core Get SERP Segments",
      description: "Call Semantic Core MCP `get_serp_segments`.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.generateTrendTopicReport,
      displayName: "Semantic Core Generate Trend Topic Report",
      description:
        "Generate one project-isolated trend_topic_report.v1. The report is portfolio evidence only and is never imported as semantic-core keywords or topic inventory. Astrogen trend discovery must use its audience-trends project and audience-segment signals, not product seeds.",
      parametersSchema: trendTopicReportParametersSchema,
      executionTimeoutMs: 360_000,
    },
    {
      name: TOOL_NAMES.preparePaperclipImport,
      displayName: "Semantic Core Prepare Paperclip Import",
      description:
        "Call `prepare_paperclip_import`, validate `paperclip_import.v1`, and persist an operational import candidate.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.getReviewQueue,
      displayName: "Semantic Core Get Review Queue",
      description: "Call Semantic Core MCP `get_review_queue`.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.submitReviewDecisions,
      displayName: "Semantic Core Submit Review Decisions",
      description: "Call Semantic Core MCP `submit_review_decisions`.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.getRunCosts,
      displayName: "Semantic Core Get Run Costs",
      description: "Call Semantic Core MCP `get_run_costs`.",
      parametersSchema: looseObjectSchema,
    },
    {
      name: TOOL_NAMES.smokeTest,
      displayName: "Semantic Core Smoke Test",
      description:
        "Run schema/register_project/validate_project/mock layer/get_keywords/import validation smoke through the configured MCP server.",
      parametersSchema: looseObjectSchema,
    },
  ],
};

export default manifest;
