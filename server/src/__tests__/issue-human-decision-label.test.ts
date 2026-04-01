import { describe, expect, it } from "vitest";
import { shouldAutoApplyHumanDecisionLabel } from "../services/issue-human-decision-label.js";

describe("shouldAutoApplyHumanDecisionLabel", () => {
  it("returns true for an agent-authored comment that explicitly names the label", () => {
    expect(
      shouldAutoApplyHumanDecisionLabel({
        actorAgentId: "agent-1",
        body: "Blocking clarification. Add the label Human Decision Needed and stop.",
      }),
    ).toBe(true);
  });

  it("returns false for user-authored comments", () => {
    expect(
      shouldAutoApplyHumanDecisionLabel({
        actorAgentId: null,
        body: "Please add Human Decision Needed.",
      }),
    ).toBe(false);
  });

  it("returns false when the explicit label phrase is absent", () => {
    expect(
      shouldAutoApplyHumanDecisionLabel({
        actorAgentId: "agent-1",
        body: "Blocking clarification required before continuing.",
      }),
    ).toBe(false);
  });
});
