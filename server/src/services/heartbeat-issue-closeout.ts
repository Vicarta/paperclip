const TERMINAL_ISSUE_STATUSES = new Set(["done", "cancelled"]);

export type IssueCloseoutProtocolState = {
  issueId: string | null;
  issueStatus: string | null;
  assigneeAgentId: string | null;
  runAgentId: string;
  lifecycleMutationCount: number;
};

export type IssueCloseoutProtocolViolation = {
  errorCode: "missing_issue_closeout";
  message: string;
};

export function resolveIssueCloseoutProtocolViolation(
  input: IssueCloseoutProtocolState,
): IssueCloseoutProtocolViolation | null {
  if (!input.issueId) return null;
  if (input.lifecycleMutationCount > 0) return null;
  if (!input.assigneeAgentId || input.assigneeAgentId !== input.runAgentId) return null;
  if (input.issueStatus && TERMINAL_ISSUE_STATUSES.has(input.issueStatus)) return null;

  return {
    errorCode: "missing_issue_closeout",
    message: "Run completed without a final issue lifecycle mutation.",
  };
}
