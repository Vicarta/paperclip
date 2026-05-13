ALTER TABLE "seo_ops"."semantic_core_review_items"
  ADD COLUMN IF NOT EXISTS "search_query_eligibility" text;
--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_review_items"
  ADD COLUMN IF NOT EXISTS "query_shape_score" numeric;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seo_ops_semantic_core_review_items_query_eligibility_idx"
  ON "seo_ops"."semantic_core_review_items" USING btree ("review_batch_id","search_query_eligibility");
--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_memberships"
  ADD COLUMN IF NOT EXISTS "search_query_eligibility" text;
--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_memberships"
  ADD COLUMN IF NOT EXISTS "query_shape_score" numeric;
