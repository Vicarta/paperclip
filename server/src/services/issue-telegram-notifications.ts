import { eq, and, desc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { pluginConfig, plugins } from "@paperclipai/db";
import type { StorageService } from "../storage/types.js";
import { issueService } from "./issues.js";
import { issueNotificationContractService } from "./issue-notification-contracts.js";
import { secretService } from "./secrets.js";
import { logActivity, type LogActivityInput } from "./activity-log.js";

const TELEGRAM_PLUGIN_PACKAGE_NAME = "paperclip-plugin-telegram";

type TelegramPluginConfig = {
  telegramBotTokenRef: string | null;
  defaultChatId: string | null;
  approvalsChatId: string | null;
  errorsChatId: string | null;
  escalationChatId: string | null;
  paperclipPublicUrl: string | null;
};

type TelegramRoutingKey = "default" | "approvals" | "errors" | "escalation";

export type IssueTelegramNotificationResult =
  | {
      status: "sent";
      chatId: string;
      attachmentIds: string[];
      messageIds: Array<number | null>;
      attachmentId: string | null;
      messageId: number | null;
    }
  | {
      status: "skipped";
      reason:
        | "issue_not_found"
        | "contract_not_found"
        | "contract_disabled"
        | "attachment_not_found"
        | "telegram_plugin_not_ready"
        | "telegram_plugin_config_missing"
        | "telegram_bot_token_ref_missing"
        | "telegram_chat_id_missing";
    };

export interface IssueTelegramNotificationDeps {
  fetchImpl?: typeof fetch;
  resolveTelegramBotToken?: (companyId: string, secretRef: string) => Promise<string>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function parseTelegramPluginConfig(value: unknown): TelegramPluginConfig | null {
  const record = asRecord(value);
  if (!record) return null;
  return {
    telegramBotTokenRef: asNonEmptyString(record.telegramBotTokenRef),
    defaultChatId: asNonEmptyString(record.defaultChatId),
    approvalsChatId: asNonEmptyString(record.approvalsChatId),
    errorsChatId: asNonEmptyString(record.errorsChatId),
    escalationChatId: asNonEmptyString(record.escalationChatId),
    paperclipPublicUrl: asNonEmptyString(record.paperclipPublicUrl),
  };
}

function resolveChatId(
  config: TelegramPluginConfig,
  recipient: { target?: string; chatId?: string; routingKey?: string } | undefined,
): string | null {
  const target = recipient?.target ?? "default_chat";
  if (target === "chat_id") return recipient?.chatId ?? null;
  if (target === "routing_key") {
    const routingKey = (recipient?.routingKey ?? "default") as TelegramRoutingKey;
    switch (routingKey) {
      case "approvals":
        return config.approvalsChatId ?? null;
      case "errors":
        return config.errorsChatId ?? null;
      case "escalation":
        return config.escalationChatId ?? null;
      case "default":
      default:
        return config.defaultChatId ?? null;
    }
  }
  return config.defaultChatId ?? null;
}

function buildCaption(
  issue: Pick<{ identifier: string | null; title: string; status: string; id: string }, "identifier" | "title" | "status" | "id">,
  publicUrl: string | null,
): string {
  const identifier = issue.identifier ?? issue.id;
  const summary = summarizeIssueTitleForTelegram(issue.title);
  const parts = [`✅ Готово: ${identifier} — ${summary}`];
  if (publicUrl) {
    const trimmed = publicUrl.replace(/\/+$/, "");
    parts.push(`Відкрити задачу: ${trimmed}/issues/${issue.id}`);
  }
  const caption = parts.join("\n");
  return caption.length > 1024 ? caption.slice(0, 1021) + "..." : caption;
}

function truncateForTelegramLine(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function summarizeIssueTitleForTelegram(title: string): string {
  const normalized = title.replace(/\s+/g, " ").trim();
  if (!normalized) return "задачу завершено.";

  const cyrillicMatches = normalized.match(/[А-Яа-яІіЇїЄєҐґ]/g)?.length ?? 0;
  const letterMatches = normalized.match(/\p{L}/gu)?.length ?? 0;
  const cyrillicRatio = letterMatches > 0 ? cyrillicMatches / letterMatches : 0;
  const looksTechnical =
    /(?:release|delta|check|runtime|notification|paperclip|agent|heartbeat|plugin|sync|writeback|rollback|deploy)/i.test(
      normalized,
    ) || /[+/]|::|->|=>|`/.test(normalized);

  if (cyrillicRatio >= 0.55 && !looksTechnical) {
    return truncateForTelegramLine(normalized, 180);
  }

  return "задачу завершено. Деталі можна подивитися в Paperclip.";
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function sendTelegramDocument(params: {
  fetchImpl: typeof fetch;
  token: string;
  chatId: string;
  topicId?: string | null;
  caption?: string | null;
  filename: string;
  contentType: string;
  fileBuffer: Buffer;
}): Promise<number | null> {
  const form = new FormData();
  form.set("chat_id", params.chatId);
  if (params.topicId) form.set("message_thread_id", params.topicId);
  if (params.caption) form.set("caption", params.caption);
  form.set(
    "document",
    new File([new Uint8Array(params.fileBuffer)], params.filename, {
      type: params.contentType,
    }),
  );

  const response = await params.fetchImpl(`https://api.telegram.org/bot${params.token}/sendDocument`, {
    method: "POST",
    body: form,
  });
  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; description?: string; result?: { message_id?: number } }
    | null;

  if (!response.ok || payload?.ok !== true) {
    throw new Error(payload?.description || `Telegram sendDocument failed with status ${response.status}`);
  }

  return payload?.result?.message_id ?? null;
}

