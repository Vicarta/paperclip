#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const PROJECT_ID = "d4644ea9-c025-4421-9af9-7780e41945ba";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_MANIFEST = resolve(SCRIPT_DIR, "../manifests/pipelines.yaml");

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
  return run("sudo", [
    "docker", "exec", "-i", DB_CONTAINER,
    "psql", "-U", "paperclip", "-d", "paperclip",
    "-v", "ON_ERROR_STOP=1", "-At",
  ], sql);
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function loadManifest(pathname) {
  const source = [
    "import json, pathlib, sys, yaml",
    "path = pathlib.Path(sys.argv[1])",
    "print(json.dumps(yaml.safe_load(path.read_text()), ensure_ascii=False))",
  ].join("; ");
  return JSON.parse(run("python3", ["-c", source, pathname]));
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
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

function desiredReviewConfig(review, agentByName) {
  if (!review) return {};
  const approver = agentByName.get(review.approver);
  if (!approver) throw new Error(`Review approver not found: ${review.approver}`);
  return {
    requireApproval: true,
    approver: { kind: "agent", id: approver.id },
    approveToStageKey: review.approveTo,
    rejectToStageKey: review.rejectTo,
    ...(review.requestChangesTo ? { requestChangesToStageKey: review.requestChangesTo } : {}),
    requireRejectReason: true,
    requireRequestChangesReason: true,
  };
}

function desiredStaticStageConfig(stage, pipelines) {
  const config = structuredClone(stage.config ?? {});
  const breakdown = config.breakdown;
  if (breakdown) {
    const targetPipelineKey = breakdown.targetPipelineKey;
    if (typeof targetPipelineKey !== "string" || !targetPipelineKey.trim()) {
      throw new Error(`Stage ${stage.key} breakdown targetPipelineKey is required`);
    }
    const targetPipeline = pipelines.find((candidate) => candidate.key === targetPipelineKey);
    if (!targetPipeline) {
      throw new Error(`Stage ${stage.key} breakdown target pipeline is missing: ${targetPipelineKey}`);
    }
    breakdown.targetPipelineId = targetPipeline.id;
    delete breakdown.targetPipelineKey;
  }
  const intakeGuard = config.intakeGuard;
  if (intakeGuard) {
    const requiredParentPipelineKey = intakeGuard.requiredParentPipelineKey;
    if (typeof requiredParentPipelineKey !== "string" || !requiredParentPipelineKey.trim()) {
      throw new Error(`Stage ${stage.key} intakeGuard requiredParentPipelineKey is required`);
    }
    const parentPipeline = pipelines.find((candidate) => candidate.key === requiredParentPipelineKey);
    if (!parentPipeline) {
      throw new Error(`Stage ${stage.key} intakeGuard parent pipeline is missing: ${requiredParentPipelineKey}`);
    }
    intakeGuard.requiredParentPipelineId = parentPipeline.id;
    delete intakeGuard.requiredParentPipelineKey;
  }
  return config;
}

function initialStageConfig(stage, review, agentByName) {
  const config = structuredClone(stage.config ?? {});
  delete config.breakdown;
  delete config.intakeGuard;
  return {
    ...config,
    ...desiredReviewConfig(review, agentByName),
  };
}

async function ensurePipelineShells(token, definitions, pipelines, agentByName) {
  for (const definition of definitions) {
    if (pipelines.some((candidate) => candidate.key === definition.key)) continue;
    const pipeline = await request(token, "POST", `/companies/${COMPANY_ID}/pipelines`, {
      key: definition.key,
      name: definition.name,
      description: definition.description,
      projectId: PROJECT_ID,
      enforceTransitions: false,
      stages: definition.stages.map((stage) => ({
        key: stage.key,
        name: stage.name,
        kind: stage.kind,
        position: stage.position,
        config: initialStageConfig(stage, definition.stageAutomation?.[stage.key]?.review, agentByName),
      })),
    });
    pipelines.push(pipeline);
  }
}

function stageNeedsUpdate(current, desired, automation, agentByName, pipelines) {
  if (current.name !== desired.name || current.kind !== desired.kind || current.position !== desired.position) {
    return true;
  }
  const currentConfig = current.config ?? {};
  const staticConfig = desiredStaticStageConfig(desired, pipelines);
  for (const [key, value] of Object.entries(staticConfig)) {
    if (stableJson(currentConfig[key] ?? null) !== stableJson(value)) return true;
  }
  const reviewConfig = desiredReviewConfig(automation?.review, agentByName);
  for (const [key, value] of Object.entries(reviewConfig)) {
    if (stableJson(currentConfig[key] ?? null) !== stableJson(value)) return true;
  }
  if (!automation) {
    return Boolean(currentConfig.onEnter || currentConfig.automation);
  }
  const owner = agentByName.get(automation.owner);
  if (!owner) throw new Error(`Stage owner not found: ${automation.owner}`);
  const currentAutomation = currentConfig.automation ?? {};
  const currentOnEnter = currentConfig.onEnter ?? {};
  return currentOnEnter.type !== "run_routine"
    || typeof currentOnEnter.routineId !== "string"
    || currentAutomation.assigneeAgentId !== owner.id
    || (currentAutomation.instructionsBody ?? "").trim() !== automation.instructions.trim();
}

function stagePatch(desired, automation, agentByName, pipelines, currentConfig = {}) {
  const staticConfig = desiredStaticStageConfig(desired, pipelines);
  const config = {
    ...currentConfig,
    ...staticConfig,
    ...desiredReviewConfig(automation?.review, agentByName),
  };
  if (!staticConfig.breakdown) delete config.breakdown;
  if (!automation) {
    delete config.automation;
    delete config.onEnter;
  }
  if (automation) {
    const owner = agentByName.get(automation.owner);
    if (!owner) throw new Error(`Stage owner not found: ${automation.owner}`);
    config.automation = {
      assigneeAgentId: owner.id,
      instructionsBody: automation.instructions.trim(),
      projectId: PROJECT_ID,
    };
  }
  return {
    name: desired.name,
    kind: desired.kind,
    position: desired.position,
    config,
  };
}

function normalizedTransitions(detail) {
  const stageKeyById = new Map(detail.stages.map((stage) => [stage.id, stage.key]));
  return detail.transitions.map((edge) => ({
    from: stageKeyById.get(edge.fromStageId),
    to: stageKeyById.get(edge.toStageId),
    label: edge.label ?? null,
  })).sort((a, b) => stableJson(a).localeCompare(stableJson(b)));
}

function desiredTransitions(definition) {
  return definition.transitions.map((edge) => ({
    from: edge.from,
    to: edge.to,
    label: edge.label ?? null,
  })).sort((a, b) => stableJson(a).localeCompare(stableJson(b)));
}

function contractDocument(definition) {
  return [
    `# ${definition.name} Contract`,
    "",
    definition.description,
    "",
    "## Required fields",
    ...(definition.requiredFields ?? []).map((field) => `- ${field}`),
    "",
    "## Invariants",
    ...(definition.invariants ?? []).map((rule) => `- ${rule}`),
  ].join("\n");
}

function grantPipelinePermissions(definitions, pipelineByKey, agentByName) {
  const ceo = agentByName.get("CEO");
  const cmo = agentByName.get("Chief Marketing Officer");
  const growthPipeline = pipelineByKey.get("astrogen-growth-actions");
  if (!ceo || !cmo || !growthPipeline) throw new Error("Manager permission targets are missing");
  const pipelineIdsByAgentId = new Map();
  for (const definition of definitions) {
    const pipeline = pipelineByKey.get(definition.key);
    if (!pipeline) throw new Error(`Synced pipeline missing: ${definition.key}`);
    for (const automation of Object.values(definition.stageAutomation ?? {})) {
      const owner = agentByName.get(automation.owner);
      if (!owner) throw new Error(`Stage owner not found: ${automation.owner}`);
      const ids = pipelineIdsByAgentId.get(owner.id) ?? new Set();
      ids.add(pipeline.id);
      pipelineIdsByAgentId.set(owner.id, ids);
    }
    for (const writerName of definition.writerAgents ?? []) {
      const writer = agentByName.get(writerName);
      if (!writer) throw new Error(`Pipeline writer not found: ${writerName}`);
      const ids = pipelineIdsByAgentId.get(writer.id) ?? new Set();
      ids.add(pipeline.id);
      pipelineIdsByAgentId.set(writer.id, ids);
    }
  }
  pipelineIdsByAgentId.set(ceo.id, new Set([growthPipeline.id]));
  const grants = [
    { agentId: ceo.id, key: "tasks:assign", scope: null },
    { agentId: cmo.id, key: "tasks:assign", scope: null },
    ...[...pipelineIdsByAgentId.entries()].map(([agentId, ids]) => ({
      agentId,
      key: "pipelines:write",
      scope: { pipelineIds: [...ids].sort() },
    })),
  ];
  for (const grant of grants) {
    const scopeSql = grant.scope ? `${sqlLiteral(JSON.stringify(grant.scope))}::jsonb` : "null";
    psql(`
      insert into principal_permission_grants (
        id, company_id, principal_type, principal_id, permission_key, scope,
        granted_by_user_id, created_at, updated_at
      ) values (
        gen_random_uuid(), ${sqlLiteral(COMPANY_ID)}::uuid, 'agent',
        ${sqlLiteral(grant.agentId)}, ${sqlLiteral(grant.key)}, ${scopeSql},
        ${sqlLiteral(USER_ID)}, now(), now()
      )
      on conflict (company_id, principal_type, principal_id, permission_key)
      do update set scope=excluded.scope, granted_by_user_id=excluded.granted_by_user_id, updated_at=now();
    `);
  }
}

async function syncPipeline(token, definition, pipelines, agentByName) {
  let pipeline = pipelines.find((candidate) => candidate.key === definition.key) ?? null;
  let changed = false;
  if (!pipeline) {
    pipeline = await request(token, "POST", `/companies/${COMPANY_ID}/pipelines`, {
      key: definition.key,
      name: definition.name,
      description: definition.description,
      projectId: PROJECT_ID,
      enforceTransitions: false,
      stages: definition.stages.map((stage) => ({
        key: stage.key,
        name: stage.name,
        kind: stage.kind,
        position: stage.position,
        config: {
          ...desiredStaticStageConfig(stage, pipelines),
          ...desiredReviewConfig(definition.stageAutomation?.[stage.key]?.review, agentByName),
        },
      })),
    });
    pipelines.push(pipeline);
    changed = true;
  } else if (
    pipeline.name !== definition.name
    || pipeline.description !== definition.description
    || pipeline.enforceTransitions !== definition.enforceTransitions
  ) {
    pipeline = await request(token, "PATCH", `/pipelines/${pipeline.id}`, {
      name: definition.name,
      description: definition.description,
      enforceTransitions: definition.enforceTransitions,
      archived: false,
    });
    changed = true;
  }

  if (pipeline.projectId !== PROJECT_ID) {
    throw new Error(`Pipeline ${definition.key} has unexpected projectId ${pipeline.projectId ?? "null"}`);
  }

  let detail = await request(token, "GET", `/pipelines/${pipeline.id}`);
  const desiredKeys = new Set(definition.stages.map((stage) => stage.key));

  for (const stageDefinition of definition.stages) {
    let stage = detail.stages.find((candidate) => candidate.key === stageDefinition.key) ?? null;
    const automation = definition.stageAutomation?.[stageDefinition.key] ?? null;
    if (!stage) {
      stage = await request(token, "POST", `/pipelines/${pipeline.id}/stages`, {
        key: stageDefinition.key,
        name: stageDefinition.name,
        kind: stageDefinition.kind,
        position: stageDefinition.position,
        config: {
          ...desiredStaticStageConfig(stageDefinition, pipelines),
          ...desiredReviewConfig(automation?.review, agentByName),
        },
      });
      changed = true;
    }
    if (stageNeedsUpdate(stage, stageDefinition, automation, agentByName, pipelines)) {
      stage = await request(token, "PATCH", `/pipelines/${pipeline.id}/stages/${stage.id}`, stagePatch(
        stageDefinition,
        automation,
        agentByName,
        pipelines,
        stage.config ?? {},
      ));
      changed = true;
    }
  }

  detail = await request(token, "GET", `/pipelines/${pipeline.id}`);
  const unexpected = detail.stages.filter((stage) => !desiredKeys.has(stage.key));
  for (const stage of unexpected) {
    const replacementKey = definition.stageMigrations?.[stage.key];
    if (!replacementKey) {
      throw new Error(`Pipeline ${definition.key} has unmanaged stage without migration: ${stage.key}`);
    }
    const replacement = detail.stages.find((candidate) => candidate.key === replacementKey);
    if (!replacement) {
      throw new Error(`Pipeline ${definition.key} stage migration target is missing: ${stage.key} -> ${replacementKey}`);
    }
    await request(
      token,
      "DELETE",
      `/pipelines/${pipeline.id}/stages/${stage.id}?moveCasesToStageId=${replacement.id}`,
    );
    changed = true;
  }

  if (unexpected.length > 0) {
    detail = await request(token, "GET", `/pipelines/${pipeline.id}`);
  }
  if (stableJson(normalizedTransitions(detail)) !== stableJson(desiredTransitions(definition))) {
    await request(token, "PUT", `/pipelines/${pipeline.id}/transitions`, {
      enforceTransitions: definition.enforceTransitions,
      transitions: definition.transitions.map((edge) => ({
        fromStageKey: edge.from,
        toStageKey: edge.to,
        label: edge.label ?? null,
      })),
    });
    changed = true;
  }

  const contractBody = contractDocument(definition);
  let currentContract = null;
  try {
    currentContract = await request(token, "GET", `/pipelines/${pipeline.id}/documents/contract`);
  } catch (error) {
    if (!String(error).includes("returned 404")) throw error;
  }
  const currentBody = currentContract?.revision?.body ?? currentContract?.document?.latestBody ?? null;
  if (currentBody !== contractBody) {
    await request(token, "PUT", `/pipelines/${pipeline.id}/documents/contract`, {
      title: `${definition.name} Contract`,
      body: contractBody,
      baseRevisionId: currentContract?.revision?.id ?? currentContract?.document?.latestRevisionId ?? null,
    });
    changed = true;
  }

  const health = await request(token, "GET", `/pipelines/${pipeline.id}/health`);
  return { pipeline: { ...pipeline, id: pipeline.id }, changed, health };
}

async function main() {
  const skipBackup = process.argv.includes("--skip-backup");
  const manifestPath = process.argv.find((arg) => arg.startsWith("--manifest="))?.slice("--manifest=".length)
    ?? DEFAULT_MANIFEST;
  const manifest = loadManifest(manifestPath);
  if (manifest?.version !== 1 || !Array.isArray(manifest.pipelines)) {
    throw new Error("Unsupported pipelines manifest");
  }

  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const keyId = randomUUID();
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${sqlLiteral(keyId)}::uuid, ${sqlLiteral(USER_ID)},
      'phase46-native-pipeline-sync', ${sqlLiteral(tokenHash)}, now() + interval '20 minutes');
  `);

  try {
    const backup = skipBackup
      ? null
      : await request(token, "POST", "/instance/database-backups", {});
    const [pipelineResponse, agentResponse] = await Promise.all([
      request(token, "GET", `/companies/${COMPANY_ID}/pipelines`),
      request(token, "GET", `/companies/${COMPANY_ID}/agents`),
    ]);
    const pipelines = asArray(pipelineResponse, ["items", "pipelines"]);
    const agents = asArray(agentResponse, ["items", "agents"]);
    const agentByName = new Map(agents.map((agent) => [agent.name, agent]));
    await ensurePipelineShells(token, manifest.pipelines, pipelines, agentByName);
    const results = [];
    for (const definition of manifest.pipelines) {
      results.push(await syncPipeline(token, definition, pipelines, agentByName));
    }
    const pipelineByKey = new Map(results.map((result) => [result.pipeline.key, result.pipeline]));
    grantPipelinePermissions(manifest.pipelines, pipelineByKey, agentByName);

    const unhealthy = results.filter((result) => !result.health.ok);
    console.log(JSON.stringify({
      mode: "apply-and-verify",
      backup: backup
        ? {
            filename: backup.filename ?? null,
            backupDir: backup.backupDir ?? null,
            sizeBytes: backup.sizeBytes ?? null,
            finishedAt: backup.finishedAt ?? null,
          }
        : { skipped: true },
      pipelines: results.map((result) => ({
        key: result.pipeline.key,
        id: result.pipeline.id,
        changed: result.changed,
        healthOk: result.health.ok,
        warnings: result.health.warnings,
      })),
    }, null, 2));
    if (unhealthy.length) process.exitCode = 2;
  } finally {
    psql(`
      update board_api_keys set revoked_at=now(), last_used_at=now()
      where id=${sqlLiteral(keyId)}::uuid;
    `);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
