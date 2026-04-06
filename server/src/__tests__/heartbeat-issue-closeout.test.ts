import { describe, expect, it } from "vitest";
import { resolveIssueCloseoutProtocolViolation } from "../services/heartbeat-issue-closeout.js";

describe("resolveIssueCloseoutProtocolViolation", () => {
  it("returns null when the run is not tied to an issue execution", () => {
    expect(
      resolveIssueCloseoutProtocolViolation({
        issueId: null,
        issueStatus: null,
        assigneeAgentId: null,
        runAgentId: "agent-1",
        lifecycleMutationCount: 0,
      }),
    ).toBeNull();
  });

  it("returns null when the run already performed an issue lifecycle mutation", () => {
    expect(
      resolveIssueCloseoutProtocolViolation({
        issueId: "issue-1",
        issueStatus: "done",
        assigneeAgentId: "agent-1",
        runAgentId: "agent-1",
        lifecycleMutationCount: 1,
      }),
    ).toBeNull();
  });

  it("returns null for issue runs not owned by the assignee agent", () => {
    expect(
      resolveIssueCloseoutProtocolViolation({
        issueId: "issue-1",
        issueStatus: "todo",
        assigneeAgentId: "agent-2",
        runAgentId: "agent-1",
        lifecycleMutationCount: 0,
      }),
    ).toBeNull();
  });

  it("returns null when the linked issue is already terminal", () => {
    expect(
      resolveIssueCloseoutProtocolViolation({
        issueId: "issue-1",
        issueStatus: "cancelled",
        assigneeAgentId: "agent-1",
        runAgentId: "agent-1",
        lifecycleMutationCount: 0,
      }),
    ).toBeNull();
  });

  it("flags a missing closeout when an assignee-owned issue run exits without issue.updated", () => {
    expect(
      resolveIssueCloseoutProtocolViolation({
        issueId: "issue-1",
        issueStatus: "in_progress",
        assigneeAgentId: "agent-1",
        runAgentId: "agent-1",
        lifecycleMutationCount: 0,
      }),
    ).toEqual({
      errorCode: "missing_issue_closeout",
      message: "Run completed without a final issue lifecycle mutation.",
    });
  });
});
