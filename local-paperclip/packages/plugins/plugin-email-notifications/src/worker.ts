import { createHash } from "node:crypto";
import {
  definePlugin,
  runWorker,
  type PluginContext,
  type ToolResult,
  type ToolRunContext,
} from "@paperclipai/plugin-sdk";
import {
  DEFAULT_CONFIG,
  EMAIL_COST_BILLING_TYPE,
  EMAIL_COST_PROVIDER,
  PLUGIN_ID,
  TOOL_NAMES,
} from "./constants.js";
import { buildDetailedReportEmail } from "./weekly-seo-report.js";

type EmailNotificationsConfig = typeof DEFAULT_CONFIG & Record<string, unknown>;

type DeliveryProof = {
  id: string;
  kind: string;
  dryRun: boolean;
  provider: "resend";
  from: string;
  recipients: string[];
  subject: string;
  idempotencyKey: string;
  sentAt: string | null;
  providerMessageId: string | null;
  companyId: string;
  projectId: string;
  agentId: string;
  runId: string;
  metadata: Record<string, unknown>;
};

type DeveloperHandoffPage = {
  url: string;
  currentProblem: string;
  requiredChanges: string[];
  verification: string[];
};

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function booleanValue(value: unknown) {
  return value === true;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function arrayOfStrings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

function reportItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string" && item.trim()) return [item.trim()];
    const record = objectValue(item);
    return [record.change, record.text, record.summary]
      .filter((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0)
      .slice(0, 1)
      .map((candidate) => candidate.trim());
  });
}

function splitEmails(value: unknown) {
  return stringValue(value)
    .split(/[,\n;]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function isReasonableEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32);
}

function truncate(value: string, max = 500) {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function normalizeEmailText(value: string) {
  const normalizedLineEndings = value.replace(/\r\n?/g, "\n");
  if (
    !normalizedLineEndings.includes("\\n\\n")
    && !normalizedLineEndings.includes("\\r\\n\\r\\n")
  ) return normalizedLineEndings;
  return normalizedLineEndings.replace(/\\r\\n|\\n/g, "\n");
}

function looksLikeEnglishSeoReport(value: string) {
  const normalized = value.toLowerCase();
  const markers = [
    "reporting week",
    "comparison week",
    "executive summary",
    "freshness note",
    "page-level appendix",
    "recommended experiments",
    "indexing evidence",
    "search visibility",
  ];
  return markers.filter((marker) => normalized.includes(marker)).length >= 2;
}

function assertWeeklySeoReportLanguage(input: { subject: string; text: string; html: string; language: string }) {
  if (!input.language.trim().toLowerCase().startsWith("uk")) return;
  const visibleText = `${input.subject}\n${input.text}\n${input.html}`;
  const cyrillicCount = (visibleText.match(/[А-Яа-яІіЇїЄєҐґ]/g) ?? []).length;
  if (cyrillicCount >= 40 && !looksLikeEnglishSeoReport(visibleText)) return;
  throw new Error("weekly SEO/GEO report must be written in Ukrainian before delivery");
}

async function getConfig(ctx: PluginContext) {
  const raw = await ctx.config.get() as Partial<EmailNotificationsConfig>;
  return { ...DEFAULT_CONFIG, ...raw };
}

function resolveRecipients(config: EmailNotificationsConfig, params: Record<string, unknown>) {
  const explicitRecipients = arrayOfStrings(params.recipientEmails).map((email) => email.toLowerCase());
  const defaultRecipients = splitEmails(config.defaultRecipientEmails);
  const allowlistedRecipients = new Set([
    ...splitEmails(config.allowlistedRecipientEmails),
    ...defaultRecipients,
  ]);
  const recipients = explicitRecipients.length ? explicitRecipients : defaultRecipients;

  if (!recipients.length) {
    throw new Error("recipientEmails or defaultRecipientEmails must contain at least one recipient");
  }
  const invalidRecipients = recipients.filter((recipient) => !isReasonableEmail(recipient));
  if (invalidRecipients.length) {
    throw new Error(`invalid recipient email(s): ${invalidRecipients.join(", ")}`);
  }
  const blockedRecipients = recipients.filter((recipient) => !allowlistedRecipients.has(recipient));
  if (blockedRecipients.length) {
    throw new Error(`recipient email(s) are not allowlisted: ${blockedRecipients.join(", ")}`);
  }

  return recipients;
}

function resolveIdempotencyKey(kind: string, recipients: string[], subject: string, text: string, params: Record<string, unknown>) {
  const explicit = stringValue(params.idempotencyKey);
  return explicit || `${kind}:${stableHash({ recipients, subject, text })}`;
}

function deliveryStateKey(idempotencyKey: string) {
  return `delivery:${stableHash(idempotencyKey)}`;
}

function toMarkdownList(items: string[]) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- none";
}

