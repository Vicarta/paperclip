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
import { parseSitemapIndexXml, parseSitemapXml, summarizeSitemapEntries, type SitemapUrlEntry } from "./sitemap-sync.js";
import { normalizeOpportunityDecision } from "./opportunity-decisions.js";
import { classifyDiskInternalsPage, mapDiskInternalsProduct } from "./product-mapping.js";
import { computeRetryAt, parseRetryAfterSeconds, selectDueCrawlItems, type CrawlItem } from "./crawl-worker.js";
import { parsePageSnapshot } from "./page-snapshot.js";

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

function sqlDate(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "NULL";
  return `DATE(${sqlString(value)})`;
}

function sqlStringArray(values: string[]) {
  if (values.length === 0) return "ARRAY<STRING>[]";
  return `[${values.map((value) => sqlString(value)).join(", ")}]`;
}

function normalizeSourceUrlSql(expression: string) {
  return [
    "REGEXP_REPLACE(",
    "REGEXP_REPLACE(",
    "REGEXP_REPLACE(",
    "REGEXP_REPLACE(",
    expression,
    ", r'#.*$', '')",
    ", r'\\?.*$', '')",
    ", r'^http://', 'https://')",
    ", r'^https://diskinternals\\.com', 'https://www.diskinternals.com')",
  ].join("");
}

