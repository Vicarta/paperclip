ALTER TABLE "company_secrets" ADD COLUMN IF NOT EXISTS "key" text;
UPDATE "company_secrets"
SET "key" = lower(regexp_replace(coalesce(nullif(trim("name"), ''), "id"::text), '[^a-zA-Z0-9_.-]+', '-', 'g'))
WHERE "key" IS NULL OR trim("key") = '';
ALTER TABLE "company_secrets" ALTER COLUMN "key" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "company_secrets" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active' NOT NULL;
--> statement-breakpoint
ALTER TABLE "company_secrets" ADD COLUMN IF NOT EXISTS "managed_mode" text DEFAULT 'paperclip_managed' NOT NULL;
--> statement-breakpoint
ALTER TABLE "company_secrets" ADD COLUMN IF NOT EXISTS "provider_config_id" uuid;
--> statement-breakpoint
ALTER TABLE "company_secrets" ADD COLUMN IF NOT EXISTS "provider_metadata" jsonb;
--> statement-breakpoint
ALTER TABLE "company_secrets" ADD COLUMN IF NOT EXISTS "last_resolved_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "company_secrets" ADD COLUMN IF NOT EXISTS "last_rotated_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "company_secrets" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "company_secret_versions" ADD COLUMN IF NOT EXISTS "provider_version_ref" text;
--> statement-breakpoint
ALTER TABLE "company_secret_versions" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'current' NOT NULL;
--> statement-breakpoint
ALTER TABLE "company_secret_versions" ADD COLUMN IF NOT EXISTS "fingerprint_sha256" text;
UPDATE "company_secret_versions"
SET "fingerprint_sha256" = "value_sha256"
WHERE "fingerprint_sha256" IS NULL OR trim("fingerprint_sha256") = '';
ALTER TABLE "company_secret_versions" ALTER COLUMN "fingerprint_sha256" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "company_secret_versions" ADD COLUMN IF NOT EXISTS "rotation_job_id" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_secrets_company_key_uq" ON "company_secrets" USING btree ("company_id","key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_secrets_provider_config_idx" ON "company_secrets" USING btree ("provider_config_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_secret_versions_fingerprint_idx" ON "company_secret_versions" USING btree ("fingerprint_sha256");
