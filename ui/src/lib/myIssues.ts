import type { Issue, IssueLabel } from "@paperclipai/shared";

export const MY_ISSUE_ACTIVE_STATUSES = "backlog,todo,in_progress,in_review,blocked";
export const HUMAN_DECISION_NEEDED_LABEL_NAME = "Human Decision Needed";

function priorityRank(priority: string | null | undefined) {
  switch (priority) {
    case "critical":
      return 0;
    case "high":
      return 1;
    case "medium":
      return 2;
    case "low":
      return 3;
    default:
      return 4;
  }
}

function issueTimestamp(value: Date | string | null | undefined) {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function findHumanDecisionNeededLabelId(
  labels: Array<Pick<IssueLabel, "id" | "name">> | null | undefined,
) {
  return labels?.find((label) => label.name === HUMAN_DECISION_NEEDED_LABEL_NAME)?.id ?? null;
}

export function mergeMyIssues(assignedIssues: Issue[], humanDecisionIssues: Issue[]) {
  const deduped = new Map<string, Issue>();
  for (const issue of [...assignedIssues, ...humanDecisionIssues]) {
    deduped.set(issue.id, issue);
  }

  return [...deduped.values()].sort((left, right) => {
    const priorityDelta = priorityRank(left.priority) - priorityRank(right.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return issueTimestamp(right.updatedAt) - issueTimestamp(left.updatedAt);
  });
}
