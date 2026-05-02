import { describe, expect, it } from "vitest";
import { shouldFailSucceededIssueRunAsSilentNoop } from "../services/heartbeat.js";

describe("shouldFailSucceededIssueRunAsSilentNoop", () => {
  it("flags succeeded assignment runs that leave executable issues unchanged", () => {
    expect(
      shouldFailSucceededIssueRunAsSilentNoop({
        invocationSource: "assignment",
        outcome: "succeeded",
        hasIssueId: true,
        issueStatus: "todo",
        runCommentCount: 0,
      }),
    ).toBe(true);
  });

  it("does not flag timer runs or runs that produced comments", () => {
    expect(
      shouldFailSucceededIssueRunAsSilentNoop({
        invocationSource: "timer",
        outcome: "succeeded",
        hasIssueId: true,
        issueStatus: "todo",
        runCommentCount: 0,
      }),
    ).toBe(false);

    expect(
      shouldFailSucceededIssueRunAsSilentNoop({
        invocationSource: "assignment",
        outcome: "succeeded",
        hasIssueId: true,
        issueStatus: "todo",
        runCommentCount: 1,
      }),
    ).toBe(false);
  });

  it("does not flag completed, cancelled, or failed runs", () => {
    expect(
      shouldFailSucceededIssueRunAsSilentNoop({
        invocationSource: "assignment",
        outcome: "succeeded",
        hasIssueId: true,
        issueStatus: "done",
        runCommentCount: 0,
      }),
    ).toBe(false);

    expect(
      shouldFailSucceededIssueRunAsSilentNoop({
        invocationSource: "assignment",
        outcome: "failed",
        hasIssueId: true,
        issueStatus: "todo",
        runCommentCount: 0,
      }),
    ).toBe(false);
  });
});

