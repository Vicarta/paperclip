import { describe, expect, it } from "vitest";
import { buildLinkedWorkTerminalWakeEvent } from "../services/issues.ts";

describe("linked work terminal wake event", () => {
  it("uses an allowed pipeline event type and preserves the specific audit kind", () => {
    expect(buildLinkedWorkTerminalWakeEvent({
      companyId: "company-1",
      caseId: "case-1",
      workIssueId: "issue-1",
      workIssueIdentifier: "AST-1",
      workIssueStatus: "done",
      automationIssueId: "automation-1",
    })).toEqual({
      companyId: "company-1",
      caseId: "case-1",
      type: "updated",
      actorType: "system",
      payload: {
        kind: "linked_work_terminal_wake_scheduled",
        workIssueId: "issue-1",
        workIssueIdentifier: "AST-1",
        workIssueStatus: "done",
        automationIssueId: "automation-1",
      },
    });
  });
});
