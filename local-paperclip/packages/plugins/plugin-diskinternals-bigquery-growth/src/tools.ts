import type { ToolResult } from "@paperclipai/plugin-sdk";
import { normalizeConfig, type BigQueryGrowthPluginConfig } from "./config.js";
import { TOOL_NAMES, type ToolName } from "./constants.js";
import {
  runBigQueryQuery,
  type BigQueryQueryResult,
  type QueryParameterValue,
} from "./bigquery-client.js";
import { getReportContract } from "./report-contracts.js";
import { normalizeDiskInternalsUrl } from "./url-normalization.js";
import { parseSitemapXml, summarizeSitemapEntries } from "./sitemap-sync.js";
import { normalizeOpportunityDecision } from "./opportunity-decisions.js";

type FetchFn = typeof fetch;
type ResolveSecret = (secretRef: string) => Promise<string>;

export type ToolDeps = {
  config: BigQueryGrowthPluginConfig;
  resolveSecret: ResolveSecret;
  fetchFn: FetchFn;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function readDateRange(params: Record<string, unknown>, defaultWindowDays: number) {
  const endDate = readString(params.endDate) ?? readString(params.end_date) ?? formatDate(new Date());
  const fallbackStart = new Date(`${endDate}T00:00:00.000Z`);
  fallbackStart.setUTCDate(fallbackStart.getUTCDate() - defaultWindowDays);
  const startDate = readString(params.startDate) ?? readString(params.start_date) ?? formatDate(fallbackStart);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    throw new Error("startDate/endDate must use YYYY-MM-DD");
  }
  if (startDate > endDate) throw new Error("startDate must be before or equal to endDate");
  return { startDate, endDate };
}

function readLimit(params: Record<string, unknown>, defaultLimit: number, maxLimit: number) {
  const raw = typeof params.limit === "number" ? params.limit : defaultLimit;
  if (!Number.isInteger(raw) || raw <= 0) throw new Error("limit must be a positive integer");
  return Math.min(raw, maxLimit);
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim())
    : [];
}

function tableRef(config: ReturnType<typeof normalizeConfig>, tableOrView: string) {
  if (!config.bigQueryProjectId) throw new Error("BigQuery project id is not configured");
  return `\`${config.bigQueryProjectId}.${config.bigQueryDatasetId}.${tableOrView}\``;
}

