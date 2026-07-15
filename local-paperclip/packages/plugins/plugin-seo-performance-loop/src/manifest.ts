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
    "http.outbound",
    "jobs.schedule",
    "plugin.state.read",
    "plugin.state.write",
    "secrets.read-ref",
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
      weeklyReportTimezone: {
        type: "string",
        title: "Weekly Report Timezone",
        default: DEFAULT_CONFIG.weeklyReportTimezone,
      },
      weeklyReportDataDelayDays: {
        type: "number",
        title: "Weekly Report Data Delay Days",
        default: DEFAULT_CONFIG.weeklyReportDataDelayDays,
      },
      weeklyReportComparisonWeeks: {
        type: "number",
        title: "Weekly Report Comparison Weeks",
        default: DEFAULT_CONFIG.weeklyReportComparisonWeeks,
      },
      telegramReportMode: {
        type: "string",
        title: "Telegram Report Mode",
        default: DEFAULT_CONFIG.telegramReportMode,
      },
      telegramSummaryHardCapChars: {
        type: "number",
        title: "Telegram Summary Hard Cap Characters",
        default: DEFAULT_CONFIG.telegramSummaryHardCapChars,
      },
      detailedReportLanguage: {
        type: "string",
        title: "Detailed Report Language",
        description:
          "BCP-47-style language code for owner-facing detailed reports. Astrogen uses uk; agents must write the email in this language.",
        default: DEFAULT_CONFIG.detailedReportLanguage,
      },
      detailedReportChannel: {
        type: "string",
        title: "Detailed Report Channel",
        default: DEFAULT_CONFIG.detailedReportChannel,
      },
      detailedReportRecipientEmails: {
        type: "string",
        title: "Detailed Report Recipient Emails",
        default: DEFAULT_CONFIG.detailedReportRecipientEmails,
      },
      detailedReportFromEmail: {
        type: "string",
        title: "Detailed Report From Email",
        default: DEFAULT_CONFIG.detailedReportFromEmail,
      },
      resendApiKeySecretRef: {
        type: "string",
        format: "secret-ref",
        title: "Resend API Key Secret Ref",
        default: DEFAULT_CONFIG.resendApiKeySecretRef,
      },
      detailedReportFallback: {
        type: "string",
        title: "Detailed Report Fallback",
        default: DEFAULT_CONFIG.detailedReportFallback,
      },
      articleCadenceEnabled: {
        type: "boolean",
        title: "Enable Article Cadence",
        description:
          "Whether the SEO Performance Loop should treat recurring article generation as an active cadence to monitor and report.",
        default: DEFAULT_CONFIG.articleCadenceEnabled,
      },
      articleCadenceTargetPerDay: {
        type: "number",
        title: "Article Cadence Target Per Day",
        description:
          "Target number of new SEO article draft pipelines to launch per day for this company.",
        default: DEFAULT_CONFIG.articleCadenceTargetPerDay,
        minimum: 0,
      },
      articleCadenceTimezone: {
        type: "string",
        title: "Article Cadence Timezone",
        default: DEFAULT_CONFIG.articleCadenceTimezone,
      },
      articleCadencePreferredTimes: {
        type: "string",
        title: "Article Cadence Preferred Times",
        description:
          "Comma-separated local wall-clock times for article cadence triggers, for example 10:00,15:00.",
        default: DEFAULT_CONFIG.articleCadencePreferredTimes,
      },
      automaticFindingTaskCreationEnabled: {
        type: "boolean",
        title: "Enable Automatic Finding Task Creation",
        default: DEFAULT_CONFIG.automaticFindingTaskCreationEnabled,
      },
      automaticFindingTaskAgent: {
        type: "string",
        title: "Automatic Finding Task Agent",
        default: DEFAULT_CONFIG.automaticFindingTaskAgent,
      },
      automaticFindingTaskMaxPerRun: {
        type: "number",
        title: "Automatic Finding Task Max Per Run",
        default: DEFAULT_CONFIG.automaticFindingTaskMaxPerRun,
      },
      findingCooldownDays: {
        type: "number",
        title: "Finding Cooldown Days",
        default: DEFAULT_CONFIG.findingCooldownDays,
      },
      ignoreCloudflareEmailProtection404: {
        type: "boolean",
        title: "Ignore Cloudflare Email-Protection 404",
        default: DEFAULT_CONFIG.ignoreCloudflareEmailProtection404,
      },
      ignoreCrawlObserverNearDuplicates: {
        type: "boolean",
        title: "Ignore CrawlObserver Near-Duplicate Findings",
        default: DEFAULT_CONFIG.ignoreCrawlObserverNearDuplicates,
      },
      ignoreJsZeroWordArtifacts: {
        type: "boolean",
        title: "Ignore JS Zero-Word Artifacts",
        default: DEFAULT_CONFIG.ignoreJsZeroWordArtifacts,
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
      schedule: "0 6 * * 3",
    },
    {
      jobKey: JOB_KEYS.evaluateWeeklySeoDecisions,
      displayName: "Evaluate Weekly SEO Decisions",
      description: "Evaluates policy thresholds and records hold/watch/refresh decisions.",
      schedule: "30 6 * * 3",
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
    {
      name: TOOL_NAMES.weeklyReportPlanGet,
      displayName: "Get SEO Weekly Report Delivery Plan",
      description:
        "Returns the canonical weekly SEO report window, report language, and delivery-channel split: Telegram gets the compact digest; email gets the detailed report.",
      parametersSchema: {
        type: "object",
        properties: {
          anchorIso: { type: "string" },
          configOverrides: { type: "object" },
        },
      },
    },
    {
      name: TOOL_NAMES.detailedReportEmailSend,
      displayName: "Send SEO Detailed Report Email",
      description:
        "Sends the detailed weekly SEO report through the configured Resend transport. Prefer the structured report input: the plugin renders safe HTML and a plain-text fallback. Use only for detailed report email delivery, not Telegram summaries.",
      parametersSchema: {
        type: "object",
        properties: {
          subject: { type: "string" },
          text: { type: "string" },
          html: { type: "string" },
          report: {
            type: "object",
            description: "Structured owner-facing weekly report. Required for the canonical Astrogen weekly flow.",
            properties: {
              period: { type: "string" },
              executiveSummary: { type: "string" },
              metrics: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    current: { type: "string" },
                    previous: { type: "string" },
                    interpretation: { type: "string" },
                  },
                  required: ["label", "current"],
                },
              },
              actions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    issueId: { type: "string" },
                    title: { type: "string" },
                    owner: { type: "string" },
                    status: { type: "string" },
                    nextStep: { type: "string" },
                    url: { type: "string" },
                  },
                  required: ["title", "nextStep"],
                },
              },
              watchItems: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    reason: { type: "string" },
                    nextReview: { type: "string" },
                  },
                  required: ["title", "reason"],
                },
              },
              noActionReason: { type: "string" },
              ownerAction: { type: "string" },
              details: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    body: { type: "string" },
                  },
                  required: ["title", "body"],
                },
              },
            },
            required: ["period", "executiveSummary", "actions"],
          },
          recipientEmails: { type: "array", items: { type: "string" } },
          idempotencyKey: { type: "string" },
          dryRun: { type: "boolean" },
        },
        required: ["subject"],
      },
    },
    {
      name: TOOL_NAMES.crawlFindingRoutePlan,
      displayName: "Plan CrawlObserver Finding Routing",
      description:
        "Classifies CrawlObserver SEO findings into automatic technical tasks, ignored policy noise, or record-only evidence.",
      parametersSchema: {
        type: "object",
        properties: {
          findings: { type: "array", items: { type: "object" } },
          url: { type: "string" },
          findingType: { type: "string" },
          issueType: { type: "string" },
          severity: { type: "string" },
          statusCode: { type: "number" },
          isIndexable: { type: "boolean" },
          wordCount: { type: "number" },
          source: { type: "string" },
          details: { type: "object" },
        },
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
