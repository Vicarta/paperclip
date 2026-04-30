import { eq, and, desc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { companies, pluginConfig, plugins, projects } from "@paperclipai/db";
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

type IssueDoneNotificationActor = Partial<Pick<LogActivityInput, "actorType" | "actorId" | "agentId" | "runId">> & {
  completionSummary?: string | null;
};

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
  issue: Pick<
    { identifier: string | null; title: string; status: string; id: string; projectId: string | null },
    "identifier" | "title" | "status" | "id" | "projectId"
  >,
  publicUrl: string | null,
  company: { name: string; issuePrefix: string } | null,
  project: { name: string } | null,
  completionSummary?: string | null,
): string {
  const identifier = issue.identifier ?? issue.id;
  const title = summarizeIssueTitleForTelegram(issue.title);
  const summary = summarizeCompletionForTelegram(completionSummary, issue.title);
  const parts = [`✅ Готово: ${identifier}`];
  if (company?.name) {
    parts.push(`Компанія: ${company.name}`);
  }
  if (project?.name) {
    parts.push(`Проєкт: ${project.name}`);
  }
  parts.push(`Задача: ${title}`, `Що зроблено: ${summary}`);
  if (publicUrl) {
    const trimmed = publicUrl.replace(/\/+$/, "");
    const issuePath = issue.identifier && company?.issuePrefix
      ? `/${company.issuePrefix}/issues/${issue.identifier}`
      : `/issues/${issue.id}`;
    parts.push(`Відкрити в Paperclip: ${trimmed}${issuePath}`);
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
  if (!normalized) return "Без назви";

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

  if (/telegram|notification/i.test(normalized)) return "Налаштування Telegram-повідомлень";
  if (/release|delta|runtime|deploy|sync/i.test(normalized)) return "Технічне оновлення Paperclip";
  if (/agent|heartbeat/i.test(normalized)) return "Налаштування роботи агентів";

  return truncateForTelegramLine(normalized, 180);
}

function summarizeCompletionForTelegram(summary: string | null | undefined, title: string): string {
  const normalized = normalizeTelegramSummary(summary);
  const simple = simplifyCompletionSummaryForHuman(normalized, title);
  if (simple) return truncateForTelegramLine(simple, 360);

  if (/telegram|notification/i.test(title)) return "Оновлено формат повідомлень у Telegram.";
  if (/release|delta|runtime|deploy|sync/i.test(title)) return "Оновлення застосовано і перевірено.";
  if (/agent|heartbeat/i.test(title)) return "Налаштування агентів оновлено.";

  return "Задачу завершено.";
}

function textStats(value: string) {
  const cyrillicMatches = value.match(/[А-Яа-яІіЇїЄєҐґ]/g)?.length ?? 0;
  const latinMatches = value.match(/[A-Za-z]/g)?.length ?? 0;
  const letterMatches = value.match(/\p{L}/gu)?.length ?? 0;
  return {
    cyrillicRatio: letterMatches > 0 ? cyrillicMatches / letterMatches : 0,
    latinRatio: letterMatches > 0 ? latinMatches / letterMatches : 0,
  };
}

function simplifyCompletionSummaryForHuman(summary: string | null, title: string): string | null {
  if (!summary) return null;

  const withoutStatusPrefix = summary
    .replace(/^(?:update|updated|done|completed|implemented|finished|closed|closing|summary|result)\s*[:—-]?\s*/i, "")
    .trim();
  if (!withoutStatusPrefix) return null;

  const stats = textStats(withoutStatusPrefix);
  const looksTechnical =
    /(?:schema|handoff|runtime|deploy|plugin|adapter|api|mcp|json|metadata|writeback|rollback|sync|provider|canonical)/i.test(
      withoutStatusPrefix,
    ) || /[`{}[\]|]|->|=>|::/.test(withoutStatusPrefix);

  if (
    /review decision/i.test(withoutStatusPrefix) &&
    /accepted/i.test(withoutStatusPrefix) &&
    /(?:draft|validation)\s+lane/i.test(withoutStatusPrefix)
  ) {
    const laneIds = Array.from(new Set(withoutStatusPrefix.match(/[A-Z]{2,10}-\d+/g) ?? []));
    const laneNote = laneIds.length > 0
      ? ` Пов'язані задачі: ${laneIds.join(", ")}.`
      : "";
    return `Результат перевірено й прийнято.${laneNote} Деталі та файли залишені в Paperclip.`;
  }

  if (stats.cyrillicRatio >= 0.45 && !looksTechnical) {
    return withoutStatusPrefix;
  }

  if (
    /interim|proxy|attribution|ecommerce|product-level|reporting/i.test(withoutStatusPrefix) &&
    /attribution|ecommerce|product/i.test(withoutStatusPrefix)
  ) {
    return "Зафіксовано тимчасове правило для звітів по продуктах: поки точна прив'язка покупок до конкретного продукту ще не готова, агенти мають оцінювати результати обережно і не робити хибних висновків.";
  }

  if (/telegram|notification/i.test(withoutStatusPrefix)) {
    return "Оновлено Telegram-повідомлення: тепер вони мають бути зрозумілішими для людини, а деталі можна подивитися в Paperclip.";
  }

  if (/search console|gsc|analytics|query|queries|ctr|impression/i.test(withoutStatusPrefix)) {
    return "Оновлено роботу з пошуковою статистикою: агенти зможуть брати дані з Google Search Console для аналізу сторінок і запитів.";
  }

  if (/agent|heartbeat|routine|inbox|paperclip/i.test(withoutStatusPrefix)) {
    return "Оновлено налаштування роботи агентів у Paperclip, щоб вони коректніше виконували задачі та не плутали робочі процеси.";
  }

  if (/agent|heartbeat/i.test(title)) {
    return "Задачу по налаштуванню агентів завершено. Технічні деталі залишені в Paperclip, а тут показана тільки суть.";
  }

  if (stats.latinRatio > 0.45 || looksTechnical) {
    return "Задачу завершено. Це технічне оновлення; деталі можна відкрити в Paperclip.";
  }

  return withoutStatusPrefix;
}

function normalizeTelegramSummary(value: string | null | undefined): string | null {
  const normalized = String(value ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return null;

  const firstSentence = normalized.match(/^(.+?[.!?])(?:\s|$)/u)?.[1]?.trim();
  return firstSentence || normalized;
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

  async function getIssueCompany(companyId: string): Promise<{ name: string; issuePrefix: string } | null> {
    return await db
      .select({ name: companies.name, issuePrefix: companies.issuePrefix })
      .from(companies)
      .where(eq(companies.id, companyId))
      .then((rows) => rows[0] ?? null);
  }

  async function getIssueProject(projectId: string | null): Promise<{ name: string } | null> {
    if (!projectId) return null;
    return await db
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.id, projectId))
      .then((rows) => rows[0] ?? null);
  }

  async function sendIssueDoneNotification(
    issueId: string,
    actor?: IssueDoneNotificationActor,
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

    const [token, company, project] = await Promise.all([
      resolveTelegramBotToken(issue.companyId, config.telegramBotTokenRef),
      getIssueCompany(issue.companyId),
      getIssueProject(issue.projectId),
    ]);
    const topicId = resolved.contract.recipient?.topicId ?? null;
    const caption = buildCaption(issue, config.paperclipPublicUrl, company, project, actor?.completionSummary);
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
