-- DiskInternals scoring and opportunity marts.

CREATE OR REPLACE VIEW `__PROJECT__.__DATASET__.mart_product_priority` AS
SELECT
  f.product_id,
  ANY_VALUE(p.product_name) AS product_name,
  ANY_VALUE(p.product_family) AS product_family,
  SUM(f.sessions) AS sessions,
  SUM(f.file_downloads) AS file_downloads,
  SUM(f.visit_order_page) AS visit_order_page,
  SUM(f.purchases) AS purchases,
  SUM(f.purchase_value) AS purchase_value,
  SAFE_DIVIDE(SUM(f.visit_order_page), NULLIF(SUM(f.sessions), 0)) AS order_visit_rate,
  CURRENT_TIMESTAMP() AS scored_at
FROM `__PROJECT__.__DATASET__.fact_ga4_url_day` f
LEFT JOIN `__PROJECT__.__DATASET__.dim_product` p USING (product_id)
GROUP BY f.product_id;

CREATE OR REPLACE VIEW `__PROJECT__.__DATASET__.mart_url_growth_opportunity` AS
SELECT
  u.url_id,
  u.normalized_url,
  u.product_id,
  u.page_type,
  SUM(g.sessions) AS sessions,
  SUM(g.file_downloads) AS file_downloads,
  SUM(g.visit_order_page) AS visit_order_page,
  SUM(s.impressions) AS gsc_impressions,
  SUM(s.clicks) AS gsc_clicks,
  AVG(s.position) AS avg_position,
  CURRENT_TIMESTAMP() AS scored_at
FROM `__PROJECT__.__DATASET__.dim_url` u
LEFT JOIN `__PROJECT__.__DATASET__.fact_ga4_url_day` g USING (url_id)
LEFT JOIN `__PROJECT__.__DATASET__.fact_gsc_url_query_day` s USING (url_id)
WHERE COALESCE(u.page_type, "") NOT IN ("thank_you", "thank-you")
GROUP BY u.url_id, u.normalized_url, u.product_id, u.page_type;

CREATE OR REPLACE VIEW `__PROJECT__.__DATASET__.mart_growth_opportunities` AS
SELECT
  TO_HEX(SHA256(CONCAT(url_id, "|", COALESCE(product_id, ""), "|", COALESCE(page_type, "")))) AS opportunity_id,
  url_id,
  normalized_url,
  product_id,
  page_type,
  sessions,
  file_downloads,
  visit_order_page,
  gsc_impressions,
  gsc_clicks,
  avg_position,
  (
    LEAST(COALESCE(gsc_impressions, 0) / 10000, 1) * 25
    + LEAST(COALESCE(gsc_clicks, 0) / 1000, 1) * 20
    + LEAST((COALESCE(file_downloads, 0) + COALESCE(visit_order_page, 0)) / 100, 1) * 20
  ) AS page_action_score,
  CASE
    WHEN avg_position BETWEEN 4 AND 20 THEN "seo_refresh"
    WHEN visit_order_page > 0 AND file_downloads = 0 THEN "cro_experiment"
    ELSE "park_no_action"
  END AS preliminary_action_type,
  scored_at
FROM `__PROJECT__.__DATASET__.mart_url_growth_opportunity`;

CREATE OR REPLACE VIEW `__PROJECT__.__DATASET__.mart_localization_candidate` AS
SELECT
  url_id,
  normalized_url,
  product_id,
  country,
  SUM(impressions) AS impressions,
  SUM(clicks) AS clicks,
  AVG(position) AS avg_position,
  CURRENT_TIMESTAMP() AS scored_at
FROM `__PROJECT__.__DATASET__.fact_gsc_url_query_day`
WHERE country IS NOT NULL
GROUP BY url_id, normalized_url, product_id, country;

CREATE OR REPLACE VIEW `__PROJECT__.__DATASET__.mart_indexing_candidate` AS
SELECT
  c.url_id,
  c.normalized_url,
  c.changed_by_issue,
  c.changed_by_pr,
  c.change_type,
  c.change_date,
  u.indexable_status,
  u.last_crawled_at
FROM `__PROJECT__.__DATASET__.fact_content_change` c
LEFT JOIN `__PROJECT__.__DATASET__.dim_url` u USING (url_id)
WHERE COALESCE(u.indexable_status, "indexable") = "indexable";
