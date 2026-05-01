import {
  DEFAULT_DATASET_ID,
  DEFAULT_DATE_WINDOW_DAYS,
  DEFAULT_LOCATION,
  DEFAULT_MAXIMUM_BYTES_BILLED,
  DEFAULT_ROW_LIMIT,
  MAX_ROW_LIMIT,
} from "./constants.js";

export type BigQueryGrowthPluginConfig = {
  bigQueryProjectId?: string;
  bigQueryDatasetId?: string;
  bigQueryLocation?: string;
  bigQueryAccessTokenSecretRef?: string;
  bigQueryServiceAccountJsonSecretRef?: string;
  defaultDateWindowDays?: number;
  defaultRowLimit?: number;
  maxRowLimit?: number;
  maximumBytesBilled?: string;
  crawlUserAgent?: string;
  crawlMaxConcurrentRequestsPerHost?: number;
  crawlMinDelayMsPerHost?: number;
  crawlMaxPagesPerJob?: number;
};

function readPositiveInteger(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

export function normalizeConfig(config: BigQueryGrowthPluginConfig = {}) {
  const maxRowLimit = readPositiveInteger(config.maxRowLimit, MAX_ROW_LIMIT);
  const defaultRowLimit = Math.min(
    readPositiveInteger(config.defaultRowLimit, DEFAULT_ROW_LIMIT),
    maxRowLimit,
  );

  return {
    bigQueryProjectId: readString(config.bigQueryProjectId),
    bigQueryDatasetId: readString(config.bigQueryDatasetId, DEFAULT_DATASET_ID),
    bigQueryLocation: readString(config.bigQueryLocation, DEFAULT_LOCATION),
    bigQueryAccessTokenSecretRef: readString(config.bigQueryAccessTokenSecretRef),
    bigQueryServiceAccountJsonSecretRef: readString(config.bigQueryServiceAccountJsonSecretRef),
    defaultDateWindowDays: readPositiveInteger(
      config.defaultDateWindowDays,
      DEFAULT_DATE_WINDOW_DAYS,
    ),
    defaultRowLimit,
    maxRowLimit,
    maximumBytesBilled: readString(
      config.maximumBytesBilled,
      DEFAULT_MAXIMUM_BYTES_BILLED,
    ),
    crawlUserAgent: readString(
      config.crawlUserAgent,
      "PaperclipDiskInternalsGrowthBot/0.1 (+https://diskinternals.com/)",
    ),
    crawlMaxConcurrentRequestsPerHost: readPositiveInteger(
      config.crawlMaxConcurrentRequestsPerHost,
      2,
    ),
    crawlMinDelayMsPerHost: readPositiveInteger(config.crawlMinDelayMsPerHost, 2000),
    crawlMaxPagesPerJob: readPositiveInteger(config.crawlMaxPagesPerJob, 500),
  };
}
