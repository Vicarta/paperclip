#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const PAPERCLIP_PROJECT_ID = "d4644ea9-c025-4421-9af9-7780e41945ba";
const SEMANTIC_PROJECT_ID = "astrogen-ukraine";
const TREND_PROJECT_ID = "astrogen-audience-trends-ukraine";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const PLUGIN_KEY = "paperclip.semantic-core-mcp-agent-tools";
const REGISTER_TOOL = `${PLUGIN_KEY}:register-project`;
const TREND_TOOL = `${PLUGIN_KEY}:generate-trend-topic-report`;
const READ_TREND_TOOL = `${PLUGIN_KEY}:get-trend-topic-report`;

function run(command, args, input) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input,
    maxBuffer: 32 * 1024 * 1024,
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
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${method} ${path} returned ${response.status}: ${text.slice(0, 1200)}`);
  }
  return parsed;
}

function unwrapResult(response) {
  return response?.result?.data ?? response?.data ?? response?.result ?? response;
}

const token = `pcp_board_${randomBytes(24).toString("hex")}`;
const keyId = randomUUID();
const keyHash = createHash("sha256").update(token).digest("hex");

psql(`
  insert into board_api_keys (id, user_id, name, key_hash, expires_at)
  values (${q(keyId)}::uuid, ${q(USER_ID)}, 'semantic-core-trend-smoke',
    ${q(keyHash)}, now() + interval '10 minutes');
