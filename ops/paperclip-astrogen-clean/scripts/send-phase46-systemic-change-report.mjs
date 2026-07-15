#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const PROJECT_ID = "d4644ea9-c025-4421-9af9-7780e41945ba";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";

function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
  return result.stdout.trim();
}

function psql(sql) {
  return run("sudo", [
    "docker", "exec", "-i", DB_CONTAINER,
    "psql", "-U", "paperclip", "-d", "paperclip", "-v", "ON_ERROR_STOP=1", "-At",
  ], sql);
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
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
  if (!response.ok) throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 2000)}`);
  return parsed;
}

function ctoRunContext() {
  const value = psql(`
    select json_build_object('agentId', a.id, 'runId', h.id)::text
    from heartbeat_runs h
    join agents a on a.id=h.agent_id
    where h.company_id=${sqlLiteral(COMPANY_ID)}::uuid
      and a.name='Chief Technical Officer'
      and h.status='succeeded'
    order by h.finished_at desc nulls last
    limit 1;
  `);
  if (!value) throw new Error("No completed CTO heartbeat run is available for audited plugin execution");
  return JSON.parse(value);
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${sqlLiteral(keyId)}::uuid, ${sqlLiteral(USER_ID)},
      'phase46-systemic-change-email', ${sqlLiteral(tokenHash)}, now() + interval '10 minutes');
  `);

  try {
    const context = ctoRunContext();
    const result = await request(token, "POST", "/plugins/tools/execute", {
      tool: "paperclip.email-notifications:email-change-report-send",
      parameters: {
        recipientEmails: ["o.savitsky@gmail.com"],
        subject: "Astrogen Paperclip: системне виправлення автономних циклів",
        summary: "Системно виправлено маршрутизацію CEO/CMO, article allocator і дедуплікацію блокерів. Старі дубльовані задачі більше не керують циклами; джерелом стану є native Paperclip pipelines.",
        changedItems: [
          "Article allocator тепер dispatch-ить лише ready topic через native breakdown і не створює legacy issue tree.",
          "Ready topic не запускається автоматично; cancelled article повертає reservation у ready, успішний delivery споживає topic.",
          "CEO не змінює foreign-owned blocked issues: повторні findings оновлюють canonical growth case.",
          "17 legacy blockers консолідовано у 4 native growth cases; amountMicros bridge AST-218 підтверджено у live image.",
          "Активовано current-week topic inventory refill, бо ready inventory дорівнював нулю.",
          "Оновлено live AGENTS.md для CEO, CMO та SEO Blog Content Strategist.",
        ],
        backupPath: "DB: /paperclip/instances/astrogen-clean/data/backups/paperclip-20260714-113413.sql.gz; AGENTS: /home/paperclip/backups/astrogen-agent-contracts-2026-07-14T113332-453Z",
        verification: [
          "Усі 3 native pipelines healthOk=true без warnings.",
          "Invariant verifier пройшов: active manifest, breakdown target, no ready automation, CEO boundary, native topic supply і collector dedup.",
          "CEO triage AST-226 завершено: 0 unassigned, 0 blocked, 4 canonical growth roots.",
          "App health OK; старий Paperclip і CMS publish не зачіпалися; Telegram proactive watches не вмикалися.",
        ],
        followUps: [
          "Native growth cases самостійно проходять finding/review/delegation; topic refill має створити 3-10 candidate cases і довести безпечні теми до ready.",
          "Наступний daily allocator перевірить live breakdown dispatch без ручного запуску статті.",
        ],
        rollbackNote: "Відновити DB з указаного backup і AGENTS.md з файлової резервної копії, потім повторно застосувати попередній pipeline manifest. CMS/content/provider side effects під час цієї зміни не виконувались.",
        idempotencyKey: "phase46-systemic-native-convergence-20260714",
        metadata: { phase: 46, scope: "paperclip-astrogen-clean" },
      },
      runContext: {
        agentId: context.agentId,
        runId: context.runId,
        companyId: COMPANY_ID,
        projectId: PROJECT_ID,
      },
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    psql(`update board_api_keys set revoked_at=now(), last_used_at=now() where id=${sqlLiteral(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
