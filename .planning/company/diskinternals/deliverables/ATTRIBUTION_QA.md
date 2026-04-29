# Attribution QA And Event Parameter Requirements

## Business Events

### `purchase`

Status: primary business event.

Required parameters:
- `transaction_id`
- `value`
- `currency`
- `items.item_id`
- `items.item_name`
- `items.item_category`
- `items.price`
- `items.quantity`
- `language`

QA:
- ecommerce product report must show product names/items;
- transaction IDs must be unique;
- purchase value must reconcile with order data if available;
- product/item fields must not be empty.

### `file_download`

Status: trial/download intent, not revenue.

Required parameters:
- `product_id`
- `product_name`
- `product_family`
- `is_freeware`
- `download_filename`
- `download_version`
- `language`
- `page_type`
- `page_url`
- `cta_location`

QA:
- filenames map to products;
- freeware vs paid trial distinction is explicit;
- Linux Reader and Linux Writer are distinguishable;
- download page and source page are preserved.

### `visit_order_page`

Status: strong purchase intent and likely key micro-conversion.

Required parameters:
- `product_id`
- `product_name`
- `product_family`
- `language`
- `source_page_url`
- `cta_location`

QA:
- source page maps to a product or product proxy;
- order-page visits from Linux Reader/Linux Writer/freeware flows preserve source context.

### `thank_you_page`

Status: download-flow QA signal, not primary conversion.

Required parameters:
- `product_id`
- `product_name`
- `product_family`
- `language`
- `source_page_url`
- `download_filename`

QA:
- confirms correct product path after download;
- safety messaging can be tied to product/funnel.

### Popup Events

Events:
- `js_popup_sale_shown`
- `js_popup_sale_closed`
- `js_popup_sale_primary_click`

Required parameters:
- `popup_id`
- `popup_variant`
- `popup_type`
- `trigger_type`
- `product_id`
- `product_name`
- `page_type`
- `page_url`
- `language`

QA:
- shown/closed/clicked events share the same popup identity fields;
- click-through can be connected to download/order/purchase.

### `view_search_results`

Required parameters:
- `search_term`
- `results_count`
- `language`
- `page_url`

QA:
- search term is not redacted or dropped;
- empty-result searches are preserved.

## Interim Attribution Policy

Until ecommerce product attribution is fixed, use:

```text
Product Proxy Score =
30% product/page URL traffic
+ 25% file_download mapped by URL or filename
+ 20% visit_order_page mapped by source URL/product page
+ 15% GSC opportunity
+ 10% strategic priority from CEO/CMO
```

Do not treat `file_download` as purchase revenue.
