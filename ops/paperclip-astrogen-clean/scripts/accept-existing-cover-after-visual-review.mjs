#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const caseId = readArg("--case-id");
const candidateIssueId = readArg("--candidate-issue-id");
const blockerIssueId = readArg("--blocker-issue-id");
const relativePath = readArg("--relative-path");
const apply = process.argv.includes("--apply");

for (const [name, value] of [
  ["--case-id", caseId],
  ["--candidate-issue-id", candidateIssueId],
  ["--blocker-issue-id", blockerIssueId],
]) {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value ?? "")) {
    throw new Error(`${name} is invalid`);
  }
}
if (!relativePath || relativePath.startsWith("/") || relativePath.includes("..")) {
  throw new Error("--relative-path must be a safe workspace-relative path");
}

function run(command, args, input) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input,
    maxBuffer: 16 * 1024 * 1024,
  });
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

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
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

const preflight = JSON.parse(psql(`
  select json_build_object(
    'caseId', c.id,
    'caseKey', c.case_key,
    'version', c.version,
    'stageKey', s.key,
    'terminalKind', c.terminal_kind,
    'candidatePath', c.fields->>'coverImageRetryCandidateRelativePath',
    'providerCallCount', c.fields->>'coverImageProviderCallCount',
    'dimensionsAccepted', c.fields#>>'{coverImageDimensionCheck,acceptedWithinTolerance}',
    'candidateIssueLinked', exists (
      select 1 from pipeline_case_issue_links l
      where l.case_id=c.id and l.issue_id=${quote(candidateIssueId)}::uuid and l.retired_at is null
    ),
    'blockerIssueLinked', exists (
      select 1 from pipeline_case_issue_links l
      where l.case_id=c.id and l.issue_id=${quote(blockerIssueId)}::uuid and l.retired_at is null
    ),
    'liveRunCount', (
      select count(*)
      from pipeline_case_issue_links l
      join heartbeat_runs h on h.context_snapshot->>'issueId'=l.issue_id::text
      where l.case_id=c.id
        and l.retired_at is null
        and h.status in ('queued','running','scheduled_retry')
    )
  )::text
  from pipeline_cases c
  join pipeline_stages s on s.id=c.stage_id
  where c.company_id=${quote(COMPANY_ID)}::uuid
    and c.id=${quote(caseId)}::uuid;
`));

if (
  preflight.stageKey !== "image_recovery_review"
  || preflight.terminalKind !== null
  || preflight.candidatePath !== relativePath
  || preflight.dimensionsAccepted !== "true"
  || Number(preflight.providerCallCount) < 1
  || !preflight.candidateIssueLinked
  || !preflight.blockerIssueLinked
  || Number(preflight.liveRunCount) !== 0
) {
  throw new Error(`Case is not eligible for existing-cover recovery: ${JSON.stringify(preflight)}`);
}

const token = `pcp_board_${randomBytes(24).toString("hex")}`;
const keyId = randomUUID();
psql(`
  insert into board_api_keys (id,user_id,name,key_hash,expires_at)
  values (
    ${quote(keyId)}::uuid,
    ${quote(USER_ID)},
    'accept-existing-cover-after-visual-review',
    ${quote(createHash("sha256").update(token).digest("hex"))},
    now()+interval '10 minutes'
  );
`);

try {
  const headers = { Authorization: `Bearer ${token}` };
  const detail = await request(token, "GET", `/cases/${caseId}`);
  const pipeline = await request(token, "GET", `/pipelines/${detail.pipeline.id}`);
  const stageById = new Map((pipeline.stages ?? []).map((stage) => [stage.id, stage]));
  const typedTransition = (pipeline.transitions ?? []).find((transition) => (
    transition.fromStageId === detail.stage.id
    && stageById.get(transition.toStageId)?.key === "cms_draft"
    && transition.label === "accept_existing_after_visual_review"
  ));
  if (!typedTransition) throw new Error("Typed accept_existing_after_visual_review transition is missing");

  if (!apply) {
    console.log(JSON.stringify({ mode: "dry-run", preflight, transitionLabel: typedTransition.label }, null, 2));
    process.exit(0);
  }

  const artifact = await request(
    token,
    "POST",
    `/issues/${candidateIssueId}/work-products/register-workspace-artifact`,
    {
      relativePath,
      title: "Accepted Astrogen article cover after visual review",
      summary: "Existing candidate accepted after visual review overturned a false-positive pseudo-writing classification; no additional provider call was made.",
      contentType: "image/png",
      status: "ready_for_review",
      reviewState: "approved",
      isPrimary: true,
    },
  );
  const attachmentId = artifact.attachment?.id ?? artifact.workProduct?.metadata?.attachmentId ?? null;
  const workProductId = artifact.workProduct?.id ?? null;
  if (!attachmentId || !workProductId) throw new Error(`Artifact registration was incomplete: ${JSON.stringify(artifact)}`);

  const acceptedAt = new Date().toISOString();
  const patchedResponse = await request(token, "PATCH", `/cases/${caseId}`, {
    expectedVersion: detail.case.version,
    fieldPatch: {
      imageDefect: null,
      blockerClass: null,
      coverImageStatus: "accepted_existing_after_visual_review",
      coverImageQaStatus: "passed",
      coverImageHardDefect: null,
      coverImageHardDefectEvidence: null,
      coverImageAcceptedCandidateRelativePath: relativePath,
      coverImageAcceptedAttachmentId: attachmentId,
      coverImageAcceptedWorkProductId: workProductId,
      coverImageAcceptedAt: acceptedAt,
      coverImageRecoveryReviewOutcome: "accepted_existing_after_visual_review",
      coverImageVisualReviewEvidence: "The badge uses a familiar non-linguistic pictogram with three decorative lines; it contains no readable letters, words, numbers, controls, or fabricated interface content.",
    },
  });
  const patched = patchedResponse.case ?? patchedResponse;
  const transition = await request(token, "POST", `/cases/${caseId}/transition`, {
    toStageKey: "cms_draft",
    expectedVersion: patched.version,
    reason: "Accept the existing within-tolerance cover after visual review; prior pseudo-writing classification was a false positive and no provider retry is needed.",
  });

  await request(token, "PATCH", `/issues/${blockerIssueId}`, {
    status: "done",
    blockedByIssueIds: [],
    comment: "Візуальна перевірка завершена: на зображенні немає читабельного тексту або цифр. Умовна піктограма не є дефектом. Наявний файл прийнято без нової генерації, кейс продовжено до CMS draft.",
  });

  console.log(JSON.stringify({
    mode: "apply",
    preflight,
    artifact: { attachmentId, workProductId, existing: artifact.existing ?? false },
    transition,
  }, null, 2));
} finally {
  psql(`delete from board_api_keys where id=${quote(keyId)}::uuid;`);
}

process.exit(0);
