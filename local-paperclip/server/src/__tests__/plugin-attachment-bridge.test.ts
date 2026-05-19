import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { companies, createDb, issues } from "@paperclipai/db";
import { createHostClientHandlers } from "../../../packages/plugins/sdk/src/host-client-factory.js";
import { PLUGIN_RPC_ERROR_CODES } from "../../../packages/plugins/sdk/src/protocol.js";
import type { StorageService } from "../storage/types.js";
import { issueService } from "../services/issues.js";
import { buildHostServices } from "../services/plugin-host-services.js";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

function createEventBusStub() {
  return {
    forPlugin() {
      return {
        emit: async () => undefined,
        subscribe: async () => undefined,
      };
    },
  } as any;
}

function createStorageStub(objects: Map<string, Buffer>): StorageService {
  return {
    provider: "local_fs",
    async putFile() {
      throw new Error("putFile is not used in this test");
    },
    async getObject(_companyId, objectKey) {
      const body = objects.get(objectKey);
      if (!body) throw new Error(`Object not found: ${objectKey}`);
      return {
        stream: Readable.from(body),
        contentLength: body.length,
        contentType: "text/plain",
      };
    },
    async headObject() {
      return { exists: true };
    },
    async deleteObject() {
      return undefined;
    },
  };
}

describeEmbeddedPostgres("plugin attachment bridge", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-plugin-attachment-bridge-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.execute(`TRUNCATE TABLE issue_attachments, assets, issues, companies CASCADE`);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("reads attachment metadata and content for the owning company only", async () => {
    const companyId = randomUUID();
    const otherCompanyId = randomUUID();
    const issueId = randomUUID();
    const otherIssueId = randomUUID();
    const objects = new Map<string, Buffer>([
      ["issues/one/article.md", Buffer.from("article body", "utf8")],
      ["issues/other/secret.md", Buffer.from("other body", "utf8")],
    ]);

    await db.insert(companies).values([
      {
        id: companyId,
        name: "Astrogen",
        issuePrefix: "AST",
        requireBoardApprovalForNewAgents: false,
      },
      {
        id: otherCompanyId,
        name: "Other",
        issuePrefix: "OTH",
        requireBoardApprovalForNewAgents: false,
      },
    ]);

    await db.insert(issues).values([
      {
        id: issueId,
        companyId,
        title: "Article package",
        status: "done",
        priority: "medium",
        createdByUserId: "user-1",
      },
      {
        id: otherIssueId,
        companyId: otherCompanyId,
        title: "Other package",
        status: "done",
        priority: "medium",
        createdByUserId: "user-1",
      },
    ]);

    const issuesSvc = issueService(db);
    const attachment = await issuesSvc.createAttachment({
      issueId,
      provider: "local_fs",
      objectKey: "issues/one/article.md",
      contentType: "text/markdown",
      byteSize: 12,
      sha256: "a".repeat(64),
      originalFilename: "article.md",
      createdByUserId: "user-1",
    });
    const otherAttachment = await issuesSvc.createAttachment({
      issueId: otherIssueId,
      provider: "local_fs",
      objectKey: "issues/other/secret.md",
      contentType: "text/markdown",
      byteSize: 10,
      sha256: "b".repeat(64),
      originalFilename: "secret.md",
      createdByUserId: "user-1",
    });

    const services = buildHostServices(
      db,
      "plugin-record-id",
      "paperclip-plugin-telegram",
      createEventBusStub(),
      undefined,
      createStorageStub(objects),
    );
    const handlers = createHostClientHandlers({
      pluginId: "paperclip-plugin-telegram",
      capabilities: ["issues.read", "issue.attachments.read"],
      services,
    });

    await expect(handlers["issues.attachments.list"]({ issueId, companyId })).resolves.toEqual([
      expect.objectContaining({
        id: attachment.id,
        contentPath: `/api/attachments/${attachment.id}/content`,
      }),
    ]);

    await expect(
      handlers["issues.attachments.getContent"]({ attachmentId: attachment.id, companyId }),
    ).resolves.toEqual({
      attachment: expect.objectContaining({
        id: attachment.id,
        contentPath: `/api/attachments/${attachment.id}/content`,
      }),
      contentBase64: Buffer.from("article body", "utf8").toString("base64"),
    });

    await expect(
      handlers["issues.attachments.getContent"]({ attachmentId: otherAttachment.id, companyId }),
    ).rejects.toThrow("Attachment not found");
  });

  it("requires issue.attachments.read capability", async () => {
    const services = buildHostServices(
      db,
      "plugin-record-id",
      "paperclip-plugin-telegram",
      createEventBusStub(),
      undefined,
      createStorageStub(new Map()),
    );
    const handlers = createHostClientHandlers({
      pluginId: "paperclip-plugin-telegram",
      capabilities: ["issues.read"],
      services,
    });

    await expect(
      handlers["issues.attachments.list"]({ issueId: randomUUID(), companyId: randomUUID() }),
    ).rejects.toMatchObject({
      code: PLUGIN_RPC_ERROR_CODES.CAPABILITY_DENIED,
    });
  });
});
