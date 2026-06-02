import { describe, expect, it } from "vitest";
import {
  extractAssignmentRunFinalOutputText,
  shouldFailSucceededIssueRunAsSilentNoop,
} from "../services/heartbeat.js";

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

describe("extractAssignmentRunFinalOutputText", () => {
  it("prefers adapter summary over resultJson fields", () => {
    expect(
      extractAssignmentRunFinalOutputText({
        summary: "Final answer",
        resultJson: { summary: "Stored summary", result: "Stored result" },
      }),
    ).toBe("Final answer");
  });

  it("falls back to standard resultJson text fields", () => {
    expect(
      extractAssignmentRunFinalOutputText({
        summary: null,
        resultJson: { result: "Result text" },
      }),
    ).toBe("Result text");
  });

  it("ignores empty output", () => {
    expect(
      extractAssignmentRunFinalOutputText({
        summary: " ",
        resultJson: { summary: "", result: null },
      }),
    ).toBeNull();
  });
});
