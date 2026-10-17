#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const ROUTINE_ID = "830fe352-933b-44c6-ae4b-401d48190933";
const TRIGGER_ID = "40791707-35e9-434b-8472-5914f15d9c87";
const revisionFlagIndex = process.argv.indexOf("--revision");
const reconciliationRevision = revisionFlagIndex >= 0 ? process.argv[revisionFlagIndex + 1] : "v1";

function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
  return result.stdout.trim();
}

function psql(sql) {
  return run("sudo", [
    "docker", "exec", "-i", DB_CONTAINER,
    "psql", "-U", "paperclip", "-d", "paperclip", "-v", "ON_ERROR_STOP=1", "-At",
  ], sql);
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function kyivDate() {
  if (process.env.BUSINESS_DATE) return process.env.BUSINESS_DATE;
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Kiev",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
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
  const parsed = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 1200)}`);
  return parsed;
}

async function main() {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/i.test(reconciliationRevision)) {
    throw new Error("--revision must be a short alphanumeric/hyphen identifier");
  }
  const businessDate = kyivDate();
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${sqlLiteral(keyId)}::uuid, ${sqlLiteral(USER_ID)},
      'article-daily-batch-reconciliation', ${sqlLiteral(tokenHash)}, now() + interval '10 minutes');
  `);

  try {
    const detail = await request(token, "GET", `/routines/${ROUTINE_ID}`);
    const routine = detail.routine ?? detail;
    const description = routine.description ?? "";
    if (routine.status !== "active") throw new Error("Article allocator is not active");
    if (!description.includes("Target three new CMS drafts per Europe/Kiev day")) {
      throw new Error("Refusing to run: the three-slot daily contract is not active");
    }
    if (!description.includes("currentDayNewArticleBatchCount")) {
      throw new Error("Refusing to run: daily batch accounting is not active");
    }
    if (!description.includes("Every `/pipelines/{pipelineId}/cases` response is a direct JSON array")) {
      throw new Error("Refusing to run: native case-list response contract is not active");
    }

    const result = await request(token, "POST", `/routines/${ROUTINE_ID}/run`, {
      source: "manual",
      triggerId: TRIGGER_ID,
      payload: {
        reason: "Reconcile current-day article batch after allocator policy repair",
        businessDate,
        expectedDailyCmsDrafts: 3,
        scope: "native_allocator_only",
      },
      idempotencyKey: `astrogen-article-daily-batch-reconcile:${businessDate}:${reconciliationRevision}`,
    });
    console.log(JSON.stringify({
      businessDate,
      reconciliationRevision,
      routineId: ROUTINE_ID,
      result,
    }, null, 2));
  } finally {
    psql(`update board_api_keys set revoked_at=now(), last_used_at=now() where id=${sqlLiteral(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
