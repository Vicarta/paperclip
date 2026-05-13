ALTER TABLE "seo_ops"."semantic_core_runs" ADD COLUMN IF NOT EXISTS "import_readiness" text;
--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_runs" ADD COLUMN IF NOT EXISTS "unsafe_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_runs" ADD COLUMN IF NOT EXISTS "quality_report" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_runs" ADD COLUMN IF NOT EXISTS "policy_version" text;
--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_memberships" ADD COLUMN IF NOT EXISTS "domain_topic_match" text;
--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_memberships" ADD COLUMN IF NOT EXISTS "domain_topic_match_score" numeric;
--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_memberships" ADD COLUMN IF NOT EXISTS "product_binding_status" text;
--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_memberships" ADD COLUMN IF NOT EXISTS "acceptance_confidence" numeric;
--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_memberships" ADD COLUMN IF NOT EXISTS "review_priority" integer;
--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_memberships" ADD COLUMN IF NOT EXISTS "human_review_required" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_memberships" ADD COLUMN IF NOT EXISTS "human_review_reason" text;
--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_memberships" ADD COLUMN IF NOT EXISTS "recommended_human_decision" text;
--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_memberships" ADD COLUMN IF NOT EXISTS "evidence_summary" text;
--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_memberships" ADD COLUMN IF NOT EXISTS "policy_version" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "seo_ops"."semantic_core_review_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"site_id" uuid,
	"semantic_core_run_id" uuid,
	"client_key" text NOT NULL,
	"mcp_project_id" text NOT NULL,
	"source_run_id" text NOT NULL,
	"layer" text NOT NULL,
	"import_readiness" text,
	"unsafe_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"quality_report" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"policy_version" text,
	"accepted_count" integer DEFAULT 0 NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"parked_count" integer DEFAULT 0 NOT NULL,
	"rejected_count" integer DEFAULT 0 NOT NULL,
	"unresolved_review_count" integer DEFAULT 0 NOT NULL,
	"warning_counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"mcp_review_artifact_id" text,
	"reviewed_rerun_id" text,
	"latest_import_readiness_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"blocker_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"linked_issue_id" uuid,
	"created_by_agent_id" uuid,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "seo_ops"."semantic_core_review_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"review_batch_id" uuid NOT NULL,
	"keyword_id" uuid,
	"normalized_keyword" text NOT NULL,
	"display_keyword" text NOT NULL,
	"duplicate_group_key" text NOT NULL,
	"source_artifact_type" text NOT NULL,
	"source_run_id" text NOT NULL,
	"artifact_row_pointer" text,
	"current_machine_membership" text NOT NULL,
	"recommended_human_decision" text,
	"human_decision" text,
	"decision_status" text DEFAULT 'pending' NOT NULL,
	"product_binding_status" text,
	"domain_topic_match" text,
	"domain_topic_match_score" numeric,
	"acceptance_confidence" numeric,
	"review_priority" integer,
	"human_review_required" boolean DEFAULT false NOT NULL,
	"human_review_reason" text,
	"evidence_summary" text,
	"policy_warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"geo_search_volume" integer,
	"global_search_volume" integer,
	"latest_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_occurrences" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"validation_outcome" text,
	"validation_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"policy_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "seo_ops"."semantic_core_review_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"review_batch_id" uuid NOT NULL,
	"review_item_id" uuid NOT NULL,
	"actor_agent_id" uuid,
	"actor_user_id" text,
	"previous_decision" text,
	"new_decision" text NOT NULL,
	"notes" text,
	"validation_outcome" text NOT NULL,
	"validation_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "seo_ops"."page_serp_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"project_page_id" uuid NOT NULL,
	"page_keyword_target_id" uuid,
	"keyword_id" uuid NOT NULL,
	"policy_id" uuid,
	"provider" text DEFAULT 'serper' NOT NULL,
	"search_engine" text DEFAULT 'google' NOT NULL,
	"geo" text NOT NULL,
	"language_code" text NOT NULL,
	"device_context" text DEFAULT 'desktop' NOT NULL,
	"tracking_status" text DEFAULT 'active' NOT NULL,
	"next_check_at" timestamp with time zone,
	"last_check_at" timestamp with time zone,
	"temporary_watch_until" timestamp with time zone,
	"identity_key" text NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "seo_ops"."serp_snapshots" ADD COLUMN IF NOT EXISTS "page_serp_target_id" uuid;
--> statement-breakpoint
ALTER TABLE "seo_ops"."serp_rank_observations" ADD COLUMN IF NOT EXISTS "page_serp_target_id" uuid;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "seo_ops"."metric_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"site_id" uuid,
	"project_page_id" uuid,
	"keyword_id" uuid,
	"page_serp_target_id" uuid,
	"window_type" text NOT NULL,
	"source" text NOT NULL,
	"date_from" date NOT NULL,
	"date_to" date NOT NULL,
	"source_query_params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"clicks" integer,
	"impressions" integer,
	"ctr" numeric,
	"average_position" numeric,
	"best_owned_position" numeric,
	"owned_result_count" integer,
	"evidence_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "seo_ops"."seo_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"site_id" uuid,
	"project_page_id" uuid,
	"keyword_id" uuid,
	"page_serp_target_id" uuid,
	"decision_type" text NOT NULL,
	"decision_status" text NOT NULL,
	"decision_reason" text NOT NULL,
	"decision_window_start" date NOT NULL,
	"decision_window_end" date NOT NULL,
	"baseline_window_id" uuid,
	"post_action_window_id" uuid,
	"comparison_window_id" uuid,
	"recent_action_event_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"policy_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"evidence_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"opened_issue_id" uuid,
	"actor_agent_id" uuid,
	"actor_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "seo_ops"."page_action_events" ADD COLUMN IF NOT EXISTS "affected_keyword_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "seo_ops"."page_action_events" ADD COLUMN IF NOT EXISTS "expected_effect" text;
