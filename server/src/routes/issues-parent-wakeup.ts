const CHILD_RESULT_STATUSES = new Set(["done", "blocked", "cancelled"]);
const PARENT_NON_WAKE_STATUSES = new Set(["done", "cancelled", "backlog"]);

interface ParentWakeParams {
  previousStatus: string;
  currentStatus: string;
  parentId: string | null;
  parentAssigneeAgentId: string | null;
  parentStatus: string | null;
}

export function shouldWakeParentOnChildStatusChange(params: ParentWakeParams) {
  if (!params.parentId) return false;
  if (!params.parentAssigneeAgentId) return false;
  if (!params.parentStatus || PARENT_NON_WAKE_STATUSES.has(params.parentStatus)) return false;
  if (params.previousStatus === params.currentStatus) return false;
  return CHILD_RESULT_STATUSES.has(params.currentStatus);
}