function urlIdSql(normalizedUrlExpression: string) {
  return `LOWER(SUBSTR(TO_HEX(SHA256(${normalizedUrlExpression})), 1, 24))`;
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
    filters.push(`${contract.dateField} BETWEEN DATE(@startDate) AND DATE(@endDate)`);
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
  const fetchSitemap = async (url: string, depth: number, seen: Set<string>): Promise<SitemapUrlEntry[]> => {
    if (depth > 2 || seen.has(url)) return [];
    seen.add(url);
    const response = await input.deps.fetchFn(url);
    const xml = await response.text();
    if (!response.ok) throw new Error(`Sitemap fetch failed for ${url}: HTTP ${response.status}`);
    const nested = parseSitemapIndexXml(xml);
    if (nested.length > 0) {
      const batches = await Promise.all(nested.slice(0, 100).map((entry) => fetchSitemap(entry.loc, depth + 1, seen)));
      return batches.flat();
    }
    return parseSitemapXml(xml).map((entry) => ({ ...entry, sitemapUrl: url }));
  };
  const parsedEntries = await fetchSitemap(sitemapUrl, 0, new Set<string>());
  const maxUrls = readLimit(
    { limit: input.params.max_urls ?? input.params.maxUrls ?? config.crawlMaxPagesPerJob },
    config.crawlMaxPagesPerJob,
    config.crawlMaxPagesPerJob,
  );
  const entries = Array.from(
    new Map(parsedEntries.map((entry) => [entry.urlId, entry])).values(),
  ).slice(0, maxUrls);
  let writeResult: BigQueryQueryResult | null = null;
  if (input.params.write_to_bigquery === true || input.params.writeToBigQuery === true) {
    if (entries.length === 0) throw new Error("Sitemap contains no URL entries to write");
    const rawRows = entries.map((entry) => [
      "CURRENT_DATE()",
      sqlString(entry.sitemapUrl ?? sitemapUrl),
      sqlString(entry.rawUrl),
      sqlString(entry.normalizedUrl),
      sqlString(entry.urlId),
      sqlTimestamp(entry.lastmod),
      "ARRAY<STRUCT<language STRING, url STRING>>[]",
      "CURRENT_TIMESTAMP()",
    ].join(", "));
    const sourceRows = entries.map((entry) => {
      const normalized = normalizeDiskInternalsUrl(entry.rawUrl);
      const product = mapDiskInternalsProduct({ url: entry.normalizedUrl });
      const classification = classifyDiskInternalsPage(entry.normalizedUrl);
      return [
        `SELECT ${sqlString(entry.rawUrl)} AS raw_url`,
        `${sqlString(entry.normalizedUrl)} AS normalized_url`,
        `${sqlString(entry.urlId)} AS url_id`,
        `${sqlString(normalized.host)} AS host`,
        `${sqlString(normalized.path)} AS path`,
        `${sqlStringArray(normalized.queryParametersKept)} AS query_parameters_kept`,
        `${sqlStringArray(normalized.queryParametersRemoved)} AS query_parameters_removed`,
        `${sqlString(classification.language)} AS language`,
        `${sqlString(classification.countryTarget)} AS country_target`,
        `${sqlString(classification.pageType)} AS page_type`,
        `${sqlString(product.productId)} AS product_id`,
        `${sqlString(product.productFamily)} AS product_family`,
        `${sqlTimestamp(entry.lastmod)} AS lastmod`,
      ].join(", ");
    });
    writeResult = await runBigQueryQuery({
      config,
      resolveSecret: input.deps.resolveSecret,
      fetchFn: input.deps.fetchFn,
      options: {
        query: [
          `INSERT INTO ${tableRef(config, "raw_sitemap_snapshots")}`,
          "(snapshot_date, sitemap_url, raw_url, normalized_url, url_id, lastmod, alternates, seen_at)",
          "VALUES",
          rawRows.map((row) => `(${row})`).join(",\n"),
          ";",
          "MERGE " + tableRef(config, "dim_url") + " t",
          "USING (",
          sourceRows.join("\nUNION ALL\n"),
          ") s",
          "ON t.url_id = s.url_id",
          "WHEN MATCHED THEN UPDATE SET raw_url = s.raw_url, normalized_url = s.normalized_url, host = s.host, path = s.path, query_parameters_kept = s.query_parameters_kept, query_parameters_removed = s.query_parameters_removed, language = s.language, country_target = s.country_target, page_type = s.page_type, product_id = s.product_id, product_family = s.product_family, sitemap_present = TRUE, last_seen_in_sitemap_at = CURRENT_TIMESTAMP(), updated_at = CURRENT_TIMESTAMP()",
          "WHEN NOT MATCHED THEN INSERT (url_id, raw_url, normalized_url, host, path, query_parameters_kept, query_parameters_removed, language, country_target, page_type, product_id, product_family, indexable_status, sitemap_present, last_seen_in_sitemap_at, updated_at)",
          "VALUES (s.url_id, s.raw_url, s.normalized_url, s.host, s.path, s.query_parameters_kept, s.query_parameters_removed, s.language, s.country_target, s.page_type, s.product_id, s.product_family, 'unknown', TRUE, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP());",
          "MERGE " + tableRef(config, "url_identity_map") + " t",
          "USING (",
          entries.map((entry) => `SELECT ${sqlString(entry.rawUrl)} AS raw_url, ${sqlString(entry.normalizedUrl)} AS normalized_url, ${sqlString(entry.urlId)} AS url_id`).join("\nUNION ALL\n"),
          ") s ON t.raw_url = s.raw_url AND t.url_id = s.url_id",
          "WHEN MATCHED THEN UPDATE SET last_seen_at = CURRENT_TIMESTAMP()",
          "WHEN NOT MATCHED THEN INSERT (raw_url, normalized_url, url_id, source, first_seen_at, last_seen_at)",
          "VALUES (s.raw_url, s.normalized_url, s.url_id, 'sitemap', CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())",
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

async function executeIngestGa4UrlDay(input: { deps: ToolDeps; params: Record<string, unknown> }) {
  const config = normalizeConfig(input.deps.config);
  const { startDate, endDate } = readDateRange(input.params, config.defaultDateWindowDays);
  const pageLocation = "(SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location' LIMIT 1)";
  const normalizedUrl = normalizeSourceUrlSql(pageLocation);
  const result = await runBigQueryQuery({
    config,
    resolveSecret: input.deps.resolveSecret,
    fetchFn: input.deps.fetchFn,
    options: {
      query: [
        `DELETE FROM ${tableRef(config, "fact_ga4_url_day")} WHERE event_date BETWEEN DATE(@startDate) AND DATE(@endDate);`,
        `INSERT INTO ${tableRef(config, "fact_ga4_url_day")}`,
        "(event_date, url_id, normalized_url, product_id, country, language, device, sessions, active_users, file_downloads, visit_order_page, purchases, purchase_value)",
        "WITH events AS (",
        "  SELECT",
        "    PARSE_DATE('%Y%m%d', event_date) AS event_date,",
        `    ${normalizedUrl} AS normalized_url,`,
        `    ${urlIdSql(normalizedUrl)} AS url_id,`,
        "    geo.country AS country,",
        "    device.language AS language,",
        "    device.category AS device,",
        "    user_pseudo_id,",
        "    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id' LIMIT 1) AS ga_session_id,",
        "    event_name,",
        "    ecommerce.purchase_revenue AS purchase_revenue",
        `  FROM \`${config.bigQueryProjectId}.${config.ga4ExportDatasetId}.events_*\``,
        "  WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE(@startDate)) AND FORMAT_DATE('%Y%m%d', DATE(@endDate))",
        `    AND ${pageLocation} IS NOT NULL`,
        ")",
        "SELECT",
        "  event_date,",
        "  url_id,",
        "  e.normalized_url,",
        "  ANY_VALUE(u.product_id) AS product_id,",
        "  e.country,",
        "  e.language,",
        "  e.device,",
        "  COUNT(DISTINCT CONCAT(COALESCE(user_pseudo_id, ''), '-', COALESCE(CAST(ga_session_id AS STRING), ''))) AS sessions,",
        "  COUNT(DISTINCT user_pseudo_id) AS active_users,",
        "  COUNTIF(event_name = 'file_download') AS file_downloads,",
        "  COUNTIF(event_name = 'visit_order_page') AS visit_order_page,",
        "  COUNTIF(event_name = 'purchase') AS purchases,",
        "  CAST(SUM(IF(event_name = 'purchase', COALESCE(purchase_revenue, 0), 0)) AS NUMERIC) AS purchase_value",
        "FROM events e",
        `LEFT JOIN ${tableRef(config, "dim_url")} u USING (url_id)`,
        "GROUP BY event_date, url_id, e.normalized_url, e.country, e.language, e.device",
      ].join("\n"),
      parameters: { startDate, endDate },
      maximumBytesBilled: config.maximumBytesBilled,
      dryRun: input.params.dry_run === true,
    },
  });
  return toToolResult({ title: "ingest GA4 URL-day facts", result, source: config.ga4ExportDatasetId });
}

async function executeIngestGscUrlQueryDay(input: { deps: ToolDeps; params: Record<string, unknown> }) {
  const config = normalizeConfig(input.deps.config);
  const { startDate, endDate } = readDateRange(input.params, config.defaultDateWindowDays);
  const normalizedUrl = normalizeSourceUrlSql("url");
  const result = await runBigQueryQuery({
    config,
    resolveSecret: input.deps.resolveSecret,
    fetchFn: input.deps.fetchFn,
    options: {
      query: [
        `DELETE FROM ${tableRef(config, "fact_gsc_url_query_day")} WHERE data_date BETWEEN DATE(@startDate) AND DATE(@endDate);`,
        `INSERT INTO ${tableRef(config, "fact_gsc_url_query_day")}`,
        "(data_date, url_id, normalized_url, query, country, device, clicks, impressions, ctr, position)",
        "SELECT",
        "  data_date,",
        `  ${urlIdSql(normalizedUrl)} AS url_id,`,
        `  ${normalizedUrl} AS normalized_url,`,
        "  query,",
        "  country,",
        "  device,",
        "  SUM(clicks) AS clicks,",
        "  SUM(impressions) AS impressions,",
        "  SAFE_DIVIDE(SUM(clicks), NULLIF(SUM(impressions), 0)) AS ctr,",
        "  SAFE_DIVIDE(SUM(sum_position), NULLIF(SUM(impressions), 0)) + 1 AS position",
        `FROM \`${config.bigQueryProjectId}.${config.gscExportDatasetId}.searchdata_url_impression\``,
        "WHERE data_date BETWEEN DATE(@startDate) AND DATE(@endDate)",
        "  AND url IS NOT NULL",
        "GROUP BY data_date, url_id, normalized_url, query, country, device",
      ].join("\n"),
      parameters: { startDate, endDate },
      maximumBytesBilled: config.maximumBytesBilled,
      dryRun: input.params.dry_run === true,
    },
  });
  return toToolResult({ title: "ingest GSC URL-query facts", result, source: config.gscExportDatasetId });
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

function isFetchableHtmlUrl(url: string) {
  return !/\.(?:zip|exe|msi|dmg|pkg|pdf|jpg|jpeg|png|gif|webp|svg|css|js|ico|woff2?)($|\?)/i.test(url);
}

async function executeRunDueCrawlItems(input: { deps: ToolDeps; params: Record<string, unknown> }) {
  const config = normalizeConfig(input.deps.config);
  const limit = readLimit(input.params, 20, Math.min(config.crawlMaxPagesPerJob, 100));
  const now = new Date();
  const due = await runBigQueryQuery({
    config,
    resolveSecret: input.deps.resolveSecret,
    fetchFn: input.deps.fetchFn,
    options: {
      query: [
        "SELECT job_id, url_id, target_url, attempt_count, next_fetch_at",
        `FROM ${tableRef(config, "crawl_job_items")}`,
        "WHERE status IN ('queued', 'retry')",
        "  AND (next_fetch_at IS NULL OR next_fetch_at <= CURRENT_TIMESTAMP())",
        "ORDER BY priority ASC, created_at ASC",
        "LIMIT @limit",
      ].join("\n"),
      parameters: { limit },
      maximumBytesBilled: config.maximumBytesBilled,
    },
  });
  const items: Array<CrawlItem & { jobId: string }> = due.rows.map((row) => {
    const targetUrl = String(row.target_url ?? "");
    return {
      jobId: String(row.job_id ?? ""),
      urlId: String(row.url_id ?? ""),
      targetUrl,
      host: new URL(targetUrl).hostname,
      attemptCount: Number(row.attempt_count ?? 0),
      nextFetchAt: typeof row.next_fetch_at === "string" ? row.next_fetch_at : null,
    };
  });
  const selected = selectDueCrawlItems({
    items,
    now,
    policy: {
      maxConcurrentRequestsPerHost: config.crawlMaxConcurrentRequestsPerHost,
      minDelayMsPerHost: config.crawlMinDelayMsPerHost,
      maxAttemptsPerUrl: 3,
    },
  }) as Array<CrawlItem & { jobId: string }>;
  const processed: Array<Record<string, unknown>> = [];
  for (const item of selected) {
    if (!isFetchableHtmlUrl(item.targetUrl)) {
      processed.push({ url_id: item.urlId, target_url: item.targetUrl, status: "skipped", error_code: "non_html_asset" });
      continue;
    }
    try {
      const response = await input.deps.fetchFn(item.targetUrl, {
        headers: { "User-Agent": config.crawlUserAgent, Accept: "text/html,application/xhtml+xml" },
      });
      const retryAfter = parseRetryAfterSeconds(response.headers.get("retry-after"));
      const html = await response.text();
      const snapshot = parsePageSnapshot({
        html,
        finalUrl: response.url || item.targetUrl,
        httpStatus: response.status,
      });
      const status = response.ok ? "done" : response.status === 429 || response.status === 503 ? "retry" : "failed";
      const errorCode = response.ok ? null : `http_${response.status}`;
      const nextFetchAt = status === "retry"
        ? computeRetryAt({ now, attemptCount: item.attemptCount + 1, retryAfterSeconds: retryAfter })
        : null;
      if (input.params.write_to_bigquery === true || input.params.writeToBigQuery === true) {
        await runBigQueryQuery({
          config,
          resolveSecret: input.deps.resolveSecret,
          fetchFn: input.deps.fetchFn,
          options: {
            query: [
              `INSERT INTO ${tableRef(config, "fact_crawl_page_snapshot")}`,
              "(fetched_at, crawl_job_id, url_id, target_url, final_url, http_status, robots_allowed, noindex_detected, canonical_detected, title, h1, content_hash, response_bytes, error_code)",
              "VALUES (CURRENT_TIMESTAMP(), @jobId, @urlId, @targetUrl, @finalUrl, @httpStatus, TRUE, @noindexDetected, @canonicalDetected, @title, @h1, @contentHash, @responseBytes, @errorCode);",
              `UPDATE ${tableRef(config, "crawl_job_items")}`,
              "SET status = @status, attempt_count = attempt_count + 1, last_attempt_at = CURRENT_TIMESTAMP(), last_http_status = @httpStatus, error_code = @errorCode, response_bytes = @responseBytes, content_hash = @contentHash, canonical_detected = @canonicalDetected, robots_allowed = TRUE, noindex_detected = @noindexDetected, next_fetch_at = CAST(@nextFetchAt AS TIMESTAMP)",
              "WHERE job_id = @jobId AND url_id = @urlId;",
              `UPDATE ${tableRef(config, "dim_url")}`,
              "SET last_crawled_at = CURRENT_TIMESTAMP(), final_url_after_redirect = @finalUrl, canonical_url = COALESCE(@canonicalDetected, canonical_url), indexable_status = IF(@noindexDetected, 'noindex', IF(@httpStatus BETWEEN 200 AND 299, 'indexable', 'http_error')), updated_at = CURRENT_TIMESTAMP()",
              "WHERE url_id = @urlId",
            ].join("\n"),
            parameters: {
              jobId: item.jobId,
              urlId: item.urlId,
              targetUrl: item.targetUrl,
              finalUrl: snapshot.finalUrl,
              httpStatus: snapshot.httpStatus,
              noindexDetected: snapshot.noindexDetected,
              canonicalDetected: snapshot.canonicalDetected,
              title: snapshot.title,
              h1: snapshot.h1,
              contentHash: snapshot.contentHash,
              responseBytes: snapshot.responseBytes,
              errorCode,
              status,
              nextFetchAt,
            },
            maximumBytesBilled: config.maximumBytesBilled,
          },
        });
      }
      processed.push({ url_id: item.urlId, target_url: item.targetUrl, status, http_status: response.status });
    } catch (error) {
      const nextFetchAt = computeRetryAt({ now, attemptCount: item.attemptCount + 1 });
      if (input.params.write_to_bigquery === true || input.params.writeToBigQuery === true) {
        await runBigQueryQuery({
          config,
          resolveSecret: input.deps.resolveSecret,
          fetchFn: input.deps.fetchFn,
          options: {
            query: [
              `UPDATE ${tableRef(config, "crawl_job_items")}`,
              "SET status = 'retry', attempt_count = attempt_count + 1, last_attempt_at = CURRENT_TIMESTAMP(), error_code = @errorCode, next_fetch_at = CAST(@nextFetchAt AS TIMESTAMP)",
              "WHERE job_id = @jobId AND url_id = @urlId",
            ].join("\n"),
            parameters: {
              jobId: item.jobId,
              urlId: item.urlId,
              errorCode: error instanceof Error ? error.message.slice(0, 120) : "fetch_error",
              nextFetchAt,
            },
            maximumBytesBilled: config.maximumBytesBilled,
          },
        });
      }
      processed.push({ url_id: item.urlId, target_url: item.targetUrl, status: "retry", error_code: "fetch_error" });
    }
  }
  return {
    content: `Processed ${processed.length} due crawl item(s)`,
    data: { selected_count: selected.length, processed },
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
    case TOOL_NAMES.ingestGa4UrlDay:
      return await executeIngestGa4UrlDay({ deps: input.deps, params });
    case TOOL_NAMES.ingestGscUrlQueryDay:
      return await executeIngestGscUrlQueryDay({ deps: input.deps, params });
    case TOOL_NAMES.normalizeUrlInventory:
      return executeNormalizeUrl({ params });
    case TOOL_NAMES.scheduleCrawlBatch:
      return await executeScheduleCrawl({ deps: input.deps, params });
    case TOOL_NAMES.runDueCrawlItems:
      return await executeRunDueCrawlItems({ deps: input.deps, params });
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
