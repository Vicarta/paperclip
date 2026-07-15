#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const PROJECT_ID = "d4644ea9-c025-4421-9af9-7780e41945ba";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const EMAIL_PLUGIN_KEY = "paperclip.email-notifications";
const REMOVED_PLUGIN_KEY = "paperclip.seo-performance-loop";
const WEEKLY_TOOL = `${EMAIL_PLUGIN_KEY}:email-seo-weekly-report-send`;

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
  return run("sudo", [
    "docker", "exec", "-i", DB_CONTAINER,
    "psql", "-U", "paperclip", "-d", "paperclip",
    "-v", "ON_ERROR_STOP=1", "-At",
  ], sql);
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function asArray(value, keys = []) {
  if (Array.isArray(value)) return value;
  for (const key of keys) {
    if (Array.isArray(value?.[key])) return value[key];
  }
  return [];
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
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!response.ok) {
    throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 2000)}`);
  }
  return parsed;
}

function latestSeoRun() {
  const result = psql(`
    select h.id::text || '|' || h.agent_id::text
    from heartbeat_runs h
    join agents a on a.id = h.agent_id
    where h.company_id = ${sqlLiteral(COMPANY_ID)}::uuid
      and a.name = 'SEO Performance Analyst'
    order by h.created_at desc
    limit 1;
  `);
  const [runId, agentId] = result.split("|");
  if (!runId || !agentId) throw new Error("SEO Performance Analyst heartbeat run not found");
  return { runId, agentId };
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${sqlLiteral(keyId)}::uuid, ${sqlLiteral(USER_ID)},
      'phase48-remove-seo-performance-loop', ${sqlLiteral(tokenHash)},
      now() + interval '15 minutes');
  `);

  try {
    const pluginResponse = await request(token, "GET", "/plugins");
    const plugins = asArray(pluginResponse, ["items", "plugins"]);
    const email = plugins.find((plugin) => plugin.pluginKey === EMAIL_PLUGIN_KEY);
    const removed = plugins.find((plugin) => plugin.pluginKey === REMOVED_PLUGIN_KEY);
    if (!email || email.status !== "ready" || email.version !== "0.3.0") {
      throw new Error(`Weekly email replacement is not ready at 0.3.0: ${JSON.stringify(email ?? null)}`);
    }

    const toolsResponse = await request(token, "GET", "/plugins/tools");
    const tools = asArray(toolsResponse, ["items", "tools"]);
    if (!tools.some((tool) => (tool.name ?? tool.tool) === WEEKLY_TOOL)) {
      throw new Error(`Weekly email tool is not registered: ${WEEKLY_TOOL}`);
    }

    const { runId, agentId } = latestSeoRun();
    const dryRun = await request(token, "POST", "/plugins/tools/execute", {
      tool: WEEKLY_TOOL,
      parameters: {
        subject: "Перевірка щотижневого SEO/GEO звіту Astrogen",
        report: {
          period: "Технічна перевірка без відправлення",
          executiveSummary: "Новий HTML-шаблон і канал доставки готові. Реальний лист не надсилається.",
          metrics: [],
          actions: [],
          watchItems: [],
          noActionReason: "",
          ownerAction: "",
          details: [],
        },
        idempotencyKey: `phase48-weekly-email-dry-run:${keyId}`,
        dryRun: true,
      },
      runContext: { companyId: COMPANY_ID, projectId: PROJECT_ID, agentId, runId },
    });
    const dryRunProof = dryRun?.result?.data?.proof ?? dryRun?.data?.proof;
    if (dryRunProof?.dryRun !== true) {
      throw new Error(`Weekly email dry run did not return delivery proof: ${JSON.stringify(dryRun)}`);
    }

    let uninstall = null;
    if (removed) {
      uninstall = await request(token, "DELETE", `/plugins/${removed.id}?purge=true`);
    }

    const remaining = psql(`
      select count(*)
      from plugins
      where plugin_key = ${sqlLiteral(REMOVED_PLUGIN_KEY)};
    `);
    const jobs = psql(`
      select count(*)
      from plugin_jobs j
      join plugins p on p.id = j.plugin_id
      where p.plugin_key = ${sqlLiteral(REMOVED_PLUGIN_KEY)};
    `);
    if (remaining !== "0" || jobs !== "0") {
      throw new Error(`Removed plugin still has live state: plugins=${remaining}, jobs=${jobs}`);
    }

    console.log(JSON.stringify({
      mode: "verify-replacement-and-purge",
      emailPlugin: { id: email.id, version: email.version, status: email.status },
      weeklyEmailDryRun: dryRunProof,
      removedPlugin: removed ? { id: removed.id, purged: Boolean(uninstall) } : { alreadyAbsent: true },
      remainingPluginRows: Number(remaining),
      remainingJobRows: Number(jobs),
    }, null, 2));
  } finally {
    psql(`
      update board_api_keys
      set revoked_at = now(), last_used_at = now()
      where id = ${sqlLiteral(keyId)}::uuid;
    `);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
