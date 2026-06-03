import type { PluginEvent } from "@paperclipai/plugin-sdk";
import { escapeMarkdownV2, truncateAtWord } from "./telegram-api.js";
import type { SendMessageOptions } from "./telegram-api.js";
import { containsPayloadDraftReadyEvidence, sanitizeIssueDoneComment } from "./notification-policy.js";

type Payload = Record<string, unknown>;

type FormattedMessage = {
  text: string;
  options: SendMessageOptions;
};

function esc(s: string): string {
  return escapeMarkdownV2(s);
}

function bold(s: string): string {
  return `*${esc(s)}*`;
}

function code(s: string): string {
  return `\`${esc(s)}\``;
}

export type IssueLinksOpts = { baseUrl?: string; issuePrefix?: string };

function isExternalUrl(url?: string): boolean {
  return !!url && url.startsWith("https://");
}

function issueLink(identifier: string, opts?: IssueLinksOpts): string {
  if (opts?.baseUrl && opts?.issuePrefix) {
    const url = `${opts.baseUrl}/${opts.issuePrefix}/issues/${identifier}`;
    return `[${esc(identifier)}](${url})`;
  }
  return bold(identifier);
}

function issueButton(identifier: string, opts?: IssueLinksOpts): { text: string; url: string } | null {
  if (opts?.baseUrl && opts?.issuePrefix && isExternalUrl(opts.baseUrl)) {
    return { text: "Відкрити задачу", url: `${opts.baseUrl}/${opts.issuePrefix}/issues/${identifier}` };
  }
  return null;
}

function extractPayloadDraftUrl(comment: string | null): string | null {
  if (!comment) return null;
  const match = comment.match(/https:\/\/cms\.astrogen\.com\.ua\/admin\/collections\/blogPosts\/[A-Za-z0-9_-]+/);
  return match?.[0] ?? null;
}

function isPayloadDraftReadyComment(comment: string | null): boolean {
  return containsPayloadDraftReadyEvidence(comment);
}

function extractFirstUrl(text: string | null): string | null {
  if (!text) return null;
  const match = text.match(/https:\/\/[^\s)<]+/);
  return match?.[0]?.replace(/[.,;:]+$/, "") ?? null;
}

function hasSeoCmsFixEvidence(title: string, comment: string | null): boolean {
  const haystack = `${title}\n${comment ?? ""}`;
  return /published blog noindex|noindex|canonical|sitemap/i.test(haystack)
    && /live after|after live html|no robots noindex|canonical|sitemap/i.test(haystack)
    && /https:\/\/astrogen\.com\.ua\/blog\//i.test(haystack);
}

function formatSeoCmsFixDone(
  identifier: string,
  companyName: string | null,
  title: string,
  comment: string | null,
  opts?: IssueLinksOpts,
): FormattedMessage {
  const url = extractFirstUrl(comment) ?? extractFirstUrl(title);
  const fixedNoindex = /noindex/i.test(`${title}\n${comment ?? ""}`);
  const fixedCanonical = /canonical/i.test(`${title}\n${comment ?? ""}`);
  const fixedSitemap = /sitemap/i.test(`${title}\n${comment ?? ""}`);

  const fixed: string[] = [];
  if (fixedNoindex) fixed.push("прибрано заборону індексації");
  if (fixedCanonical) fixed.push("вирівняно canonical");
  if (fixedSitemap) fixed.push("сторінку повернуто в sitemap");

  const lines: string[] = [`${esc("✅")} ${bold("Виправлено індексацію статті")}`];
  if (companyName) lines.push(`${bold("Компанія")}: ${esc(companyName)}`);
  if (url) lines.push(`${bold("Сторінка")}: ${esc(url)}`);
  lines.push("");
  lines.push(`${bold("Що було")}: ${esc("стаття була опублікована, але Google не міг нормально взяти її в індекс через технічні SEO-налаштування сторінки.")}`);
  lines.push(`${bold("Що зроблено")}: ${esc(fixed.length > 0 ? fixed.join(", ") + "." : "виправлено технічні SEO-налаштування сторінки.")}`);
  lines.push(`${bold("Що це означає")}: ${esc("сторінка тепер відкрита для індексації. Search Console може показати старий статус ще деякий час, доки Google повторно не перевірить URL.")}`);

  const button = issueButton(identifier, opts);
  return {
    text: lines.join("\n"),
    options: {
      parseMode: "MarkdownV2",
      disableWebPagePreview: true,
      ...(button ? { inlineKeyboard: [[button]] } : {}),
    },
  };
}

