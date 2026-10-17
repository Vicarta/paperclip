#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const liveRunIds = [
  "run_20260718_223110_trend_topic_7cd4289c",
  "run_20260718_223454_trend_topic_e6de23e4",
];
const fixtureRunIds = [
  "run_20260718_205816_trend_topic_ff57291a",
  "run_20260719_000529_trend_topic_e2af3b47",
];

function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function idList(values) {
  return values.map(quote).join(",");
}

const sql = `
begin;
update plugin_entities
set data=jsonb_set(data, '{requestMode}', '"live"'::jsonb, true), updated_at=now()
where entity_type='semantic-core-trend-topic-report'
  and external_id in (${idList(liveRunIds)});
update plugin_entities
set data=jsonb_set(data, '{requestMode}', '"fixture"'::jsonb, true), updated_at=now()
where entity_type='semantic-core-trend-topic-report'
  and external_id in (${idList(fixtureRunIds)});
commit;
select json_build_object(
  'live', count(*) filter (where data->>'requestMode'='live'),
  'fixture', count(*) filter (where data->>'requestMode'='fixture'),
  'unknown', count(*) filter (where data->>'requestMode' is null)
)::text
from plugin_entities
where entity_type='semantic-core-trend-topic-report';
`;

const output = run("sudo", [
  "docker", "exec", "-i", DB_CONTAINER,
  "psql", "-U", "paperclip", "-d", "paperclip", "-v", "ON_ERROR_STOP=1", "-At",
], sql);
process.stdout.write(`${output}\n`);
