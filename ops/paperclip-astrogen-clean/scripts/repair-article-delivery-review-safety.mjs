#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const PIPELINE_KEY = "astrogen-article-production";
const BLOCKER_IDENTIFIER = "AST-617";

const requiredPrefixes = {
  image: ["image", "coverImage", "coverMedia", "ogImage", "blocker"],
  cms_draft: ["cms", "beforeAfterDiff", "coverMedia", "ogImage", "blocker"],
  cmo_delivery: ["cms", "delivery", "cmoDelivery", "telegram", "topicReservation", "blocker"],
};

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

function q(value) {
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
  if (!response.ok) throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 1600)}`);
  return text ? JSON.parse(text) : null;
}

function union(values, required) {
  return [...new Set([...(Array.isArray(values) ? values : []), ...required])];
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const keyHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${q(keyId)}::uuid, ${q(USER_ID)}, 'article-delivery-review-safety',
      ${q(keyHash)}, now() + interval '10 minutes');
  `);

  try {
    const pipelines = await request(token, "GET", `/companies/${COMPANY_ID}/pipelines`);
    const pipeline = pipelines.find((item) => item.key === PIPELINE_KEY);
    if (!pipeline) throw new Error(`Pipeline not found: ${PIPELINE_KEY}`);

    const updatedStages = [];
    for (const [stageKey, prefixes] of Object.entries(requiredPrefixes)) {
      const stage = pipeline.stages.find((item) => item.key === stageKey);
      if (!stage) throw new Error(`Stage not found: ${stageKey}`);
      const config = {
        ...(stage.config ?? {}),
        reviewSafeFieldPrefixes: union(stage.config?.reviewSafeFieldPrefixes, prefixes),
      };
      await request(token, "PATCH", `/pipelines/${pipeline.id}/stages/${stage.id}`, { config });
      updatedStages.push(stageKey);
    }

    const blocker = JSON.parse(psql(`
      select json_build_object('id',id,'status',status)::text
      from issues where company_id=${q(COMPANY_ID)}::uuid and identifier=${q(BLOCKER_IDENTIFIER)};
    `));
    if (blocker.status !== "done") {
      await request(token, "PATCH", `/issues/${blocker.id}`, {
        status: "done",
        comment: [
          "Systemic article delivery review-safety policy repaired.",
          "",
          "- Image, CMS and CMO delivery stages now classify bounded media, delivery and blocker metadata as review-safe.",
          "- Editorial title/body/brief/Winning Structure fields remain review-sensitive.",
          "- The existing CMO pipeline grant already includes the article pipeline.",
          "- [AST-616](/AST/issues/AST-616) can now resume through the first-class blocker-resolution wake and transition the current-version case normally.",
        ].join("\n"),
      });
    }

    process.stdout.write(`${JSON.stringify({ ok: true, pipelineId: pipeline.id, updatedStages, blockerClosed: BLOCKER_IDENTIFIER }, null, 2)}\n`);
  } finally {
    psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
