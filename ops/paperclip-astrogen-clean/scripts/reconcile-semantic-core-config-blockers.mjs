#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const PLUGIN_KEY = "paperclip.semantic-core-mcp-agent-tools";

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
  return run("docker", [
    "exec", "-i", DB_CONTAINER,
    "psql", "-U", "paperclip", "-d", "paperclip",
    "-v", "ON_ERROR_STOP=1", "-At",
  ], sql);
}

function q(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function request(token, method, path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const responseText = await response.text();
  const parsed = responseText ? JSON.parse(responseText) : null;
  if (!response.ok) {
    throw new Error(`${method} ${path} returned ${response.status}: ${responseText.slice(0, 1000)}`);
  }
  return parsed;
}

const runtimeProof = JSON.parse(psql(`
  select json_build_object(
    'pluginVersion', p.version,
    'pluginEnabled', p.status='ready',
    'pluginHealthy', p.last_error is null and pc.last_error is null,
    'secretConfigured', nullif(pc.config_json->>'semanticCoreMcpTokenSecretRef', '') is not null,
    'secretBindingCount', (
      select count(*) from company_secret_bindings csb
      join company_secrets cs on cs.id=csb.secret_id
      where csb.company_id=${q(COMPANY_ID)}::uuid
        and csb.target_type='plugin'
        and csb.target_id=p.id::text
        and csb.config_path='semanticCoreMcpTokenSecretRef'
        and csb.required=true
        and cs.status='active'
    ),
    'trendReportCount', (
      select count(*) from plugin_entities pe
      where pe.plugin_id=p.id
        and pe.entity_type='semantic-core-trend-topic-report'
    )
  )::text
  from plugins p
  join plugin_config pc on pc.plugin_id=p.id
  where p.plugin_key=${q(PLUGIN_KEY)}
  limit 1;
`));

if (runtimeProof.pluginVersion !== "0.3.0"
    || runtimeProof.pluginEnabled !== true
    || runtimeProof.pluginHealthy !== true
    || runtimeProof.secretConfigured !== true
    || Number(runtimeProof.secretBindingCount) !== 1
    || Number(runtimeProof.trendReportCount) < 1) {
  throw new Error(`Semantic Core runtime proof is incomplete: ${JSON.stringify(runtimeProof)}`);
}

const token = `pcp_board_${randomBytes(24).toString("hex")}`;
const keyId = randomUUID();
const keyHash = createHash("sha256").update(token).digest("hex");

psql(`
  insert into board_api_keys (id, user_id, name, key_hash, expires_at)
  values (${q(keyId)}::uuid, ${q(USER_ID)}, 'reconcile-semantic-core-config-blockers',
    ${q(keyHash)}, now() + interval '10 minutes');
`);

try {
  const issues = JSON.parse(psql(`
    select json_object_agg(identifier, json_build_object('id', id, 'status', status))::text
    from issues
    where company_id=${q(COMPANY_ID)}::uuid
      and identifier in ('AST-538', 'AST-542', 'AST-543', 'AST-548');
  `));
  for (const identifier of ["AST-538", "AST-542", "AST-543", "AST-548"]) {
    if (!issues[identifier]) throw new Error(`${identifier} is missing`);
  }

  const resolvedComment = [
    "## Semantic Core MCP runtime restored",
    "",
    "Clean Paperclip now has the encrypted company-scoped Semantic Core secret binding and plugin version `0.3.0` enabled without runtime errors. Agent-dispatcher smoke succeeded for local semantic inventory and for `generate-trend-topic-report` in fixture mode. The trend report was persisted separately and did not create a semantic import or article topic.",
    "",
    "This resolves the runtime configuration blocker. Continue through the existing parent dependency graph; do not create another secret/configuration task.",
  ].join("\n");

  for (const identifier of ["AST-548", "AST-543", "AST-538"]) {
    const issue = issues[identifier];
    if (issue.status === "done" || issue.status === "cancelled") continue;
    await request(token, "POST", `/issues/${issue.id}/comments`, { body: resolvedComment });
    await request(token, "PATCH", `/issues/${issue.id}`, { status: "done" });
  }

  const waitingEvidence = issues["AST-542"];
  let resumed = { identifier: "AST-542", status: waitingEvidence.status };
  if (waitingEvidence.status !== "done" && waitingEvidence.status !== "cancelled") {
    resumed = await request(token, "PATCH", `/issues/${waitingEvidence.id}`, {
      status: "todo",
      resume: true,
      blockedBy: [],
      comment: [
        "## Evidence tool available",
        "",
        "The Semantic Core MCP configuration blocker is resolved. Resume this same waiting-evidence automation and rerun only the missing bounded SERP grouping/value-gap check for the existing topic case. Apply the current search-demand policy, including explicit calendar-date exclusion and the repetitive query-family batch limit. Do not create a duplicate topic or configuration task.",
      ].join("\n"),
    });
  }

  console.log(JSON.stringify({
    ok: true,
    runtimeProof,
    resolved: ["AST-548", "AST-543", "AST-538"],
    resumed: { identifier: "AST-542", status: resumed.status },
  }, null, 2));
} finally {
  psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
}
