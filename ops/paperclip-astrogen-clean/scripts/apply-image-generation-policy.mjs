#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const PLUGIN_KEY = "paperclip.openrouter-image-agent-tools";

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

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const keyId = randomUUID();
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${sqlLiteral(keyId)}::uuid, ${sqlLiteral(USER_ID)},
      'image-generation-policy-sync', ${sqlLiteral(tokenHash)}, now() + interval '10 minutes');
  `);

  try {
    const backup = await request(token, "POST", "/instance/database-backups", {});
    const plugins = await request(token, "GET", "/plugins");
    const plugin = plugins.find((candidate) => candidate.pluginKey === PLUGIN_KEY);
    if (!plugin) throw new Error(`Plugin not found: ${PLUGIN_KEY}`);
    const current = await request(token, "GET", `/plugins/${plugin.id}/config`);
    const configJson = {
      ...(current?.configJson ?? {}),
      defaultModel: "google/gemini-2.5-flash-image",
      maxImagesPerRequest: 1,
      targetDimensionTolerancePercent: 20,
      requireSubjectMode: true,
      structuredArtDirectionMode: "required_for_human_scene",
      visualHistoryLimit: 8,
      minimumDistinctVisualAxes: 4,
      legacyAvoidVisualPatterns: [
        "seated person or couple at a table with laptop, notebook, cup, and neutral catalogue expression",
        "burgundy sweater used as the main brand signal",
        "generic bright home office with window, plant, wooden desk, and no visible emotional event",
      ],
    };
    await request(token, "POST", `/plugins/${plugin.id}/config`, { configJson });
    const verified = await request(token, "GET", `/plugins/${plugin.id}/config`);
    const policy = {
      defaultModel: verified?.configJson?.defaultModel ?? null,
      maxImagesPerRequest: verified?.configJson?.maxImagesPerRequest ?? null,
      targetDimensionTolerancePercent: verified?.configJson?.targetDimensionTolerancePercent ?? null,
      requireSubjectMode: verified?.configJson?.requireSubjectMode ?? null,
      structuredArtDirectionMode: verified?.configJson?.structuredArtDirectionMode ?? null,
      visualHistoryLimit: verified?.configJson?.visualHistoryLimit ?? null,
      minimumDistinctVisualAxes: verified?.configJson?.minimumDistinctVisualAxes ?? null,
    };
    if (
      policy.defaultModel !== "google/gemini-2.5-flash-image"
      || policy.maxImagesPerRequest !== 1
      || policy.targetDimensionTolerancePercent !== 20
      || policy.requireSubjectMode !== true
      || policy.structuredArtDirectionMode !== "required_for_human_scene"
      || policy.visualHistoryLimit !== 8
      || policy.minimumDistinctVisualAxes !== 4
    ) {
      throw new Error("Image generation policy verification failed");
    }
    console.log(JSON.stringify({
      pluginKey: PLUGIN_KEY,
      changed: JSON.stringify(current?.configJson ?? {}) !== JSON.stringify(configJson),
      policy,
      backup: {
        filename: backup.filename ?? null,
        sizeBytes: backup.sizeBytes ?? null,
      },
    }, null, 2));
  } finally {
    psql(`
      update board_api_keys set revoked_at=now(), last_used_at=now()
      where id=${sqlLiteral(keyId)}::uuid;
    `);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
