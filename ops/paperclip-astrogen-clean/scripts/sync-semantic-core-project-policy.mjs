#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const PAPERCLIP_PROJECT_ID = "d4644ea9-c025-4421-9af9-7780e41945ba";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const SEMANTIC_PLUGIN = "paperclip.semantic-core-mcp-agent-tools";
const PAYLOAD_PLUGIN = "paperclip.payload-cms-agent-tools";
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const POLICY_PATH = resolve(SCRIPT_DIR, "../reference/semantic-core-project-policy.json");
const AUDIENCE_PATH = resolve(SCRIPT_DIR, "../reference/semantic-core-audience-summary.md");
const COMPANY_DIR = process.env.ASTROGEN_COMPANY_DIR ?? "/home/paperclip/companies/astrogen-clean";
const BACKUP_ROOT = process.env.ASTROGEN_BACKUP_DIR ?? "/home/paperclip/backups";

function run(command, args, input) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
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

function timestamp() {
  return new Date().toISOString().replaceAll(":", "").replaceAll(".", "-");
}

function syncReferenceFiles() {
  const backupDir = join(BACKUP_ROOT, `semantic-core-project-policy-${timestamp()}`);
  const files = [POLICY_PATH, AUDIENCE_PATH];
  const results = [];
  for (const source of files) {
    const target = join(COMPANY_DIR, "reference", source.split("/").at(-1));
    const before = existsSync(target) ? readFileSync(target) : null;
    const desired = readFileSync(source);
    let backupPath = null;
    const changed = before === null || !before.equals(desired);
    if (changed) {
      mkdirSync(dirname(target), { recursive: true, mode: 0o755 });
      if (before !== null) {
        mkdirSync(backupDir, { recursive: true, mode: 0o700 });
        backupPath = join(backupDir, source.split("/").at(-1));
        copyFileSync(target, backupPath);
      }
      const temporary = `${target}.tmp-${process.pid}`;
      copyFileSync(source, temporary);
      chmodSync(temporary, 0o644);
      renameSync(temporary, target);
    }
    results.push({ target, backupPath, changed, sha256: createHash("sha256").update(desired).digest("hex") });
  }
  return results;
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
  if (!response.ok) throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 1800)}`);
  return text ? JSON.parse(text) : null;
}

function unwrap(response) {
  return response?.result?.data?.structuredContent
    ?? response?.result?.data
    ?? response?.data?.structuredContent
    ?? response?.data
    ?? response?.result
    ?? response;
}

function stringValue(value) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    const candidate = value.value ?? value.text ?? value.title;
    if (typeof candidate === "string") return candidate.trim();
  }
  return "";
}

function semanticExistingPage(doc) {
  const slug = stringValue(doc.slug);
  const title = stringValue(doc.title) || stringValue(doc.meta?.title);
  if (!slug || !title) return null;
  return {
    url: `https://astrogen.com.ua/blog/${slug}/`,
    page_type: "blog_article",
    section: "blog",
    product_binding: null,
    current_title: title,
    current_h1: title,
    current_ownership: "blog",
    current_status: stringValue(doc._status) || stringValue(doc.status) || "draft",
  };
}

