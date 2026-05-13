CREATE TABLE IF NOT EXISTS "seo_ops"."semantic_core_review_group_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"review_batch_id" uuid NOT NULL,
	"group_id" text NOT NULL,
	"canonical_review_item_id" uuid,
	"actor_agent_id" uuid,
	"actor_user_id" text,
	"decision" text NOT NULL,
	"selected_item_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"omitted_item_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"reject_reason" text,
	"override_reason" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."semantic_core_review_group_decisions" ADD CONSTRAINT "semantic_core_review_group_decisions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."semantic_core_review_group_decisions" ADD CONSTRAINT "semantic_core_review_group_decisions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."semantic_core_review_group_decisions" ADD CONSTRAINT "semantic_core_review_group_decisions_review_batch_id_batches_id_fk" FOREIGN KEY ("review_batch_id") REFERENCES "seo_ops"."semantic_core_review_batches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."semantic_core_review_group_decisions" ADD CONSTRAINT "semantic_core_review_group_decisions_canonical_item_id_items_id_fk" FOREIGN KEY ("canonical_review_item_id") REFERENCES "seo_ops"."semantic_core_review_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."semantic_core_review_group_decisions" ADD CONSTRAINT "semantic_core_review_group_decisions_actor_agent_id_agents_id_fk" FOREIGN KEY ("actor_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seo_ops_semantic_core_review_group_decisions_group_idx" ON "seo_ops"."semantic_core_review_group_decisions" USING btree ("review_batch_id","group_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seo_ops_semantic_core_review_group_decisions_company_idx" ON "seo_ops"."semantic_core_review_group_decisions" USING btree ("company_id","project_id","created_at");
