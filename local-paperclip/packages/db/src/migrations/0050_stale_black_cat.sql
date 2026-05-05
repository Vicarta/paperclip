CREATE SCHEMA IF NOT EXISTS "seo_ops";
--> statement-breakpoint
CREATE TABLE "seo_ops"."ai_visibility_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"site_id" uuid,
	"ai_visibility_target_id" uuid NOT NULL,
	"keyword_id" uuid,
	"project_page_id" uuid,
	"answer_engine" text NOT NULL,
	"engine_variant" text,
	"geo" text,
	"language_code" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"snapshot_date" date NOT NULL,
	"prompt_text" text NOT NULL,
	"answer_hash" text NOT NULL,
	"target_domain_mentioned" boolean DEFAULT false NOT NULL,
	"brand_mentioned" boolean DEFAULT false NOT NULL,
	"target_url_mentioned" boolean DEFAULT false NOT NULL,
	"mentioned_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mention_rank" integer,
	"visibility_score" numeric,
	"sentiment_label" text,
	"citation_count" integer,
	"raw_answer_excerpt" text,
	"raw_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"provider" text,
	"plugin_job_run_id" uuid,
	"heartbeat_run_id" uuid,
	"cost_event_id" uuid,
	"identity_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_ops"."ai_visibility_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"site_id" uuid,
	"keyword_id" uuid,
	"project_page_id" uuid,
	"prompt_text" text NOT NULL,
	"prompt_normalized" text NOT NULL,
	"answer_engine" text NOT NULL,
	"engine_variant" text,
	"geo" text,
	"language_code" text NOT NULL,
	"device_context" text,
	"target_domain" text,
	"target_url" text,
	"frequency" text NOT NULL,
	"interval_days" integer,
	"next_check_at" timestamp with time zone,
	"last_check_at" timestamp with time zone,
	"tracking_status" text DEFAULT 'active' NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"identity_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_ops"."clusters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"external_cluster_id" text,
	"label" text NOT NULL,
	"layer" text,
	"intent_label" text,
	"status" text DEFAULT 'candidate' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_ops"."discovery_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid,
	"site_id" uuid,
	"source" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"plugin_job_run_id" uuid,
	"heartbeat_run_id" uuid,
	"cost_event_id" uuid
);
--> statement-breakpoint
CREATE TABLE "seo_ops"."keyword_cluster_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"cluster_id" uuid NOT NULL,
	"keyword_id" uuid NOT NULL,
	"membership_status" text DEFAULT 'candidate' NOT NULL,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_ops"."keyword_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid,
	"site_id" uuid,
	"page_id" uuid,
	"project_page_id" uuid,
	"keyword_id" uuid,
	"raw_query" text,
	"normalized_query" text,
	"source" text NOT NULL,
	"source_run_id" text,
	"discovery_run_id" uuid,
	"date_from" date,
	"date_to" date,
	"country" text,
	"device" text,
	"search_appearance" text,
	"clicks" integer,
	"impressions" integer,
	"ctr" numeric,
	"average_position" numeric,
	"geo_search_volume" integer,
	"global_search_volume" integer,
	"global_search_volume_status" text,
	"intent_label" text,
	"intent_probability" numeric,
	"membership" text,
	"reason" text,
	"evidence_status" text DEFAULT 'raw' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_ops"."keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"normalized_keyword" text NOT NULL,
	"display_keyword" text NOT NULL,
	"language_code" text NOT NULL,
	"location_code" text NOT NULL,
	"device_context" text DEFAULT 'desktop' NOT NULL,
	"keyword_hash" text NOT NULL,
	"status" text DEFAULT 'candidate' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_ops"."new_page_opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"site_id" uuid,
	"keyword_id" uuid,
	"source_observation_id" uuid,
	"current_page_id" uuid,
	"current_project_page_id" uuid,
	"landing_fit_state" text NOT NULL,
	"intent_label" text,
	"audience_relevance" text,
	"topical_authority_fit" text,
	"product_relation" text,
	"business_value" text,
	"proposed_page_type" text,
	"suggested_priority" integer DEFAULT 100 NOT NULL,
	"validation_status" text DEFAULT 'candidate' NOT NULL,
	"decision" text,
	"linked_issue_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_ops"."page_action_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"project_page_id" uuid NOT NULL,
	"issue_id" uuid,
	"agent_id" uuid,
	"event_type" text NOT NULL,
	"event_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_ops"."page_keyword_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"project_page_id" uuid NOT NULL,
	"keyword_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"status" text DEFAULT 'candidate' NOT NULL,
	"tier" text DEFAULT 'tier_3' NOT NULL,
	"source" text NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"accepted_at" timestamp with time zone,
	"parked_reason" text,
	"rejected_reason" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_ops"."pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"canonical_url" text NOT NULL,
	"canonical_url_normalized" text NOT NULL,
	"path" text NOT NULL,
	"url_hash" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_discovery_run_id" uuid,
	"discovery_status" text DEFAULT 'seen' NOT NULL,
	"discovery_sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sitemap_lastmod" timestamp with time zone,
	"http_status" integer,
	"redirect_target_url" text,
	"declared_canonical_url" text,
	"robots_status" text,
	"indexability_status" text,
	"title" text,
	"h1" text,
	"meta_description" text,
	"detected_language_code" text,
	"schema_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"page_type" text,
	"content_hash" text,
	"enrichment" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_ops"."performance_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"site_id" uuid,
	"project_page_id" uuid,
	"keyword_id" uuid,
	"page_keyword_target_id" uuid,
	"snapshot_date" date NOT NULL,
	"source" text NOT NULL,
	"clicks" integer,
	"impressions" integer,
	"ctr" numeric,
	"average_position" numeric,
	"provider" text,
	"classification" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_ops"."project_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"project_scope_id" uuid,
	"ownership_status" text DEFAULT 'candidate' NOT NULL,
	"ownership_mode" text DEFAULT 'owned' NOT NULL,
	"primary_page_type" text,
	"seo_state" text DEFAULT 'new' NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"monitoring_status" text DEFAULT 'active' NOT NULL,
	"first_owned_at" timestamp with time zone,
	"last_evaluated_at" timestamp with time zone,
	"last_changed_at" timestamp with time zone,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_ops"."project_scopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"site_scope_prefix" text,
	"include_path_patterns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"exclude_path_patterns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"language_code" text NOT NULL,
	"location_code" text NOT NULL,
	"device_context" text DEFAULT 'desktop' NOT NULL,
	"page_type_filter" text,
	"ownership_mode" text DEFAULT 'owned' NOT NULL,
	"conflict_policy" text DEFAULT 'flag_conflict' NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_ops"."rank_tracking_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid,
	"scope_level" text NOT NULL,
	"tier" text NOT NULL,
	"provider" text NOT NULL,
	"search_engine" text DEFAULT 'google' NOT NULL,
	"geo" text NOT NULL,
	"language_code" text NOT NULL,
	"device_context" text DEFAULT 'desktop' NOT NULL,
	"frequency" text NOT NULL,
	"interval_days" integer,
	"schedule_cron" text,
	"jitter_minutes" integer DEFAULT 0 NOT NULL,
	"max_keywords" integer,
	"max_cost_cents_per_period" integer,
	"escalation_threshold" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"temporary_watch_duration_days" integer,
	"stop_conditions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"identity_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_ops"."rank_tracking_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"project_page_id" uuid,
	"page_keyword_target_id" uuid,
	"keyword_id" uuid NOT NULL,
	"policy_id" uuid,
	"provider" text NOT NULL,
	"search_engine" text DEFAULT 'google' NOT NULL,
	"geo" text NOT NULL,
	"language_code" text NOT NULL,
	"device_context" text NOT NULL,
	"tracking_status" text DEFAULT 'active' NOT NULL,
	"next_check_at" timestamp with time zone,
	"last_check_at" timestamp with time zone,
	"temporary_watch_until" timestamp with time zone,
	"identity_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_ops"."scope_conflicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"conflict_type" text NOT NULL,
	"conflicting_project_page_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution" text,
	"resolved_by_agent_id" uuid,
	"resolved_by_user_id" text,
	"resolved_at" timestamp with time zone,
	"linked_issue_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_ops"."semantic_core_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"semantic_core_run_id" uuid,
	"keyword_id" uuid NOT NULL,
	"cluster_id" text,
	"layer" text NOT NULL,
	"membership" text DEFAULT 'candidate' NOT NULL,
	"parked_reason" text,
	"rejected_reason" text,
	"review_decision" text,
	"reviewed_by_agent_id" uuid,
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp with time zone,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_ops"."semantic_core_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"client_key" text NOT NULL,
	"mcp_project_id" text NOT NULL,
	"mcp_run_id" text NOT NULL,
	"layer" text NOT NULL,
	"run_mode" text,
	"schema_version" text,
	"provider_versions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"artifact_manifest_uri" text,
	"source_hashes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cost" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'imported' NOT NULL,
	"generated_at" timestamp with time zone,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_ops"."semantic_segment_keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"semantic_segment_id" uuid NOT NULL,
	"keyword_id" uuid NOT NULL,
	"relationship_type" text DEFAULT 'member' NOT NULL,
	"source" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_ops"."semantic_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"semantic_core_run_id" uuid,
	"external_segment_id" text,
	"segment_type" text NOT NULL,
	"label" text,
	"layer" text,
	"intent_label" text,
	"owner_type_final" text,
	"product_bindings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"primary_keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cluster_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'candidate' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_ops"."serp_rank_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"site_id" uuid,
	"project_page_id" uuid,
	"page_keyword_target_id" uuid,
	"rank_tracking_target_id" uuid,
	"keyword_id" uuid NOT NULL,
	"serp_snapshot_id" uuid,
	"provider" text DEFAULT 'serper' NOT NULL,
	"search_engine" text DEFAULT 'google' NOT NULL,
	"geo" text NOT NULL,
	"language_code" text NOT NULL,
	"device_context" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"snapshot_date" date NOT NULL,
	"rank_position" numeric,
	"rank_url" text,
	"rank_url_normalized" text,
	"rank_result_type" text,
	"owned_result_count" integer DEFAULT 0 NOT NULL,
	"best_owned_position" numeric,
	"visibility_state" text DEFAULT 'observed' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"identity_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_ops"."serp_snapshot_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"serp_snapshot_id" uuid NOT NULL,
	"result_position" integer NOT NULL,
	"result_type" text DEFAULT 'organic' NOT NULL,
	"result_url" text,
	"result_url_normalized" text,
	"result_domain" text,
	"title" text,
	"snippet" text,
	"is_owned_domain" boolean DEFAULT false NOT NULL,
	"matched_site_id" uuid,
	"matched_page_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_ops"."serp_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"site_id" uuid,
	"rank_tracking_target_id" uuid,
	"keyword_id" uuid NOT NULL,
	"provider" text DEFAULT 'serper' NOT NULL,
	"search_engine" text DEFAULT 'google' NOT NULL,
	"geo" text NOT NULL,
	"language_code" text NOT NULL,
	"device_context" text DEFAULT 'desktop' NOT NULL,
	"requested_query" text NOT NULL,
	"requested_num_results" integer,
	"observed_at" timestamp with time zone NOT NULL,
	"snapshot_date" date NOT NULL,
	"status" text DEFAULT 'ok' NOT NULL,
	"request_fingerprint" text NOT NULL,
	"raw_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"plugin_job_run_id" uuid,
	"heartbeat_run_id" uuid,
	"cost_event_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_ops"."sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"canonical_host" text,
	"default_url_scheme" text DEFAULT 'https' NOT NULL,
	"gsc_site_url" text,
	"bing_site_url" text,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "seo_ops"."ai_visibility_observations" ADD CONSTRAINT "ai_visibility_observations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."ai_visibility_observations" ADD CONSTRAINT "ai_visibility_observations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."ai_visibility_observations" ADD CONSTRAINT "ai_visibility_observations_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "seo_ops"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."ai_visibility_observations" ADD CONSTRAINT "ai_visibility_observations_ai_visibility_target_id_ai_visibility_targets_id_fk" FOREIGN KEY ("ai_visibility_target_id") REFERENCES "seo_ops"."ai_visibility_targets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."ai_visibility_observations" ADD CONSTRAINT "ai_visibility_observations_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "seo_ops"."keywords"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."ai_visibility_observations" ADD CONSTRAINT "ai_visibility_observations_project_page_id_project_pages_id_fk" FOREIGN KEY ("project_page_id") REFERENCES "seo_ops"."project_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."ai_visibility_observations" ADD CONSTRAINT "ai_visibility_observations_plugin_job_run_id_plugin_job_runs_id_fk" FOREIGN KEY ("plugin_job_run_id") REFERENCES "public"."plugin_job_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."ai_visibility_observations" ADD CONSTRAINT "ai_visibility_observations_heartbeat_run_id_heartbeat_runs_id_fk" FOREIGN KEY ("heartbeat_run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."ai_visibility_observations" ADD CONSTRAINT "ai_visibility_observations_cost_event_id_cost_events_id_fk" FOREIGN KEY ("cost_event_id") REFERENCES "public"."cost_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."ai_visibility_targets" ADD CONSTRAINT "ai_visibility_targets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."ai_visibility_targets" ADD CONSTRAINT "ai_visibility_targets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."ai_visibility_targets" ADD CONSTRAINT "ai_visibility_targets_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "seo_ops"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."ai_visibility_targets" ADD CONSTRAINT "ai_visibility_targets_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "seo_ops"."keywords"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."ai_visibility_targets" ADD CONSTRAINT "ai_visibility_targets_project_page_id_project_pages_id_fk" FOREIGN KEY ("project_page_id") REFERENCES "seo_ops"."project_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."clusters" ADD CONSTRAINT "clusters_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."clusters" ADD CONSTRAINT "clusters_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."discovery_runs" ADD CONSTRAINT "discovery_runs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."discovery_runs" ADD CONSTRAINT "discovery_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."discovery_runs" ADD CONSTRAINT "discovery_runs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "seo_ops"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."discovery_runs" ADD CONSTRAINT "discovery_runs_plugin_job_run_id_plugin_job_runs_id_fk" FOREIGN KEY ("plugin_job_run_id") REFERENCES "public"."plugin_job_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."discovery_runs" ADD CONSTRAINT "discovery_runs_heartbeat_run_id_heartbeat_runs_id_fk" FOREIGN KEY ("heartbeat_run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."discovery_runs" ADD CONSTRAINT "discovery_runs_cost_event_id_cost_events_id_fk" FOREIGN KEY ("cost_event_id") REFERENCES "public"."cost_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."keyword_cluster_memberships" ADD CONSTRAINT "keyword_cluster_memberships_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."keyword_cluster_memberships" ADD CONSTRAINT "keyword_cluster_memberships_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."keyword_cluster_memberships" ADD CONSTRAINT "keyword_cluster_memberships_cluster_id_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "seo_ops"."clusters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."keyword_cluster_memberships" ADD CONSTRAINT "keyword_cluster_memberships_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "seo_ops"."keywords"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."keyword_observations" ADD CONSTRAINT "keyword_observations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."keyword_observations" ADD CONSTRAINT "keyword_observations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."keyword_observations" ADD CONSTRAINT "keyword_observations_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "seo_ops"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."keyword_observations" ADD CONSTRAINT "keyword_observations_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "seo_ops"."pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."keyword_observations" ADD CONSTRAINT "keyword_observations_project_page_id_project_pages_id_fk" FOREIGN KEY ("project_page_id") REFERENCES "seo_ops"."project_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."keyword_observations" ADD CONSTRAINT "keyword_observations_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "seo_ops"."keywords"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."keyword_observations" ADD CONSTRAINT "keyword_observations_discovery_run_id_discovery_runs_id_fk" FOREIGN KEY ("discovery_run_id") REFERENCES "seo_ops"."discovery_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."new_page_opportunities" ADD CONSTRAINT "new_page_opportunities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."new_page_opportunities" ADD CONSTRAINT "new_page_opportunities_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."new_page_opportunities" ADD CONSTRAINT "new_page_opportunities_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "seo_ops"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."new_page_opportunities" ADD CONSTRAINT "new_page_opportunities_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "seo_ops"."keywords"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."new_page_opportunities" ADD CONSTRAINT "new_page_opportunities_source_observation_id_keyword_observations_id_fk" FOREIGN KEY ("source_observation_id") REFERENCES "seo_ops"."keyword_observations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."new_page_opportunities" ADD CONSTRAINT "new_page_opportunities_current_page_id_pages_id_fk" FOREIGN KEY ("current_page_id") REFERENCES "seo_ops"."pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."new_page_opportunities" ADD CONSTRAINT "new_page_opportunities_current_project_page_id_project_pages_id_fk" FOREIGN KEY ("current_project_page_id") REFERENCES "seo_ops"."project_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."new_page_opportunities" ADD CONSTRAINT "new_page_opportunities_linked_issue_id_issues_id_fk" FOREIGN KEY ("linked_issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."page_action_events" ADD CONSTRAINT "page_action_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."page_action_events" ADD CONSTRAINT "page_action_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."page_action_events" ADD CONSTRAINT "page_action_events_project_page_id_project_pages_id_fk" FOREIGN KEY ("project_page_id") REFERENCES "seo_ops"."project_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."page_action_events" ADD CONSTRAINT "page_action_events_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."page_action_events" ADD CONSTRAINT "page_action_events_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."page_keyword_targets" ADD CONSTRAINT "page_keyword_targets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."page_keyword_targets" ADD CONSTRAINT "page_keyword_targets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."page_keyword_targets" ADD CONSTRAINT "page_keyword_targets_project_page_id_project_pages_id_fk" FOREIGN KEY ("project_page_id") REFERENCES "seo_ops"."project_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."page_keyword_targets" ADD CONSTRAINT "page_keyword_targets_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "seo_ops"."keywords"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."pages" ADD CONSTRAINT "pages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."pages" ADD CONSTRAINT "pages_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "seo_ops"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."pages" ADD CONSTRAINT "pages_last_discovery_run_id_discovery_runs_id_fk" FOREIGN KEY ("last_discovery_run_id") REFERENCES "seo_ops"."discovery_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."performance_snapshots" ADD CONSTRAINT "performance_snapshots_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."performance_snapshots" ADD CONSTRAINT "performance_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."performance_snapshots" ADD CONSTRAINT "performance_snapshots_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "seo_ops"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."performance_snapshots" ADD CONSTRAINT "performance_snapshots_project_page_id_project_pages_id_fk" FOREIGN KEY ("project_page_id") REFERENCES "seo_ops"."project_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."performance_snapshots" ADD CONSTRAINT "performance_snapshots_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "seo_ops"."keywords"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."performance_snapshots" ADD CONSTRAINT "performance_snapshots_page_keyword_target_id_page_keyword_targets_id_fk" FOREIGN KEY ("page_keyword_target_id") REFERENCES "seo_ops"."page_keyword_targets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."project_pages" ADD CONSTRAINT "project_pages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."project_pages" ADD CONSTRAINT "project_pages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."project_pages" ADD CONSTRAINT "project_pages_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "seo_ops"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."project_pages" ADD CONSTRAINT "project_pages_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "seo_ops"."pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."project_pages" ADD CONSTRAINT "project_pages_project_scope_id_project_scopes_id_fk" FOREIGN KEY ("project_scope_id") REFERENCES "seo_ops"."project_scopes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."project_scopes" ADD CONSTRAINT "project_scopes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."project_scopes" ADD CONSTRAINT "project_scopes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."project_scopes" ADD CONSTRAINT "project_scopes_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "seo_ops"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."rank_tracking_policies" ADD CONSTRAINT "rank_tracking_policies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."rank_tracking_policies" ADD CONSTRAINT "rank_tracking_policies_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."rank_tracking_targets" ADD CONSTRAINT "rank_tracking_targets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."rank_tracking_targets" ADD CONSTRAINT "rank_tracking_targets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."rank_tracking_targets" ADD CONSTRAINT "rank_tracking_targets_project_page_id_project_pages_id_fk" FOREIGN KEY ("project_page_id") REFERENCES "seo_ops"."project_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."rank_tracking_targets" ADD CONSTRAINT "rank_tracking_targets_page_keyword_target_id_page_keyword_targets_id_fk" FOREIGN KEY ("page_keyword_target_id") REFERENCES "seo_ops"."page_keyword_targets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."rank_tracking_targets" ADD CONSTRAINT "rank_tracking_targets_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "seo_ops"."keywords"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."rank_tracking_targets" ADD CONSTRAINT "rank_tracking_targets_policy_id_rank_tracking_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "seo_ops"."rank_tracking_policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."scope_conflicts" ADD CONSTRAINT "scope_conflicts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."scope_conflicts" ADD CONSTRAINT "scope_conflicts_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "seo_ops"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."scope_conflicts" ADD CONSTRAINT "scope_conflicts_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "seo_ops"."pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."scope_conflicts" ADD CONSTRAINT "scope_conflicts_resolved_by_agent_id_agents_id_fk" FOREIGN KEY ("resolved_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."scope_conflicts" ADD CONSTRAINT "scope_conflicts_linked_issue_id_issues_id_fk" FOREIGN KEY ("linked_issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_memberships" ADD CONSTRAINT "semantic_core_memberships_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_memberships" ADD CONSTRAINT "semantic_core_memberships_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_memberships" ADD CONSTRAINT "semantic_core_memberships_semantic_core_run_id_semantic_core_runs_id_fk" FOREIGN KEY ("semantic_core_run_id") REFERENCES "seo_ops"."semantic_core_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_memberships" ADD CONSTRAINT "semantic_core_memberships_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "seo_ops"."keywords"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_memberships" ADD CONSTRAINT "semantic_core_memberships_reviewed_by_agent_id_agents_id_fk" FOREIGN KEY ("reviewed_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_runs" ADD CONSTRAINT "semantic_core_runs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_core_runs" ADD CONSTRAINT "semantic_core_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_segment_keywords" ADD CONSTRAINT "semantic_segment_keywords_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_segment_keywords" ADD CONSTRAINT "semantic_segment_keywords_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_segment_keywords" ADD CONSTRAINT "semantic_segment_keywords_semantic_segment_id_semantic_segments_id_fk" FOREIGN KEY ("semantic_segment_id") REFERENCES "seo_ops"."semantic_segments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_segment_keywords" ADD CONSTRAINT "semantic_segment_keywords_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "seo_ops"."keywords"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_segments" ADD CONSTRAINT "semantic_segments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_segments" ADD CONSTRAINT "semantic_segments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."semantic_segments" ADD CONSTRAINT "semantic_segments_semantic_core_run_id_semantic_core_runs_id_fk" FOREIGN KEY ("semantic_core_run_id") REFERENCES "seo_ops"."semantic_core_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."serp_rank_observations" ADD CONSTRAINT "serp_rank_observations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."serp_rank_observations" ADD CONSTRAINT "serp_rank_observations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."serp_rank_observations" ADD CONSTRAINT "serp_rank_observations_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "seo_ops"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."serp_rank_observations" ADD CONSTRAINT "serp_rank_observations_project_page_id_project_pages_id_fk" FOREIGN KEY ("project_page_id") REFERENCES "seo_ops"."project_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."serp_rank_observations" ADD CONSTRAINT "serp_rank_observations_page_keyword_target_id_page_keyword_targets_id_fk" FOREIGN KEY ("page_keyword_target_id") REFERENCES "seo_ops"."page_keyword_targets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."serp_rank_observations" ADD CONSTRAINT "serp_rank_observations_rank_tracking_target_id_rank_tracking_targets_id_fk" FOREIGN KEY ("rank_tracking_target_id") REFERENCES "seo_ops"."rank_tracking_targets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."serp_rank_observations" ADD CONSTRAINT "serp_rank_observations_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "seo_ops"."keywords"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."serp_rank_observations" ADD CONSTRAINT "serp_rank_observations_serp_snapshot_id_serp_snapshots_id_fk" FOREIGN KEY ("serp_snapshot_id") REFERENCES "seo_ops"."serp_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."serp_snapshot_results" ADD CONSTRAINT "serp_snapshot_results_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."serp_snapshot_results" ADD CONSTRAINT "serp_snapshot_results_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."serp_snapshot_results" ADD CONSTRAINT "serp_snapshot_results_serp_snapshot_id_serp_snapshots_id_fk" FOREIGN KEY ("serp_snapshot_id") REFERENCES "seo_ops"."serp_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."serp_snapshot_results" ADD CONSTRAINT "serp_snapshot_results_matched_site_id_sites_id_fk" FOREIGN KEY ("matched_site_id") REFERENCES "seo_ops"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."serp_snapshot_results" ADD CONSTRAINT "serp_snapshot_results_matched_page_id_pages_id_fk" FOREIGN KEY ("matched_page_id") REFERENCES "seo_ops"."pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."serp_snapshots" ADD CONSTRAINT "serp_snapshots_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."serp_snapshots" ADD CONSTRAINT "serp_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."serp_snapshots" ADD CONSTRAINT "serp_snapshots_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "seo_ops"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."serp_snapshots" ADD CONSTRAINT "serp_snapshots_rank_tracking_target_id_rank_tracking_targets_id_fk" FOREIGN KEY ("rank_tracking_target_id") REFERENCES "seo_ops"."rank_tracking_targets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."serp_snapshots" ADD CONSTRAINT "serp_snapshots_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "seo_ops"."keywords"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."serp_snapshots" ADD CONSTRAINT "serp_snapshots_plugin_job_run_id_plugin_job_runs_id_fk" FOREIGN KEY ("plugin_job_run_id") REFERENCES "public"."plugin_job_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."serp_snapshots" ADD CONSTRAINT "serp_snapshots_heartbeat_run_id_heartbeat_runs_id_fk" FOREIGN KEY ("heartbeat_run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."serp_snapshots" ADD CONSTRAINT "serp_snapshots_cost_event_id_cost_events_id_fk" FOREIGN KEY ("cost_event_id") REFERENCES "public"."cost_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_ops"."sites" ADD CONSTRAINT "sites_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "seo_ops_ai_visibility_observations_identity_uq" ON "seo_ops"."ai_visibility_observations" USING btree ("identity_key");--> statement-breakpoint
CREATE INDEX "seo_ops_ai_visibility_observations_company_project_engine_snapshot_idx" ON "seo_ops"."ai_visibility_observations" USING btree ("company_id","project_id","answer_engine","snapshot_date");--> statement-breakpoint
CREATE INDEX "seo_ops_ai_visibility_observations_company_project_domain_mentioned_idx" ON "seo_ops"."ai_visibility_observations" USING btree ("company_id","project_id","target_domain_mentioned","snapshot_date");--> statement-breakpoint
CREATE INDEX "seo_ops_ai_visibility_observations_company_project_page_snapshot_idx" ON "seo_ops"."ai_visibility_observations" USING btree ("company_id","project_page_id","snapshot_date");--> statement-breakpoint
CREATE UNIQUE INDEX "seo_ops_ai_visibility_targets_identity_uq" ON "seo_ops"."ai_visibility_targets" USING btree ("identity_key");--> statement-breakpoint
CREATE INDEX "seo_ops_ai_visibility_targets_tracking_next_check_idx" ON "seo_ops"."ai_visibility_targets" USING btree ("tracking_status","next_check_at");--> statement-breakpoint
CREATE INDEX "seo_ops_ai_visibility_targets_company_project_engine_tracking_idx" ON "seo_ops"."ai_visibility_targets" USING btree ("company_id","project_id","answer_engine","tracking_status");--> statement-breakpoint
CREATE UNIQUE INDEX "seo_ops_clusters_company_project_external_cluster_uq" ON "seo_ops"."clusters" USING btree ("company_id","project_id","external_cluster_id") WHERE "seo_ops"."clusters"."external_cluster_id" is not null;--> statement-breakpoint
CREATE INDEX "seo_ops_clusters_company_project_layer_status_idx" ON "seo_ops"."clusters" USING btree ("company_id","project_id","layer","status");--> statement-breakpoint
CREATE INDEX "seo_ops_discovery_runs_company_source_started_idx" ON "seo_ops"."discovery_runs" USING btree ("company_id","source","started_at");--> statement-breakpoint
CREATE INDEX "seo_ops_discovery_runs_company_site_started_idx" ON "seo_ops"."discovery_runs" USING btree ("company_id","site_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "seo_ops_keyword_cluster_memberships_cluster_keyword_uq" ON "seo_ops"."keyword_cluster_memberships" USING btree ("company_id","project_id","cluster_id","keyword_id");--> statement-breakpoint
CREATE INDEX "seo_ops_keyword_cluster_memberships_company_project_keyword_idx" ON "seo_ops"."keyword_cluster_memberships" USING btree ("company_id","project_id","keyword_id");--> statement-breakpoint
CREATE INDEX "seo_ops_keyword_observations_company_project_observed_idx" ON "seo_ops"."keyword_observations" USING btree ("company_id","project_id","observed_at");--> statement-breakpoint
CREATE INDEX "seo_ops_keyword_observations_company_project_page_observed_idx" ON "seo_ops"."keyword_observations" USING btree ("company_id","project_page_id","observed_at");--> statement-breakpoint
CREATE INDEX "seo_ops_keyword_observations_company_keyword_source_observed_idx" ON "seo_ops"."keyword_observations" USING btree ("company_id","keyword_id","source","observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "seo_ops_keyword_observations_gsc_dedupe_uq" ON "seo_ops"."keyword_observations" USING btree ("company_id","project_id","page_id","normalized_query","source","date_from","date_to","country","device") WHERE "seo_ops"."keyword_observations"."source" = 'gsc';--> statement-breakpoint
CREATE UNIQUE INDEX "seo_ops_keywords_identity_uq" ON "seo_ops"."keywords" USING btree ("normalized_keyword","language_code","location_code","device_context");--> statement-breakpoint
CREATE UNIQUE INDEX "seo_ops_keywords_hash_uq" ON "seo_ops"."keywords" USING btree ("keyword_hash");--> statement-breakpoint
CREATE INDEX "seo_ops_keywords_locale_status_idx" ON "seo_ops"."keywords" USING btree ("language_code","location_code","status");--> statement-breakpoint
CREATE INDEX "seo_ops_new_page_opportunities_company_project_validation_priority_idx" ON "seo_ops"."new_page_opportunities" USING btree ("company_id","project_id","validation_status","suggested_priority");--> statement-breakpoint
CREATE INDEX "seo_ops_new_page_opportunities_company_keyword_idx" ON "seo_ops"."new_page_opportunities" USING btree ("company_id","keyword_id");--> statement-breakpoint
CREATE INDEX "seo_ops_page_action_events_company_project_page_occurred_idx" ON "seo_ops"."page_action_events" USING btree ("company_id","project_id","project_page_id","occurred_at");--> statement-breakpoint
CREATE INDEX "seo_ops_page_action_events_company_issue_idx" ON "seo_ops"."page_action_events" USING btree ("company_id","issue_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seo_ops_page_keyword_targets_page_keyword_type_uq" ON "seo_ops"."page_keyword_targets" USING btree ("company_id","project_id","project_page_id","keyword_id","target_type");--> statement-breakpoint
CREATE UNIQUE INDEX "seo_ops_page_keyword_targets_accepted_primary_uq" ON "seo_ops"."page_keyword_targets" USING btree ("company_id","project_id","project_page_id") WHERE "seo_ops"."page_keyword_targets"."is_primary" = true and "seo_ops"."page_keyword_targets"."status" = 'accepted';--> statement-breakpoint
CREATE INDEX "seo_ops_page_keyword_targets_company_project_tier_status_idx" ON "seo_ops"."page_keyword_targets" USING btree ("company_id","project_id","tier","status");--> statement-breakpoint
CREATE UNIQUE INDEX "seo_ops_pages_company_site_canonical_uq" ON "seo_ops"."pages" USING btree ("company_id","site_id","canonical_url_normalized");--> statement-breakpoint
CREATE UNIQUE INDEX "seo_ops_pages_company_site_url_hash_uq" ON "seo_ops"."pages" USING btree ("company_id","site_id","url_hash");--> statement-breakpoint
CREATE INDEX "seo_ops_pages_company_site_last_seen_idx" ON "seo_ops"."pages" USING btree ("company_id","site_id","last_seen_at");--> statement-breakpoint
CREATE INDEX "seo_ops_pages_company_site_discovery_status_idx" ON "seo_ops"."pages" USING btree ("company_id","site_id","discovery_status");--> statement-breakpoint
CREATE INDEX "seo_ops_performance_snapshots_company_project_date_idx" ON "seo_ops"."performance_snapshots" USING btree ("company_id","project_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "seo_ops_performance_snapshots_company_project_page_date_idx" ON "seo_ops"."performance_snapshots" USING btree ("company_id","project_page_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "seo_ops_performance_snapshots_company_keyword_date_idx" ON "seo_ops"."performance_snapshots" USING btree ("company_id","keyword_id","snapshot_date");--> statement-breakpoint
CREATE UNIQUE INDEX "seo_ops_project_pages_company_project_page_uq" ON "seo_ops"."project_pages" USING btree ("company_id","project_id","page_id");--> statement-breakpoint
CREATE INDEX "seo_ops_project_pages_company_project_monitoring_idx" ON "seo_ops"."project_pages" USING btree ("company_id","project_id","monitoring_status","seo_state");--> statement-breakpoint
CREATE INDEX "seo_ops_project_pages_company_site_page_idx" ON "seo_ops"."project_pages" USING btree ("company_id","site_id","page_id");--> statement-breakpoint
CREATE INDEX "seo_ops_project_scopes_company_project_status_idx" ON "seo_ops"."project_scopes" USING btree ("company_id","project_id","status");--> statement-breakpoint
CREATE INDEX "seo_ops_project_scopes_company_site_status_priority_idx" ON "seo_ops"."project_scopes" USING btree ("company_id","site_id","status","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "seo_ops_rank_tracking_policies_identity_uq" ON "seo_ops"."rank_tracking_policies" USING btree ("identity_key");--> statement-breakpoint
CREATE INDEX "seo_ops_rank_tracking_policies_company_project_status_idx" ON "seo_ops"."rank_tracking_policies" USING btree ("company_id","project_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "seo_ops_rank_tracking_targets_identity_uq" ON "seo_ops"."rank_tracking_targets" USING btree ("identity_key");--> statement-breakpoint
CREATE INDEX "seo_ops_rank_tracking_targets_tracking_next_check_idx" ON "seo_ops"."rank_tracking_targets" USING btree ("tracking_status","next_check_at");--> statement-breakpoint
CREATE INDEX "seo_ops_rank_tracking_targets_company_project_tracking_idx" ON "seo_ops"."rank_tracking_targets" USING btree ("company_id","project_id","tracking_status");--> statement-breakpoint
CREATE INDEX "seo_ops_scope_conflicts_company_status_created_idx" ON "seo_ops"."scope_conflicts" USING btree ("company_id","status","created_at");--> statement-breakpoint
CREATE INDEX "seo_ops_scope_conflicts_company_site_page_idx" ON "seo_ops"."scope_conflicts" USING btree ("company_id","site_id","page_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seo_ops_semantic_core_memberships_company_project_keyword_layer_uq" ON "seo_ops"."semantic_core_memberships" USING btree ("company_id","project_id","keyword_id","layer");--> statement-breakpoint
CREATE INDEX "seo_ops_semantic_core_memberships_company_project_layer_membership_idx" ON "seo_ops"."semantic_core_memberships" USING btree ("company_id","project_id","layer","membership");--> statement-breakpoint
CREATE UNIQUE INDEX "seo_ops_semantic_core_runs_company_project_run_uq" ON "seo_ops"."semantic_core_runs" USING btree ("company_id","project_id","mcp_run_id");--> statement-breakpoint
CREATE INDEX "seo_ops_semantic_core_runs_company_project_layer_imported_idx" ON "seo_ops"."semantic_core_runs" USING btree ("company_id","project_id","layer","imported_at");--> statement-breakpoint
CREATE UNIQUE INDEX "seo_ops_semantic_segment_keywords_segment_keyword_type_uq" ON "seo_ops"."semantic_segment_keywords" USING btree ("company_id","project_id","semantic_segment_id","keyword_id","relationship_type");--> statement-breakpoint
CREATE INDEX "seo_ops_semantic_segment_keywords_company_project_keyword_idx" ON "seo_ops"."semantic_segment_keywords" USING btree ("company_id","project_id","keyword_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seo_ops_semantic_segments_company_project_external_segment_uq" ON "seo_ops"."semantic_segments" USING btree ("company_id","project_id","external_segment_id") WHERE "seo_ops"."semantic_segments"."external_segment_id" is not null;--> statement-breakpoint
CREATE INDEX "seo_ops_semantic_segments_company_project_type_status_idx" ON "seo_ops"."semantic_segments" USING btree ("company_id","project_id","segment_type","status");--> statement-breakpoint
CREATE INDEX "seo_ops_semantic_segments_company_project_layer_intent_idx" ON "seo_ops"."semantic_segments" USING btree ("company_id","project_id","layer","intent_label");--> statement-breakpoint
CREATE UNIQUE INDEX "seo_ops_serp_rank_observations_identity_uq" ON "seo_ops"."serp_rank_observations" USING btree ("identity_key");--> statement-breakpoint
CREATE INDEX "seo_ops_serp_rank_observations_company_project_keyword_observed_idx" ON "seo_ops"."serp_rank_observations" USING btree ("company_id","project_id","keyword_id","observed_at");--> statement-breakpoint
CREATE INDEX "seo_ops_serp_rank_observations_company_project_page_observed_idx" ON "seo_ops"."serp_rank_observations" USING btree ("company_id","project_page_id","observed_at");--> statement-breakpoint
CREATE INDEX "seo_ops_serp_rank_observations_company_project_visibility_date_idx" ON "seo_ops"."serp_rank_observations" USING btree ("company_id","project_id","visibility_state","snapshot_date");--> statement-breakpoint
CREATE UNIQUE INDEX "seo_ops_serp_snapshot_results_snapshot_position_type_uq" ON "seo_ops"."serp_snapshot_results" USING btree ("serp_snapshot_id","result_position","result_type");--> statement-breakpoint
CREATE INDEX "seo_ops_serp_snapshot_results_company_project_domain_idx" ON "seo_ops"."serp_snapshot_results" USING btree ("company_id","project_id","result_domain");--> statement-breakpoint
CREATE INDEX "seo_ops_serp_snapshot_results_company_project_matched_page_idx" ON "seo_ops"."serp_snapshot_results" USING btree ("company_id","project_id","matched_page_id","serp_snapshot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seo_ops_serp_snapshots_request_fingerprint_uq" ON "seo_ops"."serp_snapshots" USING btree ("request_fingerprint");--> statement-breakpoint
CREATE INDEX "seo_ops_serp_snapshots_company_project_date_idx" ON "seo_ops"."serp_snapshots" USING btree ("company_id","project_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "seo_ops_serp_snapshots_company_project_keyword_observed_idx" ON "seo_ops"."serp_snapshots" USING btree ("company_id","project_id","keyword_id","observed_at");--> statement-breakpoint
CREATE INDEX "seo_ops_serp_snapshots_context_date_idx" ON "seo_ops"."serp_snapshots" USING btree ("company_id","project_id","provider","search_engine","geo","language_code","device_context","snapshot_date");--> statement-breakpoint
CREATE UNIQUE INDEX "seo_ops_sites_company_domain_uq" ON "seo_ops"."sites" USING btree ("company_id","domain");--> statement-breakpoint
CREATE INDEX "seo_ops_sites_company_status_idx" ON "seo_ops"."sites" USING btree ("company_id","status");--> statement-breakpoint
