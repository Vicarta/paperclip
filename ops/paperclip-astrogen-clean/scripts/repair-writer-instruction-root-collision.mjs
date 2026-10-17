#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { agentDefs, assertUniqueAgentSlugs, instructionText } from "./bootstrap-astrogen-growth-os.mjs";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const COMPANY_DIR = process.env.ASTROGEN_COMPANY_DIR ?? "/home/paperclip/companies/astrogen-clean";
const BACKUP_ROOT = process.env.ASTROGEN_BACKUP_DIR ?? "/home/paperclip/backups";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const WRITER_NAMES = ["SEO Blog Article Writer (Claude)", "SEO Blog Article Writer (ChatGPT)"];

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

function timestamp() {
  return new Date().toISOString().replaceAll(":", "").replaceAll(".", "-");
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
  assertUniqueAgentSlugs();
  const writers = WRITER_NAMES.map((name) => agentDefs.find((agent) => agent.name === name));
  if (writers.some((agent) => !agent)) throw new Error("Writer definitions are missing");

  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${sqlLiteral(keyId)}::uuid, ${sqlLiteral(USER_ID)},
      'writer-instruction-root-collision-repair', ${sqlLiteral(tokenHash)}, now() + interval '15 minutes');
  `);

  try {
    const dbBackup = await request(token, "POST", "/instance/database-backups", {});
    const backupDir = path.join(BACKUP_ROOT, `astrogen-writer-instruction-roots-${timestamp()}`);
    mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    const agentResponse = await request(token, "GET", `/companies/${COMPANY_ID}/agents`);
    const liveAgents = Array.isArray(agentResponse) ? agentResponse : agentResponse.items ?? agentResponse.agents ?? [];
    const results = [];

    for (const agent of writers) {
      const live = liveAgents.find((candidate) => candidate.name === agent.name);
      if (!live) throw new Error(`Live writer agent is missing: ${agent.name}`);
      const directory = path.join(COMPANY_DIR, "agents", agent.slug);
      const targetPath = path.join(directory, "AGENTS.md");
      mkdirSync(directory, { recursive: true, mode: 0o755 });
      if (existsSync(targetPath)) copyFileSync(targetPath, path.join(backupDir, `${agent.slug}-AGENTS.md`));
      writeFileSync(targetPath, instructionText(agent), { encoding: "utf8", mode: 0o644 });
      if (readFileSync(targetPath, "utf8") !== instructionText(agent)) throw new Error(`Instruction file verification failed: ${agent.name}`);

      const containerPath = `/companies/astrogen/agents/${agent.slug}/AGENTS.md`;
      const updated = await request(token, "PATCH", `/agents/${live.id}/instructions-path`, { path: containerPath });
      if (updated.path !== containerPath) {
        throw new Error(`Instructions path patch returned an unexpected path for ${agent.name}`);
      }

      // The mutation returns a narrow acknowledgement; read the persisted agent
      // detail before declaring the runtime path repaired.
      const persisted = await request(token, "GET", `/agents/${live.id}`);
      const config = persisted.adapterConfig ?? persisted.agent?.adapterConfig ?? {};
      if (config.instructionsFilePath !== containerPath || config.instructionsRootPath !== path.dirname(containerPath)) {
        throw new Error(`Runtime instruction path verification failed: ${agent.name}`);
      }
      results.push({ agent: agent.name, slug: agent.slug, instructionPath: containerPath });
    }

    console.log(JSON.stringify({
      mode: "apply-and-verify",
      dbBackup: { backupDir: dbBackup.backupDir ?? null, sizeBytes: dbBackup.sizeBytes ?? null, finishedAt: dbBackup.finishedAt ?? null },
      fileBackupDir: backupDir,
      writers: results,
    }, null, 2));
  } finally {
    psql(`update board_api_keys set revoked_at=now(), last_used_at=now() where id=${sqlLiteral(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
