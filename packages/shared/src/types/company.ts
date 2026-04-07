import type { CompanyStatus } from "../constants.js";

export interface Company {
  id: string;
  name: string;
  description: string | null;
  status: CompanyStatus;
  issuePrefix: string;
  issueCounter: number;
  budgetMonthlyUsd: number;
  spentMonthlyUsd: number;
  requireBoardApprovalForNewAgents: boolean;
  brandColor: string | null;
  createdAt: Date;
  updatedAt: Date;
}