export function issueTelegramNotificationService(
  db: Db,
  storage: StorageService,
  deps?: IssueTelegramNotificationDeps,
) {
  const issuesSvc = issueService(db);
  const contractsSvc = issueNotificationContractService(db);
  const secretsSvc = secretService(db);
  const fetchImpl = deps?.fetchImpl ?? fetch;
  const resolveTelegramBotToken =
    deps?.resolveTelegramBotToken ??
    ((companyId: string, secretRef: string) => secretsSvc.resolveSecretValue(companyId, secretRef, "latest"));

  async function getReadyTelegramPluginConfig(): Promise<TelegramPluginConfig | null> {
    const row = await db
      .select({ configJson: pluginConfig.configJson })
      .from(plugins)
      .innerJoin(pluginConfig, eq(pluginConfig.pluginId, plugins.id))
      .where(and(eq(plugins.packageName, TELEGRAM_PLUGIN_PACKAGE_NAME), eq(plugins.status, "ready")))
      .orderBy(desc(plugins.updatedAt))
      .then((rows) => rows[0] ?? null);
    return parseTelegramPluginConfig(row?.configJson ?? null);
  }

  async function sendIssueDoneNotification(
    issueId: string,
    actor?: Pick<LogActivityInput, "actorType" | "actorId" | "agentId" | "runId">,
  ): Promise<IssueTelegramNotificationResult> {
    const issue = await issuesSvc.getById(issueId);
    if (!issue) return { status: "skipped", reason: "issue_not_found" };

    const resolved = await contractsSvc.getForIssue(issueId);
    if (!resolved) return { status: "skipped", reason: "contract_not_found" };
    if (!resolved.contract.enabled) return { status: "skipped", reason: "contract_disabled" };
    if (!resolved.attachment || resolved.attachments.length === 0) {
      return { status: "skipped", reason: "attachment_not_found" };
    }
    if (
      resolved.contract.delivery.mode === "attach_files" &&
      resolved.attachments.length !== resolved.contract.delivery.artifacts.length
    ) {
      return { status: "skipped", reason: "attachment_not_found" };
    }

    const config = await getReadyTelegramPluginConfig();
    if (!config) return { status: "skipped", reason: "telegram_plugin_not_ready" };
    if (!config.telegramBotTokenRef) return { status: "skipped", reason: "telegram_bot_token_ref_missing" };

    const chatId = resolveChatId(config, resolved.contract.recipient);
    if (!chatId) return { status: "skipped", reason: "telegram_chat_id_missing" };

    const token = await resolveTelegramBotToken(issue.companyId, config.telegramBotTokenRef);
    const topicId = resolved.contract.recipient?.topicId ?? null;
    const caption = buildCaption(issue, config.paperclipPublicUrl);
    const messageIds: Array<number | null> = [];

    for (const [index, attachment] of resolved.attachments.entries()) {
      const object = await storage.getObject(issue.companyId, attachment.objectKey);
      const fileBuffer = await streamToBuffer(object.stream);
      const filename = attachment.originalFilename ?? "attachment";
      const messageId = await sendTelegramDocument({
        fetchImpl,
        token,
        chatId,
        topicId,
        caption: index === 0 ? caption : null,
        filename,
        contentType: attachment.contentType || object.contentType || "application/octet-stream",
        fileBuffer,
      });
      messageIds.push(messageId);
    }

    await logActivity(db, {
      companyId: issue.companyId,
      actorType: actor?.actorType ?? "system",
      actorId: actor?.actorId ?? "system:issue-telegram-notifier",
      agentId: actor?.agentId ?? null,
      runId: actor?.runId ?? null,
      action: "issue.notification_sent",
      entityType: "issue",
      entityId: issue.id,
      details: {
        channel: "telegram",
        trigger: "issue_done",
        attachmentId: resolved.attachment.id,
        attachmentIds: resolved.attachments.map((attachment) => attachment.id),
        attachmentFilename: resolved.attachment.originalFilename ?? "attachment",
        attachmentFilenames: resolved.attachments.map((attachment) => attachment.originalFilename ?? "attachment"),
        chatId,
        messageId: messageIds[0] ?? null,
        messageIds,
        identifier: issue.identifier,
      },
    });

    return {
      status: "sent",
      chatId,
      attachmentIds: resolved.attachments.map((attachment) => attachment.id),
      messageIds,
      attachmentId: resolved.attachment.id,
      messageId: messageIds[0] ?? null,
    };
  }

  return {
    sendIssueDoneNotification,
  };
}
