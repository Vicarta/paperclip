ALTER TABLE "seo_ops"."semantic_core_review_batches" ADD COLUMN IF NOT EXISTS "client_review_status" text DEFAULT 'not_started' NOT NULL;
--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_review_batches" ADD COLUMN IF NOT EXISTS "client_review_completed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_review_batches" ADD COLUMN IF NOT EXISTS "client_review_processed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_review_batches" ADD COLUMN IF NOT EXISTS "client_review_revision" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_review_batches" ADD COLUMN IF NOT EXISTS "client_review_progress" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_review_batches" ADD COLUMN IF NOT EXISTS "client_review_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL;
