import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { agents, companies, createDb, heartbeatRuns, issues, pluginConfig, plugins, projects } from "@paperclipai/db";
import { operationalTelegramAlertService } from "../services/operational-telegram-alerts.js";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

function getTelegramTextBody(fetchMock: ReturnType<typeof vi.fn>, callIndex = 0): Record<string, unknown> {
  return JSON.parse(String(fetchMock.mock.calls[callIndex]?.[1]?.body ?? "{}")) as Record<string, unknown>;
}

describeEmbeddedPostgres("operationalTelegramAlertService", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-operational-telegram-alerts-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    vi.restoreAllMocks();
    await db.execute(`
      TRUNCATE TABLE
        activity_log,
        plugin_config,
        plugins,
        issues,
        projects,
        agents,
        companies
      CASCADE
    `);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("sends a human-readable silent-noop alert with agent attribution", async () => {
    const companyId = randomUUID();
    const projectId = randomUUID();
    const issueId = randomUUID();
    const agentId = randomUUID();
    const runId = randomUUID();
    const pluginId = randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: "Astrogen",
      issuePrefix: "AST",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(projects).values({
      id: projectId,
      companyId,
      name: "SEO Growth",
    });
    await db.insert(agents).values({
      id: agentId,
      companyId,
      name: "SEO Semantic Core Validator",
      role: "seo",
      title: "Semantic Core Validator",
      adapterType: "codex_local",
    });
    await db.insert(issues).values({
      id: issueId,
      companyId,
      projectId,
      title: "Stage 54 validation for /free-horoscope semantic core",
      status: "todo",
      priority: "medium",
      createdByUserId: "user-1",
      issueNumber: 708,
      identifier: "AST-708",
    });
    await db.insert(heartbeatRuns).values({
      id: runId,
      companyId,
      agentId,
      invocationSource: "assignment",
      status: "failed",
    });
    await db.insert(plugins).values({
      id: pluginId,
      pluginKey: "telegram.notifications",
      packageName: "paperclip-plugin-telegram",
      version: "0.3.0",
      apiVersion: 1,
      categories: [],
      manifestJson: {} as never,
      status: "ready",
    });
    await db.insert(pluginConfig).values({
      pluginId,
      configJson: {
        telegramBotTokenRef: "secret-ref-1",
        errorsChatId: "-5154906793",
        paperclipPublicUrl: "https://paperclip.example.test",
      },
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        ok: true,
        result: { message_id: 9001 },
      }),
    });

    const svc = operationalTelegramAlertService(db, {
      fetchImpl: fetchMock as unknown as typeof fetch,
      resolveTelegramBotToken: vi.fn().mockResolvedValue("telegram-token"),
    });

    const result = await svc.sendSilentNoopAlert({
      companyId,
      issueId,
      agentId,
      runId,
    });

    expect(result).toEqual({ status: "sent", chatId: "-5154906793", messageId: 9001 });
    const textBody = getTelegramTextBody(fetchMock);
    expect(textBody.text).toContain("⚠️ Потрібна увага: AST-708");
    expect(textBody.text).toContain("Компанія: Astrogen");
    expect(textBody.text).toContain("Проєкт: SEO Growth");
    expect(textBody.text).toContain("Агент: SEO Semantic Core Validator (Semantic Core Validator)");
    expect(textBody.text).toContain("silent_noop");
    expect(textBody.reply_markup).toEqual({
      inline_keyboard: [[{ text: "Відкрити задачу", url: "https://paperclip.example.test/AST/issues/AST-708" }]],
    });
  });
});
