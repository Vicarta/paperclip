#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const CONTENT_PLAN_TARGET = 25;
const CAMPAIGN_CONTRACT_VERSION = "content-portfolio-v3";
const PORTFOLIO_TRACKS = [
  ["western_astrology_learning", "Західна астрологія як навчальна система", 12],
  ["audience_applied_questions", "Прикладні життєві питання аудиторії", 5],
  ["audience_trends", "Трендові теми", 3],
  ["trust_expert_method_boundaries", "Довіра, вибір експерта, межі методів", 3],
  ["commercial_unmet_demand", "Продуктові теми з реально незакритим попитом", 2],
];

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

function parseJsonLine(output, label) {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error(`${label} did not return a JSON object`);
  return JSON.parse(output.slice(start, end + 1));
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
  if (!response.ok) throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 2000)}`);
  return text ? JSON.parse(text) : null;
}

function campaignId() {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kiev",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return `astrogen-content-portfolio:${date}:${CAMPAIGN_CONTRACT_VERSION}`;
}

function isoWeekKey(date = new Date()) {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((value - yearStart) / 86400000) + 1) / 7);
  return `${value.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function resolveCurrentRefillCase() {
  const week = isoWeekKey();
  const canonicalKey = `growth:topic-inventory-refill:${week}`;
  const fallbackTitle = `Canonical topic inventory refill ${canonicalKey}`;
  const rows = psql(`
    select json_build_object(
      'id', c.id,
      'caseKey', c.case_key,
      'title', c.title,
      'stageKey', ps.key,
      'canonicalKey', ${q(canonicalKey)}
    )::text
    from pipeline_cases c
    join pipelines p on p.id=c.pipeline_id
    join pipeline_stages ps on ps.id=c.stage_id
    where c.company_id=${q(COMPANY_ID)}::uuid
      and p.key='astrogen-growth-actions'
      and c.retired_at is null
      and (
        c.case_key=${q(canonicalKey)}
        or c.title=${q(fallbackTitle)}
      )
    order by
      case when c.case_key=${q(canonicalKey)} then 0 else 1 end,
      c.updated_at desc
    limit 1;
  `).trim();
  if (!rows) {
    throw new Error(`Current canonical refill case not found for ${canonicalKey}`);
  }
  return parseJsonLine(rows, "resolveCurrentRefillCase");
}

function ensureCanonicalRefillCaseKey(refillCase) {
  if (refillCase.caseKey === refillCase.canonicalKey) return refillCase;
  const updated = psql(`
    update pipeline_cases c
    set case_key=${q(refillCase.canonicalKey)},
        updated_at=now()
    where c.id=${q(refillCase.id)}::uuid
      and not exists (
        select 1
        from pipeline_cases other
        where other.pipeline_id=c.pipeline_id
          and other.case_key=${q(refillCase.canonicalKey)}
          and other.id<>c.id
      )
    returning json_build_object(
      'id', c.id,
      'caseKey', c.case_key,
      'title', c.title,
      'stageKey', (
        select ps.key from pipeline_stages ps where ps.id=c.stage_id
      ),
      'canonicalKey', ${q(refillCase.canonicalKey)}
    )::text;
  `).trim();
  if (!updated) {
    throw new Error(`Could not normalize canonical refill case key to ${refillCase.canonicalKey}`);
  }
  return parseJsonLine(updated, "ensureCanonicalRefillCaseKey");
}

function initialPlanDocument(id) {
  return [
    "# Контент-план Astrogen",
    "",
    `Кампанія: ${id}`,
    "",
    "Ціль: щонайменше 25 перевірених майбутніх тем у затвердженому портфелі 12/5/3/3/2.",
    "Сегменти аудиторії контролюють різноманітність, але не є жорсткими квотами.",
    "Сирі trend-ідеї, переписка агентів і неперевірені кандидати тут не рахуються.",
    "",
    "## Покриття напрямів",
    "",
    "| Напрям | Готово | Ціль | Дефіцит |",
    "| --- | ---: | ---: | ---: |",
    ...PORTFOLIO_TRACKS.map(([key, label, target]) => `| ${label} (\`${key}\`) | 0 | ${target} | ${target} |`),
    "",
    "## Перевірені теми",
    "",
    "Поки немає тем, які пройшли всі native gates. Документ оновлюється CMO з live ready/reserved cases.",
  ].join("\n");
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  psql(`
    insert into board_api_keys (id,user_id,name,key_hash,expires_at)
    values (${q(keyId)}::uuid,${q(USER_ID)},'start-segmented-content-plan-campaign',
      ${q(createHash("sha256").update(token).digest("hex"))},now()+interval '15 minutes');
  `);

  try {
    const id = campaignId();
    const refillCase = ensureCanonicalRefillCaseKey(resolveCurrentRefillCase());
    let detail = await request(token, "GET", `/cases/${refillCase.id}`);
    const initialTrackCounts = Object.fromEntries(PORTFOLIO_TRACKS.map(([key]) => [
      key,
      Number(detail.case.fields?.contentPortfolioTrackCounts?.[key] ?? 0),
    ]));
    await request(token, "PATCH", `/cases/${refillCase.id}`, {
      fieldPatch: {
        actionType: "topic_inventory_refill",
        businessOutcome: "Maintain 25 eligible future topics across the approved 12/5/3/3/2 content portfolio.",
        executionStatus: "active_content_portfolio_campaign",
        blockerClass: null,
        ownerActionRequired: false,
        nextReviewAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        campaignId: id,
        contentPlanTarget: CONTENT_PLAN_TARGET,
        contentPortfolioTrackTargets: Object.fromEntries(PORTFOLIO_TRACKS.map(([key, , target]) => [key, target])),
        contentPortfolioTrackCounts: initialTrackCounts,
        audienceSegmentPolicy: "diversity_guardrail_not_hard_quota",
        continuationPolicy: {
          trigger: "active_content_portfolio_campaign",
          normalMaximumLiveTrendRunsPerKyivDay: 1,
          maximumLiveTrendRunsPerKyivDay: 5,
          maximumLiveTrendRunsPerCampaign: 10,
          maximumFreshReportsPerSegmentPerKyivDay: 1,
          excludeCalendarDateTopics: true,
          excludeEphemeralDailyHoroscopeTopics: true,
        },
        completionProof: "25 eligible ready/reserved native topic ids satisfy the 12/5/3/3/2 portfolio and are mirrored in next-content-plan.",
      },
      expectedVersion: detail.case.version,
    });

    const existingDocument = await request(token, "GET", `/cases/${refillCase.id}/documents/next-content-plan`)
      .catch((error) => error instanceof Error && error.message.includes(" 404:") ? null : Promise.reject(error));
    if (!existingDocument) {
      await request(token, "PUT", `/cases/${refillCase.id}/documents/next-content-plan`, {
        title: "Контент-план Astrogen: портфель 12/5/3/3/2",
        format: "markdown",
        body: initialPlanDocument(id),
        changeSummary: "Started the approved 12/5/3/3/2 content-portfolio campaign.",
      });
    }

    const launch = initialTrackCounts.audience_trends < 3
      ? parseJsonLine(run("node", [
        new URL("./run-low-inventory-trend-discovery.mjs", import.meta.url).pathname,
        "--portfolio-campaign=true",
        `--campaign-id=${id}`,
        "--validation-wave=1",
        "--force-fresh-trend-report=true",
      ]), "run-low-inventory-trend-discovery")
      : { outcome: "audience_trend_track_target_already_met" };
    detail = await request(token, "GET", `/cases/${refillCase.id}`);
    if (detail.stage?.key === "external_wait") {
      await request(token, "POST", `/cases/${refillCase.id}/transition`, {
        toStageKey: "executing",
        expectedVersion: detail.case.version,
        reason: "The focused audience-trend lane is live, so the content-portfolio campaign has a current execution path.",
      });
    } else if (detail.stage?.key !== "executing") {
      throw new Error(`Canonical refill is in unsupported stage ${detail.stage?.key}`);
    }
    const staleExternalWaitIssueIds = psql(`
      select i.id::text
      from issues i
      join pipeline_case_issue_links l on l.issue_id=i.id
      where l.case_id=${q(refillCase.id)}::uuid
        and l.retired_at is null
        and i.title='External Wait automation'
        and i.status in ('backlog','todo')
      order by i.created_at;
    `).split("\n").map((value) => value.trim()).filter(Boolean);
    for (const issueId of staleExternalWaitIssueIds) {
      await request(token, "PATCH", `/issues/${issueId}`, {
        status: "cancelled",
        blockedByIssueIds: [],
      });
    }
    process.stdout.write(`${JSON.stringify({
      ok: true,
      campaignId: id,
      refillCaseId: refillCase.id,
      refillCaseKey: refillCase.caseKey,
      canonicalRefillCaseKey: refillCase.canonicalKey,
      firstTargetAudienceSegment: launch.targetAudienceSegment ?? null,
      contentPlanDocumentKey: "next-content-plan",
      cancelledStaleExternalWaitIssueIds: staleExternalWaitIssueIds,
      launch,
    }, null, 2)}\n`);
  } finally {
    psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
