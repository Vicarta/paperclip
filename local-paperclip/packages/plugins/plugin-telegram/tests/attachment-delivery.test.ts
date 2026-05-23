import { afterEach, describe, expect, it, vi } from "vitest";
import type { IssueAttachment } from "@paperclipai/shared";
import { deliverIssueAttachmentGroups } from "../src/attachment-delivery.js";

function attachment(input: Partial<IssueAttachment> & { id: string; originalFilename: string; contentType: string }): IssueAttachment {
  return {
    id: input.id,
    companyId: input.companyId ?? "company-1",
    issueId: input.issueId ?? "issue-1",
    issueCommentId: null,
    assetId: `asset-${input.id}`,
    provider: "local_fs",
    objectKey: input.objectKey ?? input.originalFilename,
    contentType: input.contentType,
    byteSize: input.byteSize ?? 10,
    sha256: input.sha256 ?? "a".repeat(64),
    originalFilename: input.originalFilename,
    createdByAgentId: null,
    createdByUserId: "user-1",
    createdAt: new Date("2026-05-19T00:00:00.000Z"),
    updatedAt: new Date("2026-05-19T00:00:00.000Z"),
    contentPath: `/api/attachments/${input.id}/content`,
  };
}

function createContext(opts?: {
  documentBody?: string | null;
  attachments?: IssueAttachment[];
  deliveredState?: unknown;
}) {
  const state = new Map<string, unknown>();
  if (opts?.deliveredState) {
    state.set("preset", opts.deliveredState);
  }
  const comments: string[] = [];
  const activity: unknown[] = [];
  const attachments = opts?.attachments ?? [];
  return {
    comments,
    activity,
    ctx: {
      issues: {
        documents: {
          get: vi.fn().mockResolvedValue(
            opts?.documentBody === null
              ? null
              : {
                  body: opts?.documentBody ?? buildGroupedContract(),
                  latestRevisionId: "revision-1",
                },
          ),
        },
        listAttachments: vi.fn().mockResolvedValue(attachments),
        getAttachmentContent: vi.fn().mockImplementation(async (attachmentId: string) => {
          const found = attachments.find((candidate) => candidate.id === attachmentId);
          if (!found) throw new Error("Attachment not found");
          return {
            attachment: found,
            contentBase64: Buffer.from(`content:${found.originalFilename}`, "utf8").toString("base64"),
          };
        }),
        createComment: vi.fn().mockImplementation(async (_issueId: string, body: string) => {
          comments.push(body);
          return {};
        }),
      },
      state: {
        get: vi.fn().mockImplementation(async ({ stateKey }: { stateKey: string }) =>
          stateKey.includes("already") ? { deliveredAt: "now" } : state.get(stateKey) ?? null,
        ),
        set: vi.fn().mockImplementation(async ({ stateKey }: { stateKey: string }, value: unknown) => {
          state.set(stateKey, value);
        }),
      },
      activity: {
        log: vi.fn().mockImplementation(async (entry: unknown) => {
          activity.push(entry);
        }),
      },
      metrics: {
        write: vi.fn().mockResolvedValue(undefined),
      },
      http: {
        fetch: vi.fn().mockResolvedValue({
          json: vi.fn().mockResolvedValue({ ok: true, result: { message_id: 100 } }),
        }),
      },
      logger: {
        warn: vi.fn(),
        error: vi.fn(),
      },
    } as any,
  };
}

function buildGroupedContract(extra = "") {
  return `
\`\`\`json notification-contract
{
  "enabled": true,
  "channel": "telegram",
  "trigger": "issue_done",
  "delivery": {
    "mode": "delivery_groups",
    "summary": "Готовий пакет матеріалів.",
    "groups": [
      {
        "key": "article-1",
        "title": "Стаття 1",
        "caption": "1/1 Стаття 1",
        "artifacts": [
          { "source": "issue_attachment", "filenameIncludes": "article-1", "contentTypePrefix": "text/markdown" },
          { "source": "issue_attachment", "filenameIncludes": "article-1", "contentTypePrefix": "text/html" },
          { "source": "issue_attachment", "filenameIncludes": "article-1", "contentTypePrefix": "image/" }
        ]
      }${extra}
    ]
  }
}
\`\`\`
`;
}

describe("telegram attachment delivery groups", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends grouped issue attachments as Telegram documents and writes an audit trail", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ ok: true, result: { message_id: 101 } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { ctx, comments, activity } = createContext({
      attachments: [
        attachment({ id: "md-1", originalFilename: "article-1.md", contentType: "text/markdown" }),
        attachment({ id: "html-1", originalFilename: "article-1.html", contentType: "text/html" }),
        attachment({ id: "image-1", originalFilename: "article-1.png", contentType: "image/png" }),
      ],
    });

    const result = await deliverIssueAttachmentGroups({
      ctx,
      token: "token",
      event: {
        eventId: "event-1",
        eventType: "issue.updated",
        companyId: "company-1",
        entityType: "issue",
        entityId: "issue-1",
        payload: { status: "done" },
        occurredAt: new Date().toISOString(),
      } as any,
      chatId: "-100",
    });

    expect(result).toMatchObject({ status: "sent", fileCount: 3, groupCount: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      "https://api.telegram.org/bottoken/sendDocument",
      "https://api.telegram.org/bottoken/sendDocument",
      "https://api.telegram.org/bottoken/sendDocument",
    ]);
    expect(comments.at(-1)).toContain("Telegram attachment delivery completed.");
    expect(activity).toHaveLength(2);
    expect(activity.at(-1)).toMatchObject({
      message: "operational.telegram_delivery_proof",
      entityType: "issue",
      entityId: "issue-1",
      metadata: {
        channel: "telegram",
        issueId: "issue-1",
        chatId: "-100",
        messageIds: [100, 101, 101, 101],
        deliveryKind: "attachment_delivery_group",
        trigger: "issue_done",
        groupCount: 1,
        fileCount: 3,
      },
    });
  });

  it("blocks delivery and comments when a selected attachment is missing", async () => {
    const { ctx, comments } = createContext({
      attachments: [
        attachment({ id: "md-1", originalFilename: "article-1.md", contentType: "text/markdown" }),
      ],
    });

    const result = await deliverIssueAttachmentGroups({
      ctx,
      token: "token",
      event: {
        eventId: "event-1",
        eventType: "issue.updated",
        companyId: "company-1",
        entityType: "issue",
        entityId: "issue-1",
        payload: { status: "done" },
        occurredAt: new Date().toISOString(),
      } as any,
      chatId: "-100",
    });

    expect(result).toMatchObject({ status: "blocked" });
    expect(comments.at(-1)).toContain("references files that are not attached");
  });
});
