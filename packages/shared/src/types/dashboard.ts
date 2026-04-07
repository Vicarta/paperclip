export interface DashboardSummary {
  companyId: string;
  agents: {
    active: number;
    running: number;
    paused: number;
    error: number;
  };
  tasks: {
    open: number;
    inProgress: number;
    blocked: number;
    done: number;
  };
  costs: {
    monthSpendUsd: number;
    monthBudgetUsd: number;
    monthUtilizationPercent: number;
  };
  pendingApprovals: number;
}
