import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";
import { sendMessage } from "../src/telegram-api.js";
import { recordTelegramDeliveryProof } from "../src/delivery-proof.js";

vi.mock("../src/telegram-api.js", async () => {
  const actual = await vi.importActual<typeof import("../src/telegram-api.js")>(
    "../src/telegram-api.js",
  );
  return {
    ...actual,
    sendMessage: vi.fn().mockResolvedValue(321),
    setMyCommands: vi.fn(),
  };
});

vi.mock("../src/delivery-proof.js", async () => {
  const actual = await vi.importActual<typeof import("../src/delivery-proof.js")>(
    "../src/delivery-proof.js",
  );
  return {
    ...actual,
    recordTelegramDeliveryProof: vi.fn().mockResolvedValue(undefined),
  };
});

const sendMessageMock = vi.mocked(sendMessage);
const recordTelegramDeliveryProofMock = vi.mocked(recordTelegramDeliveryProof);

describe("telegram delivery profiles", () => {
  beforeEach(() => {
    sendMessageMock.mockClear();
    recordTelegramDeliveryProofMock.mockClear();
  });

  it("sends through a configured profile and records issue delivery proof", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        telegramBotTokenRef: "00000000-0000-4000-8000-000000000001",
        defaultChatId: "-100-default",
        enableCommands: false,
        enableInbound: false,
        deliveryProfiles: [
          {
            key: "diskinternals-news-docs",
            botTokenRef: "00000000-0000-4000-8000-000000000002",
            chatId: "-100-profile",
            topicId: "77",
            parseMode: "HTML",
            disableWebPagePreview: true,
          },
        ],
      },
    });

    await plugin.definition.setup(harness.ctx);

    const result = await harness.executeTool("telegram_send_message", {
      profileKey: "diskinternals-news-docs",
      text: "<b>Документ готовий</b>",
      issueId: "DI-123",
      contentRef: {
        documentId: "doc-1",
        documentUrl: "https://docs.google.com/document/d/doc-1/edit",
      },
    });

    expect(result.data).toEqual({
      ok: true,
      chatId: "-100-profile",
      messageId: 321,
      profileKey: "diskinternals-news-docs",
    });
    expect(sendMessageMock).toHaveBeenCalledWith(
      harness.ctx,
      "resolved:00000000-0000-4000-8000-000000000002",
      "-100-profile",
      "<b>Документ готовий</b>",
      {
        parseMode: "HTML",
        messageThreadId: 77,
        disableNotification: undefined,
        disableWebPagePreview: true,
      },
    );
    expect(recordTelegramDeliveryProofMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ctx: harness.ctx,
        issueId: "DI-123",
        chatId: "-100-profile",
        messageIds: [321],
        deliveryKind: "message_only",
        trigger: "telegram_send_message",
        contentRef: {
          documentId: "doc-1",
          documentUrl: "https://docs.google.com/document/d/doc-1/edit",
          profileKey: "diskinternals-news-docs",
        },
      }),
    );
  });

  it("rejects unknown delivery profiles", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        telegramBotTokenRef: "00000000-0000-4000-8000-000000000001",
        defaultChatId: "-100-default",
        enableCommands: false,
        enableInbound: false,
      },
    });

    await plugin.definition.setup(harness.ctx);

    await expect(
      harness.executeTool("telegram_send_message", {
        profileKey: "missing",
        text: "Hello",
      }),
    ).rejects.toThrow(/not configured/);
  });
});
