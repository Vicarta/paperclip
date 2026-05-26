CREATE TABLE IF NOT EXISTS "seo_ops"."indexing_inspection_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid,
	"site_id" uuid NOT NULL,
	"page_id" uuid,
	"project_page_id" uuid,
	"discovery_run_id" uuid,
	"url" text NOT NULL,
	"url_normalized" text NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"provider" text DEFAULT 'google_search_console' NOT NULL,
	"verdict" text,
	"coverage_state" text,
	"indexing_state" text,
	"page_fetch_state" text,
	"robots_txt_state" text,
	"google_canonical" text,
	"user_canonical" text,
	"last_crawl_time" timestamp with time zone,
	"inspection_result_link" text,
	"cache_hit" boolean DEFAULT false NOT NULL,
	"api_call_made" boolean DEFAULT false NOT NULL,
	"quota_units" numeric,
	"normalized_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"raw_payload_ref" text,
	"raw_payload_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "seo_ops"."page_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid,
	"site_id" uuid NOT NULL,
	"page_id" uuid,
	"project_page_id" uuid,
	"source" text NOT NULL,
	"finding_type" text NOT NULL,
	"problem_class" text NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"fingerprint" text NOT NULL,
	"latest_snapshot_id" uuid,
	"linked_issue_id" uuid,
	"evidence_summary" text,
	"evidence_refs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"policy_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."indexing_inspection_snapshots" ADD CONSTRAINT "seo_ops_indexing_snapshots_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."indexing_inspection_snapshots" ADD CONSTRAINT "seo_ops_indexing_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."indexing_inspection_snapshots" ADD CONSTRAINT "seo_ops_indexing_snapshots_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "seo_ops"."sites"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."indexing_inspection_snapshots" ADD CONSTRAINT "seo_ops_indexing_snapshots_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "seo_ops"."pages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."indexing_inspection_snapshots" ADD CONSTRAINT "seo_ops_indexing_snapshots_project_page_id_project_pages_id_fk" FOREIGN KEY ("project_page_id") REFERENCES "seo_ops"."project_pages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."indexing_inspection_snapshots" ADD CONSTRAINT "seo_ops_indexing_snapshots_discovery_run_id_discovery_runs_id_fk" FOREIGN KEY ("discovery_run_id") REFERENCES "seo_ops"."discovery_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."page_findings" ADD CONSTRAINT "seo_ops_page_findings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."page_findings" ADD CONSTRAINT "seo_ops_page_findings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."page_findings" ADD CONSTRAINT "seo_ops_page_findings_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "seo_ops"."sites"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."page_findings" ADD CONSTRAINT "seo_ops_page_findings_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "seo_ops"."pages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."page_findings" ADD CONSTRAINT "seo_ops_page_findings_project_page_id_project_pages_id_fk" FOREIGN KEY ("project_page_id") REFERENCES "seo_ops"."project_pages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."page_findings" ADD CONSTRAINT "seo_ops_page_findings_latest_snapshot_id_indexing_snapshots_id_fk" FOREIGN KEY ("latest_snapshot_id") REFERENCES "seo_ops"."indexing_inspection_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_ops"."page_findings" ADD CONSTRAINT "seo_ops_page_findings_linked_issue_id_issues_id_fk" FOREIGN KEY ("linked_issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "seo_ops_indexing_snapshots_discovery_url_uq" ON "seo_ops"."indexing_inspection_snapshots" USING btree ("company_id","discovery_run_id","url_normalized");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seo_ops_indexing_snapshots_company_site_checked_idx" ON "seo_ops"."indexing_inspection_snapshots" USING btree ("company_id","site_id","checked_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seo_ops_indexing_snapshots_company_page_checked_idx" ON "seo_ops"."indexing_inspection_snapshots" USING btree ("company_id","page_id","checked_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seo_ops_indexing_snapshots_project_page_checked_idx" ON "seo_ops"."indexing_inspection_snapshots" USING btree ("project_page_id","checked_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seo_ops_indexing_snapshots_verdict_idx" ON "seo_ops"."indexing_inspection_snapshots" USING btree ("company_id","verdict","coverage_state");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "seo_ops_page_findings_company_fingerprint_uq" ON "seo_ops"."page_findings" USING btree ("company_id","fingerprint");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seo_ops_page_findings_company_status_severity_idx" ON "seo_ops"."page_findings" USING btree ("company_id","status","severity");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seo_ops_page_findings_project_page_status_idx" ON "seo_ops"."page_findings" USING btree ("project_page_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seo_ops_page_findings_company_problem_idx" ON "seo_ops"."page_findings" USING btree ("company_id","finding_type","problem_class","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seo_ops_page_findings_linked_issue_idx" ON "seo_ops"."page_findings" USING btree ("linked_issue_id");
