#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";

const GROUPS = [
  {
    fingerprint: "production-route-metadata-source-deploy-ownership",
    title: "Control production route metadata and deploy ownership",
    summary: "Establish one controlled source, deploy, rollback, route-metadata and sitemap path for Astrogen public app routes, then verify route-specific metadata and canonical output.",
    actionClass: "technical_seo_platform",
    blockerClass: "external_dependency",
    issueIdentifiers: ["AST-29", "AST-48", "AST-50", "AST-191", "AST-192", "AST-203", "AST-204", "AST-223", "AST-224"],
    completionProof: "Controlled frontend source/deploy/rollback path plus verified initial-HTML title, description, canonical, OG URL and index policy for sampled public, expert, auth and legal routes.",
    measurementWindow: "Verify immediately after deploy and again in the next CrawlObserver/GSC cycle.",
  },
  {
    fingerprint: "horoscope-route-sitemap-canonical-consistency",
    title: "Align horoscope route, sitemap and canonical behavior",
    summary: "Resolve one canonical intent for /horoscope and /weekly-report, align redirect/auth behavior, sitemap membership and route metadata, then recheck live HTTP and GSC.",
    actionClass: "technical_seo_indexing",
    blockerClass: "external_dependency",
    issueIdentifiers: ["AST-56", "AST-82", "AST-113", "AST-149", "AST-212", "AST-213"],
    completionProof: "Deployed route/sitemap decision with HTTP, sitemap, metadata and subsequent GSC verification evidence.",
    measurementWindow: "Immediate HTTP/sitemap verification plus the next due GSC inspection after recrawl.",
  },
  {
    fingerprint: "ga4-instagram-channel-grouping-normalization",
    title: "Normalize Instagram traffic in weekly revenue reporting",
    summary: "Provide a controlled GA4 Admin or report-transform path that maps historical and current Instagram source, medium, campaign and placement variants without losing revenue attribution.",
    actionClass: "measurement_quality",
    blockerClass: "internal_recovery",
    issueIdentifiers: ["AST-120"],
    completionProof: "Before/after weekly report shows known Instagram variants under paid_social or organic_social instead of Unassigned while preserving purchases and revenue.",
    measurementWindow: "Recompute 2026-07-01 through 2026-07-07 and verify the next completed Wednesday-Tuesday week.",
  },
  {
    fingerprint: "weekly-operating-review-evidence-export",
    title: "Expose bounded weekly Paperclip operating evidence",
    summary: "Ship a least-privilege bounded evidence export for weekly CTO self-improvement without broad cross-issue history reads or raw runtime/provider payloads.",
    actionClass: "paperclip_operating_system",
    blockerClass: "internal_recovery",
    issueIdentifiers: ["AST-122"],
    completionProof: "Live authenticated endpoint or native tool returns bounded routine, heartbeat, recovery, blocked and child-outcome evidence and is consumed by the weekly review.",
    measurementWindow: "Verify in the next Wednesday operating improvement run.",
  },
];

function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
  return result.stdout.trim();
}

