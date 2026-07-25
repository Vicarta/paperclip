#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { routineDefs } from "./bootstrap-astrogen-growth-os.mjs";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const PROJECT_ID = "d4644ea9-c025-4421-9af9-7780e41945ba";
const GOAL_ID = "7767d120-e09d-48bc-9d3b-5a90d3aac61c";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const TARGET_TITLES = new Set([
  "Daily Astrogen deterministic evidence collection",
  "Daily Astrogen due-URL GSC indexing audit",
  "Daily Astrogen leadership backlog triage",
  "Astrogen article slot allocator",
  "Weekly Astrogen SEO/GEO action cycle",
  "Weekly Astrogen CMO growth portfolio plan",
  "Weekly Astrogen CEO business direction review",
  "Monthly Astrogen trend discovery",
  "Monthly Astrogen scaled-content audit",
]);

function run(command, args, input) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
  }
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

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
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
  if (!response.ok) {
    throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 1000)}`);
  }
  return parsed;
}

function asArray(value, keys) {
  if (Array.isArray(value)) return value;
  for (const key of keys) {
    if (Array.isArray(value?.[key])) return value[key];
  }
  return [];
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const keyId = randomUUID();
  const insertSql = `
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${sqlLiteral(keyId)}::uuid, ${sqlLiteral(USER_ID)},
      'phase46-autonomous-growth-routine-sync', ${sqlLiteral(tokenHash)},
      now() + interval '15 minutes');
  `;
  psql(insertSql);

  try {
    const backup = await request(token, "POST", "/instance/database-backups", {});
    const [routineResponse, agentResponse] = await Promise.all([
      request(token, "GET", `/companies/${COMPANY_ID}/routines`),
      request(token, "GET", `/companies/${COMPANY_ID}/agents`),
    ]);
    const routines = asArray(routineResponse, ["items", "routines"]);
    const agents = asArray(agentResponse, ["items", "agents"]);
    const agentByName = new Map(agents.map((agent) => [agent.name, agent]));
    const results = [];

    for (const item of routineDefs.filter((candidate) => TARGET_TITLES.has(candidate.title))) {
      const assignee = agentByName.get(item.owner);
      if (!assignee) throw new Error(`Agent not found: ${item.owner}`);
      const desired = {
        projectId: PROJECT_ID,
        goalId: GOAL_ID,
        title: item.title,
        description: item.description,
        assigneeAgentId: assignee.id,
        priority: "medium",
        status: item.status,
        concurrencyPolicy: item.concurrencyPolicy,
        catchUpPolicy: item.catchUpPolicy,
        variables: [],
        // Keep activation policy in the revisioned contract, not stale env flags.
        env: null,
      };
      let current = routines.find((routine) => routine.title === item.title) ?? null;
      let changed = false;

      if (!current) {
        current = await request(token, "POST", `/companies/${COMPANY_ID}/routines`, desired);
        routines.push(current);
        changed = true;
      } else {
        const comparable = Object.fromEntries(Object.keys(desired).map((key) => [key, current[key] ?? null]));
        if (stableJson(comparable) !== stableJson(desired)) {
          current = await request(token, "PATCH", `/routines/${current.id}`, {
            ...desired,
            baseRevisionId: current.latestRevisionId ?? null,
          });
          changed = true;
        }
      }

      let detail = await request(token, "GET", `/routines/${current.id}`);
      const triggers = asArray(detail.triggers, ["items", "triggers"]);
      const trigger = triggers.find((candidate) => candidate.kind === "schedule");
      const desiredTrigger = {
        label: item.timezone,
        enabled: item.triggerEnabled,
        cronExpression: item.cron,
        timezone: item.timezone,
      };
      if (!trigger) {
        await request(token, "POST", `/routines/${current.id}/triggers`, {
          kind: "schedule",
          ...desiredTrigger,
        });
        changed = true;
      } else {
        const actualTrigger = Object.fromEntries(Object.keys(desiredTrigger).map((key) => [key, trigger[key] ?? null]));
        if (stableJson(actualTrigger) !== stableJson(desiredTrigger)) {
          await request(token, "PATCH", `/routine-triggers/${trigger.id}`, desiredTrigger);
          changed = true;
        }
      }

      detail = await request(token, "GET", `/routines/${current.id}`);
      const verifiedTriggers = asArray(detail.triggers, ["items", "triggers"]);
      const verifiedTrigger = verifiedTriggers.find((candidate) => candidate.kind === "schedule");
      if (stableJson(detail.env ?? null) !== stableJson(desired.env)) {
        throw new Error(`Routine env drift remains after sync: ${item.title}`);
      }
      results.push({
        title: item.title,
        changed,
        status: detail.status,
        revision: detail.latestRevisionNumber,
        cron: verifiedTrigger?.cronExpression ?? null,
        timezone: verifiedTrigger?.timezone ?? null,
        triggerEnabled: verifiedTrigger?.enabled ?? false,
        env: detail.env ?? null,
      });
    }

    console.log(JSON.stringify({
      mode: "apply-and-verify",
      backup: {
        filename: backup.filename ?? null,
        backupDir: backup.backupDir ?? null,
        sizeBytes: backup.sizeBytes ?? null,
        finishedAt: backup.finishedAt ?? null,
      },
      routines: results,
    }, null, 2));
  } finally {
    psql(`
      update board_api_keys
      set revoked_at = now(), last_used_at = now()
      where id = ${sqlLiteral(keyId)}::uuid;
    `);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
