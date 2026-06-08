import { createHash } from "node:crypto";
import {
  definePlugin,
  runWorker,
  type PluginContext,
  type PluginJobContext,
  type ToolResult,
} from "@paperclipai/plugin-sdk";
import {
  DEFAULT_CONFIG,
  JOB_KEYS,
  PLUGIN_ID,
  TOOL_NAMES,
} from "./constants.js";
import {
  buildWeeklyReportPlan,
  routeCrawlFinding,
} from "./report-policy.js";

type LoopConfig = {
  googleSearchConsoleCredentialSecretRef: string;
  googleSearchConsolePropertyUrl: string;
  defaultRankProvider: string;
  defaultRankGeo: string;
  defaultRankLanguage: string;
  weeklyCollectionEnabled: boolean;
  weeklyCollectionDay: string;
  weeklyCollectionHourUtc: number;
  stableWindowWeeks: number;
  noisyWindowWeeks: number;
  declineWindowWeeks: number;
  stablePositionDeltaThreshold: number;
  declinePositionDeltaThreshold: number;
  stableClickDeltaPct: number;
  declineClickDeltaPct: number;
  stableImpressionDeltaPct: number;
  declineImpressionDeltaPct: number;
  weeklyReportTimezone: string;
  weeklyReportDataDelayDays: number;
  weeklyReportComparisonWeeks: number;
  telegramReportMode: string;
  telegramSummaryHardCapChars: number;
  detailedReportChannel: string;
  detailedReportRecipientEmails: string;
  detailedReportFromEmail: string;
  resendApiKeySecretRef: string;
  detailedReportFallback: string;
  automaticFindingTaskCreationEnabled: boolean;
  automaticFindingTaskAgent: string;
  automaticFindingTaskMaxPerRun: number;
  findingCooldownDays: number;
  ignoreCloudflareEmailProtection404: boolean;
  ignoreCrawlObserverNearDuplicates: boolean;
  ignoreJsZeroWordArtifacts: boolean;
} & Record<string, unknown>;

type PageMetrics = {
  impressions?: number | null;
  clicks?: number | null;
  ctr?: number | null;
  averagePosition?: number | null;
};

type RankMetrics = {
  keyword?: string | null;
  geo?: string | null;
  language?: string | null;
  position?: number | null;
};

type PublishedArticle = {
  id: string;
  publicationEventKey: string;
  publicationChannel: string;
  publicationAdapter: string;
  originIssueId: string;
  currentIssueId: string;
  firstPublishedAt: string;
  lastPublishedAt: string;
  canonicalUrl: string;
  canonicalSlug: string;
  routeKey: string;
  productSurface: string;
  language: string;
  geo: string;
  primaryKeyword: string;
  supportingKeywords: string[];
  titleSnapshot: string;
  h1Snapshot: string;
  metaTitleSnapshot: string;
  metaDescriptionSnapshot: string;
  authorSnapshot: string;
  publishableMarkdownAttachmentId: string;
  publishableHtmlAttachmentId: string;
  editorialSourceAttachmentId: string;
  imageAssetRef: string | null;
  status: "published" | "republished" | "retired";
  republishCount: number;
  createdAt: string;
  updatedAt: string;
};

type TelemetrySnapshot = {
  id: string;
  publishedArticleId: string;
  collectionRunKey: string;
  sourceKind: "gsc" | "rank_provider";
  sourceKey: string;
  snapshotWindowStart: string;
  snapshotWindowEnd: string;
  capturedAt: string;
  pageMetrics: PageMetrics | null;
  rankMetrics: RankMetrics | null;
  queries: Array<Record<string, unknown>>;
  rawPayload: Record<string, unknown>;
  snapshotFingerprint: string;
};

type TelemetryIngestionRequest = {
  id: string;
  publishedArticleId: string;
  collectionRunKey: string;
  sourceKind: "gsc" | "rank_provider";
  sourceKey: string;
  snapshotWindowStart: string;
  snapshotWindowEnd: string;
  requestedAt: string;
  requestedBy: "scheduled_job" | "host_dispatch";
  requestType: "plan" | "dispatch";
  registrySnapshot: {
    canonicalUrl: string;
    canonicalSlug: string;
    routeKey: string;
    productSurface: string;
    language: string;
    geo: string;
    primaryKeyword: string;
  };
  externalProviderBoundary: {
    googleSearchConsole: "not_implemented";
    rankProvider: "not_implemented";
  };
  snapshotId: string | null;
  snapshotFingerprint: string | null;
  requestFingerprint: string;
  createdAt: string;
};

type SeoDecision = {
  id: string;
  publishedArticleId: string;
  decisionWindowStart: string;
  decisionWindowEnd: string;
  decisionStatus: "hold" | "watch" | "refresh" | "benchmark_serp" | "offpage_recommendation" | "escalate";
  decisionReason: string;
  triggerSnapshotIds: string[];
  policySnapshot: Record<string, unknown>;
  metricsSnapshot: Record<string, unknown>;
  openedIssueId: string | null;
  createdAt: string;
};

type ArticleIndex = {
  ids: string[];
  canonicalUrls: Record<string, string>;
  originIssueIds: Record<string, string>;
};

