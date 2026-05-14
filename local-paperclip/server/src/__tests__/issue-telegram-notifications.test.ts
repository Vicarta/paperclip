import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { agents, companies, createDb, issues, pluginConfig, plugins, projects } from "@paperclipai/db";
import type { StorageService } from "../storage/types.js";
import { documentService } from "../services/documents.js";
import { issueService } from "../services/issues.js";
import { issueTelegramNotificationService } from "../services/issue-telegram-notifications.js";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

function getTelegramTextBody(fetchMock: ReturnType<typeof vi.fn>, callIndex = 0): Record<string, unknown> {
  return JSON.parse(String(fetchMock.mock.calls[callIndex]?.[1]?.body ?? "{}")) as Record<string, unknown>;
}

function getTelegramDocumentForm(fetchMock: ReturnType<typeof vi.fn>, callIndex = 1): FormData {
  return fetchMock.mock.calls[callIndex]?.[1]?.body as FormData;
}

function wordCount(value: string): number {
  return value.split(/\s+/).filter((word) => /\p{L}|\d/u.test(word)).length;
}

describeEmbeddedPostgres("issueTelegramNotificationService", () => {
  let db!: ReturnType<typeof createDb>;
  let documentsSvc!: ReturnType<typeof documentService>;
  let issuesSvc!: ReturnType<typeof issueService>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-issue-telegram-notifications-");
    db = createDb(tempDb.connectionString);
    documentsSvc = documentService(db);
    issuesSvc = issueService(db);
  }, 20_000);

  afterEach(async () => {
    vi.restoreAllMocks();
    await db.execute(`
      TRUNCATE TABLE
        activity_log,
        issue_attachments,
        issue_comments,
        assets,
        issue_documents,
        document_revisions,
        documents,
        plugin_config,
        plugins,
        issues,
        companies
      CASCADE
    `);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("sends the resolved issue attachment to telegram when the issue is done", async () => {
    const companyId = randomUUID();
    const issueId = randomUUID();
    const agentId = randomUUID();
    const pluginId = randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: "Astrogen",
      issuePrefix: "AST",
      requireBoardApprovalForNewAgents: false,
    });

    await db.insert(issues).values({
      id: issueId,
      companyId,
      title: "Send article to Telegram",
      status: "done",
      priority: "medium",
      createdByUserId: "user-1",
      issueNumber: 456,
      identifier: "AST-456",
    });

    await db.insert(agents).values({
      id: agentId,
      companyId,
      name: "SEO Blog Writer",
      role: "seo",
      title: "SEO Blog Writer",
      adapterType: "codex_local",
    });

    await documentsSvc.upsertIssueDocument({
      issueId,
      key: "notification-contract",
      title: "Telegram delivery",
      format: "markdown",
      body: `
\`\`\`json notification-contract
{
  "enabled": true,
  "channel": "telegram",
  "trigger": "issue_done",
  "delivery": {
    "mode": "attach_file",
    "artifact": {
      "source": "issue_attachment",
      "filenameIncludes": "article"
    }
  },
  "recipient": {
    "target": "default_chat"
  }
}
\`\`\`
      `,
      createdByUserId: "user-1",
    });

    const attachment = await issuesSvc.createAttachment({
      issueId,
      provider: "local_fs",
      objectKey: `${companyId}/issues/${issueId}/money-article-final.md`,
      contentType: "text/markdown",
      byteSize: 22,
      sha256: "a".repeat(64),
      originalFilename: "money-article-final.md",
      createdByUserId: "user-1",
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
        defaultChatId: "-5154906793",
        paperclipPublicUrl: "https://paperclip.example.test",
      },
    });

    const storage: StorageService = {
      provider: "local_fs",
      putFile: vi.fn(),
      getObject: vi.fn().mockResolvedValue({
        stream: Readable.from([Buffer.from("# final article\n\nhello")]),
        contentType: "text/markdown",
        contentLength: 21,
      }),
      headObject: vi.fn(),
      deleteObject: vi.fn(),
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        ok: true,
        result: { message_id: 7788 },
      }),
    });

    const svc = issueTelegramNotificationService(db, storage, {
      fetchImpl: fetchMock as unknown as typeof fetch,
      resolveTelegramBotToken: vi.fn().mockResolvedValue("telegram-token"),
    });

    const result = await svc.sendIssueDoneNotification(issueId, {
      agentId,
      completionSummary: "Статтю підготовлено й надіслано в Telegram.",
    });

    expect(result).toEqual({
      status: "sent",
      chatId: "-5154906793",
      attachmentIds: [attachment.id],
      messageIds: [7788, 7788],
      attachmentId: attachment.id,
      messageId: 7788,
    });
    expect(storage.getObject).toHaveBeenCalledWith(companyId, `${companyId}/issues/${issueId}/money-article-final.md`);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.telegram.org/bottelegram-token/sendMessage");
    expect(init.method).toBe("POST");
    const textBody = getTelegramTextBody(fetchMock);
    expect(textBody.text).toContain("✅ Готово: AST-456");
    expect(textBody.text).toContain("Агент: SEO Blog Writer (SEO Blog Writer)");
    expect(textBody.text).toContain("Що зроблено:");
    expect(wordCount(String(textBody.text).split("Що зроблено:")[1] ?? "")).toBeLessThanOrEqual(90);
    expect(textBody.reply_markup).toEqual({
      inline_keyboard: [[{ text: "Відкрити задачу", url: "https://paperclip.example.test/AST/issues/AST-456" }]],
    });

    const [documentUrl, documentInit] = fetchMock.mock.calls[1]!;
    expect(documentUrl).toBe("https://api.telegram.org/bottelegram-token/sendDocument");
    expect(documentInit.method).toBe("POST");

    const form = documentInit.body as FormData;
    expect(form.get("chat_id")).toBe("-5154906793");
    expect(form.get("caption")).toContain("Файл до AST-456");
    expect(form.get("caption")).toContain("Компанія: Astrogen");
    expect(form.get("caption")).toContain("Агент: SEO Blog Writer (SEO Blog Writer)");
    expect(form.get("caption")).toContain("Задача: Налаштування Telegram-повідомлень");
    expect(form.get("caption")).not.toContain("Що зроблено:");
    expect(form.get("caption")).toContain("Відкрити в Paperclip: https://paperclip.example.test/AST/issues/AST-456");
    const document = form.get("document");
    expect(document).toBeInstanceOf(File);
    expect((document as File).name).toBe("money-article-final.md");
    expect(await (document as File).text()).toContain("# final article");
  });

  it("sends multiple attachments when the contract uses attach_files", async () => {
    const companyId = randomUUID();
    const issueId = randomUUID();
    const pluginId = randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: "Astrogen",
      issuePrefix: "AST",
      requireBoardApprovalForNewAgents: false,
    });

    await db.insert(issues).values({
      id: issueId,
      companyId,
      title: "Send article bundle to Telegram",
      status: "done",
      priority: "medium",
      createdByUserId: "user-1",
      issueNumber: 457,
      identifier: "AST-457",
    });

    await documentsSvc.upsertIssueDocument({
      issueId,
      key: "notification-contract",
      title: "Telegram delivery",
      format: "markdown",
      body: `
\`\`\`json notification-contract
{
  "enabled": true,
  "channel": "telegram",
  "trigger": "issue_done",
  "delivery": {
    "mode": "attach_files",
    "artifacts": [
      {
        "source": "issue_attachment",
        "filenameIncludes": "publishable.md"
      },
      {
        "source": "issue_attachment",
        "filenameIncludes": "publishable.html"
      }
    ]
  },
  "recipient": {
    "target": "default_chat"
  }
}
\`\`\`
      `,
      createdByUserId: "user-1",
    });

    const markdownAttachment = await issuesSvc.createAttachment({
      issueId,
      provider: "local_fs",
      objectKey: `${companyId}/issues/${issueId}/money-publishable.md`,
      contentType: "text/markdown",
      byteSize: 22,
      sha256: "b".repeat(64),
      originalFilename: "money-publishable.md",
      createdByUserId: "user-1",
    });

    const htmlAttachment = await issuesSvc.createAttachment({
      issueId,
      provider: "local_fs",
      objectKey: `${companyId}/issues/${issueId}/money-publishable.html`,
      contentType: "text/html",
      byteSize: 42,
      sha256: "c".repeat(64),
      originalFilename: "money-publishable.html",
      createdByUserId: "user-1",
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
        defaultChatId: "-5154906793",
        paperclipPublicUrl: "https://paperclip.example.test",
      },
    });

    const storage: StorageService = {
      provider: "local_fs",
      putFile: vi.fn(),
      getObject: vi
        .fn()
        .mockResolvedValueOnce({
          stream: Readable.from([Buffer.from("# final article\n\nhello")]),
          contentType: "text/markdown",
          contentLength: 21,
        })
        .mockResolvedValueOnce({
          stream: Readable.from([Buffer.from("<h1>final article</h1>")]),
          contentType: "text/html",
          contentLength: 22,
        }),
      headObject: vi.fn(),
      deleteObject: vi.fn(),
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          ok: true,
          result: { message_id: 8801 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          ok: true,
          result: { message_id: 8802 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          ok: true,
          result: { message_id: 8803 },
        }),
      });

    const svc = issueTelegramNotificationService(db, storage, {
      fetchImpl: fetchMock as unknown as typeof fetch,
      resolveTelegramBotToken: vi.fn().mockResolvedValue("telegram-token"),
    });

    const result = await svc.sendIssueDoneNotification(issueId, {
      completionSummary: "Пакет статті підготовлено у Markdown та HTML.",
    });

    expect(result).toEqual({
      status: "sent",
      chatId: "-5154906793",
      attachmentIds: [markdownAttachment.id, htmlAttachment.id],
      messageIds: [8801, 8802, 8803],
      attachmentId: markdownAttachment.id,
      messageId: 8801,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const textBody = getTelegramTextBody(fetchMock);
    expect(String(textBody.text)).toContain("Що зроблено:");
    expect(wordCount(String(textBody.text).split("Що зроблено:")[1] ?? "")).toBeLessThanOrEqual(90);
    const firstForm = getTelegramDocumentForm(fetchMock, 1);
    const secondForm = getTelegramDocumentForm(fetchMock, 2);
    expect(firstForm.get("caption")).toContain("Файл до AST-457");
    expect(firstForm.get("caption")).toContain("Компанія: Astrogen");
    expect(firstForm.get("caption")).toContain("Задача: Налаштування Telegram-повідомлень");
    expect(firstForm.get("caption")).not.toContain("Що зроблено:");
    expect(firstForm.get("caption")).toContain("Відкрити в Paperclip: https://paperclip.example.test/AST/issues/AST-457");
    expect(secondForm.get("caption")).toBeNull();
  });

  it("humanizes technical English completion summaries and includes the company", async () => {
    const companyId = randomUUID();
    const issueId = randomUUID();
    const pluginId = randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: "DiskInternals",
      issuePrefix: "DIS",
      requireBoardApprovalForNewAgents: false,
    });

    await db.insert(issues).values({
      id: issueId,
      companyId,
      title: "Agent setup",
      status: "done",
      priority: "medium",
      createdByUserId: "user-1",
      issueNumber: 28,
      identifier: "DIS-28",
    });

    await documentsSvc.upsertIssueDocument({
      issueId,
      key: "notification-contract",
      title: "Telegram delivery",
      format: "markdown",
      body: `
\`\`\`json notification-contract
{
  "enabled": true,
  "channel": "telegram",
  "trigger": "issue_done",
  "recipient": { "target": "default_chat" },
  "delivery": {
    "mode": "attach_file",
    "artifact": {
      "source": "issue_attachment",
      "filenameIncludes": "summary"
    }
  }
}
\`\`\`
`,
      authorAgentId: null,
    });

    const attachment = await issuesSvc.createAttachment({
      issueId,
      provider: "local_fs",
      objectKey: `${companyId}/issues/${issueId}/summary.md`,
      contentType: "text/markdown",
      byteSize: 9,
      sha256: "d".repeat(64),
      originalFilename: "summary.md",
      createdByUserId: "user-1",
    });

    await db.insert(plugins).values({
      id: pluginId,
      pluginKey: "paperclip-plugin-telegram",
      packageName: "paperclip-plugin-telegram",
      version: "0.3.0",
      apiVersion: 1,
      manifestJson: {},
      status: "ready",
    });
    await db.insert(pluginConfig).values({
      pluginId,
      configJson: {
        telegramBotTokenRef: "telegram-secret",
        defaultChatId: "-5154906793",
        paperclipPublicUrl: "https://paperclip.example.test",
      },
    });

    const storage: StorageService = {
      provider: "local_fs",
      putFile: vi.fn(),
      getObject: vi.fn().mockResolvedValue({
        stream: Readable.from(["# summary"]),
        contentType: "text/markdown",
        contentLength: 9,
      }),
      headObject: vi.fn(),
      deleteObject: vi.fn(),
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        ok: true,
        result: { message_id: 9901 },
      }),
    });

    const svc = issueTelegramNotificationService(db, storage, {
      fetchImpl: fetchMock as unknown as typeof fetch,
      resolveTelegramBotToken: vi.fn().mockResolvedValue("telegram-token"),
    });

    await svc.sendIssueDoneNotification(issueId, {
      completionSummary:
        "Update Defined the interim proxy attribution policy for product-level reporting until ecommerce product attribution is reliable.",
    });

    expect(storage.getObject).toHaveBeenCalledWith(companyId, attachment.objectKey);
    const textBody = getTelegramTextBody(fetchMock);
    expect(String(textBody.text)).toContain("Що зроблено:");
    expect(wordCount(String(textBody.text).split("Що зроблено:")[1] ?? "")).toBeLessThanOrEqual(90);
    expect(String(textBody.text)).not.toContain("interim proxy attribution policy");
    const form = getTelegramDocumentForm(fetchMock);
    const caption = String(form.get("caption"));
    expect(caption).toContain("Файл до DIS-28");
    expect(caption).toContain("Компанія: DiskInternals");
    expect(caption).toContain("Задача: Налаштування роботи агентів");
    expect(caption).not.toContain("Що зроблено:");
    expect(caption).toContain("Відкрити в Paperclip: https://paperclip.example.test/DIS/issues/DIS-28");
    expect(caption).not.toContain("interim proxy attribution policy");
    expect(caption).not.toContain("ecommerce product attribution");
  });

  it("includes project context and humanizes review lane summaries", async () => {
    const companyId = randomUUID();
    const projectId = randomUUID();
    const issueId = randomUUID();
    const pluginId = randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: "DiskInternals",
      issuePrefix: "DIS",
      requireBoardApprovalForNewAgents: false,
    });

    await db.insert(projects).values({
      id: projectId,
      companyId,
      name: "Growth OS Launch",
      status: "in_progress",
    });

    await db.insert(issues).values({
      id: issueId,
      companyId,
      projectId,
      title: "Проаналізуй продукт",
      status: "done",
      priority: "medium",
      createdByUserId: "user-1",
      issueNumber: 50,
      identifier: "DIS-50",
    });

    await documentsSvc.upsertIssueDocument({
      issueId,
      key: "notification-contract",
      title: "Telegram delivery",
      format: "markdown",
      body: `
\`\`\`json notification-contract
{
  "enabled": true,
  "channel": "telegram",
  "trigger": "issue_done",
  "recipient": { "target": "default_chat" },
  "delivery": {
    "mode": "attach_file",
    "artifact": {
      "source": "issue_attachment",
      "filenameIncludes": "summary"
    }
  }
}
\`\`\`
`,
      authorAgentId: null,
    });

    const attachment = await issuesSvc.createAttachment({
      issueId,
      provider: "local_fs",
      objectKey: `${companyId}/issues/${issueId}/summary.md`,
      contentType: "text/markdown",
      byteSize: 9,
      sha256: "e".repeat(64),
      originalFilename: "summary.md",
      createdByUserId: "user-1",
    });

    await db.insert(plugins).values({
      id: pluginId,
      pluginKey: "paperclip-plugin-telegram",
      packageName: "paperclip-plugin-telegram",
      version: "0.3.0",
      apiVersion: 1,
      manifestJson: {},
      status: "ready",
    });
    await db.insert(pluginConfig).values({
      pluginId,
      configJson: {
        telegramBotTokenRef: "telegram-secret",
        defaultChatId: "-5154906793",
        paperclipPublicUrl: "https://paperclip.example.test",
      },
    });

    const storage: StorageService = {
      provider: "local_fs",
      putFile: vi.fn(),
      getObject: vi.fn().mockResolvedValue({
        stream: Readable.from(["# summary"]),
        contentType: "text/markdown",
        contentLength: 9,
      }),
      headObject: vi.fn(),
      deleteObject: vi.fn(),
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        ok: true,
        result: { message_id: 9902 },
      }),
    });

    const svc = issueTelegramNotificationService(db, storage, {
      fetchImpl: fetchMock as unknown as typeof fetch,
      resolveTelegramBotToken: vi.fn().mockResolvedValue("telegram-token"),
    });

    await svc.sendIssueDoneNotification(issueId, {
      completionSummary:
        "Review Decision Decision: accepted Accepted draft lane: DIS-53 Accepted validation lane: DIS-54 Canonical writer delivery: DIS-53 delivery comment Validation artifact: /companies/diskinternals/work/61-validation.md",
    });

    expect(storage.getObject).toHaveBeenCalledWith(companyId, attachment.objectKey);
    const textBody = getTelegramTextBody(fetchMock);
    expect(String(textBody.text)).toContain("Що зроблено:");
    expect(wordCount(String(textBody.text).split("Що зроблено:")[1] ?? "")).toBeLessThanOrEqual(90);
    expect(String(textBody.text)).not.toContain("Review Decision");
    const form = getTelegramDocumentForm(fetchMock);
    const caption = String(form.get("caption"));
    expect(caption).toContain("Файл до DIS-50");
    expect(caption).toContain("Компанія: DiskInternals");
    expect(caption).toContain("Проєкт: Growth OS Launch");
    expect(caption).toContain("Задача: Проаналізуй продукт");
    expect(caption).not.toContain("Що зроблено:");
    expect(caption).toContain("Відкрити в Paperclip: https://paperclip.example.test/DIS/issues/DIS-50");
    expect(caption).not.toContain("Review Decision");
    expect(caption).not.toContain("Accepted draft lane");
    expect(caption).not.toContain("Validation artifact");
  });

  it("humanizes final semantic-core manager decisions using the full completion comment", async () => {
    const companyId = randomUUID();
    const projectId = randomUUID();
    const issueId = randomUUID();
    const pluginId = randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: "DiskInternals",
      issuePrefix: "DIS",
      requireBoardApprovalForNewAgents: false,
    });

    await db.insert(projects).values({
      id: projectId,
      companyId,
      name: "Growth OS Launch",
      status: "in_progress",
    });

    await db.insert(issues).values({
      id: issueId,
      companyId,
      projectId,
      title: "Semantic core for VMFS Recovery for Mac OS users",
      status: "done",
      priority: "medium",
      createdByUserId: "user-1",
      issueNumber: 55,
      identifier: "DIS-55",
    });

    await documentsSvc.upsertIssueDocument({
      issueId,
      key: "notification-contract",
      title: "Telegram delivery",
      format: "markdown",
      body: `
\`\`\`json notification-contract
{
  "enabled": true,
  "channel": "telegram",
  "trigger": "issue_done",
  "recipient": { "target": "default_chat" },
  "delivery": {
    "mode": "attach_file",
    "artifact": {
      "source": "issue_attachment",
      "filenameIncludes": "summary"
    }
  }
}
\`\`\`
`,
      authorAgentId: null,
    });

    const attachment = await issuesSvc.createAttachment({
      issueId,
      provider: "local_fs",
      objectKey: `${companyId}/issues/${issueId}/summary.md`,
      contentType: "text/markdown",
      byteSize: 9,
      sha256: "f".repeat(64),
      originalFilename: "summary.md",
      createdByUserId: "user-1",
    });

    await db.insert(plugins).values({
      id: pluginId,
      pluginKey: "paperclip-plugin-telegram",
      packageName: "paperclip-plugin-telegram",
      version: "0.3.0",
      apiVersion: 1,
      manifestJson: {},
      status: "ready",
    });
    await db.insert(pluginConfig).values({
      pluginId,
      configJson: {
        telegramBotTokenRef: "telegram-secret",
        defaultChatId: "-5154906793",
        paperclipPublicUrl: "https://paperclip.example.test",
      },
    });

    const storage: StorageService = {
      provider: "local_fs",
      putFile: vi.fn(),
      getObject: vi.fn().mockResolvedValue({
        stream: Readable.from(["# summary"]),
        contentType: "text/markdown",
        contentLength: 9,
      }),
      headObject: vi.fn(),
      deleteObject: vi.fn(),
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        ok: true,
        result: { message_id: 9903 },
      }),
    });

    const svc = issueTelegramNotificationService(db, storage, {
      fetchImpl: fetchMock as unknown as typeof fetch,
      resolveTelegramBotToken: vi.fn().mockResolvedValue("telegram-token"),
    });

    await svc.sendIssueDoneNotification(issueId, {
      completionSummary: `## Final Manager Decision

Decision: \`accepted\`.

The reopened native-worldwide live rerun loop is accepted with a narrow downstream boundary.

Accepted artifacts:
- Full owner-visible semantic-universe export remains: /companies/diskinternals/work/53-seo-semantic-core/active/full-export.md
- Native-worldwide live rerun accepted as the latest narrow live evidence: /companies/diskinternals/work/53-seo-semantic-core/active/live-rerun.md

Manager review:
- The six kept rerun rows have measured global_search_volume = 0; do not use them alone for Stage 56 demand-priority math.`,
    });

    expect(storage.getObject).toHaveBeenCalledWith(companyId, attachment.objectKey);
    const textBody = getTelegramTextBody(fetchMock);
    expect(String(textBody.text)).toContain("Що зроблено:");
    expect(wordCount(String(textBody.text).split("Що зроблено:")[1] ?? "")).toBeLessThanOrEqual(90);
    expect(String(textBody.text)).not.toContain("Final Manager Decision");
    const form = getTelegramDocumentForm(fetchMock);
    const caption = String(form.get("caption"));
    expect(caption).toContain("Файл до DIS-55");
    expect(caption).toContain("Компанія: DiskInternals");
    expect(caption).toContain("Проєкт: Growth OS Launch");
    expect(caption).not.toContain("Що зроблено:");
    expect(caption).not.toContain("Задачу завершено. Деталі можна відкрити в Paperclip.");
    expect(caption).not.toContain("Final Manager Decision");
    expect(caption).not.toContain("global_search_volume");
  });

  it("uses a recent rich issue comment when the done transition summary is generic", async () => {
    const companyId = randomUUID();
    const projectId = randomUUID();
    const issueId = randomUUID();
    const pluginId = randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: "DiskInternals",
      issuePrefix: "DIS",
      requireBoardApprovalForNewAgents: false,
    });

    await db.insert(projects).values({
      id: projectId,
      companyId,
      name: "Growth OS Launch",
      status: "in_progress",
    });

    await db.insert(issues).values({
      id: issueId,
      companyId,
      projectId,
      title: "Semantic core for VMFS Recovery for Mac OS users",
      status: "done",
      priority: "medium",
      createdByUserId: "user-1",
      issueNumber: 91,
      identifier: "DIS-91",
    });

    await issuesSvc.addComment(
      issueId,
      "Семантичне ядро для VMFS Recovery на Mac перевірено: агент зібрав повний набір seed-запитів, розділив їх на продуктові, проблемні, VMware/ESXi, datastore, RAID та how-to кластери, зберіг geo і global volume поля та підготував результат до подальшої SEO-валидації.",
      { agentId: undefined, userId: "user-1" },
    );

    await documentsSvc.upsertIssueDocument({
      issueId,
      key: "notification-contract",
      title: "Telegram delivery",
      format: "markdown",
      body: `
\`\`\`json notification-contract
{
  "enabled": true,
  "channel": "telegram",
  "trigger": "issue_done",
  "recipient": { "target": "default_chat" },
  "delivery": {
    "mode": "attach_file",
    "artifact": {
      "source": "issue_attachment",
      "filenameIncludes": "summary"
    }
  }
}
\`\`\`
`,
      authorAgentId: null,
    });

    await issuesSvc.createAttachment({
      issueId,
      provider: "local_fs",
      objectKey: `${companyId}/issues/${issueId}/summary.md`,
      contentType: "text/markdown",
      byteSize: 9,
      sha256: "1".repeat(64),
      originalFilename: "summary.md",
      createdByUserId: "user-1",
    });

    await db.insert(plugins).values({
      id: pluginId,
      pluginKey: "paperclip-plugin-telegram",
      packageName: "paperclip-plugin-telegram",
      version: "0.3.0",
      apiVersion: 1,
      manifestJson: {},
      status: "ready",
    });
    await db.insert(pluginConfig).values({
      pluginId,
      configJson: {
        telegramBotTokenRef: "telegram-secret",
        defaultChatId: "-5154906793",
        paperclipPublicUrl: "https://paperclip.example.test",
      },
    });

    const storage: StorageService = {
      provider: "local_fs",
      putFile: vi.fn(),
      getObject: vi.fn().mockResolvedValue({
        stream: Readable.from(["# summary"]),
        contentType: "text/markdown",
        contentLength: 9,
      }),
      headObject: vi.fn(),
      deleteObject: vi.fn(),
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        ok: true,
        result: { message_id: 9910 },
      }),
    });

    const svc = issueTelegramNotificationService(db, storage, {
      fetchImpl: fetchMock as unknown as typeof fetch,
      resolveTelegramBotToken: vi.fn().mockResolvedValue("telegram-token"),
    });

    await svc.sendIssueDoneNotification(issueId, {
      completionSummary: "Done",
    });

    const textBody = getTelegramTextBody(fetchMock);
    expect(String(textBody.text)).toContain("Семантичне ядро для VMFS Recovery на Mac перевірено");
    expect(String(textBody.text)).toContain("geo і global volume");
    expect(wordCount(String(textBody.text).split("Що зроблено:")[1] ?? "")).toBeLessThanOrEqual(90);
    const form = getTelegramDocumentForm(fetchMock);
    expect(String(form.get("caption"))).not.toContain("Що зроблено: Done");
  });

  it("skips delivery when no notification contract exists", async () => {
    const companyId = randomUUID();
    const issueId = randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: "Astrogen",
      issuePrefix: "AST",
      requireBoardApprovalForNewAgents: false,
    });

    await db.insert(issues).values({
      id: issueId,
      companyId,
      title: "No contract",
      status: "done",
      priority: "medium",
      createdByUserId: "user-1",
    });

    const storage: StorageService = {
      provider: "local_fs",
      putFile: vi.fn(),
      getObject: vi.fn(),
      headObject: vi.fn(),
      deleteObject: vi.fn(),
    };

    const svc = issueTelegramNotificationService(db, storage, {
      fetchImpl: vi.fn() as unknown as typeof fetch,
      resolveTelegramBotToken: vi.fn().mockResolvedValue("telegram-token"),
    });

    await expect(svc.sendIssueDoneNotification(issueId)).resolves.toEqual({
      status: "skipped",
      reason: "contract_not_found",
    });
  });
});
