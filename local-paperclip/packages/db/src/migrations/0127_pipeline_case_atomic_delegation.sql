CREATE UNIQUE INDEX IF NOT EXISTS "issues_pipeline_case_delegation_uq"
  ON "issues" USING btree ("company_id", "origin_kind", "origin_id", "origin_fingerprint")
  WHERE "origin_kind" = 'pipeline_case_delegation'
    AND "origin_id" IS NOT NULL
    AND "origin_fingerprint" <> 'default';
