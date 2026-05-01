-- DiskInternals BigQuery-backed crawl/job state.

CREATE TABLE IF NOT EXISTS `__PROJECT__.__DATASET__.crawl_jobs` (
  job_id STRING NOT NULL,
  status STRING NOT NULL,
  priority_band STRING,
  reason STRING,
  created_at TIMESTAMP NOT NULL,
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  max_items INT64,
  max_concurrent_requests_per_host INT64,
  min_delay_between_requests_ms INT64,
  created_by_issue_id STRING,
  created_by_agent_id STRING,
  error_message STRING
)
PARTITION BY DATE(created_at)
CLUSTER BY status, priority_band;

CREATE TABLE IF NOT EXISTS `__PROJECT__.__DATASET__.crawl_job_items` (
  job_id STRING NOT NULL,
  url_id STRING NOT NULL,
  target_url STRING NOT NULL,
  created_at TIMESTAMP NOT NULL,
  priority INT64,
  reason STRING,
  status STRING NOT NULL,
  next_fetch_at TIMESTAMP,
  attempt_count INT64 NOT NULL,
  last_attempt_at TIMESTAMP,
  last_http_status INT64,
  error_code STRING,
  response_bytes INT64,
  etag STRING,
  last_modified STRING,
  content_hash STRING,
  canonical_detected STRING,
  robots_allowed BOOL,
  noindex_detected BOOL
)
PARTITION BY DATE(created_at)
CLUSTER BY job_id, status, url_id;