async function main() {
  const policy = JSON.parse(readFileSync(POLICY_PATH, "utf8"));
  const audienceSummary = readFileSync(AUDIENCE_PATH, "utf8").trim();
  const referenceFiles = syncReferenceFiles();
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const keyHash = createHash("sha256").update(token).digest("hex");
  psql(`insert into board_api_keys (id,user_id,name,key_hash,expires_at) values (${q(keyId)}::uuid,${q(USER_ID)},'sync-semantic-core-project-policy',${q(keyHash)},now()+interval '15 minutes');`);

  try {
    const paperclipBackup = await request(token, "POST", "/instance/database-backups", {});
    const context = JSON.parse(psql(`
      select json_build_object(
        'agentId',a.id,
        'runId',h.id,
        'companyId',a.company_id,
        'projectId',${q(PAPERCLIP_PROJECT_ID)}::uuid
      )::text
      from agents a
      join lateral (
        select id from heartbeat_runs
        where company_id=a.company_id and agent_id=a.id
        order by created_at desc limit 1
      ) h on true
      where a.company_id=${q(COMPANY_ID)}::uuid and a.name='SEO Semantic Core Strategist'
      limit 1;
    `));

    const existingPages = [];
    for (let page = 1; page <= 10; page += 1) {
      const response = await request(token, "POST", "/agents/me/plugin-tools/execute", {
        tool: `${PAYLOAD_PLUGIN}:payload_cms_list_blog_posts`,
        parameters: { status: "any", limit: 100, page, depth: 0, sort: "-updatedAt" },
        runContext: context,
      });
      const docs = Array.isArray(unwrap(response)?.docs) ? unwrap(response).docs : [];
      existingPages.push(...docs.map(semanticExistingPage).filter(Boolean));
      if (docs.length < 100) break;
    }
    if (existingPages.length === 0) throw new Error("Payload CMS returned no blog inventory; refusing project replacement");

    const registerResponse = await request(token, "POST", "/agents/me/plugin-tools/execute", {
      tool: `${SEMANTIC_PLUGIN}:register-project`,
      parameters: {
        project_id: policy.project_id,
        display_name: policy.display_name,
        inputs: {
          project_config: policy.project_config,
          seed_catalog: policy.seed_catalog,
          existing_pages: existingPages,
          audience_summary: audienceSummary,
        },
      },
      runContext: context,
    });
    const registration = unwrap(registerResponse);
    if (!registration?.project_id && registration?.status === "error") {
      throw new Error(`Semantic Core registration failed: ${JSON.stringify(registration).slice(0, 1600)}`);
    }

    const validationResponse = await request(token, "POST", "/agents/me/plugin-tools/execute", {
      tool: `${SEMANTIC_PLUGIN}:validate-project`,
      parameters: { project_id: policy.project_id },
      runContext: context,
    });
    const validation = unwrap(validationResponse);
    if (validation?.status !== "ok" || (Array.isArray(validation?.errors) && validation.errors.length > 0)) {
      throw new Error(`Semantic Core validation failed: ${JSON.stringify(validation).slice(0, 1600)}`);
    }

    const policyChanged = referenceFiles.some((file) =>
      file.target.endsWith("semantic-core-project-policy.json") && file.changed);
    const resetAgentNames = [
      "Chief Marketing Officer",
      "SEO Semantic Core Strategist",
      "SEO Semantic Core Validator",
      "SEO Blog Content Strategist",
    ];
    const resetAgents = [];
    if (policyChanged) {
      const rows = psql(`
        select json_build_object('id',id,'name',name)::text
        from agents
        where company_id=${q(COMPANY_ID)}::uuid
          and name in (${resetAgentNames.map(q).join(",")})
        order by name;
      `).split("\n").filter(Boolean).map((row) => JSON.parse(row));
      for (const agent of rows) {
        const state = await request(token, "POST", `/agents/${agent.id}/runtime-state/reset-session`, {
          taskKey: null,
        });
        resetAgents.push({
          id: agent.id,
          name: agent.name,
          clearedTaskSessions: state?.clearedTaskSessions ?? null,
        });
      }
    }

    const policyHash = createHash("sha256").update(readFileSync(POLICY_PATH)).digest("hex");
    process.stdout.write(`${JSON.stringify({
      ok: true,
      semanticProjectId: policy.project_id,
      validationStatus: validation.status,
      existingPageCount: existingPages.length,
      configuredLayerPolicies: Object.keys(policy.project_config.semantic_expansion.layer_policies),
      policyHash,
      policyChanged,
      resetAgents,
      referenceFiles,
      paperclipBackup,
    }, null, 2)}\n`);
  } finally {
    psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