type LoopHealthData = {
  status: "ok";
  checkedAt: string;
  registryBackend: "plugin-state-store";
  telemetrySource: "manual-gsc-plus-rank-provider-boundary";
  registeredArticleCount: number;
  lastCollectionRun: Record<string, unknown> | null;
  lastIngestionRun: Record<string, unknown> | null;
  lastDecisionRun: Record<string, unknown> | null;
  reportPolicy: {
    telegramMode: string;
    detailedChannel: string;
    detailedDeliveryReady: boolean;
  };
};

const INDEX_KEY = "registry:index";

function stableHash(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 24);
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeUrl(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  return raw.replace(/\/+$/, "");
}

function stringValue(params: Record<string, unknown>, key: string, fallback = ""): string {
  const value = params[key];
  return typeof value === "string" ? value.trim() : fallback;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanValue(params: Record<string, unknown>, key: string, fallback = false): boolean {
  const value = params[key];
  return typeof value === "boolean" ? value : fallback;
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function splitRecipients(value: string): string[] {
  return value
    .split(/[,\n;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isReasonableEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function truncate(value: string, max = 500): string {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

async function getConfig(ctx: PluginContext): Promise<LoopConfig> {
  return {
    ...DEFAULT_CONFIG,
    ...((await ctx.config.get()) as Record<string, unknown> | null),
  } as LoopConfig;
}

async function getState<T>(ctx: PluginContext, stateKey: string): Promise<T | null> {
  return (await ctx.state.get({ scopeKind: "instance", stateKey })) as T | null;
}

async function setState(ctx: PluginContext, stateKey: string, value: unknown) {
  await ctx.state.set({ scopeKind: "instance", stateKey }, value);
}

async function sendDetailedReportEmail(ctx: PluginContext, params: Record<string, unknown>) {
  const config = await getConfig(ctx);
  const subject = stringValue(params, "subject");
  const text = stringValue(params, "text");
  const html = stringValue(params, "html");
  const dryRun = booleanValue(params, "dryRun");
  const explicitRecipients = Array.isArray(params.recipientEmails) ? arrayOfStrings(params.recipientEmails) : [];
  const recipients = explicitRecipients.length ? explicitRecipients : splitRecipients(config.detailedReportRecipientEmails);
  const from = stringValue(config, "detailedReportFromEmail", DEFAULT_CONFIG.detailedReportFromEmail);
  const secretRef = stringValue(config, "resendApiKeySecretRef");

  if (!subject) throw new Error("subject is required for detailed report email");
  if (!text) throw new Error("text is required for detailed report email");
  if (!from || !isReasonableEmail(from)) throw new Error("detailedReportFromEmail must be configured as a valid email address");
  if (!recipients.length) throw new Error("detailedReportRecipientEmails must contain at least one recipient");
  const invalidRecipients = recipients.filter((recipient) => !isReasonableEmail(recipient));
  if (invalidRecipients.length) throw new Error(`invalid detailed report recipient email(s): ${invalidRecipients.join(", ")}`);
  if (!secretRef) throw new Error("resendApiKeySecretRef is required for email transport");

  const deliveryId = `seo_email_${stableHash({ subject, recipients, at: nowIso() })}`;
  if (dryRun) {
    const proof = {
      id: deliveryId,
      dryRun: true,
      provider: "resend",
      from,
      recipients,
      subject,
      sentAt: null,
      providerMessageId: null,
    };
    await setState(ctx, emailDeliveryKey(deliveryId), proof);
    return { proof };
  }

  const apiKey = await ctx.secrets.resolve(secretRef);
  const response = await ctx.http.fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject,
      text,
      ...(html ? { html } : {}),
    }),
  });

  const responseText = await response.text();
  let responseJson: Record<string, unknown> = {};
  try {
    responseJson = responseText ? objectValue(JSON.parse(responseText)) : {};
  } catch {
    responseJson = {};
  }

  if (!response.ok) {
    throw new Error(`Resend email delivery failed with HTTP ${response.status}: ${truncate(responseText)}`);
  }

  const providerMessageId = typeof responseJson.id === "string" ? responseJson.id : null;
  const proof = {
    id: deliveryId,
    dryRun: false,
    provider: "resend",
    from,
    recipients,
    subject,
    sentAt: nowIso(),
    providerMessageId,
  };
  await setState(ctx, emailDeliveryKey(deliveryId), proof);
  return { proof };
}

async function getIndex(ctx: PluginContext): Promise<ArticleIndex> {
  return (await getState<ArticleIndex>(ctx, INDEX_KEY)) ?? {
    ids: [],
    canonicalUrls: {},
    originIssueIds: {},
  };
}

async function setIndex(ctx: PluginContext, index: ArticleIndex) {
  await setState(ctx, INDEX_KEY, index);
}

const articleKey = (id: string) => `registry:article:${id}`;
const ingestionKey = (articleId: string) => `ingestion:${articleId}`;
const ingestionRunKey = (runId: string) => `ingestion-run:${runId}`;
const telemetryKey = (articleId: string) => `telemetry:${articleId}`;
const decisionKey = (articleId: string) => `decisions:${articleId}`;
const emailDeliveryKey = (id: string) => `email-delivery:${id}`;

async function getArticle(ctx: PluginContext, selector: Record<string, unknown>): Promise<PublishedArticle | null> {
  const index = await getIndex(ctx);
  const requestedId = stringValue(selector, "articleId") || stringValue(selector, "publishedArticleId");
  const canonicalUrl = normalizeUrl(selector.canonicalUrl);
  const originIssueId = stringValue(selector, "originIssueId");
  const id =
    requestedId ||
    (canonicalUrl ? index.canonicalUrls[canonicalUrl] : "") ||
    (originIssueId ? index.originIssueIds[originIssueId] : "");
  return id ? await getState<PublishedArticle>(ctx, articleKey(id)) : null;
}

function assertTelemetryReadyArticle(article: PublishedArticle) {
  const missing = [
    !article.canonicalUrl ? "canonicalUrl" : "",
    !article.routeKey ? "routeKey" : "",
    !article.productSurface ? "productSurface" : "",
    !article.language ? "language" : "",
    !article.geo ? "geo" : "",
    !article.primaryKeyword ? "primaryKeyword" : "",
  ].filter(Boolean);

  if (missing.length) {
    throw new Error(`published article registry record is missing required telemetry fields: ${missing.join(", ")}`);
  }
}

function closedWeeklyWindow(anchorIso: string): { snapshotWindowStart: string; snapshotWindowEnd: string } {
  const anchor = new Date(anchorIso);
  const utcMidnight = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()));
  const daysSinceMonday = (utcMidnight.getUTCDay() + 6) % 7;
  const snapshotWindowEnd = new Date(utcMidnight);
  snapshotWindowEnd.setUTCDate(snapshotWindowEnd.getUTCDate() - daysSinceMonday);
  const snapshotWindowStart = new Date(snapshotWindowEnd);
  snapshotWindowStart.setUTCDate(snapshotWindowStart.getUTCDate() - 7);
  return {
    snapshotWindowStart: snapshotWindowStart.toISOString(),
    snapshotWindowEnd: snapshotWindowEnd.toISOString(),
  };
}

