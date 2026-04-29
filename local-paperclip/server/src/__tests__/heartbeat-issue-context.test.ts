import { describe, expect, it } from "vitest";
import { buildHeartbeatPromptIssueMarkdown } from "../services/heartbeat-issue-context.js";

describe("buildHeartbeatPromptIssueMarkdown", () => {
  it("renders identifier metadata and description for issue-bound prompts", () => {
    const markdown = buildHeartbeatPromptIssueMarkdown({
      id: "issue-123",
      identifier: "AST-453",
      title: "Smoke: writer no queued follow-up after CLI wakeup",
      description: "Create or update the issue document with key plan in markdown.",
      status: "todo",
      priority: "high",
    });

    expect(markdown).toContain("## Current Issue");
    expect(markdown).toContain("- Identifier: AST-453");
    expect(markdown).toContain("- Title: Smoke: writer no queued follow-up after CLI wakeup");
    expect(markdown).toContain("- Status: todo");
    expect(markdown).toContain("- Priority: high");
    expect(markdown).toContain("### Issue Description");
    expect(markdown).toContain("Create or update the issue document with key plan in markdown.");
  });

  it("returns null when issue context is missing", () => {
    expect(buildHeartbeatPromptIssueMarkdown(null)).toBeNull();
  });
});