--> statement-breakpoint
ALTER TABLE "seo_ops"."page_action_events" ADD COLUMN IF NOT EXISTS "cooldown_until" timestamp with time zone;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."semantic_core_review_batches" ADD CONSTRAINT "semantic_core_review_batches_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."semantic_core_review_batches" ADD CONSTRAINT "semantic_core_review_batches_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."semantic_core_review_batches" ADD CONSTRAINT "semantic_core_review_batches_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "seo_ops"."sites"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."semantic_core_review_batches" ADD CONSTRAINT "semantic_core_review_batches_semantic_core_run_id_runs_id_fk" FOREIGN KEY ("semantic_core_run_id") REFERENCES "seo_ops"."semantic_core_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."semantic_core_review_batches" ADD CONSTRAINT "semantic_core_review_batches_linked_issue_id_issues_id_fk" FOREIGN KEY ("linked_issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."semantic_core_review_batches" ADD CONSTRAINT "semantic_core_review_batches_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."semantic_core_review_items" ADD CONSTRAINT "semantic_core_review_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."semantic_core_review_items" ADD CONSTRAINT "semantic_core_review_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."semantic_core_review_items" ADD CONSTRAINT "semantic_core_review_items_review_batch_id_batches_id_fk" FOREIGN KEY ("review_batch_id") REFERENCES "seo_ops"."semantic_core_review_batches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."semantic_core_review_items" ADD CONSTRAINT "semantic_core_review_items_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "seo_ops"."keywords"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."semantic_core_review_decisions" ADD CONSTRAINT "semantic_core_review_decisions_review_batch_id_batches_id_fk" FOREIGN KEY ("review_batch_id") REFERENCES "seo_ops"."semantic_core_review_batches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."semantic_core_review_decisions" ADD CONSTRAINT "semantic_core_review_decisions_review_item_id_items_id_fk" FOREIGN KEY ("review_item_id") REFERENCES "seo_ops"."semantic_core_review_items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."page_serp_targets" ADD CONSTRAINT "page_serp_targets_project_page_id_project_pages_id_fk" FOREIGN KEY ("project_page_id") REFERENCES "seo_ops"."project_pages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."serp_snapshots" ADD CONSTRAINT "serp_snapshots_page_serp_target_id_page_serp_targets_id_fk" FOREIGN KEY ("page_serp_target_id") REFERENCES "seo_ops"."page_serp_targets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."serp_rank_observations" ADD CONSTRAINT "serp_rank_observations_page_serp_target_id_page_serp_targets_id_fk" FOREIGN KEY ("page_serp_target_id") REFERENCES "seo_ops"."page_serp_targets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "seo_ops_semantic_core_review_batches_run_layer_uq" ON "seo_ops"."semantic_core_review_batches" USING btree ("company_id","project_id","source_run_id","layer");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seo_ops_semantic_core_review_batches_status_updated_idx" ON "seo_ops"."semantic_core_review_batches" USING btree ("company_id","project_id","status","updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seo_ops_semantic_core_review_batches_company_issue_idx" ON "seo_ops"."semantic_core_review_batches" USING btree ("company_id","linked_issue_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "seo_ops_semantic_core_review_items_batch_group_uq" ON "seo_ops"."semantic_core_review_items" USING btree ("review_batch_id","duplicate_group_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seo_ops_semantic_core_review_items_batch_decision_idx" ON "seo_ops"."semantic_core_review_items" USING btree ("review_batch_id","decision_status","human_decision");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seo_ops_semantic_core_review_items_batch_membership_idx" ON "seo_ops"."semantic_core_review_items" USING btree ("review_batch_id","current_machine_membership","product_binding_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seo_ops_semantic_core_review_items_company_keyword_idx" ON "seo_ops"."semantic_core_review_items" USING btree ("company_id","project_id","normalized_keyword");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seo_ops_semantic_core_review_decisions_batch_item_created_idx" ON "seo_ops"."semantic_core_review_decisions" USING btree ("review_batch_id","review_item_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seo_ops_semantic_core_review_decisions_company_project_created_idx" ON "seo_ops"."semantic_core_review_decisions" USING btree ("company_id","project_id","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "seo_ops_page_serp_targets_identity_uq" ON "seo_ops"."page_serp_targets" USING btree ("identity_key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "seo_ops_page_serp_targets_page_keyword_context_uq" ON "seo_ops"."page_serp_targets" USING btree ("company_id","project_id","project_page_id","keyword_id","provider","search_engine","geo","language_code","device_context");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seo_ops_page_serp_targets_tracking_next_check_idx" ON "seo_ops"."page_serp_targets" USING btree ("tracking_status","next_check_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seo_ops_page_serp_targets_company_project_page_tracking_idx" ON "seo_ops"."page_serp_targets" USING btree ("company_id","project_id","project_page_id","tracking_status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "seo_ops_metric_windows_page_window_source_uq" ON "seo_ops"."metric_windows" USING btree ("company_id","project_id","project_page_id","keyword_id","window_type","source","date_from","date_to");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seo_ops_metric_windows_company_project_window_idx" ON "seo_ops"."metric_windows" USING btree ("company_id","project_id","window_type","date_to");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seo_ops_seo_decisions_company_project_page_created_idx" ON "seo_ops"."seo_decisions" USING btree ("company_id","project_id","project_page_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seo_ops_seo_decisions_company_project_status_created_idx" ON "seo_ops"."seo_decisions" USING btree ("company_id","project_id","decision_status","created_at");
