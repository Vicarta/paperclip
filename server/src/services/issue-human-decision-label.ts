export const HUMAN_DECISION_NEEDED_LABEL = "Human Decision Needed";

const HUMAN_DECISION_NEEDED_PATTERN = /\bHuman Decision Needed\b/i;

export function shouldAutoApplyHumanDecisionLabel(input: {
  actorAgentId?: string | null;
  body?: string | null;
}): boolean {
  if (!input.actorAgentId) return false;
  const body = input.body?.trim();
  if (!body) return false;
  return HUMAN_DECISION_NEEDED_PATTERN.test(body);
}
