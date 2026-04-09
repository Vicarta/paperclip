const WAKE_TARGET_STATUSES = new Set(["todo", "in_progress", "in_review"]);
const WAKE_SOURCE_STATUSES = new Set(["backlog", "blocked", "done", "cancelled"]);

interface AssigneeStatusWakeParams {
  previousStatus: string;
  currentStatus: string;
}

export function shouldWakeAssigneeOnStatusChange(params: AssigneeStatusWakeParams) {
  if (params.previousStatus === params.currentStatus) return false;
  if (!WAKE_TARGET_STATUSES.has(params.currentStatus)) return false;
  return WAKE_SOURCE_STATUSES.has(params.previousStatus);
}
