import { DEFAULT_CONFIG } from "./constants.js";

export type SeoLoopReportConfig = {
  weeklyReportTimezone: string;
  weeklyReportDataDelayDays: number;
  weeklyReportComparisonWeeks: number;
  telegramReportMode: "summary_only";
  telegramSummaryHardCapChars: number;
  detailedReportLanguage: string;
  detailedReportChannel: "email" | "paperclip_issue_document";
  detailedReportRecipientEmails: string;
  detailedReportFromEmail: string;
  resendApiKeySecretRef: string;
  detailedReportFallback: "paperclip_issue_document";
  automaticFindingTaskCreationEnabled: boolean;
  automaticFindingTaskAgent: string;
  automaticFindingTaskMaxPerRun: number;
  findingCooldownDays: number;
  ignoreCloudflareEmailProtection404: boolean;
  ignoreCrawlObserverNearDuplicates: boolean;
  ignoreJsZeroWordArtifacts: boolean;
};

export type WeeklyReportPlan = {
  reportWindowStart: string;
  reportWindowEnd: string;
  comparisonWindowStart: string;
  comparisonWindowEnd: string;
  timezone: string;
  dataDelayDays: number;
  language: string;
  telegram: {
    mode: "summary_only";
    language: string;
    hardCapChars: number;
    requiredShape: string[];
  };
  businessKpis: {
    requiredMetrics: string[];
    preferredAcquisitionTools: string[];
    fallbackPolicy: string[];
  };
  detailed: {
    channel: "email" | "paperclip_issue_document";
    language: string;
    recipientEmails: string[];
    fromEmail: string | null;
    transportConfigured: boolean;
    fallback: "paperclip_issue_document";
    requiredShape: string[];
    deliveryReady: boolean;
  };
};

export type CrawlFindingInput = {
  url?: string;
  findingType?: string;
  issueType?: string;
  severity?: string;
  statusCode?: number;
  isIndexable?: boolean;
  wordCount?: number;
  source?: string;
  details?: Record<string, unknown>;
};

export type CrawlFindingRoute = {
  url: string;
  action: "create_task" | "ignore_by_policy" | "record_only";
  reason: string;
  routeToAgent: string | null;
  taskGroupKey: string | null;
  cooldownDays: number;
};

function numberFromConfig(value: unknown, fallback: number, min = 0): number {
  return typeof value === "number" && Number.isFinite(value) && value >= min ? value : fallback;
}