function buildChangeReport(params: Record<string, unknown>) {
  const summary = stringValue(params.summary);
  const changedItems = reportItems(params.changedItems).length
    ? reportItems(params.changedItems)
    : reportItems(params.changes);
  const backupPath = stringValue(params.backupPath) || reportItems(params.backups).join("; ");
  const verification = reportItems(params.verification).length
    ? reportItems(params.verification)
    : reportItems(params.verificationEvidence);
  const followUps = arrayOfStrings(params.followUps);
  const rollbackNote = stringValue(params.rollbackNote, "Restore from the listed backup or revert the documented change set.");
  const subject = stringValue(params.subject, "Astrogen Paperclip: change report");

  if (!summary) throw new Error("summary is required");
  if (!changedItems.length) throw new Error("changedItems must contain at least one item");
  if (!backupPath) throw new Error("backupPath is required");
  if (!verification.length) throw new Error("verification must contain at least one item");

  return {
    subject,
    text: [
      summary,
      "",
      "Changed:",
      toMarkdownList(changedItems),
      "",
      `Backup: ${backupPath}`,
      "",
      "Verification:",
      toMarkdownList(verification),
      "",
      "Follow-ups:",
      toMarkdownList(followUps),
      "",
      `Rollback: ${rollbackNote}`,
    ].join("\n"),
  };
}

function buildIncidentReport(params: Record<string, unknown>) {
  const severity = stringValue(params.severity);
  const status = stringValue(params.status);
  const summary = stringValue(params.summary);
  const impact = stringValue(params.impact, "Not specified.");
  const actionNeeded = stringValue(params.actionNeeded, "No immediate owner action requested.");
  const links = arrayOfStrings(params.links);
  const subject = stringValue(params.subject, `Astrogen Paperclip: ${severity} incident report`);

  if (!["info", "warning", "critical"].includes(severity)) {
    throw new Error("severity must be info, warning, or critical");
  }
  if (!status) throw new Error("status is required");
  if (!summary) throw new Error("summary is required");

  return {
    subject,
    text: [
      `Severity: ${severity}`,
      `Status: ${status}`,
      "",
      summary,
      "",
      `Impact: ${impact}`,
      "",
      `Action needed: ${actionNeeded}`,
      "",
      "Links:",
      toMarkdownList(links),
    ].join("\n"),
  };
}

function developerHandoffPages(value: unknown): DeveloperHandoffPage[] {
  if (!Array.isArray(value) || !value.length) {
    throw new Error("affectedPages must contain at least one page");
  }

  return value.map((item, index) => {
    const record = objectValue(item);
    const url = stringValue(record.url);
    const currentProblem = stringValue(record.currentProblem);
    const requiredChanges = arrayOfStrings(record.requiredChanges);
    const verification = arrayOfStrings(record.verification);

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error(`affectedPages[${index}].url must be a valid absolute URL`);
    }
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error(`affectedPages[${index}].url must use http or https`);
    }
    if (!currentProblem) {
      throw new Error(`affectedPages[${index}].currentProblem is required`);
    }
    if (!requiredChanges.length) {
      throw new Error(`affectedPages[${index}].requiredChanges must contain at least one item`);
    }
    if (!verification.length) {
      throw new Error(`affectedPages[${index}].verification must contain at least one item`);
    }

    return { url, currentProblem, requiredChanges, verification };
  });
}

