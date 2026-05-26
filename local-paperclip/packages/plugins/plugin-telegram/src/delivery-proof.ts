import type { PluginContext } from "@paperclipai/plugin-sdk";

export const TELEGRAM_DELIVERY_PROOF_ACTION = "operational.telegram_delivery_proof";

export type TelegramDeliveryProofInput = {
  ctx: PluginContext;
  companyId: string;
  issueId: string;
  chatId: string;
  messageIds: number[];
  deliveryKind: "issue_notification" | "attachment_delivery_group" | "message_only";
  trigger: string;
  messageThreadId?: number | null;
  fingerprint?: string | null;
  groupCount?: number | null;
  fileCount?: number | null;
  contentRef?: Record<string, unknown> | null;
};

export async function recordTelegramDeliveryProof(input: TelegramDeliveryProofInput): Promise<void> {
  const messageIds = input.messageIds.filter((messageId) => Number.isFinite(messageId));
  if (messageIds.length === 0) return;

  await input.ctx.activity.log({
    companyId: input.companyId,
    message: TELEGRAM_DELIVERY_PROOF_ACTION,
    entityType: "issue",
    entityId: input.issueId,
    metadata: {
      channel: "telegram",
      issueId: input.issueId,
      chatId: input.chatId,
      messageIds,
      messageId: messageIds[0] ?? null,
      sentAt: new Date().toISOString(),
      deliveryKind: input.deliveryKind,
      trigger: input.trigger,
      ...(input.messageThreadId ? { messageThreadId: input.messageThreadId } : {}),
      ...(input.fingerprint ? { fingerprint: input.fingerprint } : {}),
      ...(typeof input.groupCount === "number" ? { groupCount: input.groupCount } : {}),
      ...(typeof input.fileCount === "number" ? { fileCount: input.fileCount } : {}),
      ...(input.contentRef ? { contentRef: input.contentRef } : {}),
    },
  });
}
