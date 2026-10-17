#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const PLUGIN_KEY = "paperclip.crawlobserver-agent-tools";
const CRAWLOBSERVER_PROJECT_ID = "fe5261b6-e793-44ae-a093-253a19b3c78e";
const DB_CONTAINER = process.env.PAPERCLIP_DB_CONTAINER
  ?? "paperclip-astrogen-clean-db-1";

function run(command, args, input) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input,
    maxBuffer: 8 * 1024 * 1024,
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

function q(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function main() {
  psql(`
    begin;

    update plugin_config pc
    set config_json=jsonb_set(
          coalesce(pc.config_json, '{}'::jsonb),
          '{allowedProjectId}',
          to_jsonb(${q(CRAWLOBSERVER_PROJECT_ID)}::text),
          true
        ),
        last_error=null,
        updated_at=now()
    from plugins p
    where p.id=pc.plugin_id
      and p.plugin_key=${q(PLUGIN_KEY)};

    update plugin_company_settings pcs
    set settings_json=jsonb_set(
          coalesce(pcs.settings_json, '{}'::jsonb),
          '{allowedProjectId}',
          to_jsonb(${q(CRAWLOBSERVER_PROJECT_ID)}::text),
          true
        ),
        updated_at=now()
    from plugins p
    where p.id=pcs.plugin_id
      and p.plugin_key=${q(PLUGIN_KEY)}
      and pcs.company_id=${q(COMPANY_ID)}::uuid;

    commit;
  `);

  const state = JSON.parse(psql(`
    select json_build_object(
      'pluginKey',p.plugin_key,
      'version',p.version,
      'status',p.status,
      'instanceAllowedProjectId',pc.config_json->>'allowedProjectId',
      'companyAllowedProjectId',pcs.settings_json->>'allowedProjectId'
    )::text
    from plugins p
    join plugin_config pc on pc.plugin_id=p.id
    join plugin_company_settings pcs on pcs.plugin_id=p.id
      and pcs.company_id=${q(COMPANY_ID)}::uuid
    where p.plugin_key=${q(PLUGIN_KEY)};
  `));

  if (state.instanceAllowedProjectId !== CRAWLOBSERVER_PROJECT_ID
    || state.companyAllowedProjectId !== CRAWLOBSERVER_PROJECT_ID) {
    throw new Error(`CrawlObserver project scope did not persist: ${JSON.stringify(state)}`);
  }
  process.stdout.write(`${JSON.stringify({ ok: true, ...state }, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
