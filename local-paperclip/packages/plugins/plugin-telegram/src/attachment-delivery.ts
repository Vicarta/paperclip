import { createHash } from "node:crypto";
import type { IssueAttachment } from "@paperclipai/shared";
import type { PluginContext, PluginEvent } from "@paperclipai/plugin-sdk";
import { sendDocument, sendMessage } from "./telegram-api.js";
import { recordTelegramDeliveryProof } from "./delivery-proof.js";

const JSON_FENCE_REGEX = /```json(?:\s+notification-contract)?\s*([\s\S]*?)```/i;
const DELIVERY_STATE_PREFIX = "telegram.attachment-delivery.v1";
const ISSUE_NOTIFICATION_CONTRACT_KEY = "notification-contract";

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
  delivery:
    | {
        mode: "delivery_groups";
        summary?: string;
        groups: DeliveryGroup[];
      }
    | {
        mode: "message_only";
        text: string;
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asOptionalString(value: unknown): string | undefined | null {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseSelector(value: unknown): AttachmentSelector | null {
  const record = asRecord(value);
  if (!record) return null;
  if (record.source !== undefined && record.source !== "issue_attachment") return null;

  const filenameIncludes = asOptionalString(record.filenameIncludes);
  if (filenameIncludes === null) return null;
  const contentTypePrefix = asOptionalString(record.contentTypePrefix);
  if (contentTypePrefix === null) return null;

  return {
    source: "issue_attachment",
    ...(filenameIncludes ? { filenameIncludes } : {}),
    ...(contentTypePrefix ? { contentTypePrefix } : {}),
  };
}

function parseGroup(value: unknown): DeliveryGroup | null {
  const record = asRecord(value);
  if (!record) return null;

  const key = asOptionalString(record.key);
  if (!key) return null;
  const title = asOptionalString(record.title);
  if (title === null) return null;
  const caption = asOptionalString(record.caption);
  if (caption === null) return null;

  if (!Array.isArray(record.artifacts) || record.artifacts.length === 0 || record.artifacts.length > 5) {
    return null;
  }
  const artifacts = record.artifacts.map((selector) => parseSelector(selector));
  if (artifacts.some((selector) => selector === null)) return null;

  return {
    key,
    ...(title ? { title } : {}),
    ...(caption ? { caption } : {}),
    artifacts: artifacts as AttachmentSelector[],
  };
}

function parseContract(body: string): DeliveryContract | null {
  const json = extractJson(body);
  if (!json) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }

  const record = asRecord(parsed);
  if (!record) return null;
  if (record.channel !== "telegram" || record.trigger !== "issue_done") return null;

  const enabled = record.enabled === undefined ? true : record.enabled;
  if (typeof enabled !== "boolean") return null;

  const delivery = asRecord(record.delivery);
  if (!delivery) return null;

  if (delivery.mode === "message_only") {
    const text = asOptionalString(delivery.text);
    if (!text) return null;
    return {
      enabled,
      channel: "telegram",
      trigger: "issue_done",
      delivery: {
        mode: "message_only",
        text,
      },
    };
  }

  if (delivery.mode !== "delivery_groups") return null;
  const summary = asOptionalString(delivery.summary);
  if (summary === null) return null;

  if (!Array.isArray(delivery.groups) || delivery.groups.length === 0 || delivery.groups.length > 100) {
    return null;
  }
  const groups = delivery.groups.map((group) => parseGroup(group));
  if (groups.some((group) => group === null)) return null;

  return {
    enabled,
    channel: "telegram",
    trigger: "issue_done",
    delivery: {
      mode: "delivery_groups",
      ...(summary ? { summary } : {}),
      groups: groups as DeliveryGroup[],
    },
  };
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
  groups?: Array<{ group: DeliveryGroup; attachments: IssueAttachment[] }>;
  messageOnlyText?: string;
}) {
  const payload = {
    issueId: input.issueId,
    revisionId: input.revisionId,
    messageOnlyText: input.messageOnlyText,
    groups: (input.groups ?? []).map((group) => ({
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

  if (contract.delivery.mode === "message_only") {
    const fingerprint = createFingerprint({
      issueId,
      revisionId: document.latestRevisionId ?? null,
      messageOnlyText: contract.delivery.text,
    });
    const stateKey = deliveryStateKey(issueId, fingerprint);
    const previous = await input.ctx.state.get({ scopeKind: "instance", stateKey });
    if (previous) return { status: "skipped", reason: "already_delivered" };

    const messageId = await sendMessage(input.ctx, input.token, input.chatId, contract.delivery.text, {
      messageThreadId: input.messageThreadId,
    });
    const messageIds = messageId ? [messageId] : [];
    await input.ctx.state.set({ scopeKind: "instance", stateKey }, {
      issueId,
      companyId: input.event.companyId,
      fingerprint,
      messageIds,
      deliveredAt: new Date().toISOString(),
    });
    await input.ctx.activity.log({
      companyId: input.event.companyId,
      message: "Sent Telegram issue message-only notification",
      entityType: "issue",
      entityId: issueId,
      metadata: {
        fingerprint,
        messageIds,
      },
    });
    await recordTelegramDeliveryProof({
      ctx: input.ctx,
      companyId: input.event.companyId,
      issueId,
      chatId: input.chatId,
      messageThreadId: input.messageThreadId,
      messageIds,
      deliveryKind: "message_only",
      trigger: "issue_done",
      fingerprint,
      groupCount: 0,
      fileCount: 0,
    });
    await input.ctx.issues.createComment(
      issueId,
      formatAuditComment({
        groupCount: 0,
        fileCount: 0,
        messageIds,
        fingerprint,
      }),
      input.event.companyId,
    );

    return {
      status: "sent",
      fingerprint,
      messageIds,
      groupCount: 0,
      fileCount: 0,
    };
  }

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
  await recordTelegramDeliveryProof({
    ctx: input.ctx,
    companyId: input.event.companyId,
    issueId,
    chatId: input.chatId,
    messageThreadId: input.messageThreadId,
    messageIds,
    deliveryKind: "attachment_delivery_group",
    trigger: "issue_done",
    fingerprint,
    groupCount: resolvedGroups.length,
    fileCount,
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
