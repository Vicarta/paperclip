#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";

function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
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

async function response(token, method, pathname, body) {
  const result = await fetch(`${API_BASE}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await result.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!result.ok) throw new Error(`${method} ${pathname} returned ${result.status}: ${text.slice(0, 2_000)}`);
  return parsed;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const boardToken = `pcp_board_${randomBytes(24).toString("hex")}`;
  const boardKeyId = randomUUID();
  const tokenHash = createHash("sha256").update(boardToken).digest("hex");
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${sqlLiteral(boardKeyId)}::uuid, ${sqlLiteral(USER_ID)},
      'native-case-inventory-agent-verification', ${sqlLiteral(tokenHash)},
      now() + interval '15 minutes');
  `);

  let agent = null;
  let agentKey = null;
  try {
    const agents = await response(boardToken, "GET", `/companies/${COMPANY_ID}/agents`);
    agent = agents.find((item) => item.name === "Chief Marketing Officer");
    assert(agent, "Chief Marketing Officer not found");
    agentKey = await response(boardToken, "POST", `/agents/${agent.id}/keys`, {
      name: `native-case-inventory-smoke-${boardKeyId}`,
    });
    assert(agentKey?.token, "Temporary CMO agent key was not returned");

    const pipelines = await response(agentKey.token, "GET", `/companies/${COMPANY_ID}/pipelines`);
    const byKey = new Map(pipelines.map((pipeline) => [pipeline.key, pipeline]));
    const topics = byKey.get("astrogen-topic-inventory");
    const articles = byKey.get("astrogen-article-production");
    const growth = byKey.get("astrogen-growth-actions");
    assert(topics && articles && growth, "Required native pipeline ids were not discoverable by CMO");

    const readyTopics = await response(
      agentKey.token,
      "GET",
      `/pipelines/${topics.id}/cases?stageKey=ready&terminal=false&limit=10&offset=0`,
    );
    const secondReadyTopic = await response(
      agentKey.token,
      "GET",
      `/pipelines/${topics.id}/cases?stageKey=ready&terminal=false&limit=1&offset=1`,
    );
    const articleWip = await response(
      agentKey.token,
      "GET",
      `/pipelines/${articles.id}/cases?terminal=false&limit=10&offset=0`,
    );
    const refillCaseKey = "growth:topic-inventory-refill:2026-W29";
    const refill = await response(
      agentKey.token,
      "GET",
      `/pipelines/${growth.id}/cases?caseKey=${encodeURIComponent(refillCaseKey)}&terminal=false&limit=10`,
    );

    assert(readyTopics.length > 0 && readyTopics.length <= 10, `Unexpected ready topic count: ${readyTopics.length}`);
    assert(secondReadyTopic.length === Math.min(1, Math.max(0, readyTopics.length - 1)), "Pagination did not return the expected second ready topic");
    assert(articleWip.length <= 10, `Article WIP exceeded bound: ${articleWip.length}`);
    assert(refill.length <= 1, `Exact canonical refill lookup returned duplicates: ${refill.length}`);

    console.log(JSON.stringify({
      mode: "agent-key-read-only-smoke",
      agent: { id: agent.id, name: agent.name },
      pipelines: {
        topics: topics.id,
        articles: articles.id,
        growth: growth.id,
      },
      readyTopics: readyTopics.map((row) => ({
        id: row.case.id,
        caseKey: row.case.caseKey,
        stageKey: row.stage.key,
        version: row.case.version,
      })),
      secondPageCount: secondReadyTopic.length,
      openArticleWipCount: articleWip.length,
      canonicalRefillCount: refill.length,
    }, null, 2));
  } finally {
    if (agent?.id && agentKey?.id) {
      await response(boardToken, "DELETE", `/agents/${agent.id}/keys/${agentKey.id}`);
    }
    psql(`
      update board_api_keys
      set revoked_at = now(), last_used_at = now()
      where id = ${sqlLiteral(boardKeyId)}::uuid;
    `);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