async function upsertArticle(ctx: PluginContext, params: Record<string, unknown>) {
  const canonicalUrl = normalizeUrl(params.canonicalUrl);
  const publicationEventKey = stringValue(params, "publicationEventKey");
  const originIssueId = stringValue(params, "originIssueId");
  if (!publicationEventKey || !originIssueId || !canonicalUrl) {
    throw new Error("publicationEventKey, originIssueId, and canonicalUrl are required");
  }

  const index = await getIndex(ctx);
  const existingId = index.canonicalUrls[canonicalUrl] || index.originIssueIds[originIssueId];
  const id = existingId || `seo_art_${stableHash({ originIssueId, canonicalUrl })}`;
  const existing = existingId ? await getState<PublishedArticle>(ctx, articleKey(id)) : null;
  const timestamp = stringValue(params, "publishedAt") || nowIso();
  const status = stringValue(params, "status", existing ? "republished" : "published") as PublishedArticle["status"];
  const article: PublishedArticle = {
    id,
    publicationEventKey,
    publicationChannel: stringValue(params, "publicationChannel", "web"),
    publicationAdapter: stringValue(params, "publicationAdapter", "manual"),
    originIssueId,
    currentIssueId: stringValue(params, "currentIssueId", originIssueId),
    firstPublishedAt: existing?.firstPublishedAt ?? timestamp,
    lastPublishedAt: timestamp,
    canonicalUrl,
    canonicalSlug: stringValue(params, "canonicalSlug"),
    routeKey: stringValue(params, "routeKey"),
    productSurface: stringValue(params, "productSurface"),
    language: stringValue(params, "language"),
    geo: stringValue(params, "geo"),
    primaryKeyword: stringValue(params, "primaryKeyword"),
    supportingKeywords: arrayOfStrings(params.supportingKeywords),
    titleSnapshot: stringValue(params, "titleSnapshot"),
    h1Snapshot: stringValue(params, "h1Snapshot"),
    metaTitleSnapshot: stringValue(params, "metaTitleSnapshot"),
    metaDescriptionSnapshot: stringValue(params, "metaDescriptionSnapshot"),
    authorSnapshot: stringValue(params, "authorSnapshot"),
    publishableMarkdownAttachmentId: stringValue(params, "publishableMarkdownAttachmentId"),
    publishableHtmlAttachmentId: stringValue(params, "publishableHtmlAttachmentId"),
    editorialSourceAttachmentId: stringValue(params, "editorialSourceAttachmentId"),
    imageAssetRef: stringValue(params, "imageAssetRef") || null,
    status,
    republishCount: existing ? existing.republishCount + 1 : 0,
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };

  await setState(ctx, articleKey(id), article);
  if (!index.ids.includes(id)) index.ids.push(id);
  index.canonicalUrls[canonicalUrl] = id;
  index.originIssueIds[originIssueId] = id;
  await setIndex(ctx, index);

  return {
    id,
    created: !existing,
    updated: Boolean(existing),
    deduped: existing?.publicationEventKey === publicationEventKey,
    article,
  };
}

