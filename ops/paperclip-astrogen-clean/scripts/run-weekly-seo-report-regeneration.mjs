#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const ROUTINE_TITLE = "Weekly Astrogen SEO/GEO action cycle";
const REPLACED_ISSUE = "AST-1136";

function run(command, args, input) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input,
    maxBuffer: 4 * 1024 * 1024,
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

function kyivDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kiev",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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
  if (!response.ok) throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 2000)}`);
  return text ? JSON.parse(text) : null;
}

function rows(value, keys) {
  if (Array.isArray(value)) return value;
  for (const key of keys) {
    if (Array.isArray(value?.[key])) return value[key];
  }
  return [];
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  psql(`
    insert into board_api_keys (id,user_id,name,key_hash,expires_at)
    values (
      ${quote(keyId)}::uuid,
      ${quote(USER_ID)},
      'weekly-seo-report-regeneration',
      ${quote(createHash("sha256").update(token).digest("hex"))},
      now()+interval '10 minutes'
    );
  `);

  try {
    const response = await request(token, "GET", `/companies/${COMPANY_ID}/routines`);
    const routine = rows(response, ["items", "routines"]).find((item) => item.title === ROUTINE_TITLE);
    if (!routine) throw new Error(`${ROUTINE_TITLE} not found`);

    const detailResponse = await request(token, "GET", `/routines/${routine.id}`);
    const detail = detailResponse?.routine ?? detailResponse;
    if (detail.status !== "active") throw new Error("Weekly SEO/GEO routine is not active");
    if (detail.latestRevisionNumber !== 17) {
      throw new Error(`Expected routine revision 17, got ${detail.latestRevisionNumber}`);
    }

    const history = await request(token, "GET", `/routines/${routine.id}/runs?limit=10`);
    const active = rows(history, ["items", "runs"]).find((item) =>
      ["queued", "running"].includes(item.status),
    );
    if (active) throw new Error(`Weekly SEO/GEO routine already has active run ${active.id}`);

    const triggers = rows(detail.triggers, ["items", "triggers"]);
    const trigger = triggers.find((item) => item.kind === "schedule" && item.enabled);
    const businessDate = kyivDate();
    const result = await request(token, "POST", `/routines/${routine.id}/run`, {
      source: "manual",
      triggerId: trigger?.id,
      payload: {
        reason: "Regenerate the current weekly report after CrawlObserver evidence and owner-facing email repair",
        reportRegeneration: true,
        replacementForIssue: REPLACED_ISSUE,
        businessDate,
        requiredRoutineRevision: 17,
        requireFreshCrawlObserverEvidence: true,
        requireNewEmailDeliveryProof: true,
      },
      idempotencyKey: `astrogen-weekly-seo-regeneration:${businessDate}:revision-17`,
    });

    console.log(JSON.stringify({
      ok: true,
      businessDate,
      routineId: routine.id,
      routineRevision: detail.latestRevisionNumber,
      result,
    }, null, 2));
  } finally {
    psql(`delete from board_api_keys where id=${quote(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
