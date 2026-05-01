-- DiskInternals agent-facing report views.

CREATE OR REPLACE VIEW `__PROJECT__.__DATASET__.report_site_url_inventory` AS
SELECT
  url_id,
  raw_url,
  normalized_url,
  canonical_url,
  final_url_after_redirect,
  language,
  country_target,
  page_type,
  product_id,
  product_family,
  indexable_status,
  sitemap_present,
  last_seen_in_sitemap_at,
  last_crawled_at,
  last_meaningful_change_at,
  updated_at
FROM `__PROJECT__.__DATASET__.dim_url`;

CREATE OR REPLACE VIEW `__PROJECT__.__DATASET__.report_product_funnel_metrics` AS
SELECT
  event_date,
  product_id,
  country,
  language,
  SUM(sessions) AS sessions,
  SUM(file_downloads) AS file_downloads,
  SUM(visit_order_page) AS visit_order_page,
  SUM(purchases) AS purchases,
  SUM(purchase_value) AS purchase_value
FROM `__PROJECT__.__DATASET__.fact_ga4_url_day`
GROUP BY event_date, product_id, country, language;

CREATE OR REPLACE VIEW `__PROJECT__.__DATASET__.report_gsc_url_query_opportunities` AS
SELECT
  data_date,
  url_id,
  normalized_url,
  query,
  country,
  device,
  clicks,
  impressions,
  ctr,
  position
FROM `__PROJECT__.__DATASET__.fact_gsc_url_query_day`
WHERE impressions > 0;

CREATE OR REPLACE VIEW `__PROJECT__.__DATASET__.report_post_change_followup` AS
SELECT
  measured_at,
  url_id,
  changed_by_issue,
  followup_window_days,
  gsc_clicks,
  gsc_impressions,
  avg_position,
  organic_sessions,
  file_downloads,
  visit_order_page,
  purchases,
  invalidated_by_new_change,
  notes
FROM `__PROJECT__.__DATASET__.fact_followup_measurement`;