function agentButton(agentId: string, label: string, publicUrl?: string): { text: string; url: string } | null {
  if (publicUrl && isExternalUrl(publicUrl)) {
    return { text: label, url: `${publicUrl}/agents/${agentId}` };
  }
  return null;
}

function runButton(agentId: string, runId: string | null, publicUrl?: string): { text: string; url: string } | null {
  if (publicUrl && isExternalUrl(publicUrl) && runId) {
    return { text: "View Run ↗", url: `${publicUrl}/agents/${agentId}/runs/${runId}` };
  }
  return null;
}

function classifyAgentError(errorMessage: string): string {
  if (/timed?\s*out|timeout/i.test(errorMessage)) return "Agent Timeout";
  if (/limit|rate.?limit|quota/i.test(errorMessage)) return "Agent Rate Limit";
  return "Agent Error";
}

export function formatIssueCreated(event: PluginEvent, opts?: IssueLinksOpts): FormattedMessage {
  const p = event.payload as Payload;
  const identifier = String(p.identifier ?? event.entityId);
  const title = String(p.title ?? "Untitled");
  const status = p.status ? String(p.status) : null;
  const priority = p.priority ? String(p.priority) : null;
  const assigneeName = p.assigneeName ? String(p.assigneeName) : null;
  const projectName = p.projectName ? String(p.projectName) : null;

  const lines: string[] = [
    `${esc("📋")} ${bold("Issue Created")}: ${issueLink(identifier, opts)}`,
    bold(title),
  ];

  const meta: string[] = [];
  if (status) meta.push(`Status: ${code(status)}`);
  if (priority) meta.push(`Priority: ${code(priority)}`);
  if (assigneeName) meta.push(`Assignee: ${esc(assigneeName)}`);
  if (projectName) meta.push(`Project: ${esc(projectName)}`);
  if (meta.length > 0) lines.push(meta.join(" \\| "));

  if (p.description) {
    const desc = truncateAtWord(String(p.description), 200);
    lines.push(`\n${esc(">")} ${esc(desc)}`);
  }

  const button = issueButton(identifier, opts);
  return {
    text: lines.join("\n"),
    options: {
      parseMode: "MarkdownV2",
      ...(button ? { inlineKeyboard: [[button]] } : {}),
    },
  };
}

export function formatIssueAssigned(event: PluginEvent, opts?: IssueLinksOpts): FormattedMessage {
  const p = event.payload as Payload;
  const prev = (p._previous as Payload | undefined) ?? {};
  const identifier = String(p.identifier ?? event.entityId);
  const title = String(p.title ?? "Untitled");
  const assigneeName = p.assigneeName ? String(p.assigneeName) : null;
  const prevAssigneeName = prev.assigneeName ? String(prev.assigneeName) : null;

  const lines: string[] = [
    `${esc("🎯")} ${bold("Issue Assigned")}: ${issueLink(identifier, opts)}`,
    bold(title),
  ];

  if (assigneeName) {
    lines.push(
      prevAssigneeName
        ? `Assignee: ${esc(prevAssigneeName)} ${esc("→")} ${esc(assigneeName)}`
        : `Assignee: ${esc(assigneeName)}`,
    );
  } else {
    lines.push(esc("Unassigned"));
  }

  const button = issueButton(identifier, opts);
  return {
    text: lines.join("\n"),
    options: {
      parseMode: "MarkdownV2",
      ...(button ? { inlineKeyboard: [[button]] } : {}),
    },
  };
}