function buildDeveloperHandoff(params: Record<string, unknown>) {
  const summary = stringValue(params.summary);
  const impact = stringValue(params.impact);
  const sharedActions = arrayOfStrings(params.sharedActions);
  const pages = developerHandoffPages(params.affectedPages);
  const sourceIssue = stringValue(params.sourceIssue);
  const sourceIssueUrl = stringValue(params.sourceIssueUrl);
  const subject = stringValue(params.subject, "Astrogen: технічне завдання для розробників");

  if (!summary) throw new Error("summary is required");
  if (!impact) throw new Error("impact is required");
  if (!sharedActions.length) throw new Error("sharedActions must contain at least one item");
  if (!sourceIssue) throw new Error("sourceIssue is required");

  const pageSections = pages.flatMap((page, index) => [
    `${index + 1}. ${page.url}`,
    `Поточна проблема: ${page.currentProblem}`,
    "Що виправити:",
    toMarkdownList(page.requiredChanges),
    "Як перевірити:",
    toMarkdownList(page.verification),
    "",
  ]);

  return {
    subject,
    text: [
      summary,
      "",
      `Вплив: ${impact}`,
      "",
      "Сторінки для виправлення:",
      ...pageSections,
      "Спільні технічні зміни:",
      toMarkdownList(sharedActions),
      "",
      `Джерело: ${sourceIssue}${sourceIssueUrl ? ` — ${sourceIssueUrl}` : ""}`,
    ].join("\n"),
  };
}

async function emitEmailCost(input: {
  ctx: PluginContext;
  runCtx: ToolRunContext;
  config: EmailNotificationsConfig;
  toolName: string;
}) {
  if (input.config.costAccountingMode !== "estimated_per_email") return;
  const amountUsd = numberValue(input.config.estimatedEmailCostUsd, DEFAULT_CONFIG.estimatedEmailCostUsd);
  if (amountUsd <= 0) return;

  await input.ctx.costs.createEvent({
    companyId: input.runCtx.companyId,
    agentId: input.runCtx.agentId,
    projectId: input.runCtx.projectId,
    issueId: null,
    goalId: null,
    heartbeatRunId: input.runCtx.runId,
    billingCode: `resend:${input.toolName}`,
    provider: EMAIL_COST_PROVIDER,
    biller: EMAIL_COST_PROVIDER,
    billingType: EMAIL_COST_BILLING_TYPE,
    model: "email",
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    costCents: Math.max(0, Math.floor(amountUsd * 100)),
    amountMicros: Math.max(0, Math.round(amountUsd * 1_000_000)),
    occurredAt: new Date().toISOString(),
  });
}

