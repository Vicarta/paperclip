#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const PROJECT_ID = "d4644ea9-c025-4421-9af9-7780e41945ba";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const APPLY = process.argv.includes("--apply");
const TITLE = "Побудувати SEO-кластер сумісності знаків з Semantic Core evidence";
const CAMPAIGN_KEY = "zodiac-compatibility-cluster:v1";

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
    "psql", "-U", "paperclip", "-d", "paperclip", "-v", "ON_ERROR_STOP=1", "-At",
  ], sql);
}

function quote(value) {
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
  if (!response.ok) {
    throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 2000)}`);
  }
  return text ? JSON.parse(text) : null;
}

function existingCampaign() {
  const row = psql(`
    select json_build_object(
      'id', id,
      'identifier', identifier,
      'status', status,
      'assigneeAgentId', assignee_agent_id
    )::text
    from issues
    where company_id=${quote(COMPANY_ID)}::uuid
      and title=${quote(TITLE)}
      and status not in ('cancelled')
    order by created_at desc
    limit 1;
  `);
  return row ? JSON.parse(row) : null;
}

function campaignDescription() {
  return [
    "## Мета",
    "",
    "Побудувати керований SEO-кластер для залучення органічного трафіку за запитами про сумісність знаків зодіаку: одна pillar-сторінка, 12 sign hubs і поступове розширення до 78 унікальних пар.",
    "",
    "CMO керує кампанією та делегує роботу. CMO не виконує Semantic Core research, SERP-аналіз, написання або CMS mutation самостійно.",
    "",
    "Канонічний контракт: `/companies/astrogen/reference/zodiac-compatibility-cluster.yaml`.",
    "",
    "## Обов'язкова послідовність",
    "",
    "1. CMO делегує одну bounded research-задачу SEO Semantic Core Strategist.",
    "2. Semantic Core Strategist спочатку читає local inventory, потім використовує exact project `astrogen-ukraine`, layer `adjacent_use_case_intent`, `mode=live` і project-scoped cache.",
    "3. Дослідження можна виконувати пакетами за сімействами, але кожна майбутня сторінка отримує окремий `pageKeywordPacket` із canonical query, supporting queries, частотністю, accepted lifecycle, run/cluster IDs і SERP evidence.",
    "4. `candidate_review` не є завершенням. SEO Semantic Core Validator має append-only вирішити review і матеріалізувати фінальний accepted/parked/rejected результат у тому самому layer partition.",
    "5. SEO Blog Content Strategist будує page map, перевіряє повний CMS inventory, активні Paperclip cases, власника intent і канібалізацію.",
    "6. Наявний власник отримує `refresh`, `merge`, `reposition` або `internal_link`. Лише uncovered accepted intent може отримати `new_article`.",
    "7. SEO Blog Content Plan Validator перевіряє page-level evidence і native lineage. Статті не створюються напряму з цієї задачі.",
    "8. Лише `astrogen-search-demand-opportunities` із `selectedAction=new_article` можуть через guarded breakdown створити topic/article work.",
    "",
    "## Архітектура URL-власників",
    "",
    "- 1 pillar: загальна сумісність знаків зодіаку. Якщо сторінка вже існує, не створювати дубль.",
    "- 12 sign hubs: сумісність кожного знака з іншими знаками.",
    "- До 78 pair pages: одна канонічна сторінка на неупорядковану пару, включно з парами одного знака.",
    "- `Близнюки + Діва` і `Діва + Близнюки` мають одного власника за замовченням.",
    "- Гендерні формулювання є supporting queries. Окрема сторінка дозволена лише за окремого SERP intent і частотності без стереотипного контенту.",
    "",
    "## Перша хвиля",
    "",
    "- вибрати дію для наявної pillar-сторінки;",
    "- отримати фінальні pageKeywordPacket для всіх 12 sign hubs;",
    "- дослідити pair demand і вибрати 12-20 найсильніших канонічних пар;",
    "- створити або повторно використати native search-demand opportunities для кожного eligible intent;",
    "- не запускати масове написання або 144 варіанти сторінок.",
    "",
    "## Видимі результати",
    "",
    "CMO має підтримувати на цій задачі три issue documents: `compatibility-page-map`, `compatibility-keyword-research`, `compatibility-rollout-plan`. Коментарі агентів не замінюють ці документи.",
    "",
    "## Completion gate",
    "",
    "Задача не закривається, доки pillar action не вибрана, 12 sign hubs не мають фінальних Semantic Core dispositions, 12-20 pair candidates не ранжовані, а кожна eligible сторінка не має native search-demand case або явної non-article action.",
    "",
    "Не надсилати власнику технічні повідомлення в Telegram або email. Якщо один кандидат заблокований, продовжувати незалежні сторінки й зафіксувати typed blocker лише на відповідній гілці.",
  ].join("\n");
}

function initialPlanDocument() {
  return [
    "# SEO-кластер сумісності знаків",
    "",
    `Кампанія: ${CAMPAIGN_KEY}`,
    "",
    "## Цільова архітектура",
    "",
    "| Рівень | Ціль | Поточний стан |",
    "| --- | ---: | --- |",
    "| Pillar | 1 | очікує ownership review |",
    "| Sign hubs | 12 | очікують Semantic Core discovery |",
    "| Перша хвиля pair pages | 12-20 | очікують demand ranking |",
    "| Максимум canonical pair pages | 78 | наступні хвилі після вимірювання |",
    "",
    "## Незмінні правила",
    "",
    "- Кожна сторінка має окремий accepted pageKeywordPacket.",
    "- Reverse-order і gender variants не створюють новий URL без окремого SERP intent.",
    "- Наявний owner не дублюється; він отримує refresh, merge, reposition або internal_link.",
    "- Нові статті створюються тільки через native search-demand pipeline.",
    "- Продукт Astrogen можна згадувати органічно в body/CTA, але не в title, H1 або primary query.",
    "",
    "Цей документ описує затверджену кампанію. Робочі таблиці агентів зберігаються в окремих issue documents цієї задачі.",
  ].join("\n");
}

async function main() {
  const existing = existingCampaign();
  if (existing) {
    console.log(JSON.stringify({ mode: APPLY ? "reuse" : "dry-run", campaignKey: CAMPAIGN_KEY, issue: existing }, null, 2));
    return;
  }

  const cmoId = psql(`
    select id from agents
    where company_id=${quote(COMPANY_ID)}::uuid
      and name='Chief Marketing Officer'
      and status<>'terminated'
    order by created_at
    limit 1;
  `);
  const goalId = psql(`select goal_id from projects where id=${quote(PROJECT_ID)}::uuid;`);
  if (!cmoId || !goalId) throw new Error("CMO or project goal is missing");

  if (!APPLY) {
    console.log(JSON.stringify({
      mode: "dry-run",
      campaignKey: CAMPAIGN_KEY,
      title: TITLE,
      assigneeAgentId: cmoId,
      projectId: PROJECT_ID,
      goalId,
    }, null, 2));
    return;
  }

  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  psql(`
    insert into board_api_keys (id,user_id,name,key_hash,expires_at)
    values (
      ${quote(keyId)}::uuid,
      ${quote(USER_ID)},
      'start-zodiac-compatibility-cluster-campaign',
      ${quote(createHash("sha256").update(token).digest("hex"))},
      now()+interval '15 minutes'
    );
  `);

  try {
    const backup = await request(token, "POST", "/instance/database-backups", {});
    const issue = await request(token, "POST", `/companies/${COMPANY_ID}/issues`, {
      title: TITLE,
      description: campaignDescription(),
      status: "todo",
      priority: "high",
      assigneeAgentId: cmoId,
      projectId: PROJECT_ID,
      goalId,
    });
    const document = await request(token, "PUT", `/issues/${issue.id}/documents/compatibility-cluster-plan`, {
      title: "SEO-кластер сумісності знаків: затверджений план",
      format: "markdown",
      body: initialPlanDocument(),
      changeSummary: "Created the approved compatibility traffic-cluster campaign",
    });
    console.log(JSON.stringify({
      mode: "apply",
      campaignKey: CAMPAIGN_KEY,
      issueId: issue.id,
      identifier: issue.identifier,
      assigneeAgentId: cmoId,
      documentId: document.document?.id ?? document.id ?? null,
      backupDir: backup.backupDir ?? null,
    }, null, 2));
  } finally {
    psql(`update board_api_keys set revoked_at=now(), last_used_at=now() where id=${quote(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
