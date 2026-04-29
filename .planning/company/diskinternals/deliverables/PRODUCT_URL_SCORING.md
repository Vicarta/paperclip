# Product, URL, And Scoring Foundation

## `dim_product` Scope

Minimum fields:
- `product_id`
- `product_name`
- `product_family`
- `is_paid`
- `is_freeware`
- `launch_status`
- `main_url`
- `download_url`
- `order_url`
- `thank_you_url_pattern`
- `supported_filesystems`
- `supported_scenarios`
- `primary_language`
- `localized_urls`
- `recovery_safety_notes`

Linux Writer placeholder:
- `product_name`: Linux Writer
- `product_family`: Linux filesystem utility
- `is_paid`: true
- `is_freeware`: false
- `launch_status`: upcoming
- `positioning`: low-price Windows tool for creating/editing files on Linux file systems
- `routing_note`: distinguish write/edit utility intent from recovery intent

## `dim_url` Scope

Minimum fields:
- `url`
- `canonical_url`
- `language`
- `country_target`
- `page_type`
- `product_id`
- `product_family`
- `is_hub`
- `is_product_page`
- `is_article`
- `is_download_flow`
- `is_checkout_flow`
- `localized_equivalents`
- `last_meaningful_change_at`
- `indexing_priority`

## Product Proxy Score

Use before ecommerce product attribution is fixed.

```text
Product Proxy Score =
30% product/page URL traffic
+ 25% file_download mapped by URL or filename
+ 20% visit_order_page mapped by source URL/product page
+ 15% GSC opportunity
+ 10% strategic priority from CEO/CMO
```

## Product Growth Score

Use after product attribution is fixed.

```text
Product Growth Score =
35% purchase / revenue
+ 20% visit_order_page
+ 20% file_download
+ 15% GSC opportunity
+ 5% localization opportunity
+ 5% content feasibility
```

## Page Action Score

Use for URL-level backlog.

```text
Page Action Score =
25% GSC impressions with position 4-20
+ 20% organic clicks
+ 20% assisted downloads/order visits
+ 15% product strategic priority
+ 10% internal linking potential
+ 10% freshness / SERP gap
```

## Agent Usage Rules

- CMO chooses backlog from score-ranked opportunities, not raw traffic alone.
- SEO Performance Analyst owns GSC and URL opportunity scoring.
- MKT Product Discovery Analyst owns product mapping and product-priority interpretation.
- DATA Growth Analytics Agent owns score input quality and report contracts.
- QA Recovery Compliance Agent reviews product recommendations before publication.
