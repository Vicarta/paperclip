#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const APP_CONTAINER = "paperclip-astrogen-clean-app-1";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const PLUGIN_KEY = "paperclip.semantic-core-mcp-agent-tools";
const EXPECTED_TOOLS = ["request-content-parsing", "run-layer", "generate-trend-topic-report"];

function run(command, args, input) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
  return result.stdout.trim();
}

function docker(args, input) {
  return run("docker", args, input);
}

function psql(sql) {
  return docker([
    "exec", "-i", DB_CONTAINER,
    "psql", "-U", "paperclip", "-d", "paperclip", "-v", "ON_ERROR_STOP=1", "-At",
  ], sql);
}

function q(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function main() {
  const runtime = JSON.parse(docker([
    "exec", APP_CONTAINER, "node", "-e",
    "Promise.all([import('file:///app/packages/plugins/plugin-semantic-core-mcp-agent-tools/dist/manifest.js'),import('file:///app/packages/plugins/plugin-semantic-core-mcp-agent-tools/dist/constants.js')]).then(([manifest,constants])=>console.log(JSON.stringify({version:constants.PLUGIN_VERSION,tools:(manifest.default?.tools||[]).map((tool)=>tool.name)})))",
  ]));
  if (runtime.version !== "0.3.15") throw new Error(`Unexpected runtime plugin version: ${runtime.version}`);
  for (const tool of EXPECTED_TOOLS) {
    if (!runtime.tools.includes(tool)) throw new Error(`Runtime plugin tool missing: ${tool}`);
  }

  const settingsRaw = psql(`
    select pcs.settings_json::text
    from plugin_company_settings pcs
    join plugins p on p.id=pcs.plugin_id
    where pcs.company_id=${q(COMPANY_ID)}::uuid and p.plugin_key=${q(PLUGIN_KEY)};
  `);
  const settings = JSON.parse(settingsRaw);
  if (settings.providerExecutionPolicy !== "approved_candidate_batch") throw new Error("Provider policy is not active");
  if (settings.trendLiveExecutionEnabled !== true) throw new Error("Trend live gate is not active");
  if (settings.contentParsingExecutionPolicy !== "approved_bounded_evidence") {
    throw new Error("Content parsing policy is not active");
  }
  if (typeof settings.semanticCoreMcpTokenSecretRef !== "string" || !settings.semanticCoreMcpTokenSecretRef) {
    throw new Error("Semantic Core secret reference is missing");
  }

  console.log(JSON.stringify({
    ok: true,
    runtimePluginVersion: runtime.version,
    runtimeToolCount: runtime.tools.length,
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
