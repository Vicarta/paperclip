import type { ProjectHumanFacingLanguage } from "@paperclipai/shared";
import type { AdapterExecutionResult } from "../adapters/index.js";
import { summarizeHeartbeatRunResultJson } from "./heartbeat-run-summary.js";

export type IssueSummaryFallbackStatus = "succeeded" | "failed" | "timed_out" | "cancelled";

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

const SYSTEM_COMMENT_PREFIXES = [
  "## Workspace Ready",
];

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

export function shouldPostIssueSummaryFallback(contextSnapshot: Record<string, unknown> | null | undefined) {
  if (!contextSnapshot || typeof contextSnapshot !== "object" || Array.isArray(contextSnapshot)) return false;
  return Boolean(readNonEmptyString(contextSnapshot.issueId));
}

export function sanitizeIssueSummaryText(value: string | null | undefined, opts?: { maxLength?: number }) {
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

  const text = cleanedLines.join("\n").trim();
  if (!text) return null;
  const maxLength = Math.max(120, opts?.maxLength ?? 1200);
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text;
}

export function isSystemIssueComment(body: string | null | undefined) {
  const normalized = readNonEmptyString(body);
  if (!normalized) return true;
  return SYSTEM_COMMENT_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function buildQuestionReply(question: NonNullable<AdapterExecutionResult["question"]>) {
  const prompt = sanitizeIssueSummaryText(question.prompt, { maxLength: 800 });
  const choices = question.choices
    .map((choice) => {
      const label = sanitizeIssueSummaryText(choice.label, { maxLength: 120 });
      const description = sanitizeIssueSummaryText(choice.description ?? null, { maxLength: 200 });
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
  const fromSummary = sanitizeIssueSummaryText(input.summary, { maxLength: 1200 });
  if (fromSummary) return fromSummary;

  const summarized = summarizeHeartbeatRunResultJson(input.resultJson);
  return (
    sanitizeIssueSummaryText(readNonEmptyString(summarized?.summary), { maxLength: 1200 }) ??
    sanitizeIssueSummaryText(readNonEmptyString(summarized?.result), { maxLength: 1200 }) ??
    sanitizeIssueSummaryText(readNonEmptyString(summarized?.message), { maxLength: 1200 })
  );
}

function readFailureReason(input: {
  errorMessage?: string | null;
  resultJson?: Record<string, unknown> | null;
}) {
  const fromError = sanitizeIssueSummaryText(input.errorMessage, { maxLength: 800 });
  if (fromError) return fromError;

  const summarized = summarizeHeartbeatRunResultJson(input.resultJson);
  return (
    sanitizeIssueSummaryText(readNonEmptyString(summarized?.error), { maxLength: 800 }) ??
    sanitizeIssueSummaryText(readNonEmptyString(summarized?.message), { maxLength: 800 }) ??
    sanitizeIssueSummaryText(readNonEmptyString(summarized?.result), { maxLength: 800 })
  );
}

export function buildIssueSummaryFallbackComment(input: {
  status: IssueSummaryFallbackStatus;
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
