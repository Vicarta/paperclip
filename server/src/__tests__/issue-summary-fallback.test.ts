import { describe, expect, it } from "vitest";
import {
  buildIssueSummaryFallbackComment,
  isSystemIssueComment,
  sanitizeIssueSummaryText,
  shouldPostIssueSummaryFallback,
} from "../services/issue-summary-fallback.js";

describe("shouldPostIssueSummaryFallback", () => {
  it("returns true for generic issue-context runs", () => {
    expect(
      shouldPostIssueSummaryFallback({
        issueId: "issue-1",
        source: "issue.assigned",
      }),
    ).toBe(true);
  });

  it("returns false when issue context is missing", () => {
    expect(
      shouldPostIssueSummaryFallback({
        source: "timer",
      }),
    ).toBe(false);
  });
});

describe("sanitizeIssueSummaryText", () => {
  it("removes technical chatter", () => {
    expect(
      sanitizeIssueSummaryText(
        [
          "[paperclip] Loaded agent instructions file: /astrogen/agents/cmo/AGENTS.md",
          "stdout: /tmp/foo",
          "Updated the issue plan and created the next specialist handoff.",
        ].join("\n"),
      ),
    ).toBe("Updated the issue plan and created the next specialist handoff.");
  });
});

describe("isSystemIssueComment", () => {
  it("recognizes workspace-ready system comments", () => {
    expect(isSystemIssueComment("## Workspace Ready\n\n- CWD: `/tmp/project`")).toBe(true);
  });

  it("does not classify ordinary update comments as system comments", () => {
    expect(isSystemIssueComment("## Update\n\nPrepared the competitor summary.")).toBe(false);
  });
});

describe("buildIssueSummaryFallbackComment", () => {
  it("prefers explicit summary on success", () => {
    expect(
      buildIssueSummaryFallbackComment({
        status: "succeeded",
        summary: "Prepared the competitor map and documented the remaining evidence gaps.",
      }),
    ).toBe("Prepared the competitor map and documented the remaining evidence gaps.");
  });

  it("formats failure replies cleanly", () => {
    expect(
      buildIssueSummaryFallbackComment({
        status: "failed",
        errorMessage: "[paperclip] warning\nCould not access the upstream API with the current credentials.",
      }),
    ).toBe("I couldn't complete this request.\n\nCould not access the upstream API with the current credentials.");
  });

  it("returns null for cancelled runs", () => {
    expect(
      buildIssueSummaryFallbackComment({
        status: "cancelled",
        summary: "This should not be posted.",
      }),
    ).toBeNull();
  });
});
