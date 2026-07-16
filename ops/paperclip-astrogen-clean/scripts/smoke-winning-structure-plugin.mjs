#!/usr/bin/env node

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const PROJECT_ID = "d4644ea9-c025-4421-9af9-7780e41945ba";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const PLUGIN_PREFIX = "paperclip.winning-structure-mcp-agent-tools";

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

function parseJsonContent(value) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = parseJsonContent(item?.text ?? item?.content ?? item);
      if (parsed) return parsed;
    }
  }
  return value && typeof value === "object" ? value : null;
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
    throw new Error(`${method} ${path} returned ${response.status}: ${text.slice(0, 800)}`);
  }
  return parsed;
}

const token = `pcp_board_${randomBytes(24).toString("hex")}`;
const keyId = randomUUID();
const keyHash = createHash("sha256").update(token).digest("hex");

psql(`
  insert into board_api_keys (id, user_id, name, key_hash, expires_at)
  values (${q(keyId)}::uuid, ${q(USER_ID)}, 'phase47-winning-structure-smoke',
    ${q(keyHash)}, now() + interval '10 minutes');
`);

try {
  const context = JSON.parse(psql(`
    select json_build_object(
      'agentId', a.id,
      'runId', hr.id,
      'companyId', a.company_id,
      'projectId', ${q(PROJECT_ID)}::uuid
    )::text
    from agents a
    join lateral (
      select id from heartbeat_runs
      where company_id=a.company_id and agent_id=a.id
      order by created_at desc limit 1
    ) hr on true
    where a.company_id=${q(COMPANY_ID)}::uuid
      and a.name='MKT Competitive Intelligence Analyst'
    limit 1;
  `));

  const tools = await request(
    token,
    "GET",
    `/agents/me/plugin-tools?pluginId=${encodeURIComponent(PLUGIN_PREFIX)}`,
  );
  const names = tools.map((tool) => tool.name).sort();
  const result = await request(token, "POST", "/agents/me/plugin-tools/execute", {
    tool: `${PLUGIN_PREFIX}:validate-task-input`,
    runContext: context,
    parameters: {
      company_id: COMPANY_ID,
      project_id: PROJECT_ID,
      client_key: "astrogen-ukraine",
      idempotency_key: "winning-structure:phase47-plugin-smoke:v1",
      task: {
        keyword_cluster_id: "phase47-plugin-smoke",
        page_mode: "new",
        target_url: "https://astrogen.com.ua/blog/phase47-plugin-smoke/",
        primary_keyword: "астрологічна консультація",
        auxiliary_keywords: ["як підготуватися до астрологічної консультації"],
        intent_hypothesis: "Читачеві потрібно зрозуміти межі формату і підготувати корисний запит.",
        content_goal: "Перевірити валідацію evidence-backed структури без запуску аналізу.",
      },
      market: {
        geo: "UA",
        search_language: "uk",
        output_language: "uk-UA",
        primary_device: "mobile",
      },
      ownership_context: {
        forbidden_competing_urls: [],
        forbidden_topics: [],
        candidate_internal_urls: [],
        query_url_performance: [],
        discovery_mode: "caller_supplied",
        interaction_policy: "required_on_blocking_conflict",
        max_interaction_rounds: 3,
      },
      business_context: {
        reader_value_evidence: [{
          evidence_id: "phase47-contract-smoke",
          evidence_type: "official_documentation",
          title: "Astrogen evidence-backed article contract",
          summary: "The contract requires decision support, claim boundaries, and no invented evidence.",
          reader_problem: "Generic guidance does not explain format limits or how to prepare a useful request.",
          claim_boundaries: ["No deterministic or guaranteed outcomes."],
          artifact_refs: ["paperclip://reference/article-value-system"],
          source: "Astrogen Phase 47 company contract",
          observed_at: "2026-07-14T00:00:00Z",
          rights_and_privacy_notes: "Internal contract; no personal data.",
        }],
        product_bridge_targets: [],
      },
      editorial_constraints: [
        "Do not present astrology as scientific proof.",
        "Do not make medical, legal, financial, diagnostic, deterministic, or fatalistic claims.",
      ],
      cache_policy: {
        enabled: true,
        refresh: false,
        max_age_hours: 168,
        allow_crawl_reuse_on_refresh: false,
      },
    },
  });

  const execution = result?.result ?? result;
  const structured = execution?.data?.structuredContent
    ?? execution?.data?.data?.structuredContent
    ?? execution?.structuredContent
    ?? null;
  const validation = structured
    ?? parseJsonContent(execution?.data?.content)
    ?? parseJsonContent(execution?.content)
    ?? {};
  if (execution?.isError === true || validation?.valid !== true) {
    throw new Error(`Winning Structure validation smoke failed: ${JSON.stringify(validation).slice(0, 1200)}`);
  }
  if (validation.validation_source !== "remote_mcp") {
    throw new Error(`Winning Structure validation did not prove remote_mcp: ${JSON.stringify(validation).slice(0, 1200)}`);
  }
  if (typeof validation.input_hash !== "string" || !validation.input_hash) {
    throw new Error("Winning Structure validation did not return input_hash");
  }
  console.log(JSON.stringify({
    ok: true,
    toolCount: names.length,
    tools: names,
    validationValid: validation?.valid ?? null,
    errorCount: Array.isArray(validation?.errors) ? validation.errors.length : 0,
    warningCount: Array.isArray(validation?.warnings) ? validation.warnings.length : 0,
    inputHashPresent: typeof validation?.input_hash === "string" && validation.input_hash.length > 0,
    validationSource: validation.validation_source,
    responseShape: {
      top: Object.keys(result ?? {}).sort(),
      execution: Object.keys(execution ?? {}).sort(),
      data: Object.keys(execution?.data ?? {}).sort(),
      structured: Object.keys(structured ?? {}).sort(),
    },
  }, null, 2));
} finally {
  psql(`update board_api_keys set revoked_at=now() where id=${q(keyId)}::uuid;`);
}
