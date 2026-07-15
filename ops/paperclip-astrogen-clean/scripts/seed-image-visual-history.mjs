#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const PLUGIN_KEY = "paperclip.openrouter-image-agent-tools";

const history = [
  entry("AST-235", "2026-07-14T07:25:03.872Z", {
    sceneArchetype: "decision_point",
    setting: "bright neutral home office at a table",
    subjectArrangement: "one_person",
    actionType: "choosing",
    emotionalBeat: "uncertainty",
    gazePlan: "off_camera_action",
    shotDistance: "medium",
    cameraAngle: "profile",
    dominantProps: ["geometric objects", "laptop", "notebook", "phone", "table lamp"],
  }),
  entry("AST-189", "2026-07-13T07:07:19.771Z", {
    sceneArchetype: "personal_reflection",
    setting: "bright home office at a table",
    subjectArrangement: "one_person",
    actionType: "preparing",
    emotionalBeat: "anticipation",
    gazePlan: "off_camera_action",
    shotDistance: "medium",
    cameraAngle: "three_quarter",
    dominantProps: ["laptop", "notebook", "plant", "table", "tarot cards"],
  }),
  entry("AST-141", "2026-07-08T14:53:41.593Z", {
    sceneArchetype: "active_conversation",
    setting: "bright living room at a wooden table",
    subjectArrangement: "two_people",
    actionType: "discussing",
    emotionalBeat: "concern",
    gazePlan: "at_another_person",
    shotDistance: "medium",
    cameraAngle: "profile",
    dominantProps: ["cup", "notebook", "papers", "table"],
  }),
  entry("AST-128", "2026-07-08T13:04:39.142Z", {
    sceneArchetype: "active_conversation",
    setting: "bright home kitchen at a wooden table",
    subjectArrangement: "two_people",
    actionType: "discussing",
    emotionalBeat: "uncertainty",
    gazePlan: "at_another_person",
    shotDistance: "medium",
    cameraAngle: "profile",
    dominantProps: ["cup", "laptop", "notebook", "table"],
  }),
  entry("AST-106", "2026-07-07T11:45:35.741Z", {
    sceneArchetype: "personal_reflection",
    setting: "bright home office at a wooden desk",
    subjectArrangement: "one_person",
    actionType: "preparing",
    emotionalBeat: "uncertainty",
    gazePlan: "off_camera_action",
    shotDistance: "medium",
    cameraAngle: "three_quarter",
    dominantProps: ["cup", "laptop", "notebook"],
  }),
  entry("AST-92", "2026-07-07T08:20:52.983Z", {
    sceneArchetype: "expert_listening",
    setting: "bright consultation room at a wooden table",
    subjectArrangement: "couple_with_expert",
    actionType: "discussing",
    emotionalBeat: "trust",
    gazePlan: "at_another_person",
    shotDistance: "medium",
    cameraAngle: "three_quarter",
    dominantProps: ["cup", "laptop", "papers", "table"],
  }),
];

function entry(articleKey, generatedAt, fingerprint) {
  return { articleKey, generatedAt, fingerprint };
}

function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
  return result.stdout.trim();
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function psql(sql) {
  return run("sudo", [
    "docker", "exec", "-i", DB_CONTAINER,
    "psql", "-U", "paperclip", "-d", "paperclip", "-v", "ON_ERROR_STOP=1", "-At",
  ], sql);
}

function main() {
  if (!process.argv.includes("--apply")) throw new Error("Pass --apply to seed reviewed visual history");
  const pluginId = psql(`select id from plugins where plugin_key=${sqlLiteral(PLUGIN_KEY)} limit 1;`);
  if (!pluginId) throw new Error(`Plugin not found: ${PLUGIN_KEY}`);
  const value = JSON.stringify(history);
  psql(`
    insert into plugin_state (plugin_id, scope_kind, scope_id, namespace, state_key, value_json, updated_at)
    values (
      ${sqlLiteral(pluginId)}::uuid,
      'company',
      ${sqlLiteral(COMPANY_ID)},
      'visual-history',
      'human-scene-v1',
      ${sqlLiteral(value)}::jsonb,
      now()
    )
    on conflict (plugin_id, scope_kind, scope_id, namespace, state_key)
    do update set value_json=excluded.value_json, updated_at=now();
  `);
  const count = psql(`
    select jsonb_array_length(value_json)
    from plugin_state
    where plugin_id=${sqlLiteral(pluginId)}::uuid
      and scope_kind='company'
      and scope_id=${sqlLiteral(COMPANY_ID)}
      and namespace='visual-history'
      and state_key='human-scene-v1';
  `);
  if (Number(count) !== history.length) throw new Error(`Visual history verification failed: ${count}`);
  console.log(JSON.stringify({ pluginKey: PLUGIN_KEY, seeded: history.length, articleKeys: history.map((item) => item.articleKey) }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
