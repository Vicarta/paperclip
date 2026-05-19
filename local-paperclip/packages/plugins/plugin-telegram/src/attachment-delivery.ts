import { createHash } from "node:crypto";
import type { IssueAttachment } from "@paperclipai/shared";
import type { PluginContext, PluginEvent } from "@paperclipai/plugin-sdk";
import { ISSUE_NOTIFICATION_CONTRACT_KEY, issueNotificationContractSchema } from "@paperclipai/shared";
import { sendDocument, sendMessage } from "./telegram-api.js";

const JSON_FENCE_REGEX = /```json(?:\s+notification-contract)?\s*([\s\S]*?)```/i;
const DELIVERY_STATE_PREFIX = "telegram.attachment-delivery.v1";

type AttachmentSelector = {
  source?: "issue_attachment";
  filenameIncludes?: string;
  contentTypePrefix?: string;
};

type DeliveryGroup = {
  key: string;
  title?: string;
  caption?: string;
  artifacts: AttachmentSelector[];
};

type DeliveryContract = {
  enabled: boolean;
  channel: "telegram";
  trigger: "issue_done";
  delivery: {
    mode: "delivery_groups";
    summary?: string;
    groups: DeliveryGroup[];
  };
};

export type AttachmentDeliveryResult =
  | { status: "skipped"; reason: "missing_issue_id" | "missing_contract" | "disabled" | "unsupported_mode" | "already_delivered" }
  | { status: "blocked"; missing: Array<{ groupKey: string; selector: AttachmentSelector }> }
  | { status: "sent"; fingerprint: string; messageIds: number[]; fileCount: number; groupCount: number };

function extractJson(body: string): string | null {
  const trimmed = body.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  return body.match(JSON_FENCE_REGEX)?.[1]?.trim() ?? null;
}

function parseContract(body: string): DeliveryContract | null {
  const json = extractJson(body);
  if (!json) return null;
  const parsed = issueNotificationContractSchema.parse(JSON.parse(json));
  if (parsed.channel !== "telegram" || parsed.trigger !== "issue_done") return null;
  if (parsed.delivery.mode !== "delivery_groups") return null;
  return parsed as DeliveryContract;
}

function attachmentMatchesSelector(attachment: IssueAttachment, selector: AttachmentSelector): boolean {
  const filename = attachment.originalFilename ?? "";
  if (selector.filenameIncludes && !filename.includes(selector.filenameIncludes)) return false;
  if (selector.contentTypePrefix && !attachment.contentType.startsWith(selector.contentTypePrefix)) return false;
  return true;
}

function resolveGroup(attachments: IssueAttachment[], group: DeliveryGroup) {
  const resolved: IssueAttachment[] = [];
  const missing: AttachmentSelector[] = [];
  for (const selector of group.artifacts) {
    const match = attachments.find((candidate) => attachmentMatchesSelector(candidate, selector)) ?? null;
    if (!match) {
      missing.push(selector);
      continue;
    }
    if (!resolved.some((attachment) => attachment.id === match.id)) {
      resolved.push(match);
    }
  }
  return { group, attachments: resolved, missing };
}

