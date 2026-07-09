import { Router } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@paperclipai/db";
import { badRequest } from "../errors.js";
import { assertCompanyAccess } from "./authz.js";

type JsonRecord = Record<string, unknown>;

type DueUrlRow = {
  page_id: string;
  project_page_id: string;
  company_id: string;
  project_id: string;
  site_id: string;
  url: string;
  url_normalized: string;
  path: string;
  page_type: string | null;
  title: string | null;
  project_page_priority: number;
  monitoring_status: string;
  last_seen_at: Date | string | null;
};

type PageLookupRow = {
  page_id: string | null;
  project_page_id: string | null;
  site_id: string | null;
};

const uuidSchema = z.string().uuid();

const inspectionImportSchema = z.object({
  companyId: uuidSchema,
  projectId: uuidSchema.nullable().optional(),
  siteId: uuidSchema.nullable().optional(),
  input: z.record(z.unknown()).optional().default({}),
  summary: z.record(z.unknown()).optional().default({}),
  results: z.array(z.record(z.unknown())).default([]),
});

type ImportResult = z.infer<typeof inspectionImportSchema>["results"][number];

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function bool(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function timestampOrNull(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeUrl(value: unknown) {
  const raw = text(value);
  return raw.replace(/\/+$/, "") || raw;
}

function findingProblem(result: ImportResult) {
  const normalizedPayload = record(result.normalizedPayload);
  const explicit = text(normalizedPayload.problemClass) || text(result.problemClass);
  if (explicit) return explicit;

  const coverageState = text(result.coverageState).toLowerCase();
  const verdict = text(result.verdict).toUpperCase();
  if (verdict === "PASS") return null;
  if (coverageState.includes("unknown")) return "unknown_to_google";
  if (coverageState.includes("not indexed")) return "not_indexed";
  if (coverageState.includes("duplicate")) return "duplicate_without_user_selected_canonical";
  if (coverageState.includes("alternate")) return "alternate_with_canonical";
  if (coverageState.includes("soft 404")) return "soft_404";
  return verdict && verdict !== "PASS" ? "non_pass_indexing_verdict" : null;
}

function shouldCreateFinding(result: ImportResult) {
  const normalizedPayload = record(result.normalizedPayload);
  const problem = findingProblem(result);
  if (!problem) return false;
  const actionability = text(normalizedPayload.actionability);
  if (actionability === "none" || actionability === "ok") return false;
  return text(result.verdict).toUpperCase() !== "PASS";
}

function findingTypeFor(problemClass: string) {
  if (problemClass === "unknown_gsc_state") return "indexing:unknown_to_google";
  return `indexing:${problemClass}`;
}

function severityFor(problemClass: string) {
  if (problemClass === "soft_404" || problemClass.includes("noindex")) return "high";
  return "medium";
}

function jsonb(value: unknown) {
  return JSON.stringify(value ?? {});
}

export function seoOpsRoutes(db: Db) {
  const router = Router();

  router.get("/seo/indexing/due-urls", async (req, res) => {
    const companyId = uuidSchema.safeParse(req.query.companyId);
    if (!companyId.success) throw badRequest("companyId is required");
    assertCompanyAccess(req, companyId.data);

    const projectId = uuidSchema.safeParse(req.query.projectId);
    if (!projectId.success) throw badRequest("projectId is required");

    const rawLimit = Number(req.query.limit ?? 50);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 500) : 50;

    const rows = Array.from(await db.execute(sql<DueUrlRow>`
      select
        p.id as page_id,
        pp.id as project_page_id,
        p.company_id,
        pp.project_id,
        p.site_id,
        p.canonical_url as url,
        p.canonical_url_normalized as url_normalized,
        p.path,
        coalesce(pp.primary_page_type, p.page_type) as page_type,
        p.title,
        pp.priority as project_page_priority,
        pp.monitoring_status,
        p.last_seen_at
      from seo_ops.project_pages pp
      join seo_ops.pages p
        on p.id = pp.page_id
       and p.company_id = pp.company_id
       and p.site_id = pp.site_id
      where pp.company_id = ${companyId.data}
        and pp.project_id = ${projectId.data}
        and pp.monitoring_status = 'active'
        and p.discovery_status <> 'gone'
      order by pp.priority desc, p.last_seen_at asc nulls first, p.canonical_url_normalized asc
      limit ${limit}
    `));

    res.json({
      items: rows.map((row) => ({
        pageId: row.page_id,
        projectPageId: row.project_page_id,
        companyId: row.company_id,
        projectId: row.project_id,
        siteId: row.site_id,
        url: row.url,
        urlNormalized: row.url_normalized,
        path: row.path,
        pageType: row.page_type,
        title: row.title,
        projectPagePriority: row.project_page_priority,
        monitoringStatus: row.monitoring_status,
        lastSeenAt: row.last_seen_at instanceof Date ? row.last_seen_at.toISOString() : row.last_seen_at,
      })),
      count: rows.length,
      source: "seo_ops.pages/project_pages",
    });
  });

  router.post("/seo/indexing/inspection-results/import", async (req, res) => {
    const parsed = inspectionImportSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest("Invalid indexing inspection import payload", parsed.error.flatten());
    const input = parsed.data;
    assertCompanyAccess(req, input.companyId);

    const source = text(input.input.source, "gsc_indexing_audit") || "gsc_indexing_audit";
    const [run] = Array.from(await db.execute(sql<{ id: string }>`
      insert into seo_ops.discovery_runs (
        company_id,
        project_id,
        site_id,
        source,
        status,
        started_at,
        finished_at,
        input,
        summary,
        heartbeat_run_id
      )
      values (
        ${input.companyId},
        ${input.projectId ?? null},
        ${input.siteId ?? null},
        ${source},
        'completed',
        now(),
        now(),
        ${jsonb(input.input)}::jsonb,
        ${jsonb(input.summary)}::jsonb,
        null
      )
      returning id
    `));

    const findingTypeCounts: Record<string, number> = {};
    let snapshotCount = 0;
    let findingCount = 0;

    for (const rawResult of input.results) {
      const result = rawResult as ImportResult;
      const url = text(result.url);
      if (!url) continue;
      const urlNormalized = normalizeUrl(result.urlNormalized || result.url);
      const normalizedPayload = record(result.normalizedPayload);

      const [lookup] = Array.from(await db.execute(sql<PageLookupRow>`
        select
          p.id as page_id,
          pp.id as project_page_id,
          p.site_id
        from seo_ops.pages p
        left join seo_ops.project_pages pp
          on pp.page_id = p.id
         and pp.company_id = p.company_id
         and (${input.projectId ?? null}::uuid is null or pp.project_id = ${input.projectId ?? null})
        where p.company_id = ${input.companyId}
          and p.canonical_url_normalized = ${urlNormalized}
        order by pp.priority desc nulls last
        limit 1
      `));

      const siteId = text(result.siteId) || input.siteId || lookup?.site_id;
      if (!siteId) throw badRequest(`siteId is required for ${url}`);

      const snapshotRows = Array.from(await db.execute(sql<{ id: string }>`
        insert into seo_ops.indexing_inspection_snapshots (
          company_id,
          project_id,
          site_id,
          page_id,
          project_page_id,
          discovery_run_id,
          url,
          url_normalized,
          checked_at,
          provider,
          verdict,
          coverage_state,
          indexing_state,
          page_fetch_state,
          robots_txt_state,
          google_canonical,
          user_canonical,
          last_crawl_time,
          inspection_result_link,
          cache_hit,
          api_call_made,
          quota_units,
          normalized_payload,
          raw_payload_ref,
          raw_payload_hash
        )
        values (
          ${input.companyId},
          ${input.projectId ?? null},
          ${siteId},
          ${text(result.pageId) || lookup?.page_id || null},
          ${text(result.projectPageId) || lookup?.project_page_id || null},
          ${run?.id ?? null},
          ${url},
          ${urlNormalized},
          ${timestampOrNull(result.checkedAt) ?? new Date().toISOString()},
          ${text(result.provider, "google_search_console") || "google_search_console"},
          ${text(result.verdict) || null},
          ${text(result.coverageState) || null},
          ${text(result.indexingState) || null},
          ${text(result.pageFetchState) || null},
          ${text(result.robotsTxtState) || null},
          ${text(result.googleCanonical) || null},
          ${text(result.userCanonical) || null},
          ${timestampOrNull(result.lastCrawlTime)},
          ${text(result.inspectionResultLink) || null},
          ${bool(result.cacheHit, false)},
          ${bool(result.apiCallMade, false)},
          ${numberOrNull(result.quotaUnits)},
          ${jsonb(normalizedPayload)}::jsonb,
          ${text(result.rawPayloadRef) || null},
          ${text(result.rawPayloadHash) || null}
        )
        on conflict (company_id, discovery_run_id, url_normalized)
        do update set
          checked_at = excluded.checked_at,
          provider = excluded.provider,
          verdict = excluded.verdict,
          coverage_state = excluded.coverage_state,
          indexing_state = excluded.indexing_state,
          page_fetch_state = excluded.page_fetch_state,
          robots_txt_state = excluded.robots_txt_state,
          google_canonical = excluded.google_canonical,
          user_canonical = excluded.user_canonical,
          last_crawl_time = excluded.last_crawl_time,
          inspection_result_link = excluded.inspection_result_link,
          cache_hit = excluded.cache_hit,
          api_call_made = excluded.api_call_made,
          quota_units = excluded.quota_units,
          normalized_payload = excluded.normalized_payload,
          raw_payload_ref = excluded.raw_payload_ref,
          raw_payload_hash = excluded.raw_payload_hash
        returning id
      `));
      const snapshotId = snapshotRows[0]?.id ?? null;
      snapshotCount += snapshotId ? 1 : 0;

      const problemClass = findingProblem(result);
      if (!problemClass || !shouldCreateFinding(result)) continue;
      const findingType = findingTypeFor(problemClass);
      const fingerprint = [
        input.projectId ?? "global",
        urlNormalized,
        findingType,
        problemClass,
      ].join(":");
      const evidenceSummary = [
        text(result.coverageState),
        text(result.indexingState),
        text(result.verdict),
      ].filter(Boolean).join(" | ") || `GSC indexing finding for ${url}`;

      const findingRows = Array.from(await db.execute(sql<{ id: string }>`
        insert into seo_ops.page_findings (
          company_id,
          project_id,
          site_id,
          page_id,
          project_page_id,
          source,
          finding_type,
          problem_class,
          severity,
          status,
          first_seen_at,
          last_seen_at,
          fingerprint,
          latest_snapshot_id,
          evidence_summary,
          evidence_refs,
          policy_snapshot,
          updated_at
        )
        values (
          ${input.companyId},
          ${input.projectId ?? null},
          ${siteId},
          ${text(result.pageId) || lookup?.page_id || null},
          ${text(result.projectPageId) || lookup?.project_page_id || null},
          ${source},
          ${findingType},
          ${problemClass},
          ${severityFor(problemClass)},
          'open',
          now(),
          now(),
          ${fingerprint},
          ${snapshotId},
          ${evidenceSummary},
          ${jsonb({ url, urlNormalized, snapshotId })}::jsonb,
          ${jsonb({ source: "seo_ops_indexing_import_v1" })}::jsonb,
          now()
        )
        on conflict (company_id, fingerprint)
        do update set
          last_seen_at = now(),
          latest_snapshot_id = excluded.latest_snapshot_id,
          evidence_summary = excluded.evidence_summary,
          evidence_refs = excluded.evidence_refs,
          policy_snapshot = excluded.policy_snapshot,
          status = case
            when seo_ops.page_findings.status = 'resolved' then 'open'
            else seo_ops.page_findings.status
          end,
          updated_at = now()
        returning id
      `));
      if (findingRows[0]?.id) {
        findingCount += 1;
        findingTypeCounts[findingType] = (findingTypeCounts[findingType] ?? 0) + 1;
      }
    }

    await db.execute(sql`
      update seo_ops.discovery_runs
      set summary = ${jsonb({ ...input.summary, snapshotCount, findingCount, findingTypeCounts })}::jsonb
      where id = ${run?.id ?? null}
    `);

    res.json({
      discoveryRunId: run?.id ?? null,
      snapshotCount,
      findingCount,
      findingTypeCounts,
    });
  });

  return router;
}
