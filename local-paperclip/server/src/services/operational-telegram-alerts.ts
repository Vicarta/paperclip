import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, companies, issues, pluginConfig, plugins, projects } from "@paperclipai/db";
import { secretService } from "./secrets.js";
import { logActivity } from "./activity-log.js";

const TELEGRAM_PLUGIN_PACKAGE_NAME = "paperclip-plugin-telegram";
const TELEGRAM_MESSAGE_TEXT_LIMIT = 4096;

type TelegramPluginConfig = {
  telegramBotTokenRef: string | null;
  defaultChatId: string | null;
  approvalsChatId: string | null;
  errorsChatId: string | null;
  escalationChatId: string | null;
  paperclipPublicUrl: string | null;
};

type OperationalTelegramAlertResult =
  | { status: "sent"; chatId: string; messageId: number | null }
  | {
      status: "skipped";
      reason:
        | "issue_not_found"
        | "agent_not_found"
        | "telegram_plugin_not_ready"
        | "telegram_bot_token_ref_missing"
        | "telegram_chat_id_missing";
    };

export interface OperationalTelegramAlertDeps {
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

function buildIssueUrl(
  issue: { identifier: string | null; id: string },
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

function truncateLine(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function buildSilentNoopMessage(input: {
  issue: { identifier: string | null; id: string; title: string };
  company: { name: string; issuePrefix: string } | null;
  project: { name: string } | null;
  agent: { name: string; title: string | null };
  issueUrl: string | null;
}): string {
  const identifier = input.issue.identifier ?? input.issue.id;
  const agentLabel = input.agent.title
    ? `${input.agent.name} (${input.agent.title})`
    : input.agent.name;
  const parts = [
    `⚠️ Потрібна увага: ${identifier}`,
    input.company?.name ? `Компанія: ${input.company.name}` : null,
    input.project?.name ? `Проєкт: ${input.project.name}` : null,
    `Агент: ${agentLabel}`,
    `Задача: ${truncateLine(input.issue.title, 180)}`,
    "Що сталося: агент завершив запуск без помилки, але задача не отримала жодного результату або коментаря.",
    "Що зроблено: Paperclip позначив цей запуск як технічну помилку `silent_noop`, щоб задача не загубилась.",
    input.issueUrl ? `Відкрити задачу: ${input.issueUrl}` : null,
  ].filter(Boolean) as string[];
  const text = parts.join("\n");
  return text.length > TELEGRAM_MESSAGE_TEXT_LIMIT
    ? `${text.slice(0, TELEGRAM_MESSAGE_TEXT_LIMIT - 3).trimEnd()}...`
    : text;
}

async function sendTelegramMessage(params: {
  fetchImpl: typeof fetch;
  token: string;
  chatId: string;
  text: string;
  issueUrl?: string | null;
}): Promise<number | null> {
  const body: Record<string, unknown> = {
    chat_id: params.chatId,
    text: params.text,
    disable_web_page_preview: true,
  };
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

export function operationalTelegramAlertService(db: Db, deps?: OperationalTelegramAlertDeps) {
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

  async function sendSilentNoopAlert(input: {
    companyId: string;
    issueId: string;
    agentId: string;
    runId: string;
  }): Promise<OperationalTelegramAlertResult> {
    const issue = await db
      .select({
        id: issues.id,
        companyId: issues.companyId,
        projectId: issues.projectId,
        identifier: issues.identifier,
        title: issues.title,
      })
      .from(issues)
      .where(and(eq(issues.id, input.issueId), eq(issues.companyId, input.companyId)))
      .then((rows) => rows[0] ?? null);
    if (!issue) return { status: "skipped", reason: "issue_not_found" };

    const agent = await db
      .select({ id: agents.id, name: agents.name, title: agents.title })
      .from(agents)
      .where(and(eq(agents.id, input.agentId), eq(agents.companyId, input.companyId)))
      .then((rows) => rows[0] ?? null);
    if (!agent) return { status: "skipped", reason: "agent_not_found" };

    const config = await getReadyTelegramPluginConfig();
    if (!config) return { status: "skipped", reason: "telegram_plugin_not_ready" };
    if (!config.telegramBotTokenRef) return { status: "skipped", reason: "telegram_bot_token_ref_missing" };
    const chatId = config.errorsChatId ?? config.escalationChatId ?? config.defaultChatId;
    if (!chatId) return { status: "skipped", reason: "telegram_chat_id_missing" };

    const [token, company, project] = await Promise.all([
      resolveTelegramBotToken(issue.companyId, config.telegramBotTokenRef),
      db
        .select({ name: companies.name, issuePrefix: companies.issuePrefix })
        .from(companies)
        .where(eq(companies.id, issue.companyId))
        .then((rows) => rows[0] ?? null),
      issue.projectId
        ? db
            .select({ name: projects.name })
            .from(projects)
            .where(eq(projects.id, issue.projectId))
            .then((rows) => rows[0] ?? null)
        : Promise.resolve(null),
    ]);
    const issueUrl = buildIssueUrl(issue, config.paperclipPublicUrl, company);
    const messageId = await sendTelegramMessage({
      fetchImpl,
      token,
      chatId,
      text: buildSilentNoopMessage({ issue, company, project, agent, issueUrl }),
      issueUrl,
    });

    await logActivity(db, {
      companyId: issue.companyId,
      actorType: "system",
      actorId: "system:operational-telegram-alerts",
      agentId: agent.id,
      runId: input.runId,
      action: "operational.telegram_alert_sent",
      entityType: "issue",
      entityId: issue.id,
      details: {
        channel: "telegram",
        trigger: "silent_noop",
        chatId,
        messageId,
        identifier: issue.identifier,
      },
    });

    return { status: "sent", chatId, messageId };
  }

  return {
    sendSilentNoopAlert,
  };
}

