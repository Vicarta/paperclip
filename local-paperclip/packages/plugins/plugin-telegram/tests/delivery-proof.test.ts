import { describe, expect, it, vi } from "vitest";
import { recordTelegramDeliveryProof } from "../src/delivery-proof.js";

describe("telegram delivery proof ledger", () => {
  it("writes a structured issue activity proof for Telegram delivery", async () => {
    const activity: unknown[] = [];
    const ctx = {
      activity: {
        log: vi.fn().mockImplementation(async (entry: unknown) => {
          activity.push(entry);
        }),
      },
    } as any;

    await recordTelegramDeliveryProof({
      ctx,
      companyId: "company-1",
      issueId: "issue-1",
      chatId: "-100",
      messageThreadId: 77,
      messageIds: [123],
      deliveryKind: "issue_notification",
      trigger: "issue.updated",
      contentRef: {
        cmsCollection: "blogPosts",
        cmsId: 44,
      },
    });

    expect(activity).toHaveLength(1);
    expect(activity[0]).toMatchObject({
      companyId: "company-1",
      message: "operational.telegram_delivery_proof",
      entityType: "issue",
      entityId: "issue-1",
      metadata: {
        channel: "telegram",
        issueId: "issue-1",
        chatId: "-100",
        messageId: 123,
        messageIds: [123],
        messageThreadId: 77,
        deliveryKind: "issue_notification",
        trigger: "issue.updated",
        contentRef: {
          cmsCollection: "blogPosts",
          cmsId: 44,
        },
      },
    });
    expect((activity[0] as any).metadata.sentAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("does not write proof when Telegram returned no message id", async () => {
    const ctx = {
      activity: {
        log: vi.fn(),
      },
    } as any;

    await recordTelegramDeliveryProof({
      ctx,
      companyId: "company-1",
      issueId: "issue-1",
      chatId: "-100",
      messageIds: [],
      deliveryKind: "issue_notification",
      trigger: "issue.updated",
    });

    expect(ctx.activity.log).not.toHaveBeenCalled();
  });
});