export function formatIssueDone(event: PluginEvent, opts?: IssueLinksOpts): FormattedMessage {
  const p = event.payload as Payload;
  const identifier = String(p.identifier ?? event.entityId);
  const title = String(p.title ?? "");
  const comment = p.comment ? String(p.comment) : null;
  const companyName = p.companyName ? String(p.companyName) : null;
  const draftUrl = extractPayloadDraftUrl(comment);

  if (hasSeoCmsFixEvidence(title, comment)) {
    return formatSeoCmsFixDone(identifier, companyName, title, comment, opts);
  }

  if (draftUrl && isPayloadDraftReadyComment(comment)) {
    const lines: string[] = [`${esc("✅")} ${bold("Чернетка готова")}`];
    if (companyName) lines.push(`${bold("Компанія")}: ${esc(companyName)}`);
    if (title) lines.push(`${bold("Стаття")}: ${esc(title)}`);
    lines.push(esc("Статтю створено в CMS як чернетку. Cover-зображення додано."));
    lines.push(`${bold("Чернетка")}: ${esc(draftUrl)}`);

    const buttons = [{ text: "Відкрити чернетку", url: draftUrl }];
    const issue = issueButton(identifier, opts);
    return {
      text: lines.join("\n"),
      options: {
        parseMode: "MarkdownV2",
        inlineKeyboard: issue ? [buttons, [issue]] : [buttons],
      },
    };
  }

  const lines: string[] = [`${esc("✅")} ${bold("Готово")}: ${issueLink(identifier, opts)}`];
  if (companyName) lines.push(`${bold("Компанія")}: ${esc(companyName)}`);
  if (title) lines.push(`${bold("Задача")}: ${esc(title)}`);

  const safeComment = sanitizeIssueDoneComment(comment);
  if (safeComment) {
    const truncated = truncateAtWord(safeComment, 125);
    lines.push(`${bold("Що зроблено")}: ${esc(truncated)}`);
  }

  const button = issueButton(identifier, opts);
  return {
    text: lines.join("\n"),
    options: {
      parseMode: "MarkdownV2",
      ...(button ? { inlineKeyboard: [[button]] } : {}),
    },
  };
}

export function formatApprovalCreated(event: PluginEvent, opts?: IssueLinksOpts): FormattedMessage {
  const p = event.payload as Payload;
  const approvalType = String(p.type ?? "unknown");
  const approvalId = String(p.approvalId ?? event.entityId);
  const title = String(p.title ?? "Approval Requested");
  const description = p.description ? String(p.description) : null;
  const agentName = p.agentName ? String(p.agentName) : null;

  const lines: string[] = [
    `${esc("🔔")} ${bold("Approval Requested")}`,
    bold(title),
  ];

  if (agentName) lines.push(`Agent: ${esc(agentName)} \\| Type: ${code(approvalType)}`);
  if (description) lines.push(`\n${esc(truncateAtWord(description, 300))}`);

  // Add linked issues if present
  const linkedIssues = Array.isArray(p.linkedIssues) ? p.linkedIssues as Array<Payload> : [];
  if (linkedIssues.length > 0) {
    lines.push(`\n${bold(`Linked Issues (${String(linkedIssues.length)})`)}`);
    for (const issue of linkedIssues.slice(0, 5)) {
      const issueId = String(issue.identifier ?? "?");
      const issueParts = [`${issueLink(issueId, opts)} ${esc(String(issue.title ?? ""))}`];
      const issueMeta: string[] = [];
      if (issue.status) issueMeta.push(String(issue.status));
      if (issue.priority) issueMeta.push(String(issue.priority));
      if (issue.assignee) issueMeta.push(`-> ${String(issue.assignee)}`);
      if (issueMeta.length > 0) issueParts.push(`\\(${esc(issueMeta.join(" | "))}\\)`);
      lines.push(issueParts.join(" "));
    }
  }

  const keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [
    [
      { text: "Approve", callback_data: `approve_${approvalId}` },
      { text: "Reject", callback_data: `reject_${approvalId}` },
    ],
  ];

  // Add deep link to the first linked issue if available
  if (linkedIssues.length > 0) {
    const firstIssueId = String(linkedIssues[0]!.identifier ?? "");
    if (firstIssueId) {
      const btn = issueButton(firstIssueId, opts);
      if (btn) keyboard.push([btn]);
    }
  }

  return {
    text: lines.join("\n"),
    options: {
      parseMode: "MarkdownV2",
      inlineKeyboard: keyboard,
    },
  };
}

