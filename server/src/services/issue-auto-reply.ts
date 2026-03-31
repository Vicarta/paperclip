import type { ProjectHumanFacingLanguage } from "@paperclipai/shared";
import type { AdapterExecutionResult } from "../adapters/index.js";
import { summarizeHeartbeatRunResultJson } from "./heartbeat-run-summary.js";

export type IssueAutoReplyStatus = "succeeded" | "failed" | "timed_out" | "cancelled";

const COMMENT_TRIGGER_SOURCES = new Set(["issue.comment", "comment.mention", "issue.comment.reopen"]);
const TECHNICAL_LINE_PATTERNS = [
  /^\[paperclip]/i,
  /^The above agent instructions were loaded from /i,
  /^Resolve any relative file references from /i,
  /^Loaded agent instructions from /i,
  /^Prepended instructions/i,
  /^Configured instructionsFilePath /i,
  /^Prompt is passed to /i,
  /^session id[:=]/i,
  /^session reused[:=]/i,
  /^tokens?[:=]/i,
  /^cost(?:Usd| USD)?[:=]/i,
  /^stderr[:=]/i,
  /^stdout[:=]/i,
  /^command[:=]/i,
  /^status[:=]\s*(completed|failed|cancelled)$/i,
  /^exit(?:_code| code)?[:=]/i,
  /^Triggered comment[:=]/i,
  /^Wake context handled[:=]/i,
  /^Logged the run in /i,
  /^Confirmed inbox is empty\b/i,
];

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

export function shouldPostIssueAutoReply(contextSnapshot: Record<string, unknown> | null | undefined) {
  if (!contextSnapshot || typeof contextSnapshot !== "object" || Array.isArray(contextSnapshot)) return false;
  const issueId = readNonEmptyString(contextSnapshot.issueId);
  const commentId = readNonEmptyString(contextSnapshot.commentId);
  const source = readNonEmptyString(contextSnapshot.source);
  return Boolean(issueId && commentId && source && COMMENT_TRIGGER_SOURCES.has(source));
}

export function sanitizeIssueAutoReplyText(value: string | null | undefined, opts?: { maxLength?: number }) {
  const raw = readNonEmptyString(value);
  if (!raw) return null;

  const cleanedLines = normalizeWhitespace(raw)
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .filter((line) => !TECHNICAL_LINE_PATTERNS.some((pattern) => pattern.test(line.trim())))
    .filter((line) => !/^\/[A-Za-z0-9._/-]+$/.test(line.trim()))
    .filter((line) => !/^(thread|run|workspace|worktree)\s*[:=]/i.test(line.trim()));

  if (cleanedLines.length === 0) return null;

  const collapsed: string[] = [];
  let previousBlank = false;
  for (const line of cleanedLines) {
    const trimmed = line.trim();
    const currentBlank = trimmed.length === 0;
    if (currentBlank && previousBlank) continue;
    collapsed.push(line);
    previousBlank = currentBlank;
  }

  const text = collapsed.join("\n").trim();
  if (!text) return null;
  const maxLength = Math.max(120, opts?.maxLength ?? 1200);
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text;
}

function buildQuestionReply(question: NonNullable<AdapterExecutionResult["question"]>) {
  const prompt = sanitizeIssueAutoReplyText(question.prompt, { maxLength: 800 });
  const choices = question.choices
    .map((choice) => {
      const label = sanitizeIssueAutoReplyText(choice.label, { maxLength: 120 });
      const description = sanitizeIssueAutoReplyText(choice.description ?? null, { maxLength: 200 });
      if (!label) return null;
      return description ? `- **${label}**: ${description}` : `- **${label}**`;
    })
    .filter((line): line is string => Boolean(line));

  if (!prompt && choices.length === 0) return null;
  return [prompt, choices.length > 0 ? choices.join("\n") : null].filter(Boolean).join("\n\n");
}

function readSuccessSummary(input: {
  summary?: string | null;
  resultJson?: Record<string, unknown> | null;
}) {
  const fromSummary = sanitizeIssueAutoReplyText(input.summary, { maxLength: 1200 });
  if (fromSummary) return fromSummary;

  const summarized = summarizeHeartbeatRunResultJson(input.resultJson);
  return (
    sanitizeIssueAutoReplyText(readNonEmptyString(summarized?.summary), { maxLength: 1200 }) ??
    sanitizeIssueAutoReplyText(readNonEmptyString(summarized?.result), { maxLength: 1200 }) ??
    sanitizeIssueAutoReplyText(readNonEmptyString(summarized?.message), { maxLength: 1200 })
  );
}

function readFailureReason(input: {
  errorMessage?: string | null;
  resultJson?: Record<string, unknown> | null;
}) {
  const fromError = sanitizeIssueAutoReplyText(input.errorMessage, { maxLength: 800 });
  if (fromError) return fromError;

  const summarized = summarizeHeartbeatRunResultJson(input.resultJson);
  return (
    sanitizeIssueAutoReplyText(readNonEmptyString(summarized?.error), { maxLength: 800 }) ??
    sanitizeIssueAutoReplyText(readNonEmptyString(summarized?.message), { maxLength: 800 }) ??
    sanitizeIssueAutoReplyText(readNonEmptyString(summarized?.result), { maxLength: 800 })
  );
}

export function buildIssueAutoReplyComment(input: {
  status: IssueAutoReplyStatus;
  summary?: string | null;
  resultJson?: Record<string, unknown> | null;
  errorMessage?: string | null;
  question?: AdapterExecutionResult["question"] | null;
  humanFacingLanguage?: ProjectHumanFacingLanguage | null;
}) {
  if (input.question) {
    return buildQuestionReply(input.question);
  }

  if (input.status === "cancelled") {
    return null;
  }

  if (input.status === "succeeded") {
    return readSuccessSummary(input);
  }

  const reason = readFailureReason(input);
  if (input.status === "timed_out") {
    const timeoutPrefix =
      input.humanFacingLanguage === "uk"
        ? "Я не зміг завершити це в межах відведеного часу."
        : "I couldn't finish this within the allotted time.";
    return reason
      ? `${timeoutPrefix}\n\n${reason}`
      : timeoutPrefix;
  }

  const failurePrefix =
    input.humanFacingLanguage === "uk"
      ? "Я не зміг виконати цей запит."
      : "I couldn't complete this request.";
  return reason
    ? `${failurePrefix}\n\n${reason}`
    : failurePrefix;
}