function createFingerprint(input: {
  issueId: string;
  revisionId: string | null;
  groups: Array<{ group: DeliveryGroup; attachments: IssueAttachment[] }>;
}) {
  const payload = {
    issueId: input.issueId,
    revisionId: input.revisionId,
    groups: input.groups.map((group) => ({
      key: group.group.key,
      attachmentIds: group.attachments.map((attachment) => attachment.id),
    })),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function deliveryStateKey(issueId: string, fingerprint: string) {
  return `${DELIVERY_STATE_PREFIX}:${issueId}:${fingerprint}`;
}

function formatBlockedComment(missing: Array<{ groupKey: string; selector: AttachmentSelector }>) {
  const lines = [
    "Telegram delivery skipped: the notification contract references files that are not attached to this issue.",
    "",
    ...missing.map((item) => {
      const selectorParts = [
        item.selector.filenameIncludes ? `filename includes "${item.selector.filenameIncludes}"` : null,
        item.selector.contentTypePrefix ? `content type starts with "${item.selector.contentTypePrefix}"` : null,
      ].filter(Boolean);
      return `- ${item.groupKey}: ${selectorParts.join(", ") || "issue attachment"}`;
    }),
  ];
  return lines.join("\n");
}

function formatAuditComment(input: {
  groupCount: number;
  fileCount: number;
  messageIds: number[];
  fingerprint: string;
}) {
  return [
    "Telegram attachment delivery completed.",
    `Groups: ${input.groupCount}`,
    `Files: ${input.fileCount}`,
    `Telegram message ids: ${input.messageIds.join(", ") || "n/a"}`,
    `Delivery fingerprint: ${input.fingerprint.slice(0, 16)}`,
  ].join("\n");
}

export async function deliverIssueAttachmentGroups(input: {
  ctx: PluginContext;
  token: string;
  event: PluginEvent;
  chatId: string;
  messageThreadId?: number;
}): Promise<AttachmentDeliveryResult> {
  const issueId = input.event.entityId;
  if (!issueId) return { status: "skipped", reason: "missing_issue_id" };

  const document = await input.ctx.issues.documents.get(
    issueId,
    ISSUE_NOTIFICATION_CONTRACT_KEY,
    input.event.companyId,
  );
  if (!document?.body) return { status: "skipped", reason: "missing_contract" };

  const contract = parseContract(document.body);
  if (!contract) return { status: "skipped", reason: "unsupported_mode" };
  if (!contract.enabled) return { status: "skipped", reason: "disabled" };

  const attachments = await input.ctx.issues.listAttachments(issueId, input.event.companyId);
  const resolvedGroups = contract.delivery.groups.map((group) => resolveGroup(attachments, group));
  const missing = resolvedGroups.flatMap((group) =>
    group.missing.map((selector) => ({ groupKey: group.group.key, selector })),
  );

  if (missing.length > 0) {
    await input.ctx.issues.createComment(issueId, formatBlockedComment(missing), input.event.companyId);
    return { status: "blocked", missing };
  }

  const fingerprint = createFingerprint({
    issueId,
    revisionId: document.latestRevisionId ?? null,
    groups: resolvedGroups,
  });
  const stateKey = deliveryStateKey(issueId, fingerprint);
  const previous = await input.ctx.state.get({ scopeKind: "instance", stateKey });
  if (previous) return { status: "skipped", reason: "already_delivered" };

  const messageIds: number[] = [];
  if (contract.delivery.summary) {
    const messageId = await sendMessage(input.ctx, input.token, input.chatId, contract.delivery.summary, {
      messageThreadId: input.messageThreadId,
    });
    if (messageId) messageIds.push(messageId);
  }

  for (const group of resolvedGroups) {
    for (const [index, attachment] of group.attachments.entries()) {
      const content = await input.ctx.issues.getAttachmentContent(attachment.id, input.event.companyId);
      const messageId = await sendDocument(
        input.ctx,
        input.token,
        input.chatId,
        content.attachment,
        Buffer.from(content.contentBase64, "base64"),
        {
          caption: index === 0 ? group.group.caption ?? group.group.title : undefined,
          messageThreadId: input.messageThreadId,
        },
      );
      if (messageId) messageIds.push(messageId);
    }
  }

  const fileCount = resolvedGroups.reduce((sum, group) => sum + group.attachments.length, 0);
  await input.ctx.state.set({ scopeKind: "instance", stateKey }, {
    issueId,
    companyId: input.event.companyId,
    fingerprint,
    messageIds,
    deliveredAt: new Date().toISOString(),
  });
  await input.ctx.activity.log({
    companyId: input.event.companyId,
    message: "Sent Telegram issue attachment delivery groups",
    entityType: "issue",
    entityId: issueId,
    metadata: {
      fingerprint,
      groupCount: resolvedGroups.length,
      fileCount,
      messageIds,
    },
  });
  await input.ctx.issues.createComment(
    issueId,
    formatAuditComment({
      groupCount: resolvedGroups.length,
      fileCount,
      messageIds,
      fingerprint,
    }),
    input.event.companyId,
  );

  return {
    status: "sent",
    fingerprint,
    messageIds,
    groupCount: resolvedGroups.length,
    fileCount,
  };
}
