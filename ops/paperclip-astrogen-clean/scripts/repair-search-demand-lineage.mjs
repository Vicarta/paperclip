#!/usr/bin/env node
/**
 * Expires lineage-invalid legacy ready topics and resumes the existing W29
 * refill after scoped search-demand write access has been converged.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const REFILL_ISSUE_ID = "a671745a-2eb9-4199-bf2e-d095c7453984";
const CANONICAL_REFILL_KEY = "growth:topic-inventory-refill:2026-W29";

function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
  return result.stdout.trim();
}

function psql(sql) {
  return run("sudo", ["docker", "exec", "-i", DB_CONTAINER, "psql", "-U", "paperclip", "-d", "paperclip", "-v", "ON_ERROR_STOP=1", "-At"], sql);
}

function q(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function rows(sql) {
  const output = psql(sql);
  return output ? output.split("\n").filter(Boolean).map((line) => JSON.parse(line)) : [];
}

function legacyReadyTopics() {
  return rows(`
    select json_build_object(
      'id', pc.id,
      'caseKey', pc.case_key,
      'title', pc.title,
      'version', pc.version
    )::text
    from pipeline_cases pc
    join pipelines p on p.id=pc.pipeline_id
    join pipeline_stages ps on ps.id=pc.stage_id
    left join pipeline_cases parent on parent.id=pc.parent_case_id
    left join pipelines parent_pipeline on parent_pipeline.id=parent.pipeline_id
    where pc.company_id=${q(COMPANY_ID)}::uuid
      and p.key='astrogen-topic-inventory'
      and ps.key='ready'
      and pc.terminal_kind is null
      and pc.hidden_from_board_at is null
      and (
        coalesce(pc.fields->>'selectedAction','') <> 'new_article'
        or parent_pipeline.key is distinct from 'astrogen-search-demand-opportunities'
      )
    order by pc.created_at;
  `);
}

function opportunityPipelineId() {
  return psql(`select id from pipelines where company_id=${q(COMPANY_ID)}::uuid and key='astrogen-search-demand-opportunities';`);
}

function strategistGrant() {
  const value = psql(`
    select pg.scope::text
    from principal_permission_grants pg
    join agents a on a.id::text=pg.principal_id
    where pg.company_id=${q(COMPANY_ID)}::uuid
      and pg.principal_type='agent'
      and pg.permission_key='pipelines:write'
      and a.name='SEO Blog Content Strategist';
  `);
  return value ? JSON.parse(value) : null;
}

async function request(token, method, pathname, body) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // Keep plain text for the error below.
  }
  if (!response.ok) throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 1600)}`);
  return parsed;
}

function assertConvergedPermission() {
  const pipelineId = opportunityPipelineId();
  const grant = strategistGrant();
  if (!pipelineId || !grant?.pipelineIds?.includes(pipelineId)) {
    throw new Error("SEO Blog Content Strategist search-demand write grant is not converged");
  }
  return pipelineId;
}

function canonicalRefillState() {
  return rows(`
    select json_build_object('id',pc.id,'stage',ps.key,'caseKey',pc.case_key)::text
    from pipeline_cases pc
    join pipelines p on p.id=pc.pipeline_id
    join pipeline_stages ps on ps.id=pc.stage_id
    where pc.company_id=${q(COMPANY_ID)}::uuid
      and p.key='astrogen-growth-actions'
      and pc.case_key=${q(CANONICAL_REFILL_KEY)}
      and pc.terminal_kind is null
      and pc.hidden_from_board_at is null;
  `);
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const verify = args.includes("--verify");
  if (args.some((argument) => !["--apply", "--verify"].includes(argument))) {
    throw new Error("Usage: repair-search-demand-lineage.mjs [--apply] [--verify]");
  }

  const pipelineId = assertConvergedPermission();
  const before = legacyReadyTopics();
  if (!apply) {
    console.log(JSON.stringify({ mode: "dry-run", opportunityPipelineId: pipelineId, legacyReadyTopics: before, canonicalRefill: canonicalRefillState() }, null, 2));
    return;
  }

  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  psql(`insert into board_api_keys (id,user_id,name,key_hash,expires_at) values (${q(keyId)}::uuid,${q(USER_ID)},'search-demand-lineage-repair',${q(createHash("sha256").update(token).digest("hex"))},now()+interval '20 minutes');`);
  try {
    const backup = await request(token, "POST", "/instance/database-backups", {});
    const expired = [];
    for (const topic of before) {
      const detail = await request(token, "GET", `/cases/${topic.id}`);
      if (detail.stage?.key !== "ready") continue;
      const transitioned = await request(token, "POST", `/cases/${topic.id}/transition`, {
        toStageKey: "expired",
        expectedVersion: detail.case.version,
        reason: "Legacy ready topic has no guarded astrogen-search-demand-opportunities parent and is ineligible under astrogen-search-demand-v1.",
      });
      expired.push({ id: topic.id, caseKey: topic.caseKey, stage: transitioned.stage?.key ?? "expired" });
    }

    const issue = await request(token, "GET", `/issues/${REFILL_ISSUE_ID}`);
    let resumedStatus = issue.status;
    if (issue.status === "blocked") {
      const updated = await request(token, "PATCH", `/issues/${REFILL_ISSUE_ID}`, {
        resume: true,
        blockedByIssueIds: [],
        description: "Продовжити наявний canonical refill growth:topic-inventory-refill:2026-W29 через astrogen-search-demand-opportunities. Створити або оновити 3-10 opportunities за /companies/astrogen/reference/search-demand-policy.yaml, починаючи з прийнятих непокритих semantic-core кластерів із частотністю для України. Не створювати topic-inventory cases напряму. Лише delegated opportunity з selectedAction=new_article може створити guarded topic candidate. Повернути case-visible evidence до досягнення щонайменше 3 lineage-valid ready topics або одного точного typed blocker на конкретному opportunity.",
        comment: "## Системне розблокування\n\n- Додано вузький дозвіл запису SEO Blog Content Strategist лише до native search-demand pipeline.\n- Legacy ready-теми без guarded opportunity lineage переведено в expired і виключено з allocator count.\n- Продовжуйте цю саму [AST-482](/AST/issues/AST-482) через semantic-core-first search-demand policy; не створюйте нову refill-задачу або прямі topic cases.",
      });
      resumedStatus = updated.status;
    }

    const remainingLegacy = legacyReadyTopics();
    const refill = canonicalRefillState();
    if (remainingLegacy.length) throw new Error(`Legacy ready topics remain: ${remainingLegacy.length}`);
    if (refill.length !== 1 || refill[0].stage !== "executing") {
      throw new Error(`Canonical refill is not uniquely executing: ${JSON.stringify(refill)}`);
    }
    if (resumedStatus === "blocked") throw new Error("Existing refill issue remained blocked");

    console.log(JSON.stringify({
      mode: "apply",
      backup: { backupFile: backup.backupFile ?? null, sizeBytes: backup.sizeBytes ?? null },
      expired,
      refillIssueStatus: resumedStatus,
      canonicalRefill: refill[0],
      verifiedLegacyReadyCount: 0,
    }, null, 2));
  } finally {
    psql(`update board_api_keys set revoked_at=now(),last_used_at=now() where id=${q(keyId)}::uuid;`);
  }

  if (verify) {
    assertConvergedPermission();
    if (legacyReadyTopics().length) throw new Error("Lineage repair verification failed");
    console.log(JSON.stringify({ verified: true, canonicalRefill: canonicalRefillState() }));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
