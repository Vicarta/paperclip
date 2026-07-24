#!/usr/bin/env node

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const APP_CONTAINER = "paperclip-astrogen-clean-app-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const WRITER_NAME = "SEO Blog Article Writer (Claude)";
const BLOCKED_WRITER_ISSUE = process.env.WRITER_ISSUE_IDENTIFIER ?? "AST-1734";
const CAPACITY_ISSUE = process.env.CAPACITY_ISSUE_IDENTIFIER ?? "AST-1735";
const CAPACITY_APPROVAL_ID = process.env.CAPACITY_APPROVAL_ID
  ?? "7afe5328-1e40-4955-bcf3-cacb1a9704b1";
const WRITER_INSTRUCTIONS_PATH =
  "/home/paperclip/companies/astrogen-clean/agents/seo-blog-article-writer/AGENTS.md";

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

function q(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function claudeAuthStatus() {
  return JSON.parse(run("sudo", [
    "docker", "exec", "-u", "node", APP_CONTAINER, "claude", "auth", "status",
  ]));
}

function normalizeClaudeConfigOwnership() {
  run("sudo", [
    "docker", "exec", APP_CONTAINER,
    "chown", "-R", "node:node", "/paperclip/.claude",
  ]);
  run("sudo", [
    "docker", "exec", APP_CONTAINER,
    "chmod", "700", "/paperclip/.claude",
  ]);
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
    throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 1600)}`);
  }
  return parsed;
}

function writerAdapterConfig() {
  const instructionsRoot = "/companies/astrogen/agents/seo-blog-article-writer";
  return {
    cwd: "/companies/astrogen",
    env: {
      PAPERCLIP_API_URL: { type: "plain", value: "http://127.0.0.1:3100" },
    },
    model: "sonnet",
    graceSec: 15,
    timeoutSec: 1800,
    maxTurnsPerRun: 32,
    instructionsFilePath: `${instructionsRoot}/AGENTS.md`,
    instructionsRootPath: instructionsRoot,
    instructionsEntryFile: "AGENTS.md",
    instructionsBundleMode: "external",
    dangerouslySkipPermissions: true,
  };
}

function issueId(identifier) {
  return psql(`
    select id
    from issues
    where company_id=${q(COMPANY_ID)}::uuid
      and identifier=${q(identifier)}
    limit 1;
  `);
}

function activeIssueRun(identifier) {
  const raw = psql(`
    select coalesce(json_build_object(
      'id', h.id,
      'status', h.status,
      'agentId', h.agent_id
    )::text, '')
    from issues i
    left join heartbeat_runs h on h.id=i.execution_run_id
    where i.company_id=${q(COMPANY_ID)}::uuid
      and i.identifier=${q(identifier)}
    limit 1;
  `);
  return raw ? JSON.parse(raw) : null;
}

function patchWriterInstructions(backupDir) {
  const replacements = [
    [
      "Writes canonical Ukrainian article artifacts through OpenRouter from accepted briefs only.",
      "Writes canonical Ukrainian article artifacts through the authenticated Claude CLI subscription from accepted briefs only.",
    ],
    [
      "- This is the shared writer-workspace contract. Claude is the primary writer. ChatGPT may execute only after the case records a Claude/provider/protocol blocker or an explicit CMO fallback decision; ChatGPT must never self-trigger or replace a healthy Claude path.",
      "- This is the shared writer-workspace contract. Claude is the primary writer through the authenticated `claude_local` subscription adapter. ChatGPT may execute only after the case records a Claude CLI/provider/protocol blocker or an explicit CMO fallback decision; ChatGPT must never self-trigger or replace a healthy Claude path.",
    ],
    [
      "- The Claude writer runs through the OpenRouter prompt adapter. It has no callable shell, browser, or Paperclip API tools: never emit `<tool_call>`, shell commands, or raw API instructions. Return the adapter's single JSON protocol response with the complete attachment artifact. Include typed `pipelineTransition` when the native state machine exposes multiple allowed next stages; when exactly one transition exists, it may be omitted and Paperclip selects that route deterministically. Never guess between multiple routes. Paperclip validates and performs the transition before it can close the stage task.",
      "- Use Paperclip issue, document, artifact and typed pipeline tools only for the assigned draft stage. Local shell access is allowed only to read the accepted workspace inputs and create the canonical draft artifact; do not browse the web, call paid providers, modify CMS, generate images, publish content, or perform unrelated repository work. Register the complete artifact and apply the typed pipeline transition exposed by the native state machine. Never guess between multiple routes or mark the stage done without durable artifact and transition evidence.",
    ],
  ];

  const original = readFileSync(WRITER_INSTRUCTIONS_PATH, "utf8");
  let updated = original;
  for (const [before, after] of replacements) {
    if (updated.includes(after)) continue;
    if (!updated.includes(before)) {
      throw new Error(`Writer instruction contract drift: missing text ${before.slice(0, 80)}`);
    }
    updated = updated.replace(before, after);
  }
  if (updated === original) return false;

  mkdirSync(backupDir, { recursive: true });
  copyFileSync(
    WRITER_INSTRUCTIONS_PATH,
    path.join(backupDir, "seo-blog-article-writer.AGENTS.md"),
  );
  writeFileSync(WRITER_INSTRUCTIONS_PATH, updated, { mode: 0o644 });
  return true;
}

async function main() {
  normalizeClaudeConfigOwnership();
  const auth = claudeAuthStatus();
  if (auth.loggedIn !== true || auth.authMethod !== "claude.ai") {
    throw new Error("Claude CLI subscription auth is not active in the clean app container");
  }

  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const keyHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id,user_id,name,key_hash,expires_at)
    values (
      ${q(keyId)}::uuid,
      ${q(USER_ID)},
      'switch-claude-writer-to-cli',
      ${q(keyHash)},
      now() + interval '20 minutes'
    );
  `);

  try {
    const backup = await request(token, "POST", "/instance/database-backups", {});
    const instructionBackupDir = `/home/paperclip/backups/claude-writer-cli-${new Date()
      .toISOString()
      .replaceAll(/[-:.]/g, "")}`;
    const instructionsChanged = patchWriterInstructions(instructionBackupDir);
    const agentsResponse = await request(token, "GET", `/companies/${COMPANY_ID}/agents`);
    const agents = Array.isArray(agentsResponse)
      ? agentsResponse
      : agentsResponse?.items ?? agentsResponse?.agents ?? [];
    const writer = agents.find((agent) => agent.name === WRITER_NAME);
    if (!writer) throw new Error(`${WRITER_NAME} not found`);

    const adapterConfig = writerAdapterConfig();
    const environmentTest = await request(
      token,
      "POST",
      `/companies/${COMPANY_ID}/adapters/claude_local/test-environment`,
      { adapterConfig },
    );
    const helloPassed = environmentTest?.checks?.some(
      (check) => check.code === "claude_hello_probe_passed",
    );
    if (environmentTest?.status === "fail" || !helloPassed) {
      throw new Error(`Claude CLI environment probe failed: ${JSON.stringify(environmentTest)}`);
    }

    await request(token, "PATCH", `/agents/${writer.id}`, {
      adapterType: "claude_local",
      adapterConfig,
      replaceAdapterConfig: true,
    });
    if (writer.status === "error") {
      await request(token, "POST", `/agents/${writer.id}/clear-error`, {});
    }

    const capacityIssueId = issueId(CAPACITY_ISSUE);
    if (capacityIssueId) {
      const capacityIssue = await request(token, "GET", `/issues/${capacityIssueId}`);
      if (!["done", "cancelled"].includes(capacityIssue.status)) {
        await request(token, "PATCH", `/issues/${capacityIssueId}`, {
          status: "done",
          comment: [
            "OpenRouter text-capacity request superseded.",
            "",
            `Primary writer ${WRITER_NAME} now uses authenticated Claude CLI subscription mode.`,
            "OpenRouter remains configured only for image generation.",
          ].join("\n"),
        });
      }
    }

    try {
      const approval = await request(token, "GET", `/approvals/${CAPACITY_APPROVAL_ID}`);
      if (approval?.status === "pending") {
        await request(token, "POST", `/approvals/${CAPACITY_APPROVAL_ID}/reject`, {
          decisionNote: "Superseded by owner-approved Claude CLI subscription cutover; no OpenRouter text credit increase is needed.",
        });
      }
    } catch (error) {
      if (!String(error).includes("returned 404")) throw error;
    }

    const writerIssueId = issueId(BLOCKED_WRITER_ISSUE);
    if (!writerIssueId) throw new Error(`${BLOCKED_WRITER_ISSUE} not found`);
    const writerIssue = await request(token, "GET", `/issues/${writerIssueId}`);
    if (!["done", "cancelled"].includes(writerIssue.status)) {
      const activeRun = activeIssueRun(BLOCKED_WRITER_ISSUE);
      if (
        activeRun
        && ["queued", "running"].includes(activeRun.status)
        && activeRun.agentId !== writer.id
      ) {
        await request(token, "POST", `/heartbeat-runs/${activeRun.id}/cancel`, {});
      }
      await request(token, "PATCH", `/issues/${writerIssueId}`, {
        assigneeAgentId: writer.id,
        blockedByIssueIds: [],
      });
      await request(token, "PATCH", `/issues/${writerIssueId}`, {
        status: "todo",
        comment: [
          "Claude CLI subscription runtime is active.",
          "",
          "- Continue this same writer task from the accepted writer-brief.",
          "- Do not create a new article case or restart earlier Winning Structure stages.",
          "- OpenRouter text generation is no longer part of this path.",
        ].join("\n"),
      });
      await request(token, "POST", `/agents/${writer.id}/wakeup`, {
        source: "automation",
        triggerDetail: "system",
        reason: "claude_cli_writer_cutover",
        payload: {
          issueId: writerIssueId,
          taskId: writerIssueId,
          wakeReason: "claude_cli_writer_cutover",
        },
        idempotencyKey: `claude-cli-writer-cutover:${BLOCKED_WRITER_ISSUE}:v1`,
        forceFreshSession: true,
      });
    }

    const updatedWriter = await request(token, "GET", `/agents/${writer.id}`);
    console.log(JSON.stringify({
      ok: true,
      auth: {
        authMethod: auth.authMethod,
        subscriptionType: auth.subscriptionType ?? null,
      },
      backup: {
        backupDir: backup?.backupDir ?? null,
        sizeBytes: backup?.sizeBytes ?? null,
        instructionBackupDir: instructionsChanged ? instructionBackupDir : null,
      },
      environmentTest: {
        status: environmentTest.status,
        helloPassed,
      },
      writer: {
        id: updatedWriter.id,
        status: updatedWriter.status,
        adapterType: updatedWriter.adapterType,
        model: updatedWriter.adapterConfig?.model ?? null,
      },
      resumedIssue: BLOCKED_WRITER_ISSUE,
      supersededCapacityIssue: CAPACITY_ISSUE,
    }, null, 2));
  } finally {
    psql(`
      update board_api_keys
      set revoked_at=now(),last_used_at=now()
      where id=${q(keyId)}::uuid;
    `);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
