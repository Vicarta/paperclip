import { eq, and, desc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { activityLog, agents, companies, issueComments, pluginConfig, plugins, projects } from "@paperclipai/db";
import type { StorageService } from "../storage/types.js";
import { issueService } from "./issues.js";
import { issueNotificationContractService } from "./issue-notification-contracts.js";
import { secretService } from "./secrets.js";
import { logActivity, type LogActivityInput } from "./activity-log.js";

const TELEGRAM_PLUGIN_PACKAGE_NAME = "paperclip-plugin-telegram";
const TELEGRAM_DOCUMENT_CAPTION_LIMIT = 1024;
const TELEGRAM_MESSAGE_TEXT_LIMIT = 4096;
const COMPLETION_SUMMARY_MAX_WORDS = 90;

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
  agentName?: string | null,
  completionSummary?: string | null,
): string {
  const identifier = issue.identifier ?? issue.id;
  const title = summarizeIssueTitleForTelegram(issue.title);
  void completionSummary;
  const parts = [`Файл до ${identifier}`];
  if (company?.name) {
    parts.push(`Компанія: ${company.name}`);
  }
  if (project?.name) {
    parts.push(`Проєкт: ${project.name}`);
  }
  if (agentName) {
    parts.push(`Агент: ${agentName}`);
  }
  parts.push(`Задача: ${title}`);
  if (publicUrl) {
    const trimmed = publicUrl.replace(/\/+$/, "");
    const issuePath = issue.identifier && company?.issuePrefix
      ? `/${company.issuePrefix}/issues/${issue.identifier}`
      : `/issues/${issue.id}`;
    parts.push(`Відкрити в Paperclip: ${trimmed}${issuePath}`);
  }
  const caption = parts.join("\n");
  return caption.length > TELEGRAM_DOCUMENT_CAPTION_LIMIT
    ? caption.slice(0, TELEGRAM_DOCUMENT_CAPTION_LIMIT - 3) + "..."
    : caption;
}

function buildIssueUrl(
  issue: Pick<{ identifier: string | null; id: string }, "identifier" | "id">,
  publicUrl: string | null,
  company: { issuePrefix: string } | null,
): string | null {
  if (!publicUrl) return null;
  const trimmed = publicUrl.replace(/\/+$/, "");
  const issuePath = issue.identifier && company?.issuePrefix
    ? `/${company.issuePrefix}/issues/${issue.identifier}`
    : `/issues/${issue.id}`;
  return `${trimmed}${issuePath}`;
}

