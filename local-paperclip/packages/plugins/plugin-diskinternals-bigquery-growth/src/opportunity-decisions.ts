import { randomUUID } from "node:crypto";
import type { ActionType } from "./constants.js";
import { assertActionType } from "./scoring.js";

export type OpportunityDecisionInput = {
  opportunity_id?: string;
  action_type?: string;
  owner_lane?: string;
  decision_status?: string;
  reason?: string;
  confidence?: number;
  source_opportunity_ids?: string[];
  parent_issue_id?: string;
};

export function normalizeOpportunityDecision(input: OpportunityDecisionInput) {
  const actionType = input.action_type ?? "";
  assertActionType(actionType);
  const opportunityId = input.opportunity_id?.trim() || `opp_${randomUUID()}`;
  const sourceOpportunityIds = Array.isArray(input.source_opportunity_ids)
    ? input.source_opportunity_ids
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter((value) => value.length > 0 && !value.includes(","))
    : [opportunityId];

  return {
    opportunityId,
    actionType: actionType as ActionType,
    ownerLane: input.owner_lane?.trim() || actionType,
    decisionStatus: input.decision_status?.trim() || "proposed",
    reason: input.reason?.trim() || "",
    confidence: typeof input.confidence === "number" ? input.confidence : null,
    sourceOpportunityIds: sourceOpportunityIds.length > 0 ? sourceOpportunityIds : [opportunityId],
    parentIssueId: input.parent_issue_id?.trim() || null,
  };
}
