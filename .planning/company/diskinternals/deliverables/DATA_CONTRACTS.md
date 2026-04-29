# GA4/GSC MCP Data Contracts

## Principles

- Agents consume normalized reports, not raw screenshots.
- Agents do not invent funnel calculations ad hoc.
- Every report has fields, owner, consumers, refresh expectation, and known limitations.
- MCP is the operational source now. BigQuery becomes source of truth later.

## Reports

### `ga4_funnel_by_url`

**Owner:** DATA Growth Analytics Agent under CTO
**Consumers:** CMO, SEO Performance Analyst, CRO Funnel Experiment Agent, MKT Product Discovery Analyst

Fields:
- `date`
- `page_url`
- `page_path`
- `event_name`
- `event_count`
- `sessions`
- `active_users`
- `channel`
- `country`
- `language`
- `device`
- `source_medium`

Use:
- identify URLs with traffic but weak download/order/purchase flow;
- prioritize product pages, hubs, and articles for refresh/CRO/linking;
- monitor post-PR changes.

### `ga4_funnel_by_product_proxy`

**Owner:** DATA Growth Analytics Agent
**Consumers:** CMO, MKT Product Discovery Analyst

Fields:
- `date`
- `product_proxy`
- `product_family`
- `inference_source` (`url`, `download_filename`, `thank_you`, `order_page`, `manual_map`)
- `page_url`
- `event_name`
- `event_count`
- `language`
- `country`
- `confidence`

Use:
- interim Product Proxy Score until ecommerce attribution is reliable.

### `gsc_url_query_opportunities`

**Owner:** SEO Performance Analyst
**Consumers:** SEO lane, CMO, Localization Opportunity Agent

Fields:
- `date_range`
- `url`
- `query`
- `clicks`
- `impressions`
- `ctr`
- `position`
- `country`
- `device`
- `language_guess`

Use:
- find position 4-20 opportunities;
- map queries to refresh, internal linking, localization, and new-article candidates.

### `site_search_terms`

**Owner:** DATA Growth Analytics Agent
**Consumers:** SEO Blog Content Strategist, MKT Product Discovery Analyst, CRO Funnel Experiment Agent

Fields:
- `date`
- `search_term`
- `results_count`
- `page_url`
- `language`
- `country`
- `sessions`

Use:
- detect product confusion and content gaps;
- feed guided selector scenarios.

### `popup_performance`

**Owner:** CRO Funnel Experiment Agent
**Consumers:** CMO, QA Recovery Compliance Agent

Fields:
- `date`
- `popup_id`
- `popup_variant`
- `popup_type`
- `trigger_type`
- `product_proxy`
- `page_type`
- `page_url`
- `language`
- `shown`
- `closed`
- `primary_click`
- `download_after_popup`
- `visit_order_page_after_popup`
- `purchase_after_popup`

Use:
- evaluate contextual uncertainty-reducer experiments.

### `top_landing_pages_to_purchase`

**Owner:** DATA Growth Analytics Agent
**Consumers:** CMO, CEO, MKT Product Discovery Analyst

Fields:
- `landing_page_url`
- `channel`
- `country`
- `language`
- `sessions`
- `downloads`
- `visit_order_page`
- `purchases`
- `purchase_value`
- `product_proxy`
- `path_confidence`

Use:
- CEO/CMO prioritization and impact reporting.

### `changed_urls_for_indexing`

**Owner:** SEO Internal Linking Indexation Agent
**Consumers:** CMO, SEO Performance Analyst

Fields:
- `url`
- `change_date`
- `change_type`
- `changed_by_issue`
- `changed_by_pr`
- `priority`
- `reason`
- `submit_to_indexing`
- `follow_up_7d`
- `follow_up_14d`
- `follow_up_28d`

Use:
- avoid bulk indexing and track meaningful changes.
