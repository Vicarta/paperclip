#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = "http://127.0.0.1:3210/api";

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

function q(value) {
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
  if (!response.ok) throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 1800)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const keyHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${q(keyId)}::uuid, ${q(USER_ID)}, 'reconcile-trend-layer-correction',
      ${q(keyHash)}, now() + interval '10 minutes');
  `);

  try {
    const parent = JSON.parse(psql(`
      select json_build_object('id',id,'identifier',identifier,'status',status)::text
      from issues where company_id=${q(COMPANY_ID)}::uuid and identifier='AST-705';
    `));
    const child = JSON.parse(psql(`
      select json_build_object('id',id,'identifier',identifier,'status',status,'description',description)::text
      from issues where company_id=${q(COMPANY_ID)}::uuid and identifier='AST-706';
    `));

    const context = await request(token, "GET", `/issues/${parent.id}/heartbeat-context`);
    const projected = context?.childWork?.childIssueSummaries?.find((item) => item.identifier === "AST-706")?.resultProjection;
    if (projected?.key !== "trendIngestionResult") {
      throw new Error("AST-706 result projection is not visible through parent heartbeat context");
    }

    const result = {
      finalDisposition: "layer_correction_required",
      createdSearchDemandCaseIds: [],
      eligibleReadyTopicCountAfter: 0,
      remainingUnusedClusters: 0,
      validationWave: 3,
      layerValidationMatrix: [
        {
          phrase: "що не можна обіцяти на астрологічній консультації",
          testedLayer: "audience_need_intent",
          intendedLayer: "audience_need_intent",
          disposition: "parked_no_entity_anchor",
          correctionRequired: false,
        },
        {
          phrase: "як перевірити профіль астролога перед оплатою консультації",
          testedLayer: "audience_need_intent",
          intendedLayer: "audience_need_intent",
          disposition: "parked_no_entity_anchor",
          correctionRequired: false,
        },
        {
          phrase: "натальна карта для зміни роботи як сформулювати запит",
          testedLayer: "audience_need_intent",
          intendedLayer: "adjacent_use_case_intent",
          disposition: "parked_owner_mismatch",
          correctionRequired: true,
        },
        {
          phrase: "як обрати консультацію нумеролога онлайн",
          testedLayer: "audience_need_intent",
          intendedLayer: "audience_interest_intent",
          disposition: "parked_no_entity_anchor",
          correctionRequired: true,
        },
        {
          phrase: "курси астрології для початківців як обрати навчання",
          testedLayer: "audience_need_intent",
          intendedLayer: "audience_interest_intent",
          disposition: "parked_no_entity_anchor",
          correctionRequired: true,
        },
      ],
    };
    const marker = "## trendIngestionResult";
    const markerIndex = child.description.indexOf(marker);
    const baseDescription = (markerIndex >= 0 ? child.description.slice(0, markerIndex) : child.description).trimEnd();
    const description = [
      baseDescription,
      "",
      marker,
      "```json",
      JSON.stringify(result, null, 2),
      "```",
    ].join("\n");
    await request(token, "PATCH", `/issues/${child.id}`, { description });

    await request(token, "PATCH", `/issues/${parent.id}`, {
      status: "todo",
      blockedByIssueIds: [],
      comment: [
        "Reopened the same trend routine after a systemic layer-routing correction.",
        "",
        "AST-706 tested a heterogeneous five-phrase batch only on audience_need_intent. Its parent-visible result now identifies exactly three same-wave corrections. This is not a fourth wave and does not permit a broad layer sweep.",
      ].join("\n"),
    });
    await request(token, "POST", `/issues/${parent.id}/comments`, {
      interrupt: true,
      body: [
        "## Resume wave 3 with typed layer correction",
        "",
        "Read `heartbeat-context.childWork.childIssueSummaries[].resultProjection` for AST-706. Do not create another evidence-recovery issue.",
        "",
        "Delegate one bounded same-wave correction:",
        "- `натальна карта для зміни роботи як сформулювати запит` -> `adjacent_use_case_intent`",
        "- `як обрати консультацію нумеролога онлайн` -> `audience_interest_intent`",
        "- `курси астрології для початківців як обрати навчання` -> `audience_interest_intent`",
        "",
        "Do not retry the two phrases already tested on their intended audience_need_intent layer. Do not generate another trend report, add phrases, create topic/article work directly, or sweep other layers. Any accepted phrase continues through bounded CMS ownership/cannibalization review and native search-demand intake.",
      ].join("\n"),
    });

    process.stdout.write(`${JSON.stringify({
      ok: true,
      parent: parent.identifier,
      previousParentStatus: parent.status,
      child: child.identifier,
      projectedKeyBeforeRepair: projected.key,
      correctionPhraseCount: result.layerValidationMatrix.filter((item) => item.correctionRequired).length,
    }, null, 2)}\n`);
  } finally {
    psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