function sqlString(value: string | null | undefined) {
  if (value === null || value === undefined) return "NULL";
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlTimestamp(value: string | null | undefined) {
  if (!value) return "NULL";
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return "NULL";
  return `TIMESTAMP(${sqlString(timestamp.toISOString())})`;
}

function renderReportQuery(input: {
  toolName: ToolName;
  params: Record<string, unknown>;
  config: ReturnType<typeof normalizeConfig>;
}) {
  const contract = getReportContract(input.toolName);
  const limit = readLimit(input.params, input.config.defaultRowLimit, input.config.maxRowLimit);
  const filters: string[] = [];
  const parameters: Record<string, QueryParameterValue> = { limit };
  if (contract.dateField) {
    const { startDate, endDate } = readDateRange(input.params, input.config.defaultDateWindowDays);
    filters.push(`${contract.dateField} BETWEEN @startDate AND @endDate`);
    parameters.startDate = startDate;
    parameters.endDate = endDate;
  }
  const productId = readString(input.params.product_id) ?? readString(input.params.productId);
  if (productId) {
    filters.push("product_id = @productId");
    parameters.productId = productId;
  }
  const urlId = readString(input.params.url_id) ?? readString(input.params.urlId);
  if (urlId) {
    filters.push("url_id = @urlId");
    parameters.urlId = urlId;
  }
  const country = readString(input.params.country);
  if (country) {
    filters.push("country = @country");
    parameters.country = country;
  }
  if (input.toolName === TOOL_NAMES.getCroExperimentCandidates) {
    filters.push("preliminary_action_type = 'cro_experiment'");
  }
  if (input.toolName === TOOL_NAMES.getInternalLinkCandidates) {
    filters.push("preliminary_action_type IN ('seo_refresh', 'internal_linking')");
  }
  const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
  const order = contract.defaultOrderBy ? `ORDER BY ${contract.defaultOrderBy}` : "";
  return {
    query: [
      `SELECT ${contract.columns.join(", ")}`,
      `FROM ${tableRef(input.config, contract.source)}`,
      where,
      order,
      "LIMIT @limit",
    ].filter(Boolean).join("\n"),
    parameters,
    source: contract.source,
    knownLimitations: contract.knownLimitations,
  };
}

function resultContent(title: string, result: BigQueryQueryResult) {
  return `${title}: ${result.rows.length} row(s), bytes=${result.totalBytesProcessed ?? "unknown"}, cache=${String(result.cacheHit)}`;
}

function toToolResult(input: {
  title: string;
  result: BigQueryQueryResult;
  source: string;
  knownLimitations?: string[];
}): ToolResult {
  return {
    content: resultContent(input.title, input.result),
    data: {
      rows: input.result.rows,
      row_count: input.result.rows.length,
      total_rows: input.result.totalRows,
      source: input.source,
      total_bytes_processed: input.result.totalBytesProcessed,
      cache_hit: input.result.cacheHit,
      job_reference: input.result.jobReference,
      dry_run: input.result.dryRun,
      known_limitations: input.knownLimitations ?? [],
    },
  };
}

async function executeCrawlJobStatus(input: {
  deps: ToolDeps;
  params: Record<string, unknown>;
}) {
  const config = normalizeConfig(input.deps.config);
  const jobId = readString(input.params.job_id) ?? readString(input.params.jobId);
  if (!jobId) throw new Error("job_id is required");
  const result = await runBigQueryQuery({
    config,
    resolveSecret: input.deps.resolveSecret,
    fetchFn: input.deps.fetchFn,
    options: {
      query: [
        "SELECT",
        "  j.job_id,",
        "  j.status,",
        "  j.priority_band,",
        "  j.reason,",
        "  j.created_at,",
        "  j.started_at,",
        "  j.finished_at,",
        "  j.max_items,",
        "  COUNT(i.url_id) AS item_count,",
        "  COUNTIF(i.status = 'done') AS done_count,",
        "  COUNTIF(i.status = 'failed') AS failed_count,",
        "  COUNTIF(i.status IN ('queued', 'retry')) AS pending_count",
        `FROM ${tableRef(config, "crawl_jobs")} j`,
        `LEFT JOIN ${tableRef(config, "crawl_job_items")} i USING (job_id)`,
        "WHERE j.job_id = @jobId",
        "GROUP BY j.job_id, j.status, j.priority_band, j.reason, j.created_at, j.started_at, j.finished_at, j.max_items",
        "LIMIT 1",
      ].join("\n"),
      parameters: { jobId },
      maximumBytesBilled: config.maximumBytesBilled,
    },
  });
  return toToolResult({ title: "crawl job status", result, source: "crawl_jobs" });
}

async function runReportTool(input: {
  deps: ToolDeps;
  toolName: ToolName;
  params: Record<string, unknown>;
}) {
  const config = normalizeConfig(input.deps.config);
  const rendered = renderReportQuery({
    toolName: input.toolName,
    params: input.params,
    config,
  });
  const result = await runBigQueryQuery({
    config,
    resolveSecret: input.deps.resolveSecret,
    fetchFn: input.deps.fetchFn,
    options: {
      query: rendered.query,
      parameters: rendered.parameters,
      maximumBytesBilled: config.maximumBytesBilled,
      dryRun: input.params.dry_run === true,
    },
  });
  return toToolResult({
    title: input.toolName,
    result,
    source: rendered.source,
    knownLimitations: rendered.knownLimitations,
  });
}

async function executeSchemaStatus(input: { deps: ToolDeps }) {
  const config = normalizeConfig(input.deps.config);
  const result = await runBigQueryQuery({
    config,
    resolveSecret: input.deps.resolveSecret,
    fetchFn: input.deps.fetchFn,
    options: {
      query: [
        "SELECT table_name, table_type",
        `FROM \`${config.bigQueryProjectId}.${config.bigQueryDatasetId}.INFORMATION_SCHEMA.TABLES\``,
        "ORDER BY table_name",
      ].join("\n"),
      maximumBytesBilled: config.maximumBytesBilled,
    },
  });
  return toToolResult({ title: "schema status", result, source: "INFORMATION_SCHEMA.TABLES" });
}

async function executeSyncSitemap(input: { deps: ToolDeps; params: Record<string, unknown> }) {
  const config = normalizeConfig(input.deps.config);
  const sitemapUrl = readString(input.params.sitemap_url) ?? readString(input.params.sitemapUrl);
  if (!sitemapUrl) throw new Error("sitemap_url is required");
  const response = await input.deps.fetchFn(sitemapUrl);
  const xml = await response.text();
  if (!response.ok) throw new Error(`Sitemap fetch failed: HTTP ${response.status}`);
  const parsedEntries = parseSitemapXml(xml);
  const maxUrls = readLimit(
    { limit: input.params.max_urls ?? input.params.maxUrls ?? config.crawlMaxPagesPerJob },
    config.crawlMaxPagesPerJob,
    config.crawlMaxPagesPerJob,
  );
  const entries = parsedEntries.slice(0, maxUrls);
  let writeResult: BigQueryQueryResult | null = null;
  if (input.params.write_to_bigquery === true || input.params.writeToBigQuery === true) {
    if (entries.length === 0) throw new Error("Sitemap contains no URL entries to write");
    writeResult = await runBigQueryQuery({
      config,
      resolveSecret: input.deps.resolveSecret,
      fetchFn: input.deps.fetchFn,
      options: {
        query: [
          `INSERT INTO ${tableRef(config, "raw_sitemap_snapshots")}`,
          "(snapshot_date, sitemap_url, raw_url, normalized_url, url_id, lastmod, alternates, seen_at)",
          "VALUES",
          entries.map((entry) => [
            "CURRENT_DATE()",
            sqlString(sitemapUrl),
            sqlString(entry.rawUrl),
            sqlString(entry.normalizedUrl),
            sqlString(entry.urlId),
            sqlTimestamp(entry.lastmod),
            "ARRAY<STRUCT<language STRING, url STRING>>[]",
            "CURRENT_TIMESTAMP()",
          ].join(", ")).map((row) => `(${row})`).join(",\n"),
        ].join("\n"),
        maximumBytesBilled: config.maximumBytesBilled,
      },
    });
  }
  return {
    content: `${writeResult ? "Inserted" : "Parsed"} ${entries.length} sitemap URL(s) from ${sitemapUrl}`,
    data: {
      sitemap_url: sitemapUrl,
      parsed_url_count: parsedEntries.length,
      processed_url_count: entries.length,
      truncated: parsedEntries.length > entries.length,
      ...summarizeSitemapEntries(entries),
      bigquery_write: writeResult
        ? {
          total_bytes_processed: writeResult.totalBytesProcessed,
          job_reference: writeResult.jobReference,
        }
        : null,
    },
  };
}

function executeNormalizeUrl(input: { params: Record<string, unknown> }) {
  const rawUrl = readString(input.params.url) ?? readString(input.params.raw_url);
  if (!rawUrl) throw new Error("url is required");
  const normalized = normalizeDiskInternalsUrl(rawUrl);
  return {
    content: `Normalized ${rawUrl} -> ${normalized.normalizedUrl}`,
    data: normalized,
  };
}

async function executeScheduleCrawl(input: { deps: ToolDeps; params: Record<string, unknown> }) {
  const config = normalizeConfig(input.deps.config);
  const urls = readStringArray(input.params.urls).slice(0, config.crawlMaxPagesPerJob);
  const normalizedUrls = urls.map((url) => normalizeDiskInternalsUrl(url));
  const defaultMaxItems = normalizedUrls.length > 0
    ? normalizedUrls.length
    : config.crawlMaxPagesPerJob;
  const maxItems = readLimit(
    { limit: input.params.max_items ?? input.params.maxItems ?? defaultMaxItems },
    config.crawlMaxPagesPerJob,
    config.crawlMaxPagesPerJob,
  );
  const reason = readString(input.params.reason) ?? "agent-request";
  const priorityBand = readString(input.params.priority_band) ?? readString(input.params.priorityBand) ?? "P2";
  const jobId = `crawl_${Date.now()}`;
  let jobWriteResult: BigQueryQueryResult | null = null;
  let itemWriteResult: BigQueryQueryResult | null = null;
  if (input.params.write_to_bigquery === true || input.params.writeToBigQuery === true) {
    jobWriteResult = await runBigQueryQuery({
      config,
      resolveSecret: input.deps.resolveSecret,
      fetchFn: input.deps.fetchFn,
      options: {
        query: [
          `INSERT INTO ${tableRef(config, "crawl_jobs")}`,
          "(job_id, status, priority_band, reason, created_at, max_items, max_concurrent_requests_per_host, min_delay_between_requests_ms, created_by_issue_id, created_by_agent_id)",
          "VALUES (@jobId, 'queued', @priorityBand, @reason, CURRENT_TIMESTAMP(), @maxItems, @maxConcurrent, @minDelayMs, @createdByIssueId, @createdByAgentId)",
        ].join("\n"),
        parameters: {
          jobId,
          priorityBand,
          reason,
          maxItems,
          maxConcurrent: config.crawlMaxConcurrentRequestsPerHost,
          minDelayMs: config.crawlMinDelayMsPerHost,
          createdByIssueId: readString(input.params.created_by_issue_id),
          createdByAgentId: readString(input.params.created_by_agent_id),
        },
        maximumBytesBilled: config.maximumBytesBilled,
      },
    });
    if (normalizedUrls.length > 0) {
      const itemRows = normalizedUrls.slice(0, maxItems).map((item, index) => [
        sqlString(jobId),
        sqlString(item.urlId),
        sqlString(item.normalizedUrl),
        "CURRENT_TIMESTAMP()",
        String(index + 1),
        sqlString(reason),
        sqlString("queued"),
        "CURRENT_TIMESTAMP()",
        "0",
      ].join(", "));
      itemWriteResult = await runBigQueryQuery({
        config,
        resolveSecret: input.deps.resolveSecret,
        fetchFn: input.deps.fetchFn,
        options: {
          query: [
            `INSERT INTO ${tableRef(config, "crawl_job_items")}`,
            "(job_id, url_id, target_url, created_at, priority, reason, status, next_fetch_at, attempt_count)",
            "VALUES",
            itemRows.map((row) => `(${row})`).join(",\n"),
          ].join("\n"),
          maximumBytesBilled: config.maximumBytesBilled,
        },
      });
    }
  }
  return {
    content: `${jobWriteResult ? "Scheduled" : "Prepared"} crawl job ${jobId} (${priorityBand}, max ${maxItems})`,
    data: {
      job_id: jobId,
      status: jobWriteResult ? "queued" : "prepared",
      priority_band: priorityBand,
      reason,
      max_items: maxItems,
      url_count: normalizedUrls.length,
      sample_urls: normalizedUrls.slice(0, 10),
      max_concurrent_requests_per_host: config.crawlMaxConcurrentRequestsPerHost,
      min_delay_between_requests_ms: config.crawlMinDelayMsPerHost,
      bigquery_write: jobWriteResult
        ? {
          job_reference: jobWriteResult.jobReference,
          item_job_reference: itemWriteResult?.jobReference ?? null,
        }
        : null,
    },
  };
}

async function executeRecordOpportunityDecision(input: {
  deps: ToolDeps;
  params: Record<string, unknown>;
}) {
  const config = normalizeConfig(input.deps.config);
  const decision = normalizeOpportunityDecision(input.params);
  const result = await runBigQueryQuery({
    config,
    resolveSecret: input.deps.resolveSecret,
    fetchFn: input.deps.fetchFn,
    options: {
      query: [
        `INSERT INTO ${tableRef(config, "opportunity_decisions")}`,
        "(decided_at, opportunity_id, action_type, owner_lane, decision_status, reason, confidence, source_opportunity_ids, parent_issue_id, decided_by_agent_id)",
        "VALUES (CURRENT_TIMESTAMP(), @opportunityId, @actionType, @ownerLane, @decisionStatus, @reason, @confidence, SPLIT(@sourceOpportunityIdsCsv, ','), @parentIssueId, @decidedByAgentId)",
      ].join("\n"),
      parameters: {
        opportunityId: decision.opportunityId,
        actionType: decision.actionType,
        ownerLane: decision.ownerLane,
        decisionStatus: decision.decisionStatus,
        reason: decision.reason,
        confidence: decision.confidence,
        sourceOpportunityIdsCsv: decision.sourceOpportunityIds.join(","),
        parentIssueId: decision.parentIssueId,
        decidedByAgentId: readString(input.params.decided_by_agent_id),
      },
      maximumBytesBilled: config.maximumBytesBilled,
    },
  });
  return toToolResult({
    title: "record opportunity decision",
    result,
    source: "opportunity_decisions",
  });
}

export async function executeBigQueryGrowthTool(input: {
  deps: ToolDeps;
  toolName: ToolName;
  params?: unknown;
}): Promise<ToolResult> {
  const params = isRecord(input.params) ? input.params : {};
  switch (input.toolName) {
    case TOOL_NAMES.getSchemaStatus:
      return await executeSchemaStatus({ deps: input.deps });
    case TOOL_NAMES.syncSitemapSnapshot:
      return await executeSyncSitemap({ deps: input.deps, params });
    case TOOL_NAMES.normalizeUrlInventory:
      return executeNormalizeUrl({ params });
    case TOOL_NAMES.scheduleCrawlBatch:
      return await executeScheduleCrawl({ deps: input.deps, params });
    case TOOL_NAMES.recordOpportunityDecision:
    case TOOL_NAMES.recordExperimentDecision:
      return await executeRecordOpportunityDecision({ deps: input.deps, params });
    case TOOL_NAMES.getCrawlJobStatus:
      return await executeCrawlJobStatus({ deps: input.deps, params });
    case TOOL_NAMES.getQueryCostSummary:
      {
        const reportToolName = readString(params.report_tool_name)
          ?? readString(params.reportToolName)
          ?? TOOL_NAMES.getUrlGrowthOpportunityQueue;
        if (!Object.values(TOOL_NAMES).includes(reportToolName as ToolName)) {
          throw new Error(`Unknown report tool: ${reportToolName}`);
        }
        return await runReportTool({
          deps: input.deps,
          toolName: reportToolName as ToolName,
          params: { ...params, dry_run: true, limit: params.limit ?? 10 },
        });
      }
    default:
      return await runReportTool({ deps: input.deps, toolName: input.toolName, params });
  }
}
