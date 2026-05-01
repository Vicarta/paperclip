-- DiskInternals growth core tables.
-- Apply with ops/bigquery/diskinternals/scripts/apply.sh after replacing project/dataset placeholders.

CREATE TABLE IF NOT EXISTS `__PROJECT__.__DATASET__.dim_product` (
  product_id STRING NOT NULL,
  product_name STRING NOT NULL,
  product_family STRING,
  is_paid BOOL,
  is_freeware BOOL,
  launch_status STRING,
  main_url STRING,
  download_url STRING,
  order_url STRING,
  supported_filesystems ARRAY<STRING>,
  supported_scenarios ARRAY<STRING>,
  primary_language STRING,
  localized_urls ARRAY<STRING>,
  recovery_safety_notes STRING,
  updated_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS `__PROJECT__.__DATASET__.dim_url` (
  url_id STRING NOT NULL,
  raw_url STRING NOT NULL,
  normalized_url STRING NOT NULL,
  canonical_url STRING,
  final_url_after_redirect STRING,
  google_canonical_url STRING,
  host STRING,
  path STRING,
  query_parameters_kept ARRAY<STRING>,
  query_parameters_removed ARRAY<STRING>,
  language STRING,
  country_target STRING,
  page_type STRING,
  product_id STRING,
  product_family STRING,
  indexable_status STRING,
  sitemap_present BOOL,
  last_seen_in_sitemap_at TIMESTAMP,
  last_crawled_at TIMESTAMP,
  last_meaningful_change_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS `__PROJECT__.__DATASET__.url_identity_map` (
  raw_url STRING NOT NULL,
  normalized_url STRING NOT NULL,
  url_id STRING NOT NULL,
  source STRING NOT NULL,
  first_seen_at TIMESTAMP NOT NULL,
  last_seen_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS `__PROJECT__.__DATASET__.raw_sitemap_snapshots` (
  snapshot_date DATE NOT NULL,
  sitemap_url STRING NOT NULL,
  raw_url STRING NOT NULL,
  normalized_url STRING,
  url_id STRING,
  lastmod TIMESTAMP,
  alternates ARRAY<STRUCT<language STRING, url STRING>>,
  seen_at TIMESTAMP NOT NULL
)
PARTITION BY snapshot_date;

CREATE TABLE IF NOT EXISTS `__PROJECT__.__DATASET__.fact_ga4_url_day` (
  event_date DATE NOT NULL,
  url_id STRING,
  normalized_url STRING,
  product_id STRING,
  country STRING,
  language STRING,
  device STRING,
  sessions INT64,
  active_users INT64,
  file_downloads INT64,
  visit_order_page INT64,
  purchases INT64,
  purchase_value NUMERIC
)
PARTITION BY event_date
CLUSTER BY normalized_url, product_id, country, language;

CREATE TABLE IF NOT EXISTS `__PROJECT__.__DATASET__.fact_gsc_url_query_day` (
  data_date DATE NOT NULL,
  url_id STRING,
  normalized_url STRING,
  query STRING,
  country STRING,
  device STRING,
  clicks INT64,
  impressions INT64,
  ctr FLOAT64,
  position FLOAT64
)
PARTITION BY data_date
CLUSTER BY normalized_url, country, device;

CREATE TABLE IF NOT EXISTS `__PROJECT__.__DATASET__.fact_crawl_page_snapshot` (
  fetched_at TIMESTAMP NOT NULL,
  crawl_job_id STRING,
  url_id STRING,
  target_url STRING,
  final_url STRING,
  http_status INT64,
  robots_allowed BOOL,
  noindex_detected BOOL,
  canonical_detected STRING,
  title STRING,
  h1 STRING,
  content_hash STRING,
  response_bytes INT64,
  error_code STRING
)
PARTITION BY DATE(fetched_at)
CLUSTER BY url_id, http_status;

CREATE TABLE IF NOT EXISTS `__PROJECT__.__DATASET__.fact_content_change` (
  change_date DATE NOT NULL,
  url_id STRING NOT NULL,
  normalized_url STRING,
  changed_by_issue STRING,
  changed_by_pr STRING,
  change_type STRING,
  description STRING,
  recorded_at TIMESTAMP NOT NULL
)
PARTITION BY change_date
CLUSTER BY url_id, change_type;

CREATE TABLE IF NOT EXISTS `__PROJECT__.__DATASET__.fact_experiment_event` (
  event_date DATE NOT NULL,
  experiment_id STRING NOT NULL,
  url_id STRING,
  product_id STRING,
  variant STRING,
  shown INT64,
  closed INT64,
  primary_click INT64,
  downloads_after INT64,
  order_visits_after INT64,
  purchases_after INT64
)
PARTITION BY event_date
CLUSTER BY experiment_id, url_id, product_id;

CREATE TABLE IF NOT EXISTS `__PROJECT__.__DATASET__.fact_followup_measurement` (
  measured_at TIMESTAMP NOT NULL,
  url_id STRING NOT NULL,
  changed_by_issue STRING,
  followup_window_days INT64,
  gsc_clicks INT64,
  gsc_impressions INT64,
  avg_position FLOAT64,
  organic_sessions INT64,
  file_downloads INT64,
  visit_order_page INT64,
  purchases INT64,
  invalidated_by_new_change BOOL,
  notes STRING
)
PARTITION BY DATE(measured_at)
CLUSTER BY url_id, followup_window_days;

CREATE TABLE IF NOT EXISTS `__PROJECT__.__DATASET__.opportunity_decisions` (
  decided_at TIMESTAMP NOT NULL,
  opportunity_id STRING NOT NULL,
  action_type STRING NOT NULL,
  owner_lane STRING NOT NULL,
  decision_status STRING NOT NULL,
  reason STRING,
  confidence FLOAT64,
  source_opportunity_ids ARRAY<STRING>,
  parent_issue_id STRING,
  decided_by_agent_id STRING
)
PARTITION BY DATE(decided_at)
CLUSTER BY action_type, owner_lane, decision_status;