function buildIssueDoneMessage(
  issue: Pick<
    { identifier: string | null; title: string; status: string; id: string; projectId: string | null },
    "identifier" | "title" | "status" | "id" | "projectId"
  >,
  publicUrl: string | null,
  company: { name: string; issuePrefix: string } | null,
  project: { name: string } | null,
  agentName?: string | null,
  completionSummary?: string | null,
): string {
  const identifier = issue.identifier ?? issue.id;
  const title = summarizeIssueTitleForTelegram(issue.title);
  const summary = summarizeCompletionForTelegram(completionSummary, issue.title, {
    companyName: company?.name ?? null,
    projectName: project?.name ?? null,
  });
  const issueUrl = buildIssueUrl(issue, publicUrl, company);
  const parts = [`✅ Готово: ${identifier}`];
  if (company?.name) {
    parts.push(`Компанія: ${company.name}`);
  }
  if (project?.name) {
    parts.push(`Проєкт: ${project.name}`);
  }
  if (agentName) {
    parts.push(`Агент: ${agentName}`);
  }
  parts.push(`Задача: ${title}`, `Що зроблено: ${summary}`);
  if (issueUrl) {
    parts.push(`Відкрити задачу: ${issueUrl}`);
  }
  const message = parts.join("\n");
  return message.length > TELEGRAM_MESSAGE_TEXT_LIMIT
    ? message.slice(0, TELEGRAM_MESSAGE_TEXT_LIMIT - 3).trimEnd() + "..."
    : message;
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

function summarizeCompletionBriefForTelegram(summary: string | null | undefined, title: string): string {
  const known = summarizeKnownCompletionForTelegram(summary, title);
  if (known) return truncateForTelegramLine(known, 360);

  const normalized = normalizeTelegramSummary(summary);
  const simple = simplifyCompletionSummaryForHuman(normalized, title);
  if (simple) return truncateForTelegramLine(simple, 360);

  if (/telegram|notification/i.test(title)) return "Оновлено формат повідомлень у Telegram.";
  if (/release|delta|runtime|deploy|sync/i.test(title)) return "Оновлення застосовано і перевірено.";
  if (/semantic\s+core|семантич/i.test(title)) {
    return "Задачу зі збору семантичного ядра завершено; результат і файли залишені в Paperclip.";
  }
  if (/agent|heartbeat/i.test(title)) return "Налаштування агентів оновлено.";

  return "Задачу завершено.";
}

function summarizeCompletionForTelegram(
  summary: string | null | undefined,
  title: string,
  context?: { companyName?: string | null; projectName?: string | null },
): string {
  const brief = summarizeCompletionBriefForTelegram(summary, title);
  return ensureHumanCompletionSummaryQuality(brief, summary, title, context);
}

function normalizeTelegramText(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function summarizeKnownCompletionForTelegram(summary: string | null | undefined, title: string): string | null {
  const normalized = normalizeTelegramText(summary);
  if (!normalized) return null;

  if (
    /final manager decision/i.test(normalized) &&
    /decision:\s*accepted/i.test(normalized) &&
    /native[-\s]?worldwide/i.test(normalized) &&
    /semantic[-\s]?universe|full[-\s]?export/i.test(normalized)
  ) {
    return "CMO прийняв фінальний результат: повне семантичне ядро лишається основною базою, а live native-worldwide перезапуск прийнято тільки як вузьку перевірку; його 6 рядків не можна використовувати як повний планувальний набір.";
  }

  if (
    /semantic\s+core/i.test(title) &&
    /decision:\s*accepted/i.test(normalized) &&
    /validation/i.test(normalized) &&
    /boundary/i.test(normalized)
  ) {
    return "Результат семантичного ядра прийнято з обмеженнями: ширша база і live-перевірка мають різне призначення, тож деталі потрібно дивитися в Paperclip.";
  }

  return null;
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
  const normalized = normalizeTelegramText(value);
  if (!normalized) return null;

  const firstSentence = normalized.match(/^(.+?[.!?])(?:\s|$)/u)?.[1]?.trim();
  return firstSentence || normalized;
}

function wordCount(value: string): number {
  return value.split(/\s+/).filter((word) => /\p{L}|\d/u.test(word)).length;
}

function trimToWordLimit(value: string, maxWords: number): string {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return value.trim();
  const trimmed = words.slice(0, maxWords).join(" ").replace(/[,:;]+$/u, "");
  return /[.!?]$/u.test(trimmed) ? trimmed : `${trimmed}.`;
}

function splitReadableSentences(value: string | null | undefined): string[] {
  const normalized = normalizeTelegramText(value);
  if (!normalized) return [];
  return normalized
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => {
      if (!sentence) return false;
      if (/^(?:done|completed|finished|accepted|decision|update|summary|result)[:.\s-]*$/i.test(sentence)) {
        return false;
      }
      if (/^(?:final manager decision|review decision|decision:\s*accepted)$/i.test(sentence)) return false;
      return wordCount(sentence) >= 5;
    })
    .slice(0, 3);
}

function isGenericCompletionSummary(value: string): boolean {
  const normalized = value.toLowerCase().replace(/\s+/g, " ").trim();
  return (
    normalized === "задачу завершено." ||
    normalized === "задачу завершено" ||
    normalized.includes("деталі можна відкрити в paperclip") ||
    normalized.includes("технічні деталі залишені в paperclip") ||
    normalized.includes("це технічне оновлення")
  );
}

function ensureHumanCompletionSummaryQuality(
  brief: string,
  rawSummary: string | null | undefined,
  title: string,
  context?: { companyName?: string | null; projectName?: string | null },
): string {
  const normalizedBrief = truncateForTelegramLine(brief, 420);
  const stats = textStats(normalizedBrief);
  const hasHumanLanguage = stats.cyrillicRatio >= 0.35;
  const needsRewrite = !hasHumanLanguage || isGenericCompletionSummary(normalizedBrief);

  if (!needsRewrite) {
    return trimToWordLimit(normalizedBrief, COMPLETION_SUMMARY_MAX_WORDS);
  }

  return expandCompletionSummaryForHuman(normalizedBrief, rawSummary, title, context);
}

function expandCompletionSummaryForHuman(
  brief: string,
  rawSummary: string | null | undefined,
  title: string,
  context?: { companyName?: string | null; projectName?: string | null },
): string {
  const companyName = context?.companyName?.trim() || "компанії";
  const issueTitle = summarizeIssueTitleForTelegram(title);
  const evidence = splitReadableSentences(rawSummary)
    .filter((sentence) => !/https?:\/\/|\b\/(?:companies|clients|paperclip)\//i.test(sentence))
    .filter((sentence) => !/(?:artifact|schema|payload|migration|docker|postgres|checksum|rollback|deploy)/i.test(sentence))
    .join(" ");
  const evidenceStats = textStats(evidence);
  const evidenceLooksAgentFacing =
    /(?:review decision|final manager decision|accepted draft lane|validation artifact|interim proxy attribution|global_search_volume|canonical writer delivery)/i.test(
      evidence,
    ) || evidenceStats.cyrillicRatio < 0.35;
  const usefulEvidence = evidence && !isGenericCompletionSummary(evidence) && !evidenceLooksAgentFacing
    ? evidence
    : null;
  const opening = isGenericCompletionSummary(brief)
    ? `Задачу "${issueTitle}" завершено.`
    : brief;
  const parts = [
    opening,
    usefulEvidence ? `Суть: ${trimToWordLimit(usefulEvidence, 38)}` : null,
    `Для ${companyName}: деталі й файли лишились у Paperclip.`,
    "Якщо потрібна дія людини, вона має бути окремо вказана в задачі.",
  ].filter(Boolean) as string[];

  return trimToWordLimit(parts.join(" "), COMPLETION_SUMMARY_MAX_WORDS);
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

async function sendTelegramMessage(params: {
  fetchImpl: typeof fetch;
  token: string;
  chatId: string;
  topicId?: string | null;
  text: string;
  issueUrl?: string | null;
}): Promise<number | null> {
  const body: Record<string, unknown> = {
    chat_id: params.chatId,
    text: params.text,
    disable_web_page_preview: true,
  };
  if (params.topicId) body.message_thread_id = params.topicId;
  if (params.issueUrl) {
    body.reply_markup = {
      inline_keyboard: [[{ text: "Відкрити задачу", url: params.issueUrl }]],
    };
  }

  const response = await params.fetchImpl(`https://api.telegram.org/bot${params.token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; description?: string; result?: { message_id?: number } }
    | null;

  if (!response.ok || payload?.ok !== true) {
    throw new Error(payload?.description || `Telegram sendMessage failed with status ${response.status}`);
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

  async function getActorAgentName(companyId: string, agentId: string | null | undefined): Promise<string | null> {
    if (!agentId) return null;
    const row = await db
      .select({ name: agents.name, title: agents.title })
      .from(agents)
      .where(and(eq(agents.companyId, companyId), eq(agents.id, agentId)))
      .then((rows) => rows[0] ?? null);
    if (!row) return null;
    return row.title ? `${row.name} (${row.title})` : row.name;
  }

  async function resolveCompletionSummaryEvidence(
    issue: { id: string; companyId: string },
    actor?: IssueDoneNotificationActor,
  ): Promise<string | null> {
    const candidates: string[] = [];
    const explicitSummary = asNonEmptyString(actor?.completionSummary);
    if (explicitSummary) candidates.push(explicitSummary);

    const recentComments = await db
      .select({
        body: issueComments.body,
        authorAgentId: issueComments.authorAgentId,
        createdByRunId: issueComments.createdByRunId,
      })
      .from(issueComments)
      .where(and(eq(issueComments.companyId, issue.companyId), eq(issueComments.issueId, issue.id)))
      .orderBy(desc(issueComments.createdAt), desc(issueComments.id))
      .limit(10);

    for (const comment of recentComments) {
      if (actor?.runId && comment.createdByRunId === actor.runId) candidates.push(comment.body);
    }
    for (const comment of recentComments) {
      if (actor?.agentId && comment.authorAgentId === actor.agentId) candidates.push(comment.body);
    }
    candidates.push(...recentComments.map((comment) => comment.body));

    const recentIssueUpdates = await db
      .select({ details: activityLog.details })
      .from(activityLog)
      .where(
        and(
          eq(activityLog.companyId, issue.companyId),
          eq(activityLog.entityType, "issue"),
          eq(activityLog.entityId, issue.id),
          eq(activityLog.action, "issue.updated"),
        ),
      )
      .orderBy(desc(activityLog.createdAt), desc(activityLog.id))
      .limit(10);

    for (const update of recentIssueUpdates) {
      const comment = asNonEmptyString(asRecord(update.details)?.comment);
      if (comment) candidates.push(comment);
    }

    return selectBestCompletionSummaryCandidate(candidates);
  }

  function selectBestCompletionSummaryCandidate(candidates: string[]): string | null {
    const scored = candidates
      .map((candidate, index) => {
        const normalized = normalizeTelegramText(candidate);
        if (!normalized) return null;
        const stats = textStats(normalized);
        const genericPenalty = isGenericCompletionSummary(normalized) || /^(?:done|completed|finished)\.?$/i.test(normalized)
          ? 60
          : 0;
        const score = Math.min(wordCount(normalized), 120) + stats.cyrillicRatio * 20 - genericPenalty - index * 0.1;
        return { normalized, score };
      })
      .filter((item): item is { normalized: string; score: number } => Boolean(item))
      .sort((a, b) => b.score - a.score);
    return scored[0]?.normalized ?? null;
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

    const [token, company, project, actorAgentName] = await Promise.all([
      resolveTelegramBotToken(issue.companyId, config.telegramBotTokenRef),
      getIssueCompany(issue.companyId),
      getIssueProject(issue.projectId),
      getActorAgentName(issue.companyId, actor?.agentId),
    ]);
    const topicId = resolved.contract.recipient?.topicId ?? null;
    const completionSummary = await resolveCompletionSummaryEvidence(issue, actor);
    const issueUrl = buildIssueUrl(issue, config.paperclipPublicUrl, company);
    const richMessage = buildIssueDoneMessage(
      issue,
      config.paperclipPublicUrl,
      company,
      project,
      actorAgentName,
      completionSummary,
    );
    const caption = buildCaption(issue, config.paperclipPublicUrl, company, project, actorAgentName, completionSummary);
    const messageIds: Array<number | null> = [];

    const summaryMessageId = await sendTelegramMessage({
      fetchImpl,
      token,
      chatId,
      topicId,
      text: richMessage,
      issueUrl,
    });
    messageIds.push(summaryMessageId);

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
