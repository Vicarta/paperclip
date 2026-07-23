#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const OPENROUTER_SECRET_ID = "18cfeaa8-7856-4999-99d3-3335aa7c35c3";
const PROMPT_ONLY_MODEL = "anthropic/claude-sonnet-4.6";
const LOCAL_TOOLS_MODEL = "openrouter/anthropic/claude-sonnet-4.6";
const FALLBACK_MARKER_KEY = "paperclipHarnessFallback";

function parseArgs(argv) {
  const names = new Set();
  let all = false;
  let reason = "";
  let runtime = "local-tools";
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
    if (value === "--reason") {
      reason = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (value === "--runtime") {
      runtime = argv[index + 1] ?? "";
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
  if (!reason.trim()) {
    throw new Error("--reason is required");
  }
  if (!["local-tools", "prompt-only"].includes(runtime)) {
    throw new Error("--runtime must be local-tools or prompt-only");
  }
  return { all, names, reason: reason.trim(), runtime };
}

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

function readFallbackMarker(agent) {
  const marker = agent.adapterConfig?.[FALLBACK_MARKER_KEY];
  return marker && typeof marker === "object" ? marker : null;
}

function fallbackConfig(agent, reason, runtime) {
  const previous = agent.adapterConfig ?? {};
  const existingMarker = readFallbackMarker(agent);
  const marker = existingMarker ?? {
    activatedAt: new Date().toISOString(),
    reason,
    originalAdapterType: agent.adapterType,
    originalAdapterConfig: previous,
  };
  const shared = {
    env: {
      OPENROUTER_API_KEY: {
        type: "secret_ref",
        version: "latest",
        secretId: OPENROUTER_SECRET_ID,
      },
    },
    instructionsFilePath: previous.instructionsFilePath,
    instructionsRootPath: previous.instructionsRootPath,
    instructionsEntryFile: previous.instructionsEntryFile ?? "AGENTS.md",
    instructionsBundleMode: previous.instructionsBundleMode ?? "external",
    [FALLBACK_MARKER_KEY]: {
      ...marker,
      reason,
      lastRoutedAt: new Date().toISOString(),
      fallbackRuntime: runtime,
    },
  };
  if (runtime === "prompt-only") {
    return {
      ...shared,
      model: PROMPT_ONLY_MODEL,
      timeoutSec: 1800,
      maxCompletionTokens: 16000,
    };
  }
  return {
    ...shared,
    cwd: "/companies/astrogen",
    model: LOCAL_TOOLS_MODEL,
    timeoutSec: 0,
    graceSec: 15,
    outputInactivityTimeoutMs: 1800000,
    dangerouslySkipPermissions: true,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const keyHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id,user_id,name,key_hash,expires_at)
    values (${quote(keyId)}::uuid,${quote(USER_ID)},'activate-openrouter-harness-fallback',${quote(keyHash)},now()+interval '20 minutes');
  `);

  try {
    const backup = await request(token, "POST", "/instance/database-backups", {});
    const response = await request(token, "GET", `/companies/${COMPANY_ID}/agents`);
    const agents = rows(response, ["items", "agents"]);
    const targets = agents.filter((agent) =>
      (agent.adapterType === "codex_local" || readFallbackMarker(agent))
      && (options.all || options.names.has(agent.name))
    );
    if (!options.all) {
      const found = new Set(targets.map((agent) => agent.name));
      const missing = [...options.names].filter((name) => !found.has(name));
      if (missing.length > 0) {
        throw new Error(`Requested codex_local/fallback agents not found: ${missing.join(", ")}`);
      }
    }
    if (targets.length === 0) {
      throw new Error("No codex_local/fallback agents matched the requested scope");
    }
    const changed = [];
    const adapterType = options.runtime === "local-tools" ? "opencode_local" : "openrouter";
    const model = options.runtime === "local-tools" ? LOCAL_TOOLS_MODEL : PROMPT_ONLY_MODEL;
    for (const agent of targets) {
      await request(token, "PATCH", `/agents/${agent.id}`, {
        adapterType,
        adapterConfig: fallbackConfig(agent, options.reason, options.runtime),
        replaceAdapterConfig: true,
      });
      changed.push({ id: agent.id, name: agent.name, from: agent.adapterType, to: adapterType, model });
    }
    console.log(JSON.stringify({
      ok: true,
      backup: { backupDir: backup.backupDir, sizeBytes: backup.sizeBytes },
      fallbackReason: options.reason,
      fallbackRuntime: options.runtime,
      changedCount: changed.length,
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
