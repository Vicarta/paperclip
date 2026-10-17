#!/usr/bin/env node
import { closeSync, mkdirSync, openSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const APP_CONTAINER = "paperclip-astrogen-clean-app-1";
const PLUGIN_KEY = "paperclip.semantic-core-mcp-agent-tools";
const PACKAGE_NAME = "@paperclipai/plugin-semantic-core-mcp-agent-tools";
const PACKAGE_PATH = "/app/packages/plugins/plugin-semantic-core-mcp-agent-tools";
const INSTALL_ORDER = 80;
const BACKUP_DIR = "/home/paperclip/backups";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, ...options });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
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

function qJson(value) {
  return `${q(JSON.stringify(value))}::jsonb`;
}

function backupDatabase() {
  mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
  const path = `${BACKUP_DIR}/astrogen-clean-semantic-local-inventory-${stamp}.dump`;
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
  const version = docker([
    "exec", APP_CONTAINER, "node", "-e",
    `process.stdout.write(require(${JSON.stringify(`${PACKAGE_PATH}/package.json`)}).version)`,
  ]);
  const manifest = JSON.parse(docker([
    "exec", APP_CONTAINER, "node", "-e",
    `import(${JSON.stringify(`file://${PACKAGE_PATH}/dist/manifest.js`)}).then((m)=>process.stdout.write(JSON.stringify(m.default||m)))`,
  ]));
  if (!manifest.tools?.some((tool) => tool.name === "get-local-inventory")) {
    throw new Error("Deployed semantic-core plugin does not expose get-local-inventory");
  }

  const settings = {
    desiredState: "active",
    localInventoryReadOnly: true,
    maxLocalInventoryRows: 50,
  };
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

  psql(`
    insert into plugin_company_settings (
      id, company_id, plugin_id, settings_json, enabled, last_error, created_at, updated_at
    ) values (
      gen_random_uuid(), '${COMPANY_ID}'::uuid, '${pluginId}'::uuid,
      ${qJson(settings)}, true, NULL, now(), now()
    )
    on conflict (company_id, plugin_id) do update set
      settings_json=excluded.settings_json,
      enabled=true,
      last_error=NULL,
      updated_at=now();

    insert into plugin_config (id, plugin_id, config_json, last_error, created_at, updated_at)
    values (gen_random_uuid(), '${pluginId}'::uuid, ${qJson(settings)}, NULL, now(), now())
    on conflict (plugin_id) do update set
      config_json=excluded.config_json,
      last_error=NULL,
      updated_at=now();
  `);

  const snapshotCount = Number(psql(`
    select count(*) from plugin_entities
    where plugin_id='${pluginId}'::uuid
      and entity_type='semantic-core-import-candidate'
      and data->>'companyId'=${q(COMPANY_ID)};
  `));
  if (snapshotCount < 1) throw new Error("No company-scoped semantic-core import snapshot is available");

  console.log(JSON.stringify({
    ok: true,
    backupPath,
    pluginKey: PLUGIN_KEY,
    version,
    pluginEnabled: true,
    localInventorySnapshots: snapshotCount,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
