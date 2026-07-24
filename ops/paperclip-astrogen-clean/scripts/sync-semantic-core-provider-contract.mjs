#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const PLUGIN_KEY = "paperclip.semantic-core-mcp-agent-tools";
const VERIFY_ONLY = process.argv.includes("--verify");
const SETTINGS = {
  providerExecutionPolicy: "approved_candidate_batch",
  trendLiveExecutionEnabled: true,
  contentParsingExecutionPolicy: "approved_bounded_evidence",
  allowedProjectIdsCsv: "astrogen-ukraine,astrogen-audience-trends-ukraine",
};

function run(command, args, input) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
  return result.stdout.trim();
}

function psql(sql) {
  return run("docker", [
    "exec", "-i", DB_CONTAINER,
    "psql", "-U", "paperclip", "-d", "paperclip", "-v", "ON_ERROR_STOP=1", "-At",
  ], sql);
}

function q(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function qJson(value) {
  return `${q(JSON.stringify(value))}::jsonb`;
}

function readCurrentSettings() {
  const raw = psql(`
    select pcs.settings_json::text
    from plugin_company_settings pcs
    join plugins p on p.id=pcs.plugin_id
    where pcs.company_id=${q(COMPANY_ID)}::uuid and p.plugin_key=${q(PLUGIN_KEY)};
  `);
  if (!raw) throw new Error(`Missing ${PLUGIN_KEY} company settings`);
  return JSON.parse(raw);
}

function assertContract(settings) {
  for (const [key, value] of Object.entries(SETTINGS)) {
    if (settings[key] !== value) {
      throw new Error(`Semantic Core setting mismatch: ${key}`);
    }
  }
  if (typeof settings.semanticCoreMcpTokenSecretRef !== "string" || !settings.semanticCoreMcpTokenSecretRef) {
    throw new Error("Semantic Core secret reference is missing");
  }
}

function main() {
  if (!VERIFY_ONLY) {
    psql(`
      update plugin_company_settings pcs
      set settings_json=coalesce(pcs.settings_json, '{}'::jsonb) || ${qJson(SETTINGS)},
          enabled=true,
          last_error=null,
          updated_at=now()
      from plugins p
      where pcs.plugin_id=p.id
        and pcs.company_id=${q(COMPANY_ID)}::uuid
        and p.plugin_key=${q(PLUGIN_KEY)};

      update plugin_config pc
      set config_json=coalesce(pc.config_json, '{}'::jsonb) || ${qJson(SETTINGS)},
          last_error=null,
          updated_at=now()
      from plugins p
      where pc.plugin_id=p.id and p.plugin_key=${q(PLUGIN_KEY)};
    `);
  }
  const settings = readCurrentSettings();
  assertContract(settings);
  console.log(JSON.stringify({
    ok: true,
    mode: VERIFY_ONLY ? "verify" : "apply-and-verify",
    pluginKey: PLUGIN_KEY,
    providerExecutionPolicy: settings.providerExecutionPolicy,
    trendLiveExecutionEnabled: settings.trendLiveExecutionEnabled,
    contentParsingExecutionPolicy: settings.contentParsingExecutionPolicy,
    tokenSecretRefPresent: true,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
