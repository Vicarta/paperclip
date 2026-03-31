import type { ProjectHumanFacingLanguage } from "@paperclipai/shared";
import type { AdapterExecutionResult } from "../adapters/index.js";
import {
  buildIssueSummaryFallbackComment,
  sanitizeIssueSummaryText,
} from "./issue-summary-fallback.js";

export type IssueAutoReplyStatus = "succeeded" | "failed" | "timed_out" | "cancelled";

const COMMENT_TRIGGER_SOURCES = new Set([
  "issue.comment",
  "comment.mention",
  "issue.comment.reopen",
]);

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function shouldPostIssueAutoReply(
  contextSnapshot: Record<string, unknown> | null | undefined,
) {
  if (!contextSnapshot || typeof contextSnapshot !== "object" || Array.isArray(contextSnapshot)) {
    return false;
  }
  const issueId = readNonEmptyString(contextSnapshot.issueId);
  const commentId = readNonEmptyString(contextSnapshot.commentId);
  const source = readNonEmptyString(contextSnapshot.source);
  return Boolean(issueId && commentId && source && COMMENT_TRIGGER_SOURCES.has(source));
}

export function sanitizeIssueAutoReplyText(
  value: string | null | undefined,
  opts?: { maxLength?: number },
) {
  return sanitizeIssueSummaryText(value, opts);
}

export function buildIssueAutoReplyComment(input: {
  status: IssueAutoReplyStatus;
  summary?: string | null;
  resultJson?: Record<string, unknown> | null;
  errorMessage?: string | null;
  question?: AdapterExecutionResult["question"] | null;
  humanFacingLanguage?: ProjectHumanFacingLanguage | null;
}) {
  return buildIssueSummaryFallbackComment(input);
}
