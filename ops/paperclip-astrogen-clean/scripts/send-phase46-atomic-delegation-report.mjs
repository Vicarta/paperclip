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
  const parsed = text ? JSON.parse(text) : null;
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
      'phase46-atomic-delegation-email', ${sqlLiteral(tokenHash)}, now() + interval '10 minutes');
  `);

  try {
    const context = ctoRunContext();
    const result = await request(token, "POST", "/plugins/tools/execute", {
      tool: "paperclip.email-notifications:email-change-report-send",
      parameters: {
        recipientEmails: ["o.savitsky@gmail.com"],
        subject: "Astrogen Paperclip: атомарне делегування та case-scoped evidence",
        summary: "У clean Paperclip системно усунуто два розриви native pipeline: створення specialist issue окремо від work link та недоступність повного linked evidence для manager/verifier. Делегування тепер атомарне й idempotent, а повні документи читаються через case-scoped output API без broad foreign-issue access.",
        changedItems: [
          "POST issue підтримує pipelineCaseLink із caseId та стабільним requestKey; issue і typed work link створюються в одній DB transaction.",
          "Повторний запит із тим самим caseId/requestKey повертає існуючу issue і не дублює activity, wakeup або automation.",
          "Migration 0127 додала company-scoped unique partial index для pipeline-case delegation.",
          "Standalone work-link route дозволена керівнику лише для вже наявної або мігрованої роботи; нове делегування повинно використовувати atomic API.",
          "Convergence автоматично прив'язує історичну роботу та один раз перезапускає executing stage, якщо specialist work завершено і живого execution path немає.",
          "Leadership backlog triage оновлено до revision 6; live CMO contract вимагає atomic pipelineCaseLink.",
          "Додано GET /api/cases/{caseId}/outputs/documents/{documentId}; context fetch hint більше не веде manager/verifier на foreign issue route.",
          "Executing growth stage тепер детерміновано маршрутизує evidence: complete -> verify, durable blocker -> external_wait, missing -> один bounded recovery.",
        ],
        backupPath: "DB: /home/paperclip/backups/paperclip-astrogen-clean-before-atomic-delegation-20260714T1215Z.dump and /home/paperclip/backups/paperclip-astrogen-clean-before-case-output-read-20260714T1242Z.dump; env: /home/paperclip/apps/paperclip-astrogen-clean/.env.before-atomic-pipeline-delegation-20260714T1215Z and .env.before-case-output-read-20260714T1242Z; AGENTS: /home/paperclip/backups/astrogen-agent-contracts-2026-07-14T125110-642Z; convergence backups: /paperclip/instances/astrogen-clean/data/backups",
        verification: [
          "Image paperclip-app:v2026.626.0-vicarta.53-case-output-read-20260714T1242Z healthy; PostgreSQL client 17.10; DB container не перезапускався.",
          "Unique index issues_pipeline_case_delegation_uq присутній; 8/8 plugins і 80 tools завантажені.",
          "Pipeline and issue route tests, shared/db/server typecheck, migration numbering та diff checks пройшли.",
          "Історичний missing work link AST-248 відновлено; GA4 case із завершеним AST-260 отримав штатний current-stage rerun; topic case з активною AST-275 не був помилково перезапущений.",
          "Live acceptance прочитав повний AST-275 completion-evidence через case output API: 3269 символів, 3 topic keys, без truncation/redaction.",
          "Topic refill завершився measured/done; native inventory має 3 ready topics. GA4 evidence mismatch ізольовано в external_wait і він не блокує незалежний content lane.",
          "Фінальний convergence already-converged; активних або queued heartbeat runs немає.",
          "Старий Paperclip, CMS publish і Telegram proactive watches не зачіпалися.",
        ],
        followUps: [
          "Продовжити Wave 4 спостереження за автономними runs та SLO без ручного запуску business tasks.",
          "Перевірити наступні природні CEO/CMO делегування на delivery proof і відсутність orphan issue/link states.",
        ],
        rollbackNote: "Повернути попередній app image та .env backup, відновити DB dump і AGENTS backup. Під час зміни CMS/provider side effects не виконувалися.",
        idempotencyKey: "phase46-atomic-delegation-case-output-20260714",
        metadata: { phase: 46, scope: "paperclip-astrogen-clean", migration: 127, release: "vicarta.53" },
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
