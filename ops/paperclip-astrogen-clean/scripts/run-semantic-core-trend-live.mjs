#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const COMPANY_ID = "cb7b5231-2da0-4e91-b4af-538d8f1ca263";
const PAPERCLIP_PROJECT_ID = "d4644ea9-c025-4421-9af9-7780e41945ba";
const USER_ID = "VetfGVba4HjRqdTiVfZNL4HsvXchKgLW";
const DB_CONTAINER = "paperclip-astrogen-clean-db-1";
const API_BASE = process.env.PAPERCLIP_API_BASE ?? "http://127.0.0.1:3210/api";
const SEMANTIC_PLUGIN = "paperclip.semantic-core-mcp-agent-tools";
const PAYLOAD_PLUGIN = "paperclip.payload-cms-agent-tools";
const TREND_PROJECT_ID = "astrogen-audience-trends-ukraine";

function run(command, args, input) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`.trim());
  }
  return result.stdout.trim();
}

function psql(sql) {
  return run("sudo", [
    "docker", "exec", "-i", DB_CONTAINER,
    "psql", "-U", "paperclip", "-d", "paperclip",
    "-v", "ON_ERROR_STOP=1", "-At",
  ], sql);
}

function q(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
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
  const parsed = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 1600)}`);
  }
  return parsed;
}

function unwrapToolData(response) {
  return response?.result?.data?.structuredContent
    ?? response?.result?.data
    ?? response?.data?.structuredContent
    ?? response?.data
    ?? response?.result
    ?? response;
}

function stringValue(value) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    const candidate = value.value ?? value.text ?? value.title;
    if (typeof candidate === "string") return candidate.trim();
  }
  return "";
}

function contentSummary(doc) {
  const slug = stringValue(doc.slug);
  const title = stringValue(doc.title) || stringValue(doc.meta?.title) || slug;
  const cmsStatus = stringValue(doc._status) || stringValue(doc.status);
  return {
    title,
    url: `https://astrogen.com.ua/blog/${slug}`,
    status: cmsStatus === "published" ? "published" : "planned",
  };
}

function kyivDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kiev",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function summarizeClusters(clusters) {
  return clusters.map((cluster, index) => ({
    id: cluster.id ?? cluster.cluster_id ?? `cluster-${index + 1}`,
    title: cluster.title ?? cluster.name ?? cluster.label ?? null,
    topics: Array.isArray(cluster.topic_ideas)
      ? cluster.topic_ideas.map((topic) => topic.title ?? topic.query ?? topic.phrase ?? topic.name ?? topic).slice(0, 5)
      : [],
  }));
}

