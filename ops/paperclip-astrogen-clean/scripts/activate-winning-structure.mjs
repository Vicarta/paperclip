#!/usr/bin/env node
import { createCipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { closeSync, mkdirSync, openSync } from "node:fs";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const APP_CONTAINER = "paperclip-astrogen-clean-app-1";
const MCP_CONTAINER = "winning-structure-mcp";
const PLUGIN_KEY = "paperclip.winning-structure-mcp-agent-tools";
const SECRET_KEY = "winning-structure-mcp-token";
const MCP_URL = "http://100.98.5.50:8000/mcp";
const CLIENT_KEY = "astrogen-ukraine";
const BACKUP_DIR = "/home/paperclip/backups";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
  }
  return result.stdout?.trim() ?? "";
}

function docker(args, options) {
  return run("docker", args, options);
}

function psql(sql) {
  return docker([
    "exec", "-i", DB_CONTAINER,
    "psql", "-U", "paperclip", "-d", "paperclip",
    "-v", "ON_ERROR_STOP=1", "-q", "-At",
  ], { input: sql });
}

function q(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function qUuid(value) {
  return value ? `${q(value)}::uuid` : "NULL";
}

function qJson(value) {
  return `${q(JSON.stringify(value))}::jsonb`;
}

function decodeMasterKey(raw) {
  const trimmed = raw.trim();
  if (/^[A-Fa-f0-9]{64}$/.test(trimmed)) return Buffer.from(trimmed, "hex");
  const base64 = Buffer.from(trimmed, "base64");
  if (base64.length === 32) return base64;
  if (Buffer.byteLength(trimmed, "utf8") === 32) return Buffer.from(trimmed, "utf8");
  throw new Error("Invalid Paperclip secret master key format");
}

function readMasterKey() {
  const path = docker(["exec", APP_CONTAINER, "printenv", "PAPERCLIP_SECRETS_MASTER_KEY_FILE"]);
  if (!path) throw new Error("PAPERCLIP_SECRETS_MASTER_KEY_FILE is not configured");
  return decodeMasterKey(docker(["exec", APP_CONTAINER, "cat", path]));
}

function readMcpToken() {
  if (process.env.WINNING_STRUCTURE_MCP_TOKEN?.trim()) {
    return process.env.WINNING_STRUCTURE_MCP_TOKEN.trim();
  }
  const inspect = JSON.parse(docker(["inspect", MCP_CONTAINER]));
  const env = inspect[0]?.Config?.Env ?? [];
  const entry = env.find((value) => value.startsWith("MCP_BEARER_TOKEN="));
  const token = entry?.slice("MCP_BEARER_TOKEN=".length).trim();
  if (!token) throw new Error("MCP_BEARER_TOKEN is unavailable in the MCP container");
  return token;
}

function encryptValue(masterKey, value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    scheme: "local_encrypted_v1",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

function backupDatabase() {
  mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
  const path = `${BACKUP_DIR}/astrogen-clean-phase47-winning-structure-${stamp}.dump`;
  const fd = openSync(path, "w", 0o600);
  try {
    const result = spawnSync("docker", [
      "exec", DB_CONTAINER, "pg_dump", "-U", "paperclip", "-d", "paperclip", "-Fc",
    ], { stdio: ["ignore", fd, "pipe"], encoding: "utf8" });
    if (result.status !== 0) throw new Error(result.stderr || "pg_dump failed");
  } finally {
    closeSync(fd);
  }
  return path;
}

function main() {
  const backupPath = backupDatabase();
  const token = readMcpToken();
  const material = encryptValue(readMasterKey(), token);
  const digest = createHash("sha256").update(token).digest("hex");
  const proposedSecretId = randomUUID();

  const secretId = psql(`
    insert into company_secrets (
      id, company_id, name, provider, latest_version, description, key,
      status, managed_mode, provider_metadata, updated_at
    ) values (
      ${qUuid(proposedSecretId)}, ${qUuid(COMPANY_ID)},
      'Winning Structure MCP token', 'local_encrypted', 1,
      'Bearer token for private Winning Structure MCP', ${q(SECRET_KEY)},
      'active', 'paperclip_managed',
      ${qJson({ source: "winning-structure-mcp-container", phase: 47 })}, now()
    )
    on conflict (company_id, key) do update set
      name=excluded.name,
      provider=excluded.provider,
      latest_version=1,
      description=excluded.description,
      status='active',
      managed_mode='paperclip_managed',
      provider_metadata=excluded.provider_metadata,
      deleted_at=NULL,
      updated_at=now()
    returning id;
  `).trim();

  psql(`
    update company_secret_versions
    set status='revoked', revoked_at=now()
    where secret_id=${qUuid(secretId)} and version<>1 and status='current';

    insert into company_secret_versions (
      secret_id, version, material, value_sha256, fingerprint_sha256,
      status, revoked_at, created_at
    ) values (
      ${qUuid(secretId)}, 1, ${qJson(material)}, ${q(digest)}, ${q(digest)},
      'current', NULL, now()
    )
    on conflict (secret_id, version) do update set
      material=excluded.material,
      value_sha256=excluded.value_sha256,
      fingerprint_sha256=excluded.fingerprint_sha256,
      status='current',
      revoked_at=NULL;
  `);

  const pluginId = psql(`select id from plugins where plugin_key=${q(PLUGIN_KEY)};`).trim();
  if (!pluginId) throw new Error(`Plugin is not installed: ${PLUGIN_KEY}`);
  const settings = {
    winningStructureMcpTokenSecretRef: secretId,
    winningStructureMcpUrl: MCP_URL,
    allowedClientKeysCsv: CLIENT_KEY,
    requestTimeoutMs: 180000,
    costAccountingMode: "provider_reported",
  };

  psql(`
    update plugins
    set status='ready', last_error=NULL, updated_at=now()
    where id=${qUuid(pluginId)};

    insert into plugin_company_settings (
      id, company_id, plugin_id, settings_json, enabled, last_error, created_at, updated_at
    ) values (
      gen_random_uuid(), ${qUuid(COMPANY_ID)}, ${qUuid(pluginId)},
      ${qJson(settings)}, true, NULL, now(), now()
    )
    on conflict (company_id, plugin_id) do update set
      settings_json=excluded.settings_json,
      enabled=true,
      last_error=NULL,
      updated_at=now();

    insert into plugin_config (id, plugin_id, config_json, last_error, created_at, updated_at)
    values (gen_random_uuid(), ${qUuid(pluginId)}, ${qJson(settings)}, NULL, now(), now())
    on conflict (plugin_id) do update set
      config_json=excluded.config_json,
      last_error=NULL,
      updated_at=now();

    insert into company_secret_bindings (
      company_id, secret_id, target_type, target_id, config_path,
      version_selector, required, label, created_at, updated_at
    ) values (
      ${qUuid(COMPANY_ID)}, ${qUuid(secretId)}, 'plugin', ${q(pluginId)},
      'winningStructureMcpTokenSecretRef', 'latest', true,
      'Winning Structure MCP bearer token for private Astrogen article analysis',
      now(), now()
    )
    on conflict (company_id, target_type, target_id, config_path) do update set
      secret_id=excluded.secret_id,
      version_selector='latest',
      required=true,
      label=excluded.label,
      updated_at=now();
  `);

  console.log(JSON.stringify({
    ok: true,
    backupPath,
    companyId: COMPANY_ID,
    pluginKey: PLUGIN_KEY,
    pluginEnabled: true,
    secretStored: true,
    mcpUrl: MCP_URL,
    clientKey: CLIENT_KEY,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
