ALTER TABLE "seo_ops"."semantic_core_review_items" ADD COLUMN IF NOT EXISTS "human_connection_assessment" text;
--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_review_items" ADD COLUMN IF NOT EXISTS "human_connection_note" text;
