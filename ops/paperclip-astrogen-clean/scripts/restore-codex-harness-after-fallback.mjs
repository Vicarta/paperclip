#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const FALLBACK_MARKER_KEY = "paperclipHarnessFallback";

function parseArgs(argv) {
  const names = new Set();
  let all = false;
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--all") {
      all = true;
      continue;
    }
    if (value === "--agent-name") {
      const name = argv[index + 1];
      if (!name) throw new Error("--agent-name requires a value");
      names.add(name);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }
  if (!all && names.size === 0) {
    throw new Error("Pass --all or at least one --agent-name");
  }
  if (all && names.size > 0) {
    throw new Error("Use either --all or --agent-name, not both");
  }
  return { all, names };
}

function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
  return result.stdout.trim();
}

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function psql(sql) {
  return run("sudo", [
    "docker", "exec", "-i", DB_CONTAINER,
    "psql", "-U", "paperclip", "-d", "paperclip", "-v", "ON_ERROR_STOP=1", "-At",
  ], sql);
}

function rows(value, keys = []) {
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
  if (!response.ok) throw new Error(`${method} ${pathname} returned ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

function fallbackMarker(agent) {
  const marker = agent.adapterConfig?.[FALLBACK_MARKER_KEY];
  return marker && typeof marker === "object" ? marker : null;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const keyHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id,user_id,name,key_hash,expires_at)
    values (${quote(keyId)}::uuid,${quote(USER_ID)},'restore-codex-harness-after-fallback',${quote(keyHash)},now()+interval '20 minutes');
  `);

  try {
    const backup = await request(token, "POST", "/instance/database-backups", {});
    const response = await request(token, "GET", `/companies/${COMPANY_ID}/agents`);
    const agents = rows(response, ["items", "agents"]);
    const targets = agents.filter((agent) => {
      if (agent.adapterType !== "openrouter" || !fallbackMarker(agent)) return false;
      return options.all || options.names.has(agent.name);
    });
    if (!options.all) {
      const found = new Set(targets.map((agent) => agent.name));
      const missing = [...options.names].filter((name) => !found.has(name));
      if (missing.length > 0) {
        throw new Error(`Requested fallback agents not found: ${missing.join(", ")}`);
      }
    }
    if (targets.length === 0) {
      throw new Error("No marked fallback agents matched the requested scope");
    }
    const changed = [];
    for (const agent of targets) {
      const marker = fallbackMarker(agent);
      const originalAdapterType = marker.originalAdapterType;
      const originalAdapterConfig = marker.originalAdapterConfig;
      if (typeof originalAdapterType !== "string" || !originalAdapterConfig || typeof originalAdapterConfig !== "object") {
        throw new Error(`Invalid fallback marker for ${agent.name}`);
      }
      await request(token, "PATCH", `/agents/${agent.id}`, {
        adapterType: originalAdapterType,
        adapterConfig: originalAdapterConfig,
        replaceAdapterConfig: true,
      });
      changed.push({ id: agent.id, name: agent.name, restoredAdapterType: originalAdapterType });
    }
    console.log(JSON.stringify({
      ok: true,
      backup: { backupDir: backup.backupDir, sizeBytes: backup.sizeBytes },
      restoredCount: changed.length,
      changed,
    }, null, 2));
  } finally {
    psql(`update board_api_keys set revoked_at=now(),last_used_at=now() where id=${quote(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