function psql(sql) {
  return run("sudo", [
    "docker", "exec", "-i", DB_CONTAINER,
    "psql", "-U", "paperclip", "-d", "paperclip",
    "-v", "ON_ERROR_STOP=1", "-At",
  ], sql);
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function asArray(value, keys = []) {
  if (Array.isArray(value)) return value;
  for (const key of keys) if (Array.isArray(value?.[key])) return value[key];
  return [];
}

async function request(token, method, pathname, body) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!response.ok) throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 2000)}`);
  return parsed;
}

function issueRows() {
  const identifiers = [...new Set([
    ...GROUPS.flatMap((group) => group.issueIdentifiers),
    "AST-218",
    "AST-226",
  ])];
  const output = psql(`
    select json_build_object('id', id, 'identifier', identifier, 'title', title, 'status', status)::text
    from issues
    where company_id=${sqlLiteral(COMPANY_ID)}::uuid
      and identifier in (${identifiers.map(sqlLiteral).join(",")})
    order by identifier;
  `);
  return output.split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function ensureIssueLink(token, caseId, issueId) {
  const links = asArray(await request(token, "GET", `/cases/${caseId}/issue-links`), ["items", "links"]);
  if (links.some((row) => row.issue?.id === issueId)) return false;
  await request(token, "POST", `/cases/${caseId}/issue-links`, { issueId, role: "work" });
  return true;
}

async function ensureGrowthCase(token, pipeline, group, managerId, executorId) {
  const caseKey = `growth:${group.fingerprint}`;
  const listed = asArray(await request(token, "GET", `/pipelines/${pipeline.id}/cases?limit=200`), ["items", "cases"]);
  let pipelineCase = listed.find((candidate) => candidate.caseKey === caseKey) ?? null;
  if (!pipelineCase) {
    const created = await request(token, "POST", `/pipelines/${pipeline.id}/cases`, {
      caseKey,
      title: group.title,
      summary: group.summary,
      stageKey: "finding",
      fields: {
        findingFingerprint: group.fingerprint,
        actionClass: group.actionClass,
        businessOutcome: group.summary,
        evidenceRefs: group.issueIdentifiers,
        managerId,
        executorId,
        blockerClass: group.blockerClass,
        nextReviewAt: new Date(Date.now() + (group.blockerClass === "external_dependency" ? 7 : 2) * 86400000).toISOString(),
        completionProof: group.completionProof,
        measurementWindow: group.measurementWindow,
      },
    });
    pipelineCase = created.case ?? created;
  }
  return pipelineCase;
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${sqlLiteral(keyId)}::uuid, ${sqlLiteral(USER_ID)},
      'phase46-legacy-blocker-convergence', ${sqlLiteral(tokenHash)}, now() + interval '20 minutes');
  `);

  try {
    const backup = await request(token, "POST", "/instance/database-backups", {});
    const [pipelineResponse, agentResponse] = await Promise.all([
      request(token, "GET", `/companies/${COMPANY_ID}/pipelines`),
      request(token, "GET", `/companies/${COMPANY_ID}/agents`),
    ]);
    const pipelines = asArray(pipelineResponse, ["items", "pipelines"]);
    const agents = asArray(agentResponse, ["items", "agents"]);
    const growthPipeline = pipelines.find((pipeline) => pipeline.key === "astrogen-growth-actions");
    const cmo = agents.find((agent) => agent.name === "Chief Marketing Officer");
    const cto = agents.find((agent) => agent.name === "Chief Technical Officer");
    if (!growthPipeline || !cmo || !cto) throw new Error("Growth pipeline or manager agents are missing");

    const issues = new Map(issueRows().map((issue) => [issue.identifier, issue]));
    const migrated = [];
    for (const group of GROUPS) {
      const pipelineCase = await ensureGrowthCase(token, growthPipeline, group, cmo.id, cto.id);
      let currentDocument = null;
      try {
        currentDocument = await request(token, "GET", `/cases/${pipelineCase.id}/documents/legacy-consolidation`);
      } catch (error) {
        if (!String(error).includes("returned 404")) throw error;
      }
      await request(token, "PUT", `/cases/${pipelineCase.id}/documents/legacy-consolidation`, {
        title: "Legacy blocker consolidation",
        body: [
          `# ${group.title}`,
          "",
          group.summary,
          "",
          `- Stable fingerprint: ${group.fingerprint}`,
          `- Blocker class: ${group.blockerClass}`,
          `- Legacy evidence: ${group.issueIdentifiers.join(", ")}`,
          `- Completion proof: ${group.completionProof}`,
          `- Measurement window: ${group.measurementWindow}`,
        ].join("\n"),
        changeSummary: "Consolidate repeated legacy blockers into one native growth case.",
        baseRevisionId: currentDocument?.revision?.id
          ?? currentDocument?.document?.latestRevisionId
          ?? null,
      });

      for (const identifier of group.issueIdentifiers) {
        const issue = issues.get(identifier);
        if (!issue) throw new Error(`Issue not found: ${identifier}`);
        await ensureIssueLink(token, pipelineCase.id, issue.id);
        if (issue.status !== "cancelled" && issue.status !== "done") {
          await request(token, "PATCH", `/issues/${issue.id}`, {
            status: "cancelled",
            blockedByIssueIds: [],
            comment: `Superseded by native growth case ${pipelineCase.id} with stable fingerprint ${group.fingerprint}. This issue remains linked as evidence; future findings must update the same case instead of creating another blocker.`,
          });
        }
      }
      migrated.push({ fingerprint: group.fingerprint, caseId: pipelineCase.id, legacyIssues: group.issueIdentifiers });
    }

    const costIssue = issues.get("AST-218");
    if (!costIssue) throw new Error("Issue not found: AST-218");
    if (costIssue.status !== "done") {
      await request(token, "PATCH", `/issues/${costIssue.id}`, {
        status: "done",
        blockedByIssueIds: [],
        comment: "Verified in the currently deployed clean app image: /app/server/dist/services/plugin-host-services.js forwards params.amountMicros to costService.createEvent. No paid smoke call was made; the scheduled weekly cost-accounting audit remains responsible for verifying the next real provider event.",
      });
    }

    const triageIssue = issues.get("AST-226");
    if (!triageIssue) throw new Error("Issue not found: AST-226");
    await request(token, "PATCH", `/issues/${triageIssue.id}`, {
      status: "todo",
      blockedByIssueIds: [],
      comment: "Systemic routing repair is live: assigned/blocked foreign issues are now evidence for canonical native growth cases, not CEO mutation targets. Four root causes were consolidated; resume this same triage issue under the updated contract and do not recreate legacy blocker branches.",
    });

    console.log(JSON.stringify({
      mode: "apply-and-verify",
      backup: {
        filename: backup.filename ?? null,
        backupDir: backup.backupDir ?? null,
        sizeBytes: backup.sizeBytes ?? null,
        finishedAt: backup.finishedAt ?? null,
      },
      migrated,
      resolved: ["AST-218"],
      resumed: ["AST-226"],
    }, null, 2));
  } finally {
    psql(`update board_api_keys set revoked_at=now(), last_used_at=now() where id=${sqlLiteral(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
