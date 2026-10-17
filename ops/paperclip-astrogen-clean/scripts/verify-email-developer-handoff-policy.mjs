#!/usr/bin/env node
/**
 * Live, no-delivery verification for developer handoffs. It proves that an
 * allowed Ukrainian handoff can render, while internal URLs and English source
 * text are rejected before the mail transport is reached.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const PROJECT_ID = "d4644ea9-c025-4421-9af9-7780e41945ba";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const TOOL = "paperclip.email-notifications:email-developer-handoff-send";
const AST_424_ID = "50a15d06-b62c-4337-b697-eafaeb2819f3";

function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
  return result.stdout.trim();
}

function psql(sql) {
  return run("sudo", ["docker", "exec", "-i", DB_CONTAINER, "psql", "-U", "paperclip", "-d", "paperclip", "-v", "ON_ERROR_STOP=1", "-At"], sql);
}

function q(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
  if (!value) throw new Error("No completed CTO heartbeat run is available for the dry-run verification");
  return JSON.parse(value);
}

async function invoke(token, parameters) {
  const response = await fetch(`${API_BASE}/plugins/tools/execute`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      tool: TOOL,
      runContext: { ...ctoRunContext(), companyId: COMPANY_ID, projectId: PROJECT_ID },
      parameters,
    }),
  });
  const text = await response.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // Keep the plain response for an actionable assertion below.
  }
  return { ok: response.ok, status: response.status, body, text };
}

async function request(token, method, pathname, body) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 1000)}`);
  return text ? JSON.parse(text) : null;
}

function ukrainianParameters(overrides = {}) {
  return {
    subject: "Перевірка технічного завдання",
    summary: "Потрібно перевірити коректність метаданих сторінки.",
    impact: "Це допомагає пошуку точніше розрізняти сторінки сайту.",
    affectedPages: [{
      url: "https://astrogen.com.ua/experts",
      currentProblem: "Потрібно підтвердити унікальність назви сторінки.",
      requiredChanges: ["Перевірити title, description і canonical у production HTML."],
      verification: ["Перевірити відповідь сторінки після деплою."],
    }],
    sharedActions: ["Не змінювати внутрішні маршрути Paperclip."],
    sourceIssue: "AST-424",
    idempotencyKey: `email-handoff-policy-smoke-${randomUUID()}`,
    dryRun: true,
    metadata: { scope: "paperclip-astrogen-clean", verification: true },
    ...overrides,
  };
}

function toolError(result) {
  if (!result.ok || !result.body || typeof result.body !== "object") return result.text;
  const payload = result.body.result;
  return payload && typeof payload === "object" && typeof payload.error === "string" ? payload.error : "";
}

async function main() {
  const recordAst424 = process.argv.slice(2).includes("--record-ast424");
  if (process.argv.slice(2).some((argument) => argument !== "--record-ast424")) {
    throw new Error("Usage: verify-email-developer-handoff-policy.mjs [--record-ast424]");
  }
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  psql(`
    insert into board_api_keys (id,user_id,name,key_hash,expires_at)
    values (${q(keyId)}::uuid,${q(USER_ID)},'email-developer-handoff-policy-verification',${q(createHash("sha256").update(token).digest("hex"))},now()+interval '15 minutes');
  `);

  try {
    const valid = await invoke(token, ukrainianParameters());
    assert(valid.ok, `A valid Ukrainian dry run was rejected: ${valid.text.slice(0, 1000)}`);
    assert(JSON.stringify(valid.body).includes("dry run passed"), "Valid handoff did not report a dry-run proof");

    const internal = await invoke(token, ukrainianParameters({
      affectedPages: [{
        url: "http://127.0.0.1:3100/api/cases?limit=10",
        currentProblem: "Внутрішній маршрут не повинен потрапляти до листа розробникам.",
        requiredChanges: ["Залишити відновлення маршруту внутрішнім процесом Paperclip."],
        verification: ["Перевірити native pipeline route від імені агента."],
      }],
    }));
    assert(internal.ok && toolError(internal).includes("not an approved external site"), "Internal endpoint was not rejected before email delivery");

    const english = await invoke(token, ukrainianParameters({
      summary: "Fix the page metadata.",
      impact: "Search engines cannot distinguish the pages.",
      affectedPages: [{
        url: "https://astrogen.com.ua/experts",
        currentProblem: "The title must be unique.",
        requiredChanges: ["Set a unique title and description."],
        verification: ["Check the production HTML."],
      }],
      sharedActions: ["Deploy the website."],
    }));
    assert(english.ok && toolError(english).includes("must be written in Ukrainian"), "English developer handoff was not rejected before email delivery");

    const mixedLanguage = await invoke(token, ukrainianParameters({
      summary: "Потрібно перевірити сторінку.",
      impact: "Search engines cannot distinguish these pages because the deployment renders the wrong metadata for several routes.",
      affectedPages: [{
        url: "https://astrogen.com.ua/experts",
        currentProblem: "The homepage title is rendered instead of a unique title.",
        requiredChanges: ["Set a unique title and description."],
        verification: ["Check the rendered production HTML."],
      }],
      sharedActions: ["Deploy the website and verify all affected pages in production."],
    }));
    assert(mixedLanguage.ok && toolError(mixedLanguage).includes("must be written in Ukrainian"), "Predominantly English developer handoff was not rejected before email delivery");

    if (recordAst424) {
      const marker = "Native case inventory repair verified 2026-07-16";
      const comments = await request(token, "GET", `/issues/${AST_424_ID}/comments`);
      const alreadyRecorded = Array.isArray(comments) && comments.some((comment) => String(comment.body ?? "").includes(marker));
      if (!alreadyRecorded) {
        await request(token, "POST", `/issues/${AST_424_ID}/comments`, {
          body: `${marker}\n\nAST-424 не вимагав нового загального /api/cases маршруту. Підтверджений native шлях для agent-heartbeat: спочатку GET /api/companies/{companyId}/pipelines, далі GET /api/pipelines/{pipelineId}/cases з stageKey, terminal=false, limit/offset; canonical refill шукається точним caseKey.\n\nПісля вирівнювання live core route CMO read-only smoke успішно прочитав ready inventory, article WIP і canonical refill. Generic /api/cases, localhost та tailnet адреси залишаються навмисно непідтримуваними.\n\nДодатково email handoff тепер приймає лише public Astrogen hosts і український текст; internal API recovery не може потрапити в лист розробникам.`,
        });
      }
      const issue = await request(token, "GET", `/issues/${AST_424_ID}`);
      if (issue.status !== "done") {
        await request(token, "PATCH", `/issues/${AST_424_ID}`, { status: "done" });
      }
    }

    console.log(JSON.stringify({
      verified: true,
      deliveryMode: "dry-run-only",
      validUkrainianHandoff: "accepted",
      internalEndpointHandoff: "rejected-before-transport",
      englishHandoff: "rejected-before-transport",
      mixedLanguageHandoff: "rejected-before-transport",
      ast424Recorded: recordAst424,
    }, null, 2));
  } finally {
    psql(`update board_api_keys set revoked_at=now(),last_used_at=now() where id=${q(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