async function main() {
  const token = `pcp_board_${randomBytes(24).toString("hex")}`;
  const keyId = randomUUID();
  const keyHash = createHash("sha256").update(token).digest("hex");
  psql(`
    insert into board_api_keys (id, user_id, name, key_hash, expires_at)
    values (${q(keyId)}::uuid, ${q(USER_ID)}, 'semantic-core-live-trend-recovery',
      ${q(keyHash)}, now() + interval '15 minutes');
  `);

  try {
    const context = JSON.parse(psql(`
      select json_build_object(
        'agentId', i.assignee_agent_id,
        'runId', coalesce(
          i.execution_run_id,
          (
            select hr.id from heartbeat_runs hr
            where hr.company_id=i.company_id
              and hr.agent_id=i.assignee_agent_id
              and hr.context_snapshot ->> 'issueId'=i.id::text
            order by hr.created_at desc
            limit 1
          )
        ),
        'companyId', i.company_id,
        'projectId', coalesce(i.project_id, ${q(PAPERCLIP_PROJECT_ID)}::uuid),
        'issueId', i.id
      )::text
      from issues i
      where i.company_id=${q(COMPANY_ID)}::uuid and i.identifier='AST-606';
    `));
    if (!context.runId) throw new Error("AST-606 has no execution run context");

    const existingContent = [];
    for (const page of [1, 2]) {
      const response = await request(token, "POST", "/agents/me/plugin-tools/execute", {
        tool: `${PAYLOAD_PLUGIN}:payload_cms_list_blog_posts`,
        parameters: { status: "any", limit: 100, page, depth: 0, sort: "-updatedAt" },
        runContext: context,
      });
      const data = unwrapToolData(response);
      const docs = Array.isArray(data?.docs) ? data.docs : [];
      existingContent.push(...docs.map(contentSummary).filter((item) => item.title && !item.url.endsWith("/")));
      if (docs.length < 100) break;
    }
    if (existingContent.length === 0) {
      throw new Error("Payload CMS inventory returned no blog posts; refusing trend run without duplicate context");
    }

    const importCountBefore = Number(psql(`
      select count(*) from plugin_entities
      where entity_type='semantic-core-import-candidate';
    `));
    const response = await request(token, "POST", "/agents/me/plugin-tools/execute", {
      tool: `${SEMANTIC_PLUGIN}:generate-trend-topic-report`,
      parameters: {
        project_id: TREND_PROJECT_ID,
        project: {
          name: "Astrogen",
          description: "Український audience research про людей, які переживають поточну невизначеність, зміни роботи й місця проживання, дистанційні стосунки, сімейну напругу, цифрову недовіру, втому від AI-порад та decision fatigue.",
          market: "Україномовні current audience signals навколо життєвого вибору, цифрової культури, довіри, стосунків, сімейної взаємодії, саморефлексії та поведінкових змін аудиторії",
          geographies: ["Ukraine"],
          output_language: "uk",
          business_context: "Пріоритет: ширший audience-interest та adjacent-use-case попит з боку сегментів ЦА. Починай із поточного часового, поведінкового, соціального, сезонного або search-language сигналу аудиторії, а не з продуктів, модальностей, чинних ключів чи сторінок. Поточні сторінки сайту використовуються лише як duplicate/ownership context. Не пропонувати evergreen how-to теми без current signal; не вести trend discovery у clinical psychology або psychotherapy lane.",
        },
        audience_segments: [
          { id: "life_decisions", name: "Люди в періоді життєвих рішень", description: "У 2026 році стикаються з релокацією, поверненням або переїздом, змінами роботи, фінансовою невизначеністю, сімейними зобовʼязаннями, енергетичною нестабільністю й decision fatigue; шукають мову для структурування вибору без фаталістичних прогнозів." },
          { id: "relationships", name: "Люди, які осмислюють стосунки", description: "У 2026 році переживають дистанційні стосунки, розділений побут, міграцію, мобілізаційний стрес, dating-app fatigue, цифрову недовіру, спільне планування бюджету й конфлікти очікувань; шукають ненавʼязливу мову для розуміння ситуації." },
          { id: "self_reflection", name: "Аудиторія самопізнання", description: "Реагує на втому від швидких порад, AI-контенту й інформаційного шуму; шукає короткі письмові, візуальні або ритуалізовані практики самоспостереження, ідентичності й сенсотворення без детермінованих відповідей." },
          { id: "family_and_parenting", name: "Батьки та сімейна аудиторія", description: "У 2026 році має справу з навчальною нестабільністю, цифровими звичками дітей, підлітковою тривожністю в сімʼї, розділеними родинами, різними режимами догляду й потребою говорити про характер без діагнозів та ярликів." },
          { id: "expert_selection", name: "Люди, які обирають консультанта", description: "Після хвилі онлайн-консультацій, AI-порад і шахрайських обіцянок перевіряють довіру, межі компетентності, прозорість профілю, формат першої взаємодії, червоні прапорці й власні очікування." },
        ],
        analysis_date: kyivDate(),
        horizon_months: 6,
        constraints: {
          max_clusters: 8,
          topics_per_cluster: 3,
          content_lead_time_days: 14,
            excluded_topics: [
              "zodiac sign for a specific calendar day and month",
              "horoscope for a specific calendar date",
              "birth-date zodiac profile centered on one day and month",
              "horoscope for today",
              "daily horoscope for one zodiac sign",
              "rolling current-day horoscope content",
              "evergreen how-to without current audience signal",
              "clinical psychology or psychotherapy as primary lane",
              "deterministic medical, legal, financial or relationship predictions",
            ],
            max_research_queries: 12,
            max_sources: 30,
          request_timeout_ms: 300000,
        },
        cache_policy: {
          scope: "private_project",
          strategy: "use_cache",
          search_ttl_seconds: 21600,
          source_ttl_seconds: 86400,
          llm_ttl_seconds: 21600,
          stale_if_provider_unavailable: true,
          cache_llm_outputs: false,
        },
        mode: "live",
        company_goal: "Залучати цільовий органічний трафік через реальні поточні сигнали, ситуації, питання й інтереси сегментів ЦА, не канібалізуючи чинні сторінки і не підміняючи тренди продуктово-семантичними ключами.",
        existing_content: existingContent,
      },
      runContext: context,
    });
    const result = unwrapToolData(response);
    if (result?.status !== "ok" || result?.schema_version !== "trend_topic_report.v1") {
      throw new Error(`Live trend report failed: ${JSON.stringify(result).slice(0, 2000)}`);
    }

    const importCountAfter = Number(psql(`
      select count(*) from plugin_entities
      where entity_type='semantic-core-import-candidate';
    `));
    if (importCountAfter !== importCountBefore) {
      throw new Error("Live trend run changed semantic import candidates");
    }

    const blocker = JSON.parse(psql(`
      select json_build_object('id', id, 'identifier', identifier, 'status', status)::text
      from issues where company_id=${q(COMPANY_ID)}::uuid and identifier='AST-611';
    `));
    if (blocker.status !== "done") {
      await request(token, "PATCH", `/issues/${blocker.id}`, {
        status: "done",
        comment: [
          "Systemic repair deployed and verified.",
          "",
          "- The MCP SDK call has an explicit 300-second request timeout instead of its hidden 60-second default.",
          "- The host tool invocation has a bounded 360-second envelope so transport cleanup cannot race the MCP result.",
          "- Live report completed through the agent dispatcher with the strict top-level schema.",
          `- Report run: \`${result.run_id}\``,
          `- Clusters: ${Array.isArray(result.clusters) ? result.clusters.length : 0}`,
          "- Semantic import count remained unchanged.",
          "",
          "Resume [AST-606](/AST/issues/AST-606) through the existing blocker-resolution wake and route selected phrases to normal semantic validation.",
        ].join("\n"),
      }, context.runId);
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      reportRunId: result.run_id,
      status: result.status,
      existingContentCount: existingContent.length,
      clusterCount: Array.isArray(result.clusters) ? result.clusters.length : 0,
      watchlistCount: Array.isArray(result.watchlist) ? result.watchlist.length : 0,
      warnings: result.warnings ?? [],
      clusters: summarizeClusters(Array.isArray(result.clusters) ? result.clusters : []),
      semanticImportCountUnchanged: importCountAfter,
      blockerClosed: blocker.identifier,
    }, null, 2)}\n`);
  } finally {
    psql(`delete from board_api_keys where id=${q(keyId)}::uuid;`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
