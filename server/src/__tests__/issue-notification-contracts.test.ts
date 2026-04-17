import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { companies, createDb, issues } from "@paperclipai/db";
import {
  extractIssueNotificationContractJson,
  issueNotificationContractService,
  parseIssueNotificationContractDocument,
} from "../services/issue-notification-contracts.ts";
import { documentService } from "../services/documents.ts";
import { issueService } from "../services/issues.ts";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

describe("issue notification contract parsing", () => {
  it("extracts the first fenced json block", () => {
    expect(
      extractIssueNotificationContractJson(`
# Notifications

\`\`\`json notification-contract
{"enabled":true,"channel":"telegram","trigger":"issue_done","delivery":{"mode":"attach_file","artifact":{"source":"issue_attachment"}}}
\`\`\`
      `),
    ).toContain('"channel":"telegram"');
  });

  it("parses a markdown-backed notification contract document", () => {
    const contract = parseIssueNotificationContractDocument({
      body: `
\`\`\`json
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
  }
}
\`\`\`
      `,
    });

    expect(contract.channel).toBe("telegram");
    expect(contract.delivery.artifact.filenameIncludes).toBe("article");
  });

  it("parses a multi-file telegram notification contract document", () => {
    const contract = parseIssueNotificationContractDocument({
      body: `
\`\`\`json
{
  "enabled": true,
  "channel": "telegram",
  "trigger": "issue_done",
  "delivery": {
    "mode": "attach_files",
    "artifacts": [
      { "source": "issue_attachment", "filenameIncludes": ".md" },
      { "source": "issue_attachment", "filenameIncludes": ".html" }
    ]
  }
}
\`\`\`
      `,
    });

    expect(contract.delivery.mode).toBe("attach_files");
    if (contract.delivery.mode !== "attach_files") {
      throw new Error("Expected attach_files mode");
    }
    expect(contract.delivery.artifacts).toHaveLength(2);
  });
});

describeEmbeddedPostgres("issueNotificationContractService", () => {
  let db!: ReturnType<typeof createDb>;
  let documentsSvc!: ReturnType<typeof documentService>;
  let issuesSvc!: ReturnType<typeof issueService>;
  let notificationSvc!: ReturnType<typeof issueNotificationContractService>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-issue-notification-contracts-");
    db = createDb(tempDb.connectionString);
    documentsSvc = documentService(db);
    issuesSvc = issueService(db);
    notificationSvc = issueNotificationContractService(db);
  }, 20_000);

  afterEach(async () => {
    await db.execute(`TRUNCATE TABLE issue_attachments, assets, issue_documents, document_revisions, documents, issues, companies CASCADE`);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("resolves the latest matching attachment for the notification contract", async () => {
    const companyId = randomUUID();
    const issueId = randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: "AST",
      requireBoardApprovalForNewAgents: false,
    });

    await db.insert(issues).values({
      id: issueId,
      companyId,
      title: "Article ready notification",
      status: "done",
      priority: "medium",
      createdByUserId: "user-1",
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
      "filenameIncludes": "article",
      "contentTypePrefix": "text/"
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

    await issuesSvc.createAttachment({
      issueId,
      provider: "local_fs",
      objectKey: "draft-1.md",
      contentType: "text/markdown",
      byteSize: 10,
      sha256: "a".repeat(64),
      originalFilename: "draft-notes.md",
      createdByUserId: "user-1",
    });

    const finalAttachment = await issuesSvc.createAttachment({
      issueId,
      provider: "local_fs",
      objectKey: "article-final.md",
      contentType: "text/markdown",
      byteSize: 12,
      sha256: "b".repeat(64),
      originalFilename: "money-article-final.md",
      createdByUserId: "user-1",
    });

    const resolved = await notificationSvc.getForIssue(issueId);

    expect(resolved?.key).toBe("notification-contract");
    expect(resolved?.contract.channel).toBe("telegram");
    expect(resolved?.attachment).toEqual(
      expect.objectContaining({
        id: finalAttachment.id,
        originalFilename: "money-article-final.md",
        contentPath: `/api/attachments/${finalAttachment.id}/content`,
      }),
    );
    expect(resolved?.attachments).toEqual([
      expect.objectContaining({
        id: finalAttachment.id,
      }),
    ]);
  });

  it("resolves multiple attachments for attach_files delivery", async () => {
    const companyId = randomUUID();
    const issueId = randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: "AST",
      requireBoardApprovalForNewAgents: false,
    });

    await db.insert(issues).values({
      id: issueId,
      companyId,
      title: "Article bundle notification",
      status: "done",
      priority: "medium",
      createdByUserId: "user-1",
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
      { "source": "issue_attachment", "filenameIncludes": "publishable", "contentTypePrefix": "text/markdown" },
      { "source": "issue_attachment", "filenameIncludes": "publishable", "contentTypePrefix": "text/html" }
    ]
  }
}
\`\`\`
      `,
      createdByUserId: "user-1",
    });

    const markdownAttachment = await issuesSvc.createAttachment({
      issueId,
      provider: "local_fs",
      objectKey: "article-publishable.md",
      contentType: "text/markdown",
      byteSize: 12,
      sha256: "c".repeat(64),
      originalFilename: "money-publishable.md",
      createdByUserId: "user-1",
    });

    const htmlAttachment = await issuesSvc.createAttachment({
      issueId,
      provider: "local_fs",
      objectKey: "article-publishable.html",
      contentType: "text/html",
      byteSize: 24,
      sha256: "d".repeat(64),
      originalFilename: "money-publishable.html",
      createdByUserId: "user-1",
    });

    const resolved = await notificationSvc.getForIssue(issueId);

    expect(resolved?.attachment?.id).toBe(markdownAttachment.id);
    expect(resolved?.attachments).toEqual([
      expect.objectContaining({ id: markdownAttachment.id }),
      expect.objectContaining({ id: htmlAttachment.id }),
    ]);
  });
});