async function sendEmail(input: {
  ctx: PluginContext;
  runCtx: ToolRunContext;
  toolName: string;
  kind: string;
  params: Record<string, unknown>;
  subject: string;
  text: string;
  html?: string;
}): Promise<ToolResult> {
  const config = await getConfig(input.ctx);
  const from = stringValue(config.fromEmail);
  const secretRef = stringValue(config.resendApiKeySecretRef);
  const baseUrl = stringValue(config.resendApiBaseUrl, DEFAULT_CONFIG.resendApiBaseUrl).replace(/\/+$/, "");
  const subject = input.subject.trim();
  const text = normalizeEmailText(input.text).trim();
  const html = stringValue(input.html);
  const dryRun = booleanValue(input.params.dryRun);
  const metadata = objectValue(input.params.metadata);

  if (!from || !isReasonableEmail(from)) {
    throw new Error("fromEmail must be configured as a valid email address");
  }
  if (!secretRef) {
    throw new Error("resendApiKeySecretRef is required for email transport");
  }
  if (!subject) throw new Error("subject is required");
  if (!text) throw new Error("text is required");

  const recipients = resolveRecipients(config, input.params);
  const idempotencyKey = resolveIdempotencyKey(input.kind, recipients, subject, text, input.params);
  const stateKey = deliveryStateKey(idempotencyKey);
  const scope = {
    scopeKind: "company" as const,
    scopeId: input.runCtx.companyId,
    namespace: "deliveries",
    stateKey,
  };
  const existing = await input.ctx.state.get(scope) as DeliveryProof | null;
  if (existing && !dryRun) {
    return {
      content: `Email notification already delivered for idempotency key ${idempotencyKey}.`,
      data: { proof: existing, idempotentReplay: true },
    };
  }

  const proofBase = {
    id: `email_${stableHash({ input: idempotencyKey, companyId: input.runCtx.companyId })}`,
    kind: input.kind,
    provider: "resend" as const,
    from,
    recipients,
    subject,
    idempotencyKey,
    companyId: input.runCtx.companyId,
    projectId: input.runCtx.projectId,
    agentId: input.runCtx.agentId,
    runId: input.runCtx.runId,
    metadata,
  };

  if (dryRun) {
    const proof: DeliveryProof = {
      ...proofBase,
      dryRun: true,
      sentAt: null,
      providerMessageId: null,
    };
    return { content: "Email notification dry run passed.", data: { proof } };
  }

  const apiKey = await input.ctx.secrets.resolve(secretRef);
  const response = await input.ctx.http.fetch(`${baseUrl}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject,
      text,
      ...(html ? { html } : {}),
    }),
  });
  const responseText = await response.text();
  let responseJson: Record<string, unknown> = {};
  try {
    responseJson = responseText ? objectValue(JSON.parse(responseText)) : {};
  } catch {
    responseJson = {};
  }
  if (!response.ok) {
    throw new Error(`Resend email delivery failed with HTTP ${response.status}: ${truncate(responseText)}`);
  }

  const proof: DeliveryProof = {
    ...proofBase,
    dryRun: false,
    sentAt: new Date().toISOString(),
    providerMessageId: typeof responseJson.id === "string" ? responseJson.id : null,
  };
  await input.ctx.state.set(scope, proof);
  await input.ctx.activity.log({
    companyId: input.runCtx.companyId,
    message: "Email notification delivered",
    entityType: "plugin",
    entityId: PLUGIN_ID,
    metadata: {
      kind: input.kind,
      proofId: proof.id,
      provider: proof.provider,
      recipients: proof.recipients,
      subject: proof.subject,
      providerMessageId: proof.providerMessageId,
    },
  });
  await emitEmailCost({
    ctx: input.ctx,
    runCtx: input.runCtx,
    config,
    toolName: input.toolName,
  });

  return { content: "Email notification delivered.", data: { proof } };
}

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info(`${PLUGIN_ID} plugin setup complete`);

    ctx.tools.register(
      TOOL_NAMES.sendEmailNotification,
      {
        displayName: "Send Email Notification",
        description:
          "Send a concise email notification to explicit allowlisted recipients, or to configured default recipients when recipientEmails is omitted.",
        parametersSchema: {
          type: "object",
          properties: {
            recipientEmails: { type: "array", items: { type: "string" } },
            subject: { type: "string" },
            text: { type: "string" },
            html: { type: "string" },
            idempotencyKey: { type: "string" },
            dryRun: { type: "boolean" },
            metadata: { type: "object" },
          },
          required: ["subject", "text"],
        },
      },
      async (params, runCtx) => {
        const record = objectValue(params);
        return await sendEmail({
          ctx,
          runCtx,
          toolName: TOOL_NAMES.sendEmailNotification,
          kind: "notification",
          params: record,
          subject: stringValue(record.subject),
          text: stringValue(record.text),
          html: stringValue(record.html),
        });
      },
    );

    ctx.tools.register(
      TOOL_NAMES.sendChangeReport,
      {
        displayName: "Send Email Change Report",
        description:
          "Send a structured change report after Paperclip process, agent, plugin, or runtime changes. Canonical required fields: summary, changedItems (string[]), backupPath (string), verification (string[]). Include backup and verification evidence.",
        parametersSchema: {
          type: "object",
          properties: {
            recipientEmails: { type: "array", items: { type: "string" } },
            subject: { type: "string" },
            summary: { type: "string" },
            changedItems: { type: "array", items: { type: "string" } },
            backupPath: { type: "string" },
            verification: { type: "array", items: { type: "string" } },
            followUps: { type: "array", items: { type: "string" } },
            rollbackNote: { type: "string" },
            idempotencyKey: { type: "string" },
            dryRun: { type: "boolean" },
            metadata: { type: "object" },
          },
          required: ["summary", "changedItems", "backupPath", "verification"],
        },
      },
      async (params, runCtx) => {
        const record = objectValue(params);
        const report = buildChangeReport(record);
        return await sendEmail({
          ctx,
          runCtx,
          toolName: TOOL_NAMES.sendChangeReport,
          kind: "change_report",
          params: record,
          subject: report.subject,
          text: report.text,
        });
      },
    );

    ctx.tools.register(
      TOOL_NAMES.sendIncidentReport,
      {
        displayName: "Send Email Incident Report",
        description:
          "Send a structured incident or blocker report to explicit allowlisted recipients, or to configured default recipients.",
        parametersSchema: {
          type: "object",
          properties: {
            recipientEmails: { type: "array", items: { type: "string" } },
            subject: { type: "string" },
            severity: { type: "string", enum: ["info", "warning", "critical"] },
            status: { type: "string" },
            summary: { type: "string" },
            impact: { type: "string" },
            actionNeeded: { type: "string" },
            links: { type: "array", items: { type: "string" } },
            idempotencyKey: { type: "string" },
            dryRun: { type: "boolean" },
            metadata: { type: "object" },
          },
          required: ["severity", "status", "summary"],
        },
      },
      async (params, runCtx) => {
        const record = objectValue(params);
        const report = buildIncidentReport(record);
        return await sendEmail({
          ctx,
          runCtx,
          toolName: TOOL_NAMES.sendIncidentReport,
          kind: "incident_report",
          params: record,
          subject: report.subject,
          text: report.text,
        });
      },
    );

    ctx.tools.register(
      TOOL_NAMES.sendDeveloperHandoff,
      {
        displayName: "Send Developer Email Handoff",
        description:
          "Send an implementer-ready technical handoff. Every affected page must include its exact URL, current problem, required changes, and verification steps.",
        parametersSchema: {
          type: "object",
          properties: {
            recipientEmails: { type: "array", items: { type: "string" } },
            subject: { type: "string" },
            summary: { type: "string" },
            impact: { type: "string" },
            affectedPages: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                properties: {
                  url: { type: "string" },
                  currentProblem: { type: "string" },
                  requiredChanges: { type: "array", items: { type: "string" }, minItems: 1 },
                  verification: { type: "array", items: { type: "string" }, minItems: 1 },
                },
                required: ["url", "currentProblem", "requiredChanges", "verification"],
              },
            },
            sharedActions: { type: "array", items: { type: "string" }, minItems: 1 },
            sourceIssue: { type: "string" },
            sourceIssueUrl: { type: "string" },
            idempotencyKey: { type: "string" },
            dryRun: { type: "boolean" },
            metadata: { type: "object" },
          },
          required: ["summary", "impact", "affectedPages", "sharedActions", "sourceIssue"],
        },
      },
      async (params, runCtx) => {
        const record = objectValue(params);
        const report = buildDeveloperHandoff(record);
        return await sendEmail({
          ctx,
          runCtx,
          toolName: TOOL_NAMES.sendDeveloperHandoff,
          kind: "developer_handoff",
          params: record,
          subject: report.subject,
          text: report.text,
        });
      },
    );

    ctx.tools.register(
      TOOL_NAMES.sendWeeklySeoReport,
      {
        displayName: "Send Weekly SEO/GEO Report",
        description:
          "Render and send a simple Ukrainian owner-facing weekly SEO/GEO report as safe HTML with a plain-text fallback.",
        parametersSchema: {
          type: "object",
          properties: {
            recipientEmails: { type: "array", items: { type: "string" } },
            subject: { type: "string" },
            report: { type: "object" },
            idempotencyKey: { type: "string" },
            dryRun: { type: "boolean" },
            metadata: { type: "object" },
          },
          required: ["subject", "report"],
        },
      },
      async (params, runCtx) => {
        const record = objectValue(params);
        const subject = stringValue(record.subject);
        const body = buildDetailedReportEmail(record);
        const config = await getConfig(ctx);
        assertWeeklySeoReportLanguage({
          subject,
          text: body.text,
          html: body.html,
          language: stringValue(config.defaultLanguage, DEFAULT_CONFIG.defaultLanguage),
        });
        return await sendEmail({
          ctx,
          runCtx,
          toolName: TOOL_NAMES.sendWeeklySeoReport,
          kind: "weekly_seo_report",
          params: record,
          subject,
          text: body.text,
          html: body.html,
        });
      },
    );

    ctx.data.register("health", async () => {
      const config = await getConfig(ctx);
      const defaultRecipients = splitEmails(config.defaultRecipientEmails);
      const allowlistedRecipients = splitEmails(config.allowlistedRecipientEmails);
      return {
        status: "ok",
        provider: "resend",
        fromConfigured: Boolean(stringValue(config.fromEmail)),
        secretRefConfigured: Boolean(stringValue(config.resendApiKeySecretRef)),
        defaultRecipientCount: defaultRecipients.length,
        allowlistedRecipientCount: new Set([...defaultRecipients, ...allowlistedRecipients]).size,
        costAccountingMode: config.costAccountingMode,
        checkedAt: new Date().toISOString(),
      };
    });
  },

  async onHealth() {
    return { status: "ok", message: `${PLUGIN_ID} ready` };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
