#!/usr/bin/env node
import { createCipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { closeSync, mkdirSync, openSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const APP_CONTAINER = "paperclip-astrogen-clean-app-1";
const PLUGIN_KEY = "paperclip.semantic-core-mcp-agent-tools";
const PACKAGE_NAME = "@paperclipai/plugin-semantic-core-mcp-agent-tools";
const PACKAGE_PATH = "/app/packages/plugins/plugin-semantic-core-mcp-agent-tools";
const INSTALL_ORDER = 80;
const SECRET_KEY = "semantic-core-mcp-token";
const TOKEN_FILE = "/home/mcpsemcor/.config/semantic-core/bearer_token";
const MCP_URL = "http://100.98.5.50:8001/mcp";
const SEMANTIC_PROJECT_ID = "astrogen-ukraine";
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
  return `'${String(value).replaceAll("'", "''")}'`;
}

function qUuid(value) {
  return `${q(value)}::uuid`;
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
  const token = readFileSync(TOKEN_FILE, "utf8").trim();
  if (!token) throw new Error("Semantic Core MCP token file is empty");
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
  const path = `${BACKUP_DIR}/astrogen-clean-semantic-core-mcp-${stamp}.dump`;
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

function readPluginVersion() {
  return docker([
    "exec", APP_CONTAINER, "node", "-e",
    `process.stdout.write(require(${JSON.stringify(`${PACKAGE_PATH}/package.json`)}).version)`,
  ]);
}

function readPluginManifest() {
  const source = `import(${JSON.stringify(`file://${PACKAGE_PATH}/dist/manifest.js`)}).then((m)=>process.stdout.write(JSON.stringify(m.default||m)))`;
  return JSON.parse(docker(["exec", APP_CONTAINER, "node", "-e", source]));
}

function main() {
  if (process.getuid?.() !== 0) {
    throw new Error("Run as root so the server-owned MCP token can be read without copying it");
  }

  const backupPath = backupDatabase();
  const token = readMcpToken();
  const material = encryptValue(readMasterKey(), token);
  const digest = createHash("sha256").update(token).digest("hex");
  const version = readPluginVersion();
  const manifest = readPluginManifest();
  if (!manifest.tools?.some((tool) => tool.name === "generate-trend-topic-report")) {
    throw new Error("Deployed semantic-core plugin does not expose generate-trend-topic-report");
  }

  const secretId = psql(`
    insert into company_secrets (
      id, company_id, name, provider, latest_version, description, key,
      status, managed_mode, provider_metadata, updated_at
    ) values (
      '${randomUUID()}'::uuid, ${qUuid(COMPANY_ID)},
      'Semantic Core MCP token', 'local_encrypted', 1,
      'Bearer token for the private project-scoped Semantic Core MCP endpoint',
      ${q(SECRET_KEY)}, 'active', 'paperclip_managed',
      ${qJson({ source: TOKEN_FILE, scope: SEMANTIC_PROJECT_ID })}, now()
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

  const pluginId = psql(`
    insert into plugins (
      id, plugin_key, package_name, package_path, version, api_version,
      categories, manifest_json, status, install_order, last_error, updated_at
    ) values (
      '${randomUUID()}'::uuid, ${q(PLUGIN_KEY)}, ${q(PACKAGE_NAME)}, ${q(PACKAGE_PATH)},
      ${q(version)}, ${Number(manifest.apiVersion || 1)}, ${qJson(manifest.categories || [])},
      ${qJson(manifest)}, 'ready', ${INSTALL_ORDER}, NULL, now()
    )
    on conflict (plugin_key) do update set
      package_name=excluded.package_name,
      package_path=excluded.package_path,
      version=excluded.version,
      api_version=excluded.api_version,
      categories=excluded.categories,
      manifest_json=excluded.manifest_json,
      status='ready',
      install_order=excluded.install_order,
      last_error=NULL,
      updated_at=now()
    returning id;
  `).trim();

  const settings = {
    desiredState: "active",
    semanticCoreMcpTokenSecretRef: secretId,
    semanticCoreMcpUrl: MCP_URL,
    defaultProjectId: SEMANTIC_PROJECT_ID,
    allowedProjectIdsCsv: SEMANTIC_PROJECT_ID,
    allowedClientKeysCsv: "",
    requestTimeoutMs: 300000,
    pollIntervalMs: 2000,
    runWaitTimeoutMs: 600000,
    localInventoryReadOnly: true,
    maxLocalInventoryRows: 50,
  };

  psql(`
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
      'semanticCoreMcpTokenSecretRef', 'latest', true,
      'Semantic Core MCP bearer token for Astrogen', now(), now()
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
    pluginKey: PLUGIN_KEY,
    pluginVersion: version,
    pluginEnabled: true,
    secretStored: true,
    mcpUrl: MCP_URL,
    semanticProjectId: SEMANTIC_PROJECT_ID,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