function booleanFromConfig(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function stringFromConfig(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function normalizeReportConfig(raw: Record<string, unknown> = {}): SeoLoopReportConfig {
  return {
    weeklyReportTimezone: stringFromConfig(raw.weeklyReportTimezone, DEFAULT_CONFIG.weeklyReportTimezone),
    weeklyReportDataDelayDays: numberFromConfig(raw.weeklyReportDataDelayDays, DEFAULT_CONFIG.weeklyReportDataDelayDays),
    weeklyReportComparisonWeeks: numberFromConfig(raw.weeklyReportComparisonWeeks, DEFAULT_CONFIG.weeklyReportComparisonWeeks, 1),
    telegramReportMode: "summary_only",
    telegramSummaryHardCapChars: numberFromConfig(raw.telegramSummaryHardCapChars, DEFAULT_CONFIG.telegramSummaryHardCapChars, 600),
    detailedReportLanguage: stringFromConfig(raw.detailedReportLanguage, DEFAULT_CONFIG.detailedReportLanguage),
    detailedReportChannel: stringFromConfig(raw.detailedReportChannel, DEFAULT_CONFIG.detailedReportChannel) === "email"
      ? "email"
      : "paperclip_issue_document",
    detailedReportRecipientEmails: stringFromConfig(raw.detailedReportRecipientEmails, DEFAULT_CONFIG.detailedReportRecipientEmails),
    detailedReportFromEmail: stringFromConfig(raw.detailedReportFromEmail, DEFAULT_CONFIG.detailedReportFromEmail),
    resendApiKeySecretRef: stringFromConfig(raw.resendApiKeySecretRef, DEFAULT_CONFIG.resendApiKeySecretRef),
    detailedReportFallback: "paperclip_issue_document",
    automaticFindingTaskCreationEnabled: booleanFromConfig(
      raw.automaticFindingTaskCreationEnabled,
      DEFAULT_CONFIG.automaticFindingTaskCreationEnabled,
    ),
    automaticFindingTaskAgent: stringFromConfig(raw.automaticFindingTaskAgent, DEFAULT_CONFIG.automaticFindingTaskAgent),
    automaticFindingTaskMaxPerRun: numberFromConfig(
      raw.automaticFindingTaskMaxPerRun,
      DEFAULT_CONFIG.automaticFindingTaskMaxPerRun,
      1,
    ),
    findingCooldownDays: numberFromConfig(raw.findingCooldownDays, DEFAULT_CONFIG.findingCooldownDays, 1),
    ignoreCloudflareEmailProtection404: booleanFromConfig(
      raw.ignoreCloudflareEmailProtection404,
      DEFAULT_CONFIG.ignoreCloudflareEmailProtection404,
    ),
    ignoreCrawlObserverNearDuplicates: booleanFromConfig(
      raw.ignoreCrawlObserverNearDuplicates,
      DEFAULT_CONFIG.ignoreCrawlObserverNearDuplicates,
    ),
    ignoreJsZeroWordArtifacts: booleanFromConfig(raw.ignoreJsZeroWordArtifacts, DEFAULT_CONFIG.ignoreJsZeroWordArtifacts),
  };
}

function mondayStartUtc(date: Date): Date {
  const midnight = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const daysSinceMonday = (midnight.getUTCDay() + 6) % 7;
  midnight.setUTCDate(midnight.getUTCDate() - daysSinceMonday);
  return midnight;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function splitRecipients(value: string): string[] {
  return value
    .split(/[,\n;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildWeeklyReportPlan(rawConfig: Record<string, unknown> = {}, anchorIso = new Date().toISOString()): WeeklyReportPlan {
  const config = normalizeReportConfig(rawConfig);
  const anchor = new Date(anchorIso);
  const reportWindowEnd = mondayStartUtc(anchor);
  const reportWindowStart = addDays(reportWindowEnd, -7);
  const comparisonWindowEnd = addDays(reportWindowStart, 0);
  const comparisonWindowStart = addDays(comparisonWindowEnd, -7 * config.weeklyReportComparisonWeeks);
  const recipientEmails = splitRecipients(config.detailedReportRecipientEmails);
  const transportConfigured = Boolean(config.resendApiKeySecretRef && config.detailedReportFromEmail);

  return {
    reportWindowStart: reportWindowStart.toISOString(),
    reportWindowEnd: reportWindowEnd.toISOString(),
    comparisonWindowStart: comparisonWindowStart.toISOString(),
    comparisonWindowEnd: comparisonWindowEnd.toISOString(),
    timezone: config.weeklyReportTimezone,
    dataDelayDays: config.weeklyReportDataDelayDays,
    language: config.detailedReportLanguage,
    telegram: {
      mode: "summary_only",
      language: config.detailedReportLanguage,
      hardCapChars: config.telegramSummaryHardCapChars,
      requiredShape: [
        `one compact owner-facing digest in ${config.detailedReportLanguage}`,
        "blank line between paragraphs",
        "week-over-week deltas only for core KPIs",
        "include total sales and organic-attributed sales/revenue, or a clear ecommerce-data gap",
        "do not present sessions, users, or engagement as a substitute for sales",
        "no raw tables, issue ids, run ids, plugin names, SQL, or provider internals",
      ],
    },
    businessKpis: {
      requiredMetrics: [
        "total purchases/orders for the reporting week and comparison week",
        "total purchase revenue for the reporting week and comparison week when GA4 ecommerce revenue is available",
        "purchases/orders attributed to Organic Search for both weeks",
        "purchase revenue attributed to Organic Search for both weeks when GA4 ecommerce revenue is available",
        "blog organic sessions and engagement only as traffic context, not as a sales proxy",
      ],
      preferredAcquisitionTools: [
        "analytics_ecommerce",
        "analytics_conversion_funnel",
        "analytics_traffic_sources",
        "analytics_organic_landing_pages",
        "analytics_page_performance",
      ],
      fallbackPolicy: [
        "If exact blog-to-sale attribution is unavailable, report whole-site total sales plus organic-attributed sales.",
        "If ecommerce events or revenue are unavailable, say that sales data is unavailable and route a tracking/data gap instead of replacing sales with sessions.",
        "If GA4 blog tracking is present but returns zero rows, report zero for that scoped metric and still include site-wide sales and organic sales.",
      ],
    },
    detailed: {
      channel: config.detailedReportChannel,
      language: config.detailedReportLanguage,
      recipientEmails,
      fromEmail: config.detailedReportFromEmail || null,
      transportConfigured,
      fallback: config.detailedReportFallback,
      deliveryReady: config.detailedReportChannel === "email"
        ? recipientEmails.length > 0 && transportConfigured
        : true,
      requiredShape: [
        `full KPI table and page-level appendix in ${config.detailedReportLanguage}`,
        "GSC query/page movements",
        "GA4 ecommerce sales table: total sales/revenue and Organic Search-attributed sales/revenue",
        "GA4 blog-to-product event and landing-page breakdown as supporting traffic context",
        "clear separation between traffic/engagement metrics and sales/revenue metrics",
        "indexing and technical SEO findings grouped by action",
        "recommended experiments, owner decisions, cooldowns, and monitoring dates",
      ],
    },
  };
}

function lower(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function hasTruthyDetail(details: Record<string, unknown> | undefined, key: string): boolean {
  return Boolean(details && details[key] === true);
}

export function routeCrawlFinding(
  finding: CrawlFindingInput,
  rawConfig: Record<string, unknown> = {},
): CrawlFindingRoute {
  const config = normalizeReportConfig(rawConfig);
  const url = typeof finding.url === "string" ? finding.url.trim() : "";
  const findingType = lower(finding.findingType);
  const issueType = lower(finding.issueType);
  const source = lower(finding.source);
  const normalized = `${findingType}:${issueType}:${source}`;

  if (config.ignoreCloudflareEmailProtection404 && url.includes("/cdn-cgi/l/email-protection")) {
    return {
      url,
      action: "ignore_by_policy",
      reason: "Cloudflare email-protection probe URL is not an SEO-owned page.",
      routeToAgent: null,
      taskGroupKey: null,
      cooldownDays: config.findingCooldownDays,
    };
  }

  if (config.ignoreCrawlObserverNearDuplicates && (normalized.includes("near") || normalized.includes("duplicate"))) {
    return {
      url,
      action: "ignore_by_policy",
      reason: "CrawlObserver near-duplicate findings are ignored by policy until a better duplicate detector is approved.",
      routeToAgent: null,
      taskGroupKey: null,
      cooldownDays: config.findingCooldownDays,
    };
  }

  const zeroWordArtifact =
    finding.wordCount === 0 &&
    (hasTruthyDetail(finding.details, "jsArtifact") || normalized.includes("zero") || normalized.includes("word_count"));
  if (config.ignoreJsZeroWordArtifacts && zeroWordArtifact) {
    return {
      url,
      action: "ignore_by_policy",
      reason: "Zero-word crawl artifact requires rendered-page confirmation before creating SEO work.",
      routeToAgent: null,
      taskGroupKey: null,
      cooldownDays: config.findingCooldownDays,
    };
  }

  if (config.automaticFindingTaskCreationEnabled === false) {
    return {
      url,
      action: "record_only",
      reason: "Automatic finding task creation is disabled in SEO loop settings.",
      routeToAgent: null,
      taskGroupKey: null,
      cooldownDays: config.findingCooldownDays,
    };
  }

  const needsCmsFix =
    normalized.includes("meta_desc_missing") ||
    normalized.includes("meta_description_missing") ||
    normalized.includes("canonical") ||
    normalized.includes("noindex") ||
    normalized.includes("sitemap") ||
    normalized.includes("redirect") ||
    url.includes("/blog/?category=");

  if (needsCmsFix) {
    return {
      url,
      action: "create_task",
      reason: "Deterministic CMS/indexability finding; route to the SEO CMS fixer without asking the owner.",
      routeToAgent: config.automaticFindingTaskAgent,
      taskGroupKey: `seo-cms-fix:${issueType || findingType || "technical"}`,
      cooldownDays: config.findingCooldownDays,
    };
  }

  return {
    url,
    action: "record_only",
    reason: "Finding is stored for the weekly SEO review but is not in the automatic-fix allowlist.",
    routeToAgent: null,
    taskGroupKey: null,
    cooldownDays: config.findingCooldownDays,
  };
}