`);

try {
  const context = JSON.parse(psql(`
    select json_build_object(
      'agentId', a.id,
      'runId', hr.id,
      'companyId', a.company_id,
      'projectId', ${q(PAPERCLIP_PROJECT_ID)}::uuid
    )::text
    from agents a
    join lateral (
      select id from heartbeat_runs
      where company_id=a.company_id and agent_id=a.id
      order by created_at desc limit 1
    ) hr on true
    where a.company_id=${q(COMPANY_ID)}::uuid
      and a.name='SEO Semantic Core Strategist'
    limit 1;
  `));

  const tools = await request(token, "GET", `/agents/me/plugin-tools?pluginId=${encodeURIComponent(PLUGIN_KEY)}`);
  const names = new Set(tools.map((tool) => tool.name));
  if (!["register-project", REGISTER_TOOL].some((name) => names.has(name))) {
    throw new Error("register-project is not registered for agent execution");
  }
  if (!["generate-trend-topic-report", TREND_TOOL].some((name) => names.has(name))) {
    throw new Error("generate-trend-topic-report is not registered for agent execution");
  }
  if (!["get-trend-topic-report", READ_TREND_TOOL].some((name) => names.has(name))) {
    throw new Error("get-trend-topic-report is not registered for agent execution");
  }

  const registerResponse = await request(token, "POST", "/agents/me/plugin-tools/execute", {
    tool: REGISTER_TOOL,
    parameters: {
      project_id: TREND_PROJECT_ID,
      project_config: {
        site_id: TREND_PROJECT_ID,
        site_domain: "astrogen.com.ua",
        domain: "astrogen.com.ua",
        client_key: TREND_PROJECT_ID,
        language: "uk",
        country: "UA",
      },
      seed_catalog: { products: [] },
      existing_pages: [],
    },
    runContext: context,
  });
  const registerResult = unwrapResult(registerResponse);
  if (registerResult?.status === "error") {
    throw new Error(`Semantic project registration failed: ${JSON.stringify(registerResult)}`);
  }

  const importCountBefore = Number(psql(`
    select count(*) from plugin_entities pe
    join plugins p on p.id=pe.plugin_id
    where p.plugin_key=${q(PLUGIN_KEY)}
      and pe.entity_type='semantic-core-import-candidate';
  `));

  const trendResponse = await request(token, "POST", "/agents/me/plugin-tools/execute", {
    tool: TREND_TOOL,
    parameters: {
      project_id: TREND_PROJECT_ID,
      project: {
        name: "Astrogen",
        description: "Ukrainian platform for bounded self-reflection and choosing specialists.",
        market: "Ukrainian-language self-reflection and expert-selection information",
        geographies: ["Ukraine"],
        output_language: "uk",
      },
      audience_segments: [
        {
          id: "self_reflection",
          name: "Аудиторія самопізнання",
          description: "Люди, які досліджують життєві переходи та особисті патерни.",
        },
      ],
      analysis_date: new Date().toISOString().slice(0, 10),
      horizon_months: 6,
      constraints: {
        max_clusters: 2,
        topics_per_cluster: 2,
        content_lead_time_days: 14,
        excluded_topics: ["конкретні дати народження", "гороскоп на конкретну дату"],
        max_research_queries: 2,
        max_sources: 4,
        request_timeout_ms: 120000,
      },
      cache_policy: {
        scope: "private_project",
        strategy: "bypass",
        search_ttl_seconds: 21600,
        source_ttl_seconds: 86400,
        llm_ttl_seconds: 21600,
        stale_if_provider_unavailable: true,
        cache_llm_outputs: false,
      },
      mode: "fixture",
    },
    runContext: context,
  });
  const result = unwrapResult(trendResponse);
  if (result?.status !== "ok" || result?.schema_version !== "trend_topic_report.v1") {
    throw new Error(`Trend fixture failed: ${JSON.stringify(result)}`);
  }
  if (result.project_id !== TREND_PROJECT_ID || !result.run_id) {
    throw new Error("Trend report identity does not match the Astrogen semantic project");
  }
  if (result.paperclip_persistence?.semantic_import_allowed !== false
      || result.paperclip_persistence?.direct_topic_creation_allowed !== false) {
    throw new Error("Trend report persistence boundaries are missing");
  }

  const importCountAfter = Number(psql(`
    select count(*) from plugin_entities pe
    join plugins p on p.id=pe.plugin_id
    where p.plugin_key=${q(PLUGIN_KEY)}
      and pe.entity_type='semantic-core-import-candidate';
  `));
  if (importCountAfter !== importCountBefore) {
    throw new Error("Trend smoke polluted semantic-core import candidates");
  }

  const persisted = Number(psql(`
    select count(*) from plugin_entities pe
    join plugins p on p.id=pe.plugin_id
    where p.plugin_key=${q(PLUGIN_KEY)}
      and pe.entity_type='semantic-core-trend-topic-report'
      and pe.external_id=${q(result.run_id)};
  `));
  if (persisted !== 1) throw new Error("Trend report was not persisted exactly once");

  const readResponse = await request(token, "POST", "/agents/me/plugin-tools/execute", {
    tool: READ_TREND_TOOL,
    parameters: {
      runId: result.run_id,
      maxClusters: 1,
      maxIdeasPerCluster: 1,
      maxEvidencePerCluster: 1,
    },
    runContext: context,
  });
  const storedReport = unwrapResult(readResponse);
  if (storedReport?.runId !== result.run_id || storedReport?.semanticImportAllowed !== false) {
    throw new Error(`Stored trend report reader returned invalid identity: ${JSON.stringify(storedReport)}`);
  }
  if ((storedReport?.clusters?.length ?? 0) > 1) {
    throw new Error("Stored trend report reader ignored maxClusters");
  }

  console.log(JSON.stringify({
    ok: true,
    pluginKey: PLUGIN_KEY,
    semanticValidationProjectId: SEMANTIC_PROJECT_ID,
    trendProjectId: TREND_PROJECT_ID,
    runId: result.run_id,
    status: result.status,
    schemaVersion: result.schema_version,
    clusters: Array.isArray(result.clusters) ? result.clusters.length : null,
    warnings: Array.isArray(result.warnings) ? result.warnings.length : null,
    costTelemetryEvents: result.paperclip_persistence?.telemetryEventCount ?? null,
    ledgerEvents: result.paperclip_persistence?.ledgerEventCount ?? null,
    semanticImportCountUnchanged: importCountAfter,
    storedReportReadVerified: true,
  }, null, 2));
} finally {
  psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
}
