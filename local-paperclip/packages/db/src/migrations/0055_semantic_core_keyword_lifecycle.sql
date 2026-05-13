CREATE TABLE IF NOT EXISTS "seo_ops"."semantic_core_keyword_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid,
	"normalized_keyword" text NOT NULL,
	"display_keyword" text NOT NULL,
	"action" text NOT NULL,
	"status" text NOT NULL,
	"notes" text,
	"actor_agent_id" uuid,
	"actor_user_id" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."semantic_core_keyword_actions" ADD CONSTRAINT "semantic_core_keyword_actions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."semantic_core_keyword_actions" ADD CONSTRAINT "semantic_core_keyword_actions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."semantic_core_keyword_actions" ADD CONSTRAINT "semantic_core_keyword_actions_actor_agent_id_agents_id_fk" FOREIGN KEY ("actor_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seo_ops_semantic_core_keyword_actions_keyword_created_idx" ON "seo_ops"."semantic_core_keyword_actions" USING btree ("company_id","project_id","normalized_keyword","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seo_ops_semantic_core_keyword_actions_status_created_idx" ON "seo_ops"."semantic_core_keyword_actions" USING btree ("company_id","status","created_at");
