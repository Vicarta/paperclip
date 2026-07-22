#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const CURRICULUM_PATH = resolve(SCRIPT_DIR, "../reference/western-astrology-curriculum.yaml");
const DOCUMENT_KEY = "western-astrology-learning-plan";
const APPLY = process.argv.includes("--apply");

function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
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

function loadCurriculum() {
  const source = readFileSync(CURRICULUM_PATH, "utf8");
  const script = "import json,sys,yaml; print(json.dumps(yaml.safe_load(sys.stdin.read()), ensure_ascii=False))";
  return JSON.parse(run("python3", ["-c", script], source));
}

function currentRefillCaseId() {
  const id = psql(`
    select pc.id
    from pipeline_cases pc
    join pipelines p on p.id=pc.pipeline_id
    where pc.company_id=${quote(COMPANY_ID)}::uuid
      and p.key='astrogen-growth-actions'
      and pc.case_key like 'growth:topic-inventory-refill:%'
    order by pc.updated_at desc
    limit 1;
  `);
  if (!id) throw new Error("Canonical topic-inventory refill case not found");
  return id;
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

function caseRow(response) {
  return response?.case ?? response;
}

function documentBody(curriculum) {
  const rows = curriculum.learningGraph.map((node) => {
    const prerequisites = node.prerequisiteNodeIds.length > 0
      ? node.prerequisiteNodeIds.join(", ")
      : "немає";
    return `| ${node.order} | ${node.workingTitleUk} | ${node.primaryConceptLabelUk} | ${prerequisites} | ${node.planningStatus} |`;
  });
  return [
    "# Навчальний контент-план із західної астрології",
    "",
    "Головне правило: одна стаття вводить рівно одне нове астрологічне поняття.",
    "",
    "Синоніми одного поняття не створюють окремого уроку. Визначення, порівняння, таблиця, список, FAQ, приклад або алгоритм для іншого терміна вже вважаються другим поняттям і блокують матеріал.",
    "",
    "| Порядок | Робоча тема | Нове поняття | Передумови | Поточний статус |",
    "| ---: | --- | --- | --- | --- |",
    ...rows,
    "",
    "## Як теми переходять у виробництво",
    "",
    "1. Агент перевіряє повний CMS inventory і визначає єдиного власника поняття.",
    "2. Якщо сторінка вже існує, тема йде у refresh, merge або reposition, а не в нову статтю.",
    "3. Перед залежною темою всі prerequisite-статті мають бути опубліковані та мати URL для внутрішнього посилання.",
    "4. SERP і Winning Structure шукають додаткову цінність лише всередині одного поняття.",
    "5. Brief, writer, validator, MC quality, CMS і CMO окремо підтверджують one-concept gate.",
    "",
    "## Чернетки, що потребують переробки",
    "",
    "- CMS 137: аспекти; заблоковано через одночасне навчання багатьох суміжних понять.",
    "- CMS 138: доми; заблоковано через огляд 12 домів та інші суміжні поняття.",
    "",
    "Цей документ є планом. Статус pending_cms_ownership_review означає, що тема ще не готова до allocator і не повинна автоматично створювати статтю.",
  ].join("\n");
}

async function main() {
  const curriculum = loadCurriculum();
  const refillCaseId = currentRefillCaseId();
  const plan = {
    refillCaseId,
    documentKey: DOCUMENT_KEY,
    curriculumVersion: curriculum.version,
    topicCount: curriculum.learningGraph.length,
  };
  if (!APPLY) {
    console.log(JSON.stringify({ mode: "dry-run", ...plan }, null, 2));
    return;
  }

  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  psql(`
    insert into board_api_keys (id,user_id,name,key_hash,expires_at)
    values (
      ${quote(keyId)}::uuid,
      ${quote(USER_ID)},
      'sync-western-astrology-curriculum-plan',
      ${quote(createHash("sha256").update(token).digest("hex"))},
      now()+interval '15 minutes'
    );
  `);

  try {
    const backup = await request(token, "POST", "/instance/database-backups", {});
    const document = await request(token, "PUT", `/cases/${refillCaseId}/documents/${DOCUMENT_KEY}`, {
      title: "Навчальний контент-план із західної астрології",
      format: "markdown",
      body: documentBody(curriculum),
      changeSummary: "Added the progressive 12-topic one-concept curriculum",
    });
    const current = caseRow(await request(token, "GET", `/cases/${refillCaseId}`));
    const updated = caseRow(await request(token, "PATCH", `/cases/${refillCaseId}`, {
      fieldPatch: {
        westernAstrologyCurriculumVersion: curriculum.version,
        westernAstrologyCurriculumDocumentKey: DOCUMENT_KEY,
        westernAstrologyCurriculumTopicCount: curriculum.learningGraph.length,
        westernAstrologyCurriculumRule: "one_article_one_new_concept",
      },
      expectedVersion: current.version,
    }));
    console.log(JSON.stringify({
      mode: "apply",
      ...plan,
      caseVersion: updated.version,
      documentId: document.document?.id ?? document.id ?? null,
      backupDir: backup.backupDir ?? null,
    }, null, 2));
  } finally {
    psql(`update board_api_keys set revoked_at=now(), last_used_at=now() where id=${quote(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