export function formatAgentError(event: PluginEvent, opts?: IssueLinksOpts): FormattedMessage {
  const p = event.payload as Payload;
  const agentId = String(p.agentId ?? event.entityId);
  const agentName = String(p.agentName ?? p.name ?? agentId);
  const errorMessage = String(p.error ?? p.message ?? "Unknown error");
  const runId = p.runId ? String(p.runId) : null;
  const companyName = p.companyName ? String(p.companyName) : null;
  const issueIdentifier = p.issueIdentifier ? String(p.issueIdentifier) : null;
  const issueTitle = p.issueTitle ? String(p.issueTitle) : null;

  const lines: string[] = [
    `${esc("❌")} ${bold(classifyAgentError(errorMessage))}`,
    `Agent: ${bold(agentName)}`,
  ];
  if (companyName) lines.push(`Company: ${esc(companyName)}`);
  if (issueIdentifier) {
    lines.push(
      issueTitle
        ? `Issue: ${issueLink(issueIdentifier, opts)} ${esc("—")} ${esc(issueTitle)}`
        : `Issue: ${issueLink(issueIdentifier, opts)}`,
    );
  }
  lines.push(`\n${code(truncateAtWord(errorMessage, 500))}`);

  const buttons = [
    runButton(agentId, runId, opts?.baseUrl),
    issueIdentifier ? issueButton(issueIdentifier, opts) : null,
    agentButton(agentId, "View Agent ↗", opts?.baseUrl),
  ].filter((button): button is { text: string; url: string } => Boolean(button));

  return {
    text: lines.join("\n"),
    options: {
      parseMode: "MarkdownV2",
      ...(buttons.length > 0 ? { inlineKeyboard: [buttons] } : {}),
    },
  };
}

export function formatAgentRunStarted(event: PluginEvent, opts?: IssueLinksOpts): FormattedMessage {
  const p = event.payload as Payload;
  const agentId = String(p.agentId ?? event.entityId);
  const agentName = String(p.agentName ?? agentId);
  const runId = p.runId ? String(p.runId) : null;

  const buttons: Array<{ text: string; url: string }> = [];
  if (opts?.baseUrl && isExternalUrl(opts.baseUrl)) {
    const url = runId
      ? `${opts.baseUrl}/agents/${agentId}/runs/${runId}`
      : `${opts.baseUrl}/agents/${agentId}`;
    buttons.push({ text: "View Run ↗", url });
  }

  return {
    text: `${esc("▶️")} ${bold(agentName)} ${esc("started a new run")}`,
    options: {
      parseMode: "MarkdownV2",
      disableNotification: true,
      ...(buttons.length > 0 ? { inlineKeyboard: [buttons] } : {}),
    },
  };
}

export function formatAgentRunFinished(event: PluginEvent, opts?: IssueLinksOpts): FormattedMessage {
  const p = event.payload as Payload;
  const agentId = String(p.agentId ?? event.entityId);
  const agentName = String(p.agentName ?? agentId);
  const runId = p.runId ? String(p.runId) : null;

  const buttons: Array<{ text: string; url: string }> = [];
  if (opts?.baseUrl && isExternalUrl(opts.baseUrl)) {
    const url = runId
      ? `${opts.baseUrl}/agents/${agentId}/runs/${runId}`
      : `${opts.baseUrl}/agents/${agentId}`;
    buttons.push({ text: "View Run ↗", url });
  }

  return {
    text: `${esc("⏹️")} ${bold(agentName)} ${esc("completed successfully")}`,
    options: {
      parseMode: "MarkdownV2",
      disableNotification: true,
      ...(buttons.length > 0 ? { inlineKeyboard: [buttons] } : {}),
    },
  };
}
