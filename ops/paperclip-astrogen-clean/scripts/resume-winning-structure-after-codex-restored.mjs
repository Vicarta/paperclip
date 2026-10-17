#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const ISSUE_IDENTIFIERS = ["AST-1070", "AST-1074"];
const STORED_RUN_IDS = {
  "AST-1070": "wsrun_20260721104519045648_7c45f18063",
  "AST-1074": "wsrun_20260721105316405134_8bd5e07e83",
};

function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
  return result.stdout.trim();
}

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function psql(sql) {
  return run("sudo", [
    "docker", "exec", "-i", DB_CONTAINER,
    "psql", "-U", "paperclip", "-d", "paperclip", "-v", "ON_ERROR_STOP=1", "-At",
  ], sql);
}

async function request(token, method, pathname, body, runId) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(runId ? { "X-Paperclip-Run-Id": runId } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${pathname} returned ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const keyHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id,user_id,name,key_hash,expires_at)
    values (${quote(keyId)}::uuid,${quote(USER_ID)},'resume-winning-structure-after-codex-restored',${quote(keyHash)},now()+interval '15 minutes');
  `);

  try {
    const resumed = [];
    for (const identifier of ISSUE_IDENTIFIERS) {
      const issueId = psql(`select id from issues where identifier=${quote(identifier)} limit 1;`);
      if (!issueId) throw new Error(`${identifier} not found`);
      const issue = await request(token, "GET", `/issues/${issueId}`);
      if (issue.status !== "blocked") {
        resumed.push({ identifier, changed: false, status: issue.status });
        continue;
      }
      const latestComment = psql(`
        select body from issue_comments where issue_id=${quote(issueId)}::uuid order by created_at desc limit 1;
      `);
      const isRestoredQuotaBlocker = latestComment.includes("usage limit");
      const isPromptOnlyToolBlocker = latestComment.includes("plugin_tool_execution_unavailable");
      if (!isRestoredQuotaBlocker && !isPromptOnlyToolBlocker) {
        throw new Error(`${identifier} is blocked for a reason other than the restored Codex quota`);
      }
      const runId = STORED_RUN_IDS[identifier];
      await request(token, "PATCH", `/issues/${issueId}`, {
        status: "todo",
        blockedByIssueIds: [],
        comment: `Codex resource availability and plugin tools are restored. The native case already stores run_id ${runId}; continue that run only and do not call start again.`,
      }, issue.lastRunId ?? undefined);
      resumed.push({ identifier, changed: true, status: "todo" });
    }
    console.log(JSON.stringify({ ok: true, resumed }, null, 2));
  } finally {
    psql(`update board_api_keys set revoked_at=now(),last_used_at=now() where id=${quote(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