async function recordTelemetry(ctx: PluginContext, params: Record<string, unknown>) {
  const article = await getArticle(ctx, params);
  if (!article) throw new Error("registered article not found for telemetry snapshot");

  const pageMetricsRaw = objectValue(params.pageMetrics);
  const rankMetricsRaw = objectValue(params.rankMetrics);
  const snapshot: TelemetrySnapshot = {
    id: `seo_tel_${stableHash({
      articleId: article.id,
      sourceKind: params.sourceKind,
      sourceKey: params.sourceKey,
      start: params.snapshotWindowStart,
      end: params.snapshotWindowEnd,
      rank: rankMetricsRaw,
    })}`,
    publishedArticleId: article.id,
    collectionRunKey: stringValue(params, "collectionRunKey", `manual_${nowIso()}`),
    sourceKind: stringValue(params, "sourceKind") === "rank_provider" ? "rank_provider" : "gsc",
    sourceKey: stringValue(params, "sourceKey"),
    snapshotWindowStart: stringValue(params, "snapshotWindowStart"),
    snapshotWindowEnd: stringValue(params, "snapshotWindowEnd"),
    capturedAt: stringValue(params, "capturedAt", nowIso()),
    pageMetrics: Object.keys(pageMetricsRaw).length ? {
      impressions: numberValue(pageMetricsRaw.impressions),
      clicks: numberValue(pageMetricsRaw.clicks),
      ctr: numberValue(pageMetricsRaw.ctr),
      averagePosition: numberValue(pageMetricsRaw.averagePosition),
    } : null,
    rankMetrics: Object.keys(rankMetricsRaw).length ? {
      keyword: typeof rankMetricsRaw.keyword === "string" ? rankMetricsRaw.keyword : article.primaryKeyword,
      geo: typeof rankMetricsRaw.geo === "string" ? rankMetricsRaw.geo : article.geo,
      language: typeof rankMetricsRaw.language === "string" ? rankMetricsRaw.language : article.language,
      position: numberValue(rankMetricsRaw.position),
    } : null,
    queries: Array.isArray(params.queries) ? params.queries.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : [],
    rawPayload: objectValue(params.rawPayload),
    snapshotFingerprint: stableHash(params),
  };

  const existing = (await getState<TelemetrySnapshot[]>(ctx, telemetryKey(article.id))) ?? [];
  const deduped = existing.some((item) => item.id === snapshot.id || item.snapshotFingerprint === snapshot.snapshotFingerprint);
  const snapshots = deduped ? existing : [...existing, snapshot].sort((a, b) => a.snapshotWindowEnd.localeCompare(b.snapshotWindowEnd));
  await setState(ctx, telemetryKey(article.id), snapshots);

  return {
    id: snapshot.id,
    created: !deduped,
    deduped,
    snapshot,
  };
}

async function recordTelemetryIngestion(
  ctx: PluginContext,
  params: Record<string, unknown>,
  requestedBy: TelemetryIngestionRequest["requestedBy"],
) {
  const config = await getConfig(ctx);
  const article = await getArticle(ctx, params);
  if (!article) throw new Error("registered article not found for telemetry ingestion request");
  if (article.status === "retired") throw new Error("retired published articles are not eligible for telemetry ingestion");
  assertTelemetryReadyArticle(article);

  const sourceKind = stringValue(params, "sourceKind") === "rank_provider" ? "rank_provider" : "gsc";
  const explicitSourceKey = stringValue(params, "sourceKey");
  const sourceKey = explicitSourceKey || (sourceKind === "gsc" ? config.googleSearchConsolePropertyUrl : config.defaultRankProvider);
  if (!sourceKey) {
    throw new Error(sourceKind === "gsc" ? "googleSearchConsolePropertyUrl is required for telemetry ingestion planning" : "defaultRankProvider is required for telemetry ingestion planning");
  }

  const snapshotWindowStart = stringValue(params, "snapshotWindowStart");
  const snapshotWindowEnd = stringValue(params, "snapshotWindowEnd");
  if (!snapshotWindowStart || !snapshotWindowEnd) {
    throw new Error("snapshotWindowStart and snapshotWindowEnd are required for telemetry ingestion planning");
  }

  const collectionRunKey = stringValue(params, "collectionRunKey", requestedBy === "scheduled_job" ? "scheduled_collection" : `host_${nowIso()}`);
  const requestedAt = stringValue(params, "requestedAt", nowIso());
  const requestFingerprint = stableHash({
    articleId: article.id,
    collectionRunKey,
    sourceKind,
    sourceKey,
    snapshotWindowStart,
    snapshotWindowEnd,
    requestedBy,
  });
  const request: TelemetryIngestionRequest = {
    id: `seo_ing_${requestFingerprint}`,
    publishedArticleId: article.id,
    collectionRunKey,
    sourceKind,
    sourceKey,
    snapshotWindowStart,
    snapshotWindowEnd,
    requestedAt,
    requestedBy,
    requestType: requestedBy === "scheduled_job" ? "plan" : "dispatch",
    registrySnapshot: {
      canonicalUrl: article.canonicalUrl,
      canonicalSlug: article.canonicalSlug,
      routeKey: article.routeKey,
      productSurface: article.productSurface,
      language: article.language,
      geo: article.geo,
      primaryKeyword: article.primaryKeyword,
    },
    externalProviderBoundary: {
      googleSearchConsole: "not_implemented",
      rankProvider: "not_implemented",
    },
    snapshotId: null,
    snapshotFingerprint: null,
    requestFingerprint,
    createdAt: nowIso(),
  };

  const existing = (await getState<TelemetryIngestionRequest[]>(ctx, ingestionKey(article.id))) ?? [];
  const deduped = existing.some((item) => item.requestFingerprint === requestFingerprint);
  const requests = deduped ? existing : [...existing, request].sort((a, b) => a.snapshotWindowEnd.localeCompare(b.snapshotWindowEnd) || a.requestedAt.localeCompare(b.requestedAt));
  await setState(ctx, ingestionKey(article.id), requests);

  const pageMetricsRaw = objectValue(params.pageMetrics);
  const rankMetricsRaw = objectValue(params.rankMetrics);
  const rawPayload = objectValue(params.rawPayload);
  const queries = Array.isArray(params.queries)
    ? params.queries.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    : [];

  let snapshotResult: Awaited<ReturnType<typeof recordTelemetry>> | null = null;
  if (Object.keys(pageMetricsRaw).length || Object.keys(rankMetricsRaw).length || queries.length) {
    snapshotResult = await recordTelemetry(ctx, {
      ...params,
      articleId: article.id,
      canonicalUrl: article.canonicalUrl,
      sourceKind,
      sourceKey,
      collectionRunKey,
      snapshotWindowStart,
      snapshotWindowEnd,
      requestedAt,
      requestedBy,
      rawPayload: {
        ...rawPayload,
        telemetryIngestion: {
          requestId: request.id,
          requestFingerprint,
          requestedBy,
          requestType: request.requestType,
          externalProviderBoundary: request.externalProviderBoundary,
        },
      },
    });
  }

  return {
    request,
    created: !deduped,
    deduped,
    snapshot: snapshotResult?.snapshot ?? null,
  };
}

