import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import {
  DEFAULT_CONFIG,
  EXPORT_NAMES,
  JOB_KEYS,
  PLUGIN_ID,
  PLUGIN_VERSION,
  SLOT_IDS,
  TOOL_NAMES,
} from "./constants.js";

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "SEO Performance Loop",
  description:
    "Registry, telemetry, and weekly decision-loop baseline for published SEO articles.",
  author: "Paperclip",
  categories: ["connector", "automation", "workspace"],
  capabilities: [
    "agent.tools.register",
    "events.subscribe",
    "jobs.schedule",
    "plugin.state.read",
    "plugin.state.write",
    "instance.settings.register",
    "ui.dashboardWidget.register"
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui"
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      googleSearchConsoleCredentialSecretRef: {
        type: "string",
        format: "secret-ref",
        title: "Google Search Console Credential Secret Ref",
        default: DEFAULT_CONFIG.googleSearchConsoleCredentialSecretRef,
      },
      googleSearchConsolePropertyUrl: {
        type: "string",
        title: "Google Search Console Property URL",
        default: DEFAULT_CONFIG.googleSearchConsolePropertyUrl,
      },
      defaultRankProvider: {
        type: "string",
        title: "Default Rank Provider",
        default: DEFAULT_CONFIG.defaultRankProvider,
      },
      defaultRankGeo: {
        type: "string",
        title: "Default Rank Geo",
        default: DEFAULT_CONFIG.defaultRankGeo,
      },
      defaultRankLanguage: {
        type: "string",
        title: "Default Rank Language",
        default: DEFAULT_CONFIG.defaultRankLanguage,
      },
      weeklyCollectionEnabled: {
        type: "boolean",
        title: "Enable Weekly Collection",
        default: DEFAULT_CONFIG.weeklyCollectionEnabled,
      },
      weeklyCollectionDay: {
        type: "string",
        title: "Weekly Collection Day (UTC)",
        default: DEFAULT_CONFIG.weeklyCollectionDay,
      },
      weeklyCollectionHourUtc: {
        type: "number",
        title: "Weekly Collection Hour UTC",
        default: DEFAULT_CONFIG.weeklyCollectionHourUtc,
      },
      stableWindowWeeks: {
        type: "number",
        title: "Stable Window Weeks",
        default: DEFAULT_CONFIG.stableWindowWeeks,
      },
      noisyWindowWeeks: {
        type: "number",
        title: "Noisy Window Weeks",
        default: DEFAULT_CONFIG.noisyWindowWeeks,
      },
      declineWindowWeeks: {
        type: "number",
        title: "Decline Window Weeks",
        default: DEFAULT_CONFIG.declineWindowWeeks,
      },
      stablePositionDeltaThreshold: {
        type: "number",
        title: "Stable Position Delta Threshold",
        default: DEFAULT_CONFIG.stablePositionDeltaThreshold,
      },
      declinePositionDeltaThreshold: {
        type: "number",
        title: "Decline Position Delta Threshold",
        default: DEFAULT_CONFIG.declinePositionDeltaThreshold,
      },
      stableClickDeltaPct: {
        type: "number",
        title: "Stable Click Delta %",
        default: DEFAULT_CONFIG.stableClickDeltaPct,
      },
      declineClickDeltaPct: {
        type: "number",
        title: "Decline Click Delta %",
        default: DEFAULT_CONFIG.declineClickDeltaPct,
      },
      stableImpressionDeltaPct: {
        type: "number",
        title: "Stable Impression Delta %",
        default: DEFAULT_CONFIG.stableImpressionDeltaPct,
      },
      declineImpressionDeltaPct: {
        type: "number",
        title: "Decline Impression Delta %",
        default: DEFAULT_CONFIG.declineImpressionDeltaPct,
      },
    },
  },
  jobs: [
    {
      jobKey: JOB_KEYS.collectWeeklySearchTelemetry,
      displayName: "Collect Weekly Search Telemetry",
      description: "Plans weekly GSC and rank-provider telemetry ingestion requests for published articles without making provider calls.",
      schedule: "0 3 * * 1",
    },
    {
      jobKey: JOB_KEYS.evaluateWeeklySeoDecisions,
      displayName: "Evaluate Weekly SEO Decisions",
      description: "Evaluates policy thresholds and records hold/watch/refresh decisions.",
      schedule: "30 3 * * 1",
    },
  ],
  tools: [
    {
      name: TOOL_NAMES.publishedArticleUpsert,
      displayName: "Upsert Published Article Record",
      description: "Registers or updates one published article in the SEO performance registry.",
      parametersSchema: {
        type: "object",
        properties: {
          publicationEventKey: { type: "string" },
          publicationChannel: { type: "string" },
          publicationAdapter: { type: "string" },
          originIssueId: { type: "string" },
          currentIssueId: { type: "string" },
          canonicalUrl: { type: "string" },
          canonicalSlug: { type: "string" },
          routeKey: { type: "string" },
          productSurface: { type: "string" },
          language: { type: "string" },
          geo: { type: "string" },
          primaryKeyword: { type: "string" },
          supportingKeywords: { type: "array", items: { type: "string" } },
          titleSnapshot: { type: "string" },
          h1Snapshot: { type: "string" },
          metaTitleSnapshot: { type: "string" },
          metaDescriptionSnapshot: { type: "string" },
          authorSnapshot: { type: "string" },
          publishableMarkdownAttachmentId: { type: "string" },
          publishableHtmlAttachmentId: { type: "string" },
          editorialSourceAttachmentId: { type: "string" },
          imageAssetRef: { type: "string" },
          publishedAt: { type: "string" },
          status: { type: "string" },
        },
        required: [
          "publicationEventKey",
          "originIssueId",
          "canonicalUrl",
          "canonicalSlug",
          "routeKey",
          "productSurface",
          "language",
          "geo",
          "primaryKeyword",
          "titleSnapshot",
          "h1Snapshot",
          "metaTitleSnapshot",
          "metaDescriptionSnapshot",
          "authorSnapshot",
          "publishableMarkdownAttachmentId",
          "publishableHtmlAttachmentId",
          "editorialSourceAttachmentId",
        ],
      },
    },
    {
      name: TOOL_NAMES.publishedArticleGet,
      displayName: "Get Published Article Record",
      description: "Returns the latest published-article registry record known to the SEO performance loop.",
      parametersSchema: {
        type: "object",
        properties: {
          articleId: { type: "string" },
          canonicalUrl: { type: "string" },
        },
      },
    },
    {
      name: TOOL_NAMES.telemetryIngestionRecord,
      displayName: "Record Telemetry Ingestion Request",
      description: "Records a host-dispatched telemetry ingestion request and optional supplied telemetry snapshot payload.",
      parametersSchema: {
        type: "object",
        properties: {
          articleId: { type: "string" },
          canonicalUrl: { type: "string" },
          originIssueId: { type: "string" },
          sourceKind: { type: "string" },
          sourceKey: { type: "string" },
          collectionRunKey: { type: "string" },
          snapshotWindowStart: { type: "string" },
          snapshotWindowEnd: { type: "string" },
          requestedAt: { type: "string" },
          pageMetrics: { type: "object" },
          rankMetrics: { type: "object" },
          queries: { type: "array", items: { type: "object" } },
          rawPayload: { type: "object" },
        },
        required: [
          "snapshotWindowStart",
          "snapshotWindowEnd",
        ],
      },
    },
    {
      name: TOOL_NAMES.telemetryIngestionGet,
      displayName: "Get Telemetry Ingestion Requests",
      description: "Returns recent telemetry ingestion requests for a published article.",
      parametersSchema: {
        type: "object",
        properties: {
          articleId: { type: "string" },
          canonicalUrl: { type: "string" },
          originIssueId: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
    {
      name: TOOL_NAMES.telemetrySnapshotRecord,
      displayName: "Record SEO Telemetry Snapshot",
      description: "Records one GSC or rank-provider telemetry snapshot for a registered article.",
      parametersSchema: {
        type: "object",
        properties: {
          articleId: { type: "string" },
          canonicalUrl: { type: "string" },
          sourceKind: { type: "string" },
          sourceKey: { type: "string" },
          snapshotWindowStart: { type: "string" },
          snapshotWindowEnd: { type: "string" },
          pageMetrics: { type: "object" },
          rankMetrics: { type: "object" },
          queries: { type: "array", items: { type: "object" } },
          rawPayload: { type: "object" },
        },
        required: ["sourceKind", "sourceKey", "snapshotWindowStart", "snapshotWindowEnd"],
      },
    },
    {
      name: TOOL_NAMES.searchTelemetryGet,
      displayName: "Get Search Telemetry Snapshot",
      description: "Returns the latest stored search telemetry snapshot for a published article.",
      parametersSchema: {
        type: "object",
        properties: {
          articleId: { type: "string" },
          weeksBack: { type: "number" },
        },
      },
    },
    {
      name: TOOL_NAMES.performanceDecisionGet,
      displayName: "Get SEO Performance Decision",
      description: "Returns the latest stored SEO performance decision for a published article.",
      parametersSchema: {
        type: "object",
        properties: {
          articleId: { type: "string" },
        },
      },
    },
    {
      name: TOOL_NAMES.followupIssueOpen,
      displayName: "Open SEO Follow-up Issue",
      description: "Placeholder hook for opening the next internal SEO follow-up issue from stored telemetry.",
      parametersSchema: {
        type: "object",
        properties: {
          articleId: { type: "string" },
          decision: { type: "string" },
          summary: { type: "string" },
        },
        required: ["articleId", "decision"],
      },
    },
  ],
  ui: {
    slots: [
      {
        type: "dashboardWidget",
        id: SLOT_IDS.dashboardWidget,
        displayName: "SEO Performance Loop",
        exportName: EXPORT_NAMES.dashboardWidget
      },
      {
        type: "settingsPage",
        id: SLOT_IDS.settingsPage,
        displayName: "SEO Performance Loop Settings",
        exportName: EXPORT_NAMES.settingsPage
      }
    ]
  }
};

export default manifest;
