import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { companies, createDb, issues, pluginConfig, plugins } from "@paperclipai/db";
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
      completionSummary: "Статтю підготовлено й надіслано в Telegram.",
    });

    expect(result).toEqual({
      status: "sent",
      chatId: "-5154906793",
      attachmentIds: [attachment.id],
      messageIds: [7788],
      attachmentId: attachment.id,
      messageId: 7788,
    });
    expect(storage.getObject).toHaveBeenCalledWith(companyId, `${companyId}/issues/${issueId}/money-article-final.md`);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.telegram.org/bottelegram-token/sendDocument");
    expect(init.method).toBe("POST");

    const form = init.body as FormData;
    expect(form.get("chat_id")).toBe("-5154906793");
    expect(form.get("caption")).toContain("✅ Готово: AST-456");
    expect(form.get("caption")).toContain("Задача: Налаштування Telegram-повідомлень");
    expect(form.get("caption")).toContain("Суть: Статтю підготовлено й надіслано в Telegram.");
    expect(form.get("caption")).toContain(`Відкрити задачу: https://paperclip.example.test/issues/${issueId}`);
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
      messageIds: [8801, 8802],
      attachmentId: markdownAttachment.id,
      messageId: 8801,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstForm = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    const secondForm = fetchMock.mock.calls[1]?.[1]?.body as FormData;
    expect(firstForm.get("caption")).toContain("✅ Готово: AST-457");
    expect(firstForm.get("caption")).toContain("Задача: Налаштування Telegram-повідомлень");
    expect(firstForm.get("caption")).toContain("Суть: Пакет статті підготовлено у Markdown та HTML.");
    expect(firstForm.get("caption")).toContain(`Відкрити задачу: https://paperclip.example.test/issues/${issueId}`);
    expect(secondForm.get("caption")).toBeNull();
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
