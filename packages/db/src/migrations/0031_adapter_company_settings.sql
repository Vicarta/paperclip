CREATE TABLE "adapter_company_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "adapter_type" text NOT NULL,
  "settings_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "last_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "adapter_company_settings" ADD CONSTRAINT "adapter_company_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "adapter_company_settings_company_idx" ON "adapter_company_settings" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX "adapter_company_settings_adapter_type_idx" ON "adapter_company_settings" USING btree ("adapter_type");
--> statement-breakpoint
CREATE UNIQUE INDEX "adapter_company_settings_company_adapter_type_uq" ON "adapter_company_settings" USING btree ("company_id","adapter_type");
