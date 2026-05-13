ALTER TABLE "seo_ops"."semantic_core_memberships" ADD COLUMN IF NOT EXISTS "locale_warning_severity" text;
--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_memberships" ADD COLUMN IF NOT EXISTS "accepted_locale_warning_overridden" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_memberships" ADD COLUMN IF NOT EXISTS "locale_override_reason" text;
--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_memberships" ADD COLUMN IF NOT EXISTS "human_decision_applied" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_memberships" ADD COLUMN IF NOT EXISTS "human_decision_blocked_reason" text;
--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_memberships" ADD COLUMN IF NOT EXISTS "source_precision_class" text;
--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_review_items" ADD COLUMN IF NOT EXISTS "locale_warning_severity" text;
--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_review_items" ADD COLUMN IF NOT EXISTS "accepted_locale_warning_overridden" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_review_items" ADD COLUMN IF NOT EXISTS "locale_override_reason" text;
--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_review_items" ADD COLUMN IF NOT EXISTS "human_decision_applied" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_review_items" ADD COLUMN IF NOT EXISTS "human_decision_blocked_reason" text;
--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_review_items" ADD COLUMN IF NOT EXISTS "source_precision_class" text;
