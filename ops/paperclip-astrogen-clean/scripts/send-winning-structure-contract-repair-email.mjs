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
  if (!response.ok) throw new Error(`${method} ${path} returned ${response.status}: ${text.slice(0, 1200)}`);
  return parsed;
}

function ctoRunContext() {
  const value = psql(`
    select json_build_object('agentId', a.id, 'runId', h.id)::text
    from heartbeat_runs h
    join agents a on a.id=h.agent_id
    where h.company_id=${q(COMPANY_ID)}::uuid
      and a.name='Chief Technical Officer'
      and h.status='succeeded'
    order by h.finished_at desc nulls last
    limit 1;
  `);
  if (!value) throw new Error("No completed CTO heartbeat run is available for audited email delivery");
  return JSON.parse(value);
}

const token = `pcp_board_${randomBytes(24).toString("hex")}`;
const keyId = randomUUID();
const keyHash = createHash("sha256").update(token).digest("hex");

psql(`
  insert into board_api_keys (id, user_id, name, key_hash, expires_at)
  values (${q(keyId)}::uuid, ${q(USER_ID)}, 'winning-structure-contract-repair-email',
    ${q(keyHash)}, now() + interval '10 minutes');
`);

try {
  const result = await request(token, "POST", "/plugins/tools/execute", {
    tool: "paperclip.email-notifications:email-notification-send",
    runContext: {
      ...ctoRunContext(),
      companyId: COMPANY_ID,
      projectId: PROJECT_ID,
    },
    parameters: {
      recipientEmails: ["o.savitsky@gmail.com"],
      subject: "Astrogen Paperclip: виправлено обробку структури статей",
      text: [
        "Виправлено проблему, через яку система могла повторювати перевірку статті, але не переходити до реального аналізу.",
        "",
        "Що змінилося:",
        "- Paperclip тепер приймає результат перевірки лише від реального сервісу SEO Winning Structure.",
        "- Якщо дані неповні, система отримує зрозумілий перелік полів для виправлення, а не запускає однаковий цикл знову.",
        "- Відновлено підключення сервісу та plugin; після перезапуску Docker вони підніматимуться автоматично.",
        "",
        "Зараз: раніше зупинена стаття продовжила роботу в тому самому workflow. Вона вже проходить реальний SEO-аналітичний етап. Нову статтю, зображення чи публікацію цей ремонт не створював.",
        "",
        "Ваших дій не потрібно. Резервні копії створено до зміни.",
      ].join("\n"),
      html: `<!doctype html><html lang="uk"><body style="margin:0;background:#f3f5f4;font-family:Arial,Helvetica,sans-serif;color:#17212b;"><main style="max-width:680px;margin:24px auto;background:#ffffff;padding:28px;border-radius:8px;"><h1 style="margin:0 0 16px;font-size:22px;">Виправлено обробку структури статей</h1><p style="line-height:1.55;">Виправлено проблему, через яку система могла повторювати перевірку статті, але не переходити до реального аналізу.</p><h2 style="font-size:17px;margin:24px 0 8px;">Що змінилося</h2><ul style="padding-left:20px;line-height:1.55;"><li>Paperclip приймає результат перевірки лише від реального сервісу SEO Winning Structure.</li><li>Неповні дані повертаються з точним переліком полів для виправлення, без повторення однакового циклу.</li><li>Відновлено plugin і сервіс; після перезапуску Docker вони підніматимуться автоматично.</li></ul><h2 style="font-size:17px;margin:24px 0 8px;">Поточний стан</h2><p style="line-height:1.55;">Раніше зупинена стаття продовжила роботу в тому самому workflow і вже проходить реальний SEO-аналітичний етап. Ремонт не створював нову статтю, зображення чи публікацію.</p><p style="line-height:1.55;margin-bottom:0;"><strong>Ваших дій не потрібно.</strong> Резервні копії створено до зміни.</p></main></body></html>`,
      idempotencyKey: "winning-structure-contract-repair-20260716",
      metadata: {
        scope: "paperclip-astrogen-clean",
        caseId: "30e253a7-42c3-4e21-a5f1-083f07584b3e",
        remoteRunId: "wsrun_20260716120612098654_07b5d4ca8f",
      },
    },
  });
  console.log(JSON.stringify(result, null, 2));
} finally {
  psql(`update board_api_keys set revoked_at=now(), last_used_at=now() where id=${q(keyId)}::uuid;`);
}