async function getTelemetryIngestionRequests(ctx: PluginContext, articleId: string, limit = 20) {
  const requests = (await getState<TelemetryIngestionRequest[]>(ctx, ingestionKey(articleId))) ?? [];
  return requests.slice(Math.max(0, requests.length - limit));
}

async function getTelemetry(ctx: PluginContext, articleId: string, weeksBack = 4) {
  const snapshots = (await getState<TelemetrySnapshot[]>(ctx, telemetryKey(articleId))) ?? [];
  return snapshots.slice(Math.max(0, snapshots.length - weeksBack));
}

function pctDelta(previous: number | null | undefined, current: number | null | undefined): number | null {
  if (typeof previous !== "number" || typeof current !== "number" || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function latestPageSnapshot(snapshots: TelemetrySnapshot[]): TelemetrySnapshot | null {
  return [...snapshots].reverse().find((snapshot) => snapshot.pageMetrics) ?? null;
}

function classifyDecision(article: PublishedArticle, snapshots: TelemetrySnapshot[], config: LoopConfig): SeoDecision {
  const pageSnapshots = snapshots.filter((snapshot) => snapshot.pageMetrics);
  const current = latestPageSnapshot(pageSnapshots);
  const previous = pageSnapshots.length >= 2 ? pageSnapshots[pageSnapshots.length - 2] : null;
  const clickDeltaPct = pctDelta(previous?.pageMetrics?.clicks, current?.pageMetrics?.clicks);
  const impressionDeltaPct = pctDelta(previous?.pageMetrics?.impressions, current?.pageMetrics?.impressions);
  const positionDelta =
    typeof previous?.pageMetrics?.averagePosition === "number" && typeof current?.pageMetrics?.averagePosition === "number"
      ? current.pageMetrics.averagePosition - previous.pageMetrics.averagePosition
      : null;

  let decisionStatus: SeoDecision["decisionStatus"] = "watch";
  let decisionReason = "Not enough closed telemetry windows yet; keep collecting data.";

  if (current && previous) {
    const declining =
      (typeof positionDelta === "number" && positionDelta >= Number(config.declinePositionDeltaThreshold)) ||
      (typeof clickDeltaPct === "number" && clickDeltaPct <= Number(config.declineClickDeltaPct)) ||
      (typeof impressionDeltaPct === "number" && impressionDeltaPct <= Number(config.declineImpressionDeltaPct));
    const stable =
      (typeof positionDelta !== "number" || Math.abs(positionDelta) <= Number(config.stablePositionDeltaThreshold)) &&
      (typeof clickDeltaPct !== "number" || clickDeltaPct >= -Number(config.stableClickDeltaPct)) &&
      (typeof impressionDeltaPct !== "number" || impressionDeltaPct >= -Number(config.stableImpressionDeltaPct));

    if (declining) {
      decisionStatus = "benchmark_serp";
      decisionReason = "Telemetry crossed a decline threshold; benchmark the live SERP before opening a refresh task.";
    } else if (stable) {
      decisionStatus = "hold";
      decisionReason = "Latest closed telemetry window is stable under the configured policy.";
    } else {
      decisionStatus = "watch";
      decisionReason = "Telemetry changed, but not enough to justify refresh or SERP benchmarking yet.";
    }
  }

  const decisionWindowEnd = current?.snapshotWindowEnd ?? nowIso();
  return {
    id: `seo_dec_${stableHash({ articleId: article.id, decisionWindowEnd })}`,
    publishedArticleId: article.id,
    decisionWindowStart: previous?.snapshotWindowStart ?? current?.snapshotWindowStart ?? decisionWindowEnd,
    decisionWindowEnd,
    decisionStatus,
    decisionReason,
    triggerSnapshotIds: [previous?.id, current?.id].filter((id): id is string => Boolean(id)),
    policySnapshot: {
      stableWindowWeeks: config.stableWindowWeeks,
      noisyWindowWeeks: config.noisyWindowWeeks,
      declineWindowWeeks: config.declineWindowWeeks,
      stablePositionDeltaThreshold: config.stablePositionDeltaThreshold,
      declinePositionDeltaThreshold: config.declinePositionDeltaThreshold,
      stableClickDeltaPct: config.stableClickDeltaPct,
      declineClickDeltaPct: config.declineClickDeltaPct,
      stableImpressionDeltaPct: config.stableImpressionDeltaPct,
      declineImpressionDeltaPct: config.declineImpressionDeltaPct,
    },
    metricsSnapshot: {
      canonicalUrl: article.canonicalUrl,
      primaryKeyword: article.primaryKeyword,
      clickDeltaPct,
      impressionDeltaPct,
      positionDelta,
      latest: current?.pageMetrics ?? null,
      previous: previous?.pageMetrics ?? null,
    },
    openedIssueId: null,
    createdAt: nowIso(),
  };
}

async function recordDecision(ctx: PluginContext, decision: SeoDecision) {
  const existing = (await getState<SeoDecision[]>(ctx, decisionKey(decision.publishedArticleId))) ?? [];
  const deduped = existing.some((item) => item.id === decision.id);
  const decisions = deduped ? existing : [...existing, decision].sort((a, b) => a.decisionWindowEnd.localeCompare(b.decisionWindowEnd));
  await setState(ctx, decisionKey(decision.publishedArticleId), decisions);
  return { decision, created: !deduped, deduped };
}

async function buildHealth(ctx: PluginContext): Promise<LoopHealthData> {
  const [lastCollectionRun, lastIngestionRun, lastDecisionRun, index, config] = await Promise.all([
    getState<Record<string, unknown>>(ctx, "last-collection-run"),
    getState<Record<string, unknown>>(ctx, "last-ingestion-run"),
    getState<Record<string, unknown>>(ctx, "last-decision-run"),
    getIndex(ctx),
    getConfig(ctx),
  ]);
  const reportPlan = buildWeeklyReportPlan(config);

  return {
    status: "ok",
    checkedAt: nowIso(),
    registryBackend: "plugin-state-store",
    telemetrySource: "manual-gsc-plus-rank-provider-boundary",
    registeredArticleCount: index.ids.length,
    lastCollectionRun: lastCollectionRun ?? null,
    lastIngestionRun: lastIngestionRun ?? null,
    lastDecisionRun: lastDecisionRun ?? null,
    reportPolicy: {
      telegramMode: reportPlan.telegram.mode,
      detailedChannel: reportPlan.detailed.channel,
      detailedDeliveryReady: reportPlan.detailed.deliveryReady,
    },
  };
}

function toolResult(content: string, data: Record<string, unknown>): ToolResult {
  return { content, data: { implemented: true, ...data } };
}

async function registerJobs(ctx: PluginContext) {
  ctx.jobs.register(JOB_KEYS.collectWeeklySearchTelemetry, async (job: PluginJobContext) => {
    const config = await getConfig(ctx);
    const index = await getIndex(ctx);
    const closedWindow = closedWeeklyWindow(job.scheduledAt ?? nowIso());
    const plannedSourceKinds: Array<{ sourceKind: "gsc" | "rank_provider"; sourceKey: string }> = [
      {
        sourceKind: "gsc",
        sourceKey: config.googleSearchConsolePropertyUrl,
      },
      {
        sourceKind: "rank_provider",
        sourceKey: config.defaultRankProvider,
      },
    ];
    const requestResults: Array<{ requestId: string; articleId: string; sourceKind: string; created: boolean; deduped: boolean }> = [];
    let skippedRequestCount = 0;

    for (const articleId of index.ids) {
      const article = await getState<PublishedArticle>(ctx, articleKey(articleId));
      if (!article || article.status === "retired") continue;
      for (const source of plannedSourceKinds) {
        if (!source.sourceKey) {
          skippedRequestCount += 1;
          continue;
        }
        try {
          const result = await recordTelemetryIngestion(
            ctx,
            {
              articleId: article.id,
              sourceKind: source.sourceKind,
              sourceKey: source.sourceKey,
              snapshotWindowStart: closedWindow.snapshotWindowStart,
              snapshotWindowEnd: closedWindow.snapshotWindowEnd,
              collectionRunKey: job.runId,
              requestedAt: job.scheduledAt,
              rawPayload: {
                jobKey: job.jobKey,
                runId: job.runId,
                trigger: job.trigger,
                scheduledAt: job.scheduledAt,
                plannedBy: "scheduled_job",
              },
            },
            "scheduled_job",
          );
          requestResults.push({
            requestId: result.request.id,
            articleId: article.id,
            sourceKind: source.sourceKind,
            created: result.created,
            deduped: result.deduped,
          });
        } catch (error) {
          skippedRequestCount += 1;
          ctx.logger.warn("SEO telemetry ingestion request planning skipped", {
            articleId: article.id,
            sourceKind: source.sourceKind,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
    const payload = {
      jobKey: job.jobKey,
      runId: job.runId,
      trigger: job.trigger,
      scheduledAt: job.scheduledAt,
      completedAt: nowIso(),
      enabled: config.weeklyCollectionEnabled !== false,
      registeredArticleCount: index.ids.length,
      windowStart: closedWindow.snapshotWindowStart,
      windowEnd: closedWindow.snapshotWindowEnd,
      propertyUrl: config.googleSearchConsolePropertyUrl || null,
      rankProvider: config.defaultRankProvider || null,
      plannedRequestCount: requestResults.length,
      createdRequestCount: requestResults.filter((item) => item.created).length,
      dedupedRequestCount: requestResults.filter((item) => item.deduped).length,
      skippedRequestCount,
      requestIds: requestResults.map((item) => item.requestId),
      note: "This scheduled slice only records ingestion requests and request envelopes; external provider calls remain not implemented.",
    };
    await setState(ctx, ingestionRunKey(job.runId), payload);
    await setState(ctx, "last-ingestion-run", payload);
    await setState(ctx, "last-collection-run", payload);
    ctx.logger.info("SEO performance loop collection job executed", payload);
  });

  ctx.jobs.register(JOB_KEYS.evaluateWeeklySeoDecisions, async (job: PluginJobContext) => {
    const config = await getConfig(ctx);
    const index = await getIndex(ctx);
    const decisionResults = [];
    for (const articleId of index.ids) {
      const article = await getState<PublishedArticle>(ctx, articleKey(articleId));
      if (!article || article.status === "retired") continue;
      const snapshots = await getTelemetry(ctx, article.id, Math.max(2, Number(config.declineWindowWeeks) + 1));
      decisionResults.push(await recordDecision(ctx, classifyDecision(article, snapshots, config)));
    }
    const payload = {
      jobKey: job.jobKey,
      runId: job.runId,
      trigger: job.trigger,
      scheduledAt: job.scheduledAt,
      completedAt: nowIso(),
      evaluatedArticleCount: decisionResults.length,
      createdDecisionCount: decisionResults.filter((result) => result.created).length,
      dedupedDecisionCount: decisionResults.filter((result) => result.deduped).length,
    };
    await setState(ctx, "last-decision-run", payload);
    ctx.logger.info("SEO performance loop decision job executed", payload);
  });
}

async function registerTools(ctx: PluginContext) {
  ctx.tools.register(
    TOOL_NAMES.publishedArticleUpsert,
    {
      displayName: "Upsert Published Article Record",
      description: "Registers or updates one published article in the SEO performance registry.",
      parametersSchema: {},
    },
    async (params: unknown): Promise<ToolResult> => {
      const result = await upsertArticle(ctx, objectValue(params));
      return toolResult("Published article registry record stored.", result);
    },
  );

  ctx.tools.register(
    TOOL_NAMES.publishedArticleGet,
    {
      displayName: "Get Published Article Record",
      description: "Returns the latest published-article registry record known to the SEO performance loop.",
      parametersSchema: {},
    },
    async (params: unknown): Promise<ToolResult> => {
      const article = await getArticle(ctx, objectValue(params));
      return toolResult(article ? "Published article registry record found." : "Published article registry record not found.", { article });
    },
  );

  ctx.tools.register(
    TOOL_NAMES.telemetryIngestionRecord,
    {
      displayName: "Record Telemetry Ingestion Request",
      description: "Records a host-dispatched or scheduled telemetry ingestion request and optional supplied snapshot payload. External provider calls remain outside this slice.",
      parametersSchema: {},
    },
    async (params: unknown): Promise<ToolResult> => {
      const result = await recordTelemetryIngestion(ctx, objectValue(params), "host_dispatch");
      return toolResult("Telemetry ingestion request recorded.", result);
    },
  );

  ctx.tools.register(
    TOOL_NAMES.telemetryIngestionGet,
    {
      displayName: "Get Telemetry Ingestion Requests",
      description: "Returns recent telemetry ingestion requests for a published article.",
      parametersSchema: {},
    },
    async (params: unknown): Promise<ToolResult> => {
      const input = objectValue(params);
      const article = await getArticle(ctx, input);
      const limit = numberValue(input.limit) ?? 20;
      const requests = article ? await getTelemetryIngestionRequests(ctx, article.id, limit) : [];
      return toolResult(article ? "Telemetry ingestion requests found." : "Published article registry record not found.", {
        article,
        requests,
      });
    },
  );

  ctx.tools.register(
    TOOL_NAMES.telemetrySnapshotRecord,
    {
      displayName: "Record SEO Telemetry Snapshot",
      description: "Records one GSC or rank-provider telemetry snapshot for a registered article.",
      parametersSchema: {},
    },
    async (params: unknown): Promise<ToolResult> => {
      const result = await recordTelemetry(ctx, objectValue(params));
      return toolResult("SEO telemetry snapshot stored.", result);
    },
  );

  ctx.tools.register(
    TOOL_NAMES.searchTelemetryGet,
    {
      displayName: "Get Search Telemetry Snapshot",
      description: "Returns the latest stored search telemetry snapshot for a published article.",
      parametersSchema: {},
    },
    async (params: unknown): Promise<ToolResult> => {
      const input = objectValue(params);
      const article = await getArticle(ctx, input);
      const weeksBack = numberValue(input.weeksBack) ?? 4;
      const snapshots = article ? await getTelemetry(ctx, article.id, weeksBack) : [];
      return toolResult(article ? "SEO telemetry snapshots found." : "Published article registry record not found.", {
        article,
        snapshots,
      });
    },
  );

  ctx.tools.register(
    TOOL_NAMES.performanceDecisionGet,
    {
      displayName: "Get SEO Performance Decision",
      description: "Returns the latest stored SEO performance decision for a published article.",
      parametersSchema: {},
    },
    async (params: unknown): Promise<ToolResult> => {
      const article = await getArticle(ctx, objectValue(params));
      const decisions = article ? (await getState<SeoDecision[]>(ctx, decisionKey(article.id))) ?? [] : [];
      return toolResult(decisions.length ? "Latest SEO performance decision found." : "SEO performance decision not found.", {
        article,
        decision: decisions[decisions.length - 1] ?? null,
      });
    },
  );

  ctx.tools.register(
    TOOL_NAMES.followupIssueOpen,
    {
      displayName: "Open SEO Follow-up Issue",
      description: "Records a requested SEO follow-up action. Issue creation remains a host-level integration boundary.",
      parametersSchema: {},
    },
    async (params: unknown): Promise<ToolResult> => {
      const input = objectValue(params);
      const article = await getArticle(ctx, input);
      const request = {
        id: `seo_follow_${stableHash({ articleId: article?.id, input, at: nowIso() })}`,
        articleId: article?.id ?? null,
        decision: stringValue(input, "decision"),
        summary: stringValue(input, "summary"),
        openedIssueId: null,
        createdAt: nowIso(),
      };
      await setState(ctx, `followup:${request.id}`, request);
      return toolResult("SEO follow-up request recorded. Host issue creation is intentionally out of scope for this slice.", { request });
    },
  );

  ctx.tools.register(
    TOOL_NAMES.weeklyReportPlanGet,
    {
      displayName: "Get SEO Weekly Report Delivery Plan",
      description: "Returns the canonical weekly SEO report window and delivery-channel split: Telegram summary, email detailed report.",
      parametersSchema: {},
    },
    async (params: unknown): Promise<ToolResult> => {
      const input = objectValue(params);
      const config = await getConfig(ctx);
      const plan = buildWeeklyReportPlan({ ...config, ...objectValue(input.configOverrides) }, stringValue(input, "anchorIso", nowIso()));
      return toolResult("SEO weekly report delivery plan resolved.", { plan });
    },
  );

  ctx.tools.register(
    TOOL_NAMES.detailedReportEmailSend,
    {
      displayName: "Send SEO Detailed Report Email",
      description: "Sends the detailed weekly SEO report through the configured Resend transport.",
      parametersSchema: {},
    },
    async (params: unknown): Promise<ToolResult> => {
      const result = await sendDetailedReportEmail(ctx, objectValue(params));
      return toolResult(result.proof.dryRun ? "SEO detailed report email dry-run validated." : "SEO detailed report email sent.", result);
    },
  );

  ctx.tools.register(
    TOOL_NAMES.crawlFindingRoutePlan,
    {
      displayName: "Plan CrawlObserver Finding Routing",
      description: "Classifies CrawlObserver SEO findings into automatic technical tasks, ignored policy noise, or record-only evidence.",
      parametersSchema: {},
    },
    async (params: unknown): Promise<ToolResult> => {
      const input = objectValue(params);
      const config = await getConfig(ctx);
      const findings = Array.isArray(input.findings)
        ? input.findings.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        : [input];
      const routes = findings.map((finding) => routeCrawlFinding(finding, config));
      return toolResult("CrawlObserver finding routing plan resolved.", {
        routes,
        createTaskCount: routes.filter((route) => route.action === "create_task").length,
        ignoredCount: routes.filter((route) => route.action === "ignore_by_policy").length,
        recordOnlyCount: routes.filter((route) => route.action === "record_only").length,
      });
    },
  );
}

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info(`${PLUGIN_ID} plugin setup complete`);

    ctx.events.on("issue.updated", async (event) => {
      const payload = event.payload && typeof event.payload === "object"
        ? (event.payload as Record<string, unknown>)
        : null;
      const status = typeof payload?.status === "string" ? payload.status : null;
      if (status !== "done") return;
      await setState(ctx, "last-observed-issue-done", {
        entityId: event.entityId,
        observedAt: nowIso(),
      });
    });

    await registerJobs(ctx);
    await registerTools(ctx);

    ctx.data.register("health", async () => buildHealth(ctx));
    ctx.data.register("overview", async () => {
      const [health, config] = await Promise.all([buildHealth(ctx), getConfig(ctx)]);
      return {
        ...health,
        configSnapshot: {
          propertyUrl: config.googleSearchConsolePropertyUrl || null,
          rankProvider: config.defaultRankProvider || null,
          rankGeo: config.defaultRankGeo || null,
          rankLanguage: config.defaultRankLanguage || null,
          weeklyReportTimezone: config.weeklyReportTimezone || null,
          telegramReportMode: config.telegramReportMode || null,
          detailedReportChannel: config.detailedReportChannel || null,
        },
      };
    });
  },

  async onHealth() {
    return {
      status: "ok",
      message: `${PLUGIN_ID} registry and decision baseline ready`,
    };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
