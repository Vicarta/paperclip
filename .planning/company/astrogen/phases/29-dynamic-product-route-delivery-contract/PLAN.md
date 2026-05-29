# Phase 29: Dynamic Product Route Delivery Contract

## Problem

The `/solar` product was added and accepted into the marketing pipeline, but the
Stage 64 delivery helper still behaved as if product categories were a fixed
old enum. This blocked article delivery after successful Stage 59 drafting and
Stage 61 validation.

## Goal

New Astrogen product routes must move through SEO article sanitizer and
Stage 64/65/Payload CMS delivery as soon as they are present in the product
catalog. A missing route in an old helper allowlist is a contract bug, not a
human decision or CTO runtime issue.

## Scope

- Make `solar` a first-class product route in the Astrogen product catalog.
- Add a Solar category contract for article sanitizer and delivery quality gates.
- Update Stage 59 and Stage 64 process contracts to use product-route slugs,
  not a hardcoded old route list.
- Update CMO routing contract so new products update the catalog before
  downstream SEO/article/delivery lanes.
- Make delivery/sanitizer helpers fall back to catalog-derived conservative
  contracts when an explicit category contract does not exist yet.

## Verification

- Delivery helper regression test covers normal existing category behavior.
- Delivery helper dry-run covers `solar` from the catalog.
- Article sanitizer regression test covers `solar`.
- Git working tree must not include unrelated runtime/tmp/secret artifacts.
